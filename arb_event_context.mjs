// arb_event_context.mjs — 研判上下文包：给定队列条目 id，打印一份 JSON，
// 汇总该事件的当刻实测数据（研判 agent 的第一手材料，免得各自重复拉数）。
//   node arb_event_context.mjs <entry-id>
// 数据源：arb_lib（Chainlink/币安中间价/Uniswap 白名单池/Aave 储备与账户）、
// 脱锚台 API（127.0.0.1:8787）、本地状态文件与 arb_addresses.sqlite。
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { STATE_DIR, readQueue, chainlinkPrice, FEEDS, binanceMid, v3PoolState, TOKENS,
  aaveReserveState, aaveAccountData } from './arb_lib.mjs';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const id = process.argv[2];
if (!id) { console.error('用法：node arb_event_context.mjs <entry-id>'); process.exit(2); }
const entry = readQueue().find(e => e.id === id);
const out = { queriedAt: new Date().toISOString(), entry: entry || null, note: entry ? '' : '条目不在队列（可能已被兜底清除），以下按 id 前缀尽力组装上下文' };
const type = entry?.type || id.split(':')[0];
const key = entry?.key || id.split(':').slice(1).join(':');
const safe = async (fn) => { try { return await fn(); } catch (e) { return { error: String(e).slice(0, 120) }; } };
const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

if (type === 'spread' || type === 'arb_addr') {
  const sym = type === 'spread' ? key : null;
  const [clEth, clBtc, bnEth, bnBtc] = await Promise.all([
    safe(() => chainlinkPrice(FEEDS['ETH/USD'])), safe(() => chainlinkPrice(FEEDS['BTC/USD'])),
    safe(() => binanceMid('ETHUSDT')), safe(() => binanceMid('BTCUSDT')),
  ]);
  out.prices = { chainlinkEth: clEth, chainlinkBtc: clBtc, binanceEthMid: bnEth, binanceBtcMid: bnBtc };
  const ethPool = await safe(() => v3PoolState('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', TOKENS.WETH.address, 18, USDC, 6));
  if (ethPool && !ethPool.error) out.dexEthUsdcPool = { price: ethPool.priceBaseInQuote, balWeth: ethPool.balBase, balUsdc: ethPool.balQuote };
  for (const t of ['WETH', 'WBTC']) {
    out[`aave_${t}`] = await safe(async () => {
      const r = await aaveReserveState(TOKENS[t].address);
      return { frozen: r.frozen, paused: r.paused, borrowingEnabled: r.borrowingEnabled, availableLiquidityRaw: r.availableLiquidity, availableLiquidityHuman: r.availableLiquidity / 10 ** TOKENS[t].decimals };
    });
  }
  if (sym === 'WBTC') {
    const p = await safe(() => v3PoolState('0x4585fe77225b41b697c938b018e2ac67ac5a20c0', TOKENS.WBTC.address, 8, TOKENS.WETH.address, 18));
    if (p && !p.error) out.dexWbtcWethPool = { priceWethPerWbtc: p.priceBaseInQuote, balWbtc: p.balBase, balWeth: p.balQuote };
  }
}

if (type === 'arb_addr') {
  const addr = (entry?.payload?.address || key || '').toLowerCase();
  try {
    const db = new DatabaseSync(path.join(STATE_DIR, 'arb_addresses.sqlite'));
    out.addressRow = db.prepare(`SELECT * FROM addresses WHERE address = ?`).get(addr) || null;
    out.recentEvents = db.prepare(`SELECT event_type, asset, amount, amount_usd, block_number, tx_hash, event_time FROM events WHERE address = ? ORDER BY id DESC LIMIT 25`).all(addr);
    db.close();
  } catch (e) { out.addressDbError = String(e).slice(0, 120); }
  out.aaveAccount = await safe(() => aaveAccountData(addr));
}

if (type === 'depeg' || type === 'cex_dip') {
  out.desk = await safe(async () => {
    const r = await fetch('http://127.0.0.1:8787/api/depeg-monitor', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return { state: j.state, thresholds: j.thresholds, active: (j.active || []).filter(e => `${e.symbol}:${e.chain}` === key || e.key === key) };
  });
  if (type === 'cex_dip') {
    const evs = loadJson(path.join(STATE_DIR, 'cex_dip_events.json'), { events: {} });
    out.cexDipEvent = (evs.events || {})[key] || null;
    const bands = loadJson(path.join(STATE_DIR, 'cex_dip_bands.json'), { combos: {} });
    out.cexDipBand = (bands.combos || {})[key] || null;
  }
  // 独立 USD 锚参考（校准规则 F1，2026-10-30 昨晚复盘）：标的与计价币（USDT/USDC）
  // 在 Kraken 的 USD 中间价——非同对、非同计价币，供研判把交叉对偏离分解为
  // 「标的自身偏离」与「计价币偏离」，避免 USDC/USDS 式交叉对幻影重演。
  // 报价纪律：用买卖中间价，不用最新成交价。
  const sym = entry?.payload?.symbol || String(key).split(/[:@]/)[0];
  out.usdAnchorRef = await safe(async () => {
    const want = new Set([`${sym}USD`, 'USDTUSD', 'USDCUSD']);
    const ap = await (await fetch('https://api.kraken.com/0/public/AssetPairs', { signal: AbortSignal.timeout(8000) })).json();
    const byAlt = {};
    for (const [k, v] of Object.entries(ap.result || {})) {
      if (want.has(v.altname) && !String(v.altname).includes('.')) byAlt[v.altname] = k;
    }
    const keys = Object.values(byAlt);
    if (!keys.length) return {};
    const tk = await (await fetch(`https://api.kraken.com/0/public/Ticker?pair=${keys.join(',')}`, { signal: AbortSignal.timeout(8000) })).json();
    const refs = {};
    for (const [alt, k] of Object.entries(byAlt)) {
      const t = tk.result?.[k];
      const bid = Number(t?.b?.[0]), ask = Number(t?.a?.[0]);
      if (bid > 0 && ask > 0) refs[alt] = (bid + ask) / 2;
    }
    return refs;
  });
  const [clEth] = await Promise.all([safe(() => chainlinkPrice(FEEDS['ETH/USD']))]);
  out.chainlinkEth = clEth;
}

console.log(JSON.stringify(out, null, 1));
