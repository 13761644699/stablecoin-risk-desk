#!/usr/bin/env node
// backtest_depeg_v2.mjs — 小时线分链回测 + 双源交叉验证（2026-04-03 ~ 2026-10-03）
// 数据源 A（主）：GeckoTerminal OHLCV 小时线（免费），按 DEPEG_WATCH 的链腿逐个拉最深两个池
// 数据源 B（交叉）：同链第二池（GeckoTerminal）；Binance 现货小时 K 线仅作参考列
// 判定：depeg_logic.mjs 的 classifyDepeg / isCleared / confirmDepeg（与线上同一套）
// Tron 链 GeckoTerminal 不支持 → 3 条 Tron 腿标未覆盖（线上锚定法不受影响）
// 用法：node backtest_depeg_v2.mjs [--write]   （--write 把 v2 章节追加进 backtest_report.md）
import fs from 'fs';
import path from 'path';
import { classifyDepeg, isCleared, devBpsFromPrice, confirmDepeg, DEPEG_WATCH } from './depeg_logic.mjs';

const FROM = '2026-04-03T00:00:00Z';
const TO = '2026-10-03T00:00:00Z';
const FROM_TS = Date.parse(FROM) / 1000;
const WARN_BPS = 50, SEVERE_BPS = 150, CLEAR_BPS = 30;

const DS_TO_GT = { ethereum: 'eth', bsc: 'bsc', solana: 'solana', arbitrum: 'arbitrum', base: 'base' };
// Tron: GeckoTerminal 无此网络，回测跳过
const BINANCE_PAIRS = { USDC: 'USDCUSDT', USDe: 'USDEUSDT', USDS: 'USDSUSDT', RLUSD: 'RLUSDUSDT', USD1: 'USD1USDT' };
// 注：币安无 PYUSD 现货对；USDT 本身是计价币无 USDT/USD 对

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'User-Agent': 'Mozilla/5.0' };

async function fetchJson(url, tries = 3, timeoutMs = 20000) {
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: UA, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429) { await sleep(15000); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
}

