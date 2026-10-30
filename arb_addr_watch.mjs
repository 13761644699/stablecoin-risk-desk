// arb_addr_watch.mjs — 元套利地址行为跟踪（套利体系整合块4）
//
// 跟踪对象：state/arb_addresses.sqlite 中 status='watching' 的地址（一线 53 个事件
// 套利仓位地址 + 二线 5 个发起方；黑客 tier=0/excluded 不跟踪）。
// 方法：随 sweep 循环每约 5 分钟增量拉 Aave V3 Pool 的 Supply/Borrow/Repay/
// Withdraw/LiquidationCall 五类事件（区块游标增量，一次 getLogs 覆盖全部地址，
// 与地址数无关），本地按地址集合过滤。全部命中事件写入库 events 表（小额也记，
// 只记不推）；研判门槛：同一地址 30 分钟内借入 ETH/WBTC 合计 >$50 万，或任一
// 被清算事件 → 入深化队列（state/arb_event_queue.jsonl），由 hook 唤起研判后
// 推送策略/路径，本脚本不直推机会警报（2026-10-30 推送时序定稿）。
// 严重度：入队时若市场正处脱节（价差监控有活跃事件或脱锚台有 severe 活跃事件），
// 标 severe（夜间也唤起研判）；否则标 event（静默时段顺延）。
//
// 环境变量：
//   ARB_NO_PUSH=1        队列写 dryrun 文件（测试）
//   ARB_ADDR_FROM/TO     覆盖区块范围（回放测试用，配合 ARB_ADDR_CURSOR_FILE）
//   ARB_ADDR_CURSOR_FILE 游标文件路径覆盖
//   ARB_ADDR_MAX_BLOCKS  单轮最大推进区块数（默认 2000，防停机后一次拉爆）
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { STATE_DIR, rpc, hexN, getLogs, keccak256, logAddr, wordUint, splitData,
  RESERVE_BY_ADDR, TOKENS, chainlinkPrice, FEEDS, enqueueArbEvent } from './arb_lib.mjs';

const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const DB_FILE = path.join(STATE_DIR, 'arb_addresses.sqlite');
const CURSOR_FILE = process.env.ARB_ADDR_CURSOR_FILE || path.join(STATE_DIR, 'arb_addr_cursor.json');
const ADDR_STATE_FILE = path.join(STATE_DIR, 'arb_addr_state.json');
const BORROW_TRIGGER_USD = 500_000;
const MAX_BLOCKS = Number(process.env.ARB_ADDR_MAX_BLOCKS || 2000);

const EVENTS = [
  { type: 'Supply', topic: '0x' + keccak256('Supply(address,address,address,uint256,uint16)'), who: (l) => logAddr(l.topics[2]), amtWord: 1 },
  { type: 'Borrow', topic: '0x' + keccak256('Borrow(address,address,address,uint256,uint8,uint256,uint16)'), who: (l) => logAddr(l.topics[2]), amtWord: 1 },
  { type: 'Repay', topic: '0x' + keccak256('Repay(address,address,address,uint256,bool)'), who: (l) => logAddr(l.topics[2]), amtWord: 0 },
  { type: 'Withdraw', topic: '0x' + keccak256('Withdraw(address,address,address,uint256)'), who: (l) => logAddr(l.topics[2]), amtWord: 0 },
  { type: 'LiquidationCall', topic: '0x' + keccak256('LiquidationCall(address,address,address,uint256,uint256,address,bool)'), who: (l) => logAddr(l.topics[3]), amtWord: 0, assetTopic: 2 },
];

function loadJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
function saveJson(f, o) { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); }

async function blockTs(n) {
  const b = await rpc('eth_getBlockByNumber', [hexN(n), false]);
  return parseInt(b.timestamp, 16);
}

function marketDislocated() {
  const spread = loadJson(path.join(STATE_DIR, 'arb_spread_state.json'), {});
  if (Object.values(spread).some(s => s && s.active)) return true;
  const depeg = loadJson(path.join(STATE_DIR, 'depeg_events.json'), { events: {} });
  return Object.values(depeg.events || {}).some(e => e.status === 'active' && e.level === 'severe');
}