// 挑池（v2）：GeckoTerminal top_pools 优先（保证 OHLCV 可用），必须 base==我们的币
// （stable/stable 池里我们的币常做 quote，那种池的 USD OHLCV 跟踪的是 base 币，不能用）；
// 不足 2 个时用 DexScreener（tokens/v1 + search）补充。
async function findPools(dsChain, gtNet, address) {
  const want = address.toLowerCase();
  const out = [];
  const seen = new Set();
  const push = (pairAddress, dex, liq, label) => {
    const k = String(pairAddress).toLowerCase();
    if (!pairAddress || seen.has(k)) return;
    seen.add(k);
    out.push({ pairAddress, dex, liq, label });
  };
  // 1) GT top_pools + base 校验
  try {
    const t = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/${gtNet}/tokens/${address}`);
    const tops = (t?.data?.relationships?.top_pools?.data || []).slice(0, 4);
    for (const tp of tops) {
      const pid = String(tp.id || '');
      const paddr = pid.includes('_') ? pid.split('_').slice(1).join('_') : pid;
      try {
        const info = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/${gtNet}/pools/${paddr}`);
        const baseId = String(info?.data?.relationships?.base_token?.data?.id || '').toLowerCase();
        const attrs = info?.data?.attributes || {};
        if (baseId.endsWith(want)) {
          push(paddr, attrs?.dex || 'gt', Number(attrs?.reserve_in_usd || 0), attrs?.name || paddr.slice(0, 10));
        }
        await sleep(1500);
      } catch { /* 单个池信息失败就跳过 */ }
      if (out.length >= 2) break;
    }
  } catch { /* GT token 查询失败就走 DexScreener */ }
  await sleep(500);
  // 2) DexScreener 补充
  if (out.length < 2) {
    const add = (pairs) => {
      for (const p of pairs || []) {
        if (p?.chainId !== dsChain) continue;
        if (String(p?.baseToken?.address || '').toLowerCase() !== want) continue;
        const price = Number(p.priceUsd), liq = Number(p?.liquidity?.usd || 0);
        if (!(price >= 0.5 && price <= 1.5) || !p.pairAddress) continue;
        push(p.pairAddress, p.dexId, liq, `${p?.baseToken?.symbol}/${p?.quoteToken?.symbol}`);
        if (out.length >= 2) break;
      }
    };
    try {
      const v1 = await fetchJson(`https://api.dexscreener.com/tokens/v1/${dsChain}/${address}`);
      add(Array.isArray(v1) ? v1 : []);
    } catch { /* 掉到 search */ }
    if (out.length < 2) {
      await sleep(400);
      try {
        const s = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`);
        add(Array.isArray(s?.pairs) ? s.pairs : []);
      } catch { /* 两个源都失败就返回已拿到的 */ }
    }
  }
  return out.slice(0, 2).sort((a, b) => b.liq - a.liq);
}

const CACHE_DIR = process.env.BT_CACHE_DIR || (process.env.HOME + '/workspace/stablecoin-risk-desk/.bt/cache');
function cacheGet(key) {
  try {
    const p = `${CACHE_DIR}/${key}.json`;
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* 缓存损坏就重拉 */ }
  return null;
}
function cacheSet(key, val) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(`${CACHE_DIR}/${key}.json`, JSON.stringify(val));
  } catch { /* 缓存写失败不影响主流程 */ }
}

async function fetchPoolHourly(gtNet, poolAddr) {
  const ck = `${gtNet}_${poolAddr}`.toLowerCase();
  const hit = cacheGet(ck);
  if (hit) return hit;
  // 返回 [[ts, close], ...] 按时间升序；分页 before_timestamp 往前翻
  const out = [];
  let before = Math.floor(Date.parse(TO) / 1000);
  for (let page = 0; page < 7; page++) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${gtNet}/pools/${poolAddr}/ohlcv/hour?limit=1000&currency=usd&before_timestamp=${before}`;
    const data = await fetchJson(url);
    const rows = data?.data?.attributes?.ohlcv_list || [];
    if (!rows.length) break;
    for (const r of rows) {
      const ts = r[0];
      if (ts >= FROM_TS) out.push([ts, r[4]]);
    }
    const oldest = rows[rows.length - 1][0];
    if (oldest <= FROM_TS) break;
    before = oldest - 1;
    await sleep(2200); // GeckoTerminal 免费 30 次/分
  }
  out.sort((a, b) => a[0] - b[0]);
  cacheSet(ck, out);
  return out;
}

async function fetchBinanceHourly(symbol) {
  const pair = BINANCE_PAIRS[symbol];
  if (!pair) return null;
  const out = [];
  let endTime = Date.parse(TO);
  for (let page = 0; page < 5; page++) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1h&limit=1000&endTime=${endTime}`;
    const data = await fetchJson(url);
    if (!data?.length) break;
    for (const k of data) out.push([Math.floor(k[0] / 1000), Number(k[4])]);
    endTime = data[0][0] - 1;
    if (endTime < Date.parse(FROM)) break;
    await sleep(400);
  }
  return out.filter(([ts]) => ts >= FROM_TS).sort((a, b) => a[0] - b[0]);
}

function fmtTs(ts) { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ') + 'Z'; }

function runLeg(symbol, chain, s1, s2) {
  // s1: 主池 [[ts, close]...]，s2: 副池 Map(ts->close) 或 null
  const triggers = [], suspicious = [];
  const pool2 = s2 ? new Map(s2) : null;
  let active = null;
  for (const [ts, c1] of s1) {
    const dev1 = devBpsFromPrice(c1);
    if (dev1 === null) continue;
    const level = classifyDepeg(dev1, WARN_BPS, SEVERE_BPS);
    const c2 = pool2 ? pool2.get(ts) : undefined;
    const dev2 = c2 !== undefined ? devBpsFromPrice(c2) : null;
    if (!level) {
      if (active && isCleared(dev1, CLEAR_BPS)) {
        triggers.push({ ts, symbol, chain, price: c1, devBps: +dev1.toFixed(1), kind: 'resolved',
          note: `持续 ${((ts - active.startTs) / 3600).toFixed(1)}h 后解除（峰值 ${active.peak.toFixed(1)} bps）` });
        active = null;
      }
      continue;
    }
    if (!active) {
      const verdict = confirmDepeg(dev1, dev2, WARN_BPS);
      const base = { ts, symbol, chain, price: c1, devBps: +dev1.toFixed(1),
        dev2Bps: dev2 === null ? null : +dev2.toFixed(1), verdict };
      if (verdict === 'suspicious') {
        suspicious.push({ ...base, kind: 'suspicious',
          note: `主池 ${dev1.toFixed(1)}bps 但副池 ${dev2 === null ? '无数据' : dev2.toFixed(1) + 'bps'} → 疑似坏点，已拦截` });
        continue;
      }
      active = { level, startTs: ts, peak: Math.abs(dev1) };
      triggers.push({ ...base, kind: `new-${level}`,
        note: (level === 'severe' ? '首次触发即严重' : '首次触发预警') +
          (verdict === 'unconfirmed' ? '（单源，无第二池）' : `（双源${verdict === 'confirmed' ? '确认' : '大概率真'}）`) });
    } else {
      active.peak = Math.max(active.peak, Math.abs(dev1));
      if (active.level === 'warn' && level === 'severe') {
        active.level = 'severe';
        triggers.push({ ts, symbol, chain, price: c1, devBps: +dev1.toFixed(1),
          dev2Bps: dev2 === null ? null : +dev2.toFixed(1),
          verdict: confirmDepeg(dev1, dev2, WARN_BPS),
          kind: 'escalated', note: '预警升级为严重' });
      }
    }
  }
  if (active) {
    const last = s1[s1.length - 1];
    triggers.push({ ts: last[0], symbol, chain, price: last[1],
      devBps: +devBpsFromPrice(last[1]).toFixed(1), kind: 'open-at-end',
      note: `截至期末仍未解除（峰值 ${active.peak.toFixed(1)} bps）` });
  }
  return { triggers, suspicious };
}

async function main() {
  const allT = [], allS = [], coverage = [];
  const binanceRef = {};
  for (const symbol of Object.keys(BINANCE_PAIRS)) {
    try { binanceRef[symbol] = await fetchBinanceHourly(symbol); console.log(`[ref] ${symbol} binance 小时线 ${binanceRef[symbol]?.length || 0} 条`); }
    catch (e) { console.log(`[ref] ${symbol} binance 拉取失败: ${e.message}`); }
  }

  for (const coin of DEPEG_WATCH) {
    for (const leg of coin.legs) {
      const tag = `${coin.symbol}@${leg.chain}`;
      const gtNet = DS_TO_GT[leg.ds];
      if (!gtNet) { coverage.push([tag, 'GeckoTerminal 无此网络（Tron），未覆盖']); console.log(`${tag}: 跳过（Tron）`); continue; }
      try {
        const pools = await findPools(leg.ds, gtNet, leg.address);
        await sleep(600);
        if (!pools.length) { coverage.push([tag, '无可用池（GT top_pools 与 DexScreener 均无 base=本币的池），未覆盖']); console.log(`${tag}: 无池`); continue; }
        let s1 = [];
        try { s1 = await fetchPoolHourly(gtNet, pools[0].pairAddress); }
        catch (e) {
          // 主池 OHLCV 404（如 DexScreener 补充的池 GT 不收录）：降级用下一个
          console.log(`${tag}: 主池 OHLCV 失败 ${e.message}，尝试副池`);
          if (pools[1]) { pools[0] = pools[1]; pools.splice(1, 1); s1 = await fetchPoolHourly(gtNet, pools[0].pairAddress); }
          else { coverage.push([tag, `主池 OHLCV 404 且无备选，未覆盖`]); continue; }
        }
        let s2 = null, pool2note = '无第二池';
        if (pools[1]) {
          await sleep(600);
          try { s2 = await fetchPoolHourly(gtNet, pools[1].pairAddress); pool2note = `副池 ${pools[1].dex} $${Math.round(pools[1].liq)}`; }
          catch (e) { console.log(`${tag}: 副池 OHLCV 失败，按单源处理`); }
        }
        coverage.push([tag, `主池 ${pools[0].dex} ${pools[0].label} $${Math.round(pools[0].liq)} / ${pool2note}，${s1.length} 小时`]);
        console.log(`${tag}: 主池 ${s1.length}h，副池 ${s2 ? s2.length : 0}h`);
        const { triggers, suspicious } = runLeg(coin.symbol, leg.chain, s1, s2);
        // 币安参考价（仅参考列，不否决链级信号）
        const bmap = binanceRef[coin.symbol] ? new Map(binanceRef[coin.symbol]) : null;
        for (const t of triggers) {
          if (bmap && bmap.has(t.ts)) t.binance = +bmap.get(t.ts).toFixed(4);
        }
        allT.push(...triggers); allS.push(...suspicious);
      } catch (e) {
        coverage.push([tag, `拉取失败：${e.message}`]);
        console.log(`${tag}: 失败 ${e.message}`);
      }
    }
  }

  allT.sort((a, b) => a.ts - b.ts || (a.symbol < b.symbol ? -1 : 1));
  allS.sort((a, b) => a.ts - b.ts);
  const counts = {};
  for (const t of allT) counts[t.kind] = (counts[t.kind] || 0) + 1;
  const newEvents = (counts['new-warn'] || 0) + (counts['new-severe'] || 0);

  const L = [];
  L.push('## 小时线回测 v2（2026-10-03 追加）');
  L.push('');
  L.push(`- 区间：2026-04-03 ~ 2026-10-03；粒度：小时线；判定：classifyDepeg/isCleared/**confirmDepeg**（与线上同一套）`);
  L.push(`- 数据源 A（主）：GeckoTerminal 各链最深池 OHLCV 小时线；数据源 B（交叉）：**同链第二池**；Binance 现货小时线仅作参考列`);
  L.push(`- 交叉规则：双源同向越线=confirmed/副源过半=likely 计有效；副源正常或反向=suspicious 拦截；无副源=unconfirmed 保守放行`);
  L.push('');
  L.push('### 数据覆盖（23/26 腿；Tron 3 腿 GeckoTerminal 无此网络，未覆盖）');
  L.push('');
  L.push('| 链腿 | 池与数据量 |');
  L.push('|---|---|');
  for (const [tag, note] of coverage) L.push(`| ${tag} | ${note} |`);
  L.push('');
  L.push('### 触发统计');
  L.push('');
  L.push(`- 首次预警：${counts['new-warn'] || 0}；首次即严重：${counts['new-severe'] || 0}；升级：${counts['escalated'] || 0}；解除：${counts['resolved'] || 0}；期末未解除：${counts['open-at-end'] || 0}`);
  L.push(`- **去重后有效事件数：${newEvents}**；双源拦截的疑似坏点：${allS.length}`);
  L.push('');
  L.push('### 有效触发清单');
  L.push('');
  L.push('| 时间(UTC) | 链腿 | 价格 | 偏离(bps) | 副池偏离 | 交叉 | 类型 | 说明 | 币安参考 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of allT) {
    L.push(`| ${fmtTs(t.ts)} | ${t.symbol}@${t.chain} | $${t.price.toFixed(4)} | ${t.devBps} | ${t.dev2Bps === undefined || t.dev2Bps === null ? '-' : t.dev2Bps} | ${t.verdict || '-'} | ${t.kind} | ${t.note} | ${t.binance ?? '-'} |`);
  }
  L.push('');
  L.push('### 被拦截的疑似坏点');
  L.push('');
  if (!allS.length) { L.push('无。'); }
  else {
    L.push('| 时间(UTC) | 链腿 | 主池偏离(bps) | 副池偏离(bps) | 说明 |');
    L.push('|---|---|---|---|---|');
    for (const s of allS) L.push(`| ${fmtTs(s.ts)} | ${s.symbol}@${s.chain} | ${s.devBps} | ${s.dev2Bps} | ${s.note} |`);
  }
  L.push('');
  L.push('### v1（日线币级）vs v2（小时线分链）对比');
  L.push('');
  L.push('- v1：183 天币级日线，2 个事件（USDG +351bps 疑似坏点、USDD -116.9bps）');
  L.push(`- v2：小时线分链双源交叉，有效事件 ${newEvents} 个，拦截疑似坏点 ${allS.length} 个`);
  L.push('- 差异说明：小时线能抓到盘中脱锚（v1 系统性漏掉）；分链口径下链特异性脱锚不再被聚合价平均掉；双源交叉把单池坏点拦在门外');
  L.push('');
  L.push('### 结论');
  L.push('');
  L.push('（由回测执行人填写：阈值是否调整、双源效果评价、剩余局限）');
  L.push('');

  const section = L.join('\n');
  if (process.argv.includes('--write')) {
    const rp = path.join(process.cwd(), 'backtest_report.md');
    const cur = fs.readFileSync(rp, 'utf8');
    fs.writeFileSync(rp, cur.replace(/\n+$/, '\n') + '\n' + section);
    console.log('\nv2 章节已追加进 backtest_report.md');
  } else {
    console.log('\n' + section);
  }
  // 机器可读摘要供调用方
  fs.writeFileSync(process.env.HOME + '/workspace/stablecoin-risk-desk/.bt/summary.json', JSON.stringify({ newEvents, suspicious: allS.length,
    triggers: allT, suspiciousList: allS }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