async function main() {
  const db = new DatabaseSync(DB_FILE);
  const watched = db.prepare(`SELECT address, tier, label FROM addresses WHERE status='watching'`).all();
  const watchSet = new Map(watched.map(r => [r.address.toLowerCase(), r]));
  console.log(`[arb-addr] 跟踪地址 ${watchSet.size} 个（一线 ${watched.filter(r => r.tier === 1).length} / 二线 ${watched.filter(r => r.tier === 2).length}）`);

  const head = parseInt(await rpc('eth_blockNumber', []), 16);
  const cursor = loadJson(CURSOR_FILE, null);
  let from, to;
  if (process.env.ARB_ADDR_FROM) {
    from = Number(process.env.ARB_ADDR_FROM);
    to = process.env.ARB_ADDR_TO ? Number(process.env.ARB_ADDR_TO) : head - 2;
  } else if (!cursor) {
    // 首次运行：游标定在链头附近，不回放历史（种子事件已在库里有摘要）
    saveJson(CURSOR_FILE, { block: head - 2, updatedAt: new Date().toISOString() });
    console.log(`[arb-addr] 首次运行，游标初始化于区块 ${head - 2}，本轮不拉取`);
    db.close();
    return;
  } else {
    from = cursor.block + 1;
    to = Math.min(head - 2, from + MAX_BLOCKS - 1);
  }
  if (to < from) { console.log('[arb-addr] 无新区块'); db.close(); return; }
  console.log(`[arb-addr] 增量拉取区块 ${from} → ${to}（链头 ${head}）`);

  const [ethPx, btcPx] = await Promise.all([
    chainlinkPrice(FEEDS['ETH/USD']).then(r => r.price).catch(() => null),
    chainlinkPrice(FEEDS['BTC/USD']).then(r => r.price).catch(() => null),
  ]);
  const usdOf = (sym, amt) => sym === 'WETH' ? (ethPx ? amt * ethPx : null)
    : sym === 'WBTC' ? (btcPx ? amt * btcPx : null)
    : (sym === 'USDT' || sym === 'USDC') ? amt : null;

  // 事件时间用区间两端区块时间戳线性插值（ETH 槽位 12 秒极稳，误差秒级），
  // 避免逐块 eth_getBlockByNumber 的上百次 RPC。
  const tsFrom = await blockTs(from);
  const tsTo = to > from ? await blockTs(to) : tsFrom;
  const tsOfBlock = (b) => to > from ? Math.round(tsFrom + (b - from) * (tsTo - tsFrom) / (to - from)) : tsFrom;
  const matched = [];
  const insEvent = db.prepare(`INSERT INTO events (address, chain, protocol, event_type, asset, amount, amount_usd, block_number, tx_hash, event_time, processed, created_at)
    VALUES (?, 'ethereum', 'aave-v3', ?, ?, ?, ?, ?, ?, ?, 0, ?)`);
  const updAddr = db.prepare(`UPDATE addresses SET last_active_at = ?, last_active_block = ? WHERE address = ?`);
  const nowIso = new Date().toISOString();

  for (const ev of EVENTS) {
    const logs = await getLogs(POOL, [ev.topic], from, to);
    for (const l of logs) {
      const who = ev.who(l);
      if (!watchSet.has(who)) continue;
      const reserveAddr = logAddr(l.topics[ev.assetTopic ?? 1]);
      const reserve = RESERVE_BY_ADDR[reserveAddr];
      const sym = reserve ? reserve.symbol : `OTHER:${reserveAddr.slice(0, 10)}`;
      const dec = reserve ? reserve.decimals : 18;
      const w = splitData(l.data);
      const amount = Number(wordUint(w[ev.amtWord])) / 10 ** dec;
      const block = parseInt(l.blockNumber, 16);
      const timeIso = new Date(tsOfBlock(block) * 1000).toISOString();
      const usd = usdOf(sym, amount);
      insEvent.run(who, ev.type, sym, amount, usd, block, l.transactionHash, timeIso, nowIso);
      updAddr.run(timeIso, block, who);
      matched.push({ address: who, type: ev.type, asset: sym, amount, usd, block, time: timeIso, tx: l.transactionHash });
    }
  }
  console.log(`[arb-addr] 命中事件 ${matched.length} 条，已写入库`);

  // ---- 研判门槛：30 分钟滚动借入（ETH/WBTC）>$50 万，或被清算 ----
  // 窗口锚点 = 本轮命中的最新事件时间（生产中≈当下；回放测试中=历史时点），不用墙钟，
  // 否则回放的历史事件永远落不进窗口。
  const addrState = loadJson(ADDR_STATE_FILE, { lastEnqueue: {} });
  const anchorIso = matched.length ? matched.map(m => m.time).sort().at(-1) : null;
  const sinceIso = anchorIso ? new Date(Date.parse(anchorIso) - 30 * 60000).toISOString() : null;
  const rows = sinceIso ? db.prepare(`SELECT address, SUM(amount_usd) AS total, COUNT(*) AS n FROM events
    WHERE event_type='Borrow' AND asset IN ('WETH','WBTC') AND amount_usd IS NOT NULL AND event_time >= ? AND event_time <= ?
    GROUP BY address HAVING total > ?`).all(sinceIso, anchorIso, BORROW_TRIGGER_USD) : [];
  const liqAddrs = [...new Set(matched.filter(m => m.type === 'LiquidationCall').map(m => m.address))];
  const dislocated = marketDislocated();
  const candidates = new Map();
  for (const r of rows) candidates.set(r.address, { borrowUsd30m: r.total, borrowCount30m: r.n, liquidation: liqAddrs.includes(r.address) });
  for (const a of liqAddrs) if (!candidates.has(a)) candidates.set(a, { borrowUsd30m: 0, borrowCount30m: 0, liquidation: true });

  for (const [addr, agg] of candidates) {
    const last = addrState.lastEnqueue[addr] ? Date.parse(addrState.lastEnqueue[addr]) : 0;
    if (Date.now() - last < 30 * 60000) { console.log(`[arb-addr] ${addr} 30 分钟内已入队，去重跳过`); continue; }
    const meta = watchSet.get(addr);
    const recent = db.prepare(`SELECT event_type, asset, amount, amount_usd, event_time, tx_hash FROM events WHERE address = ? ORDER BY id DESC LIMIT 12`).all(addr).reverse();
    const seedRow = db.prepare(`SELECT event_summary, event_borrowed_eth, pnl_est_usd FROM addresses WHERE address = ?`).get(addr);
    const recentLines = recent.map(e => `- ${e.event_time} ${e.event_type} ${e.asset} ${Number(e.amount).toFixed(4)}${e.amount_usd ? `（≈$${Math.round(e.amount_usd).toLocaleString()}）` : ''} tx ${String(e.tx_hash).slice(0, 14)}…`).join('\n');
    const factsText = [
      `元套利地址异动：${addr}（${meta?.label || ''}，tier ${meta?.tier}）`,
      ``,
      agg.liquidation ? `- ⚠️ 该地址出现被清算事件（见最近事件）` : null,
      agg.borrowUsd30m > 0 ? `- 近 30 分钟借入 ETH/WBTC ${agg.borrowCount30m} 笔，合计 ≈$${Math.round(agg.borrowUsd30m).toLocaleString()}（门槛 $50 万）` : null,
      `- 市场背景：${dislocated ? '当前存在活跃价差/严重脱锚事件（脱节环境，异动更可能与套利窗口相关）' : '当前无活跃价差/严重脱锚事件'}`,
      `- 种子档案：${seedRow?.event_summary || '—'}`,
      ``,
      `最近事件（旧→新）：`,
      recentLines,
      ``,
      `- 下一步：深化研判将还原其完整链路（抵押→借出→卖出→回补）、核当下价差与可跟空间，给出策略与风险`,
    ].filter(Boolean).join('\n');
    const r = enqueueArbEvent({
      type: 'arb_addr', key: addr, severity: dislocated ? 'severe' : 'event',
      payload: { address: addr, tier: meta?.tier, label: meta?.label, borrowUsd30m: Math.round(agg.borrowUsd30m), borrowCount30m: agg.borrowCount30m, liquidation: agg.liquidation, dislocated },
      factsText,
    });
    addrState.lastEnqueue[addr] = nowIso;
    console.log(`[arb-addr] ${addr} 已入队深化（30m 借入 $${Math.round(agg.borrowUsd30m).toLocaleString()}${agg.liquidation ? ' + 清算' : ''}，severity=${dislocated ? 'severe' : 'event'}，merged=${r.merged}）`);
  }
  saveJson(ADDR_STATE_FILE, addrState);
  saveJson(CURSOR_FILE, { block: to, updatedAt: nowIso });
  console.log(`[arb-addr] 游标推进至 ${to}`);
  db.close();
}

main().catch(e => { console.error('[arb-addr] 运行失败：', String(e).slice(0, 300)); process.exit(1); });
