#!/usr/bin/env node
// arb_cex_cross_watch.mjs — 跨所现货价差盯盘（2026-10-30 上线；同日晚间按用户
// 拍板重改判定逻辑 v2）
// 职责：TRX/ETH 在 Binance/Gate/OKX/Bitget 的 USDT 现货价 + TRX 的链上
// SunSwap 主池价，逐对评估跨所价差（不再只取最低↔最高一对）。
// 场所 universe（2026-10-30 晚用户定稿八家）：币安、Bitget、Gate、
// OKX、Bybit、Kraken、Backpack、Hyperliquid（均为用户实际有账户的
// 所/平台）+ 链上；
// KuCoin 用户点名剔除、HTX 无账户不纳入——无账户的所价差再大也
// 不可执行，不进射程。可达性如实标注 degraded、绝不硬凑数据：
// Bybit 本机 403 整站不可达（2026-10-28 已知、今回复核仍 403）；
// Backpack 的 TRX_USDC 盘口为幽灵盘（卖盘仅一档远离市价），ETH 可用；
// Kraken 的 TRX 只有 USD 对，用其自家 USDT/USD 换算成 USDT 口径。
// Hyperliquid 形态特殊：TRX/ETH 均无现货（实测 spot 511 个代币无
// TRX/ETH 对，UETH 为 Unit 封装代币、不作 ETH 现货），只接永续 mark
// 价作参考（附较现货中位的基差），不计入现货逐对、不混算；每轮顺带
// 核 spot 名单，若某资产现货对出现会日志告警待升级为现货腿。HL 充提
// 走 Arbitrum 桥、无公开状态接口，状态人工标记（现 unknown）。
//
// v2 判定逻辑（2026-10-30 TRX 事件复盘教训：旧版只取币安→KuCoin 一对，
// 研判按 F7 把整事件以「冻结折价」否掉，漏掉不含冻结腿的可做对——
// KuCoin-Gate 全天 >100bps 共 679 分钟、OKX 充提开约一小时的窗口对）：
// 1. 逐对评估：所有场所对（四所两两 + TRX 各所 vs SunSwap）逐对算中间
//    价差与 $10k 盘口模拟可成交价差，逐对过门；同资产多对触发合并为
//    一次入队（id=spread:{SYM}@CEXX），研判正文按对列可执行性。
// 2. 充提状态进判定（场所 × 资产 × 充值/提现/交易 三维）：
//    - 低价侧提现开 + 高价侧充值开 → 搬砖路径成立（open）；
//    - 任一侧充提关 → 该对标「仅库存型」（双边已有库存才可做）；
//    - 状态未知/过期 → 「仅库存型（状态未实时核实）」；
//    - 某侧交易冻结 → 该场所参与的对单独降级，不影响其他对，
//      禁止整事件一票否决（F7 按对粒度执行）。
// 3. 状态源：Gate（/api/v4/spot/currencies，含 disabled/delayed 标记）
//    与 Bitget（/api/v2/spot/public/coins，chains 的 rechargeable/
//    withdrawable）每轮公开 API 刷新；Binance/OKX/Bybit/Kraken/Backpack
//    无公开状态接口，读 venue_status.json 的
//    venues[X].assets[SYM] 人工标记（带 updatedAt，>6h 自动降 unknown）；
//    交易状态以本轮能否取到报价为实测证据（人工显式标记 closed 除外）；
//    链上侧默认 open。
// 4. 状态变化即信号：某所某资产充值/提现由关→开（哪怕短暂）且当时该所
//    参与的对存在 ≥150bps 可成交价差 → 立即入队（不等两轮确认）；
//    开→关只记档。起因：OKX 窗口仅约一小时，两轮确认+慢研判会错过。
// v2.4（2026-10-30 晚用户定案，随被盗专案一并批准实施）：
// 5. 价格指纹信号（修法 1）：某场所相对梯队底部/顶部的溢价/折价，
//    一小时内峰值 ≥200bps 后被压到峰值的 40% 以内（收窄 ≥60%），且
//    其充提状态含 unknown/closed（无官方源可证）→ 疑似充提静默开启，
//    相关对免确认即时入队并标 trigger=fingerprint_reopen；指纹是推
//    断证据、不得单独改判搬砖成立。起因：OKX 今晨 09:00 静默开窗无
//    公告、无状态 API；镜像回测校准为峰值压缩式（单点参考式在真实
//    震荡序列上漏检），今晨序列 09:15 命中（峰值 251→87bps）。
// 6. 未核实快速通道（修法 2）：分类为 inventory-unverified（状态未知
//    卡住）的对，可成交价差 ≥250bps 时免一轮确认先入队（标
//    fastTrack），把状态未知对的时序损耗压到一轮。
// 7. inferred 状态源：venue_status_inferred.json（热钱包簇出款推断，
//    hotwallet_inferred_watch.mjs 写）若标记某维 inferred-closed 且
//    本脚本该维为 unknown → 补成 closed 参与分类；仅采信「关」方向，
//    「开」方向不据此改判。该模块未启用（TronGrid key 未到位）时
//    文件不存在，本条无任何行为影响。
// 保留：只入队不直推、10 分钟兜底、研判唤起每日封顶（hook 侧）。
// 到期：2026-11-13 23:59 CST 自动停用（币安冻结 regime 临时线）。
// 回放：node arb_cex_cross_watch.mjs --replay <fixture.json>（中间价代理
// 模式，只打印逐对判定、不入队不写状态）。
import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR, enqueueArbEvent } from './arb_lib.mjs';

const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const saveJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
async function fetchJson(url, ms = 15000) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'stablecoin-risk-desk/1.0' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const STATE_FILE = path.join(STATE_DIR, 'arb_cex_cross_state.json');
const VENUE_FILE = path.join(STATE_DIR, 'venue_status.json');
const INFERRED_FILE = path.join(STATE_DIR, 'venue_status_inferred.json');
const EXPIRES_MS = Date.parse('2026-11-13T23:59:59+08:00');
const SIM_USD = 10000, MIN_FILL_USD = 3000;
const MID_TRIGGER_BPS = 200, REOPEN_MID_FLOOR_BPS = 100;
const EXEC_WARN_BPS = 150, EXEC_SEVERE_BPS = 400;
const FASTTRACK_EXEC_BPS = 250; // 修法 2：未核实对免一轮确认的可成交门槛
const FP_WINDOW_MS = 60 * 60 * 1000, FP_PEAK_BPS = 200, FP_PEAK_MIN_AGE_MS = 15 * 60 * 1000, FP_COMPRESS = 0.4; // 修法 1 价格指纹（峰值压缩式）
const STATUS_STALE_MS = 6 * 3600 * 1000;
const ASSETS = ['TRX', 'ETH'];
const CEX_VENUES = ['binance', 'gate', 'okx', 'bitget', 'bybit', 'kraken', 'backpack'];
const VENUE_CN = { binance: 'Binance', gate: 'Gate', okx: 'OKX', bitget: 'Bitget', bybit: 'Bybit', kraken: 'Kraken', backpack: 'Backpack', sunsap: 'SunSwap' };
const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

let krakenUsdtUsdCache = null;
async function krakenUsdtUsd() {
  if (krakenUsdtUsdCache) return krakenUsdtUsdCache;
  const d = await fetchJson('https://api.kraken.com/0/public/Ticker?pair=USDTUSD');
  const t = d.result.USDTZUSD;
  krakenUsdtUsdCache = (Number(t.b[0]) + Number(t.a[0])) / 2;
  return krakenUsdtUsdCache;
}
let binanceUsdcUsdtCache = null;
async function binanceUsdcUsdt() {
  if (binanceUsdcUsdtCache) return binanceUsdcUsdtCache;
  const d = await fetchJson('https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=USDCUSDT');
  binanceUsdcUsdtCache = (Number(d.bidPrice) + Number(d.askPrice)) / 2;
  return binanceUsdcUsdtCache;
}
// Backpack 盘口取最优买卖（其 depth 在薄盘时乱序返回，须自行归一化排序）；
// 盘口不合 sanity（双边缺失/价差 >300bps）返回 null，该所本轮按不可用处理。
function backpackBest(depth) {
  const bids = (depth.bids || []).map((x) => Number(x[0])).filter((x) => x > 0);
  const asks = (depth.asks || []).map((x) => Number(x[0])).filter((x) => x > 0);
  if (!bids.length || !asks.length) return null;
  const bestBid = Math.max(...bids), bestAsk = Math.min(...asks);
  if (!(bestBid < bestAsk) || (bestAsk / bestBid - 1) * 10000 > 300) return null;
  return { bestBid, bestAsk };
}

let hlPerpCache = null, hlSpotCache = null;
async function hlPerpRef(sym) {
  if (!hlPerpCache) {
    const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'stablecoin-risk-desk/1.0' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HL ${r.status}`);
    hlPerpCache = await r.json();
  }
  const [meta, ctxs] = hlPerpCache;
  const i = meta.universe.findIndex((u) => u.name === sym);
  if (i < 0) return null;
  return { mark: Number(ctxs[i].markPx), oracle: Number(ctxs[i].oraclePx) };
}
async function hlSpotListed(sym) {
  if (!hlSpotCache) {
    const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'stablecoin-risk-desk/1.0' }, body: JSON.stringify({ type: 'spotMeta' }), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HL ${r.status}`);
    hlSpotCache = await r.json();
  }
  return (hlSpotCache.universe || []).some((u) => String(u.name || '').startsWith(`${sym}/`));
}

const midFetchers = {
  binance: async (s) => { const d = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=${s}USDT`); return (Number(d.bidPrice) + Number(d.askPrice)) / 2; },
  gate: async (s) => { const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${s}_USDT`); const t = d[0]; return (Number(t.highest_bid) + Number(t.lowest_ask)) / 2; },
  okx: async (s) => { const d = await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${s}-USDT`); const t = d.data[0]; return (Number(t.bidPx) + Number(t.askPx)) / 2; },
  bitget: async (s) => { const d = await fetchJson(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${s}USDT`); const t = d.data[0]; return (Number(t.bidPr) + Number(t.askPr)) / 2; },
  bybit: async (s) => { const d = await fetchJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${s}USDT`, 8000); const t = d.result.list[0]; return (Number(t.bid1Price) + Number(t.ask1Price)) / 2; },
  kraken: async (s) => {
    if (s === 'ETH') { const d = await fetchJson('https://api.kraken.com/0/public/Ticker?pair=ETHUSDT'); const t = d.result.ETHUSDT; return (Number(t.b[0]) + Number(t.a[0])) / 2; }
    const [d, fx] = await Promise.all([fetchJson('https://api.kraken.com/0/public/Ticker?pair=TRXUSD'), krakenUsdtUsd()]);
    const t = Object.values(d.result)[0];
    return ((Number(t.b[0]) + Number(t.a[0])) / 2) / fx; // TRX/USD ÷ USDT/USD → TRX/USDT 口径
  },
  backpack: async (s) => {
    const [d, fx] = await Promise.all([fetchJson(`https://api.backpack.exchange/api/v1/depth?symbol=${s}_USDC&limit=100`), binanceUsdcUsdt()]);
    const best = backpackBest(d);
    if (!best) throw new Error('backpack book unusable');
    return ((best.bestBid + best.bestAsk) / 2) * fx; // USDC 计价 × USDC/USDT → USDT 口径
  },
};
const bookFetchers = {
  binance: async (s) => { const d = await fetchJson(`https://data-api.binance.vision/api/v3/depth?symbol=${s}USDT&limit=100`); return { bids: d.bids, asks: d.asks }; },
  gate: async (s) => { const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${s}_USDT&limit=100`); return { bids: d.bids, asks: d.asks }; },
  okx: async (s) => { const d = await fetchJson(`https://www.okx.com/api/v5/market/books?instId=${s}-USDT&sz=100`); const b = d.data[0]; return { bids: b.bids, asks: b.asks }; },
  bitget: async (s) => { const d = await fetchJson(`https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${s}USDT&limit=100`); return { bids: d.data.bids, asks: d.data.asks }; },
  bybit: async (s) => { const d = await fetchJson(`https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${s}USDT&limit=100`, 8000); return { bids: d.result.b, asks: d.result.a }; },
  kraken: async (s) => {
    if (s === 'ETH') { const d = await fetchJson('https://api.kraken.com/0/public/Depth?pair=ETHUSDT&count=100'); const b = Object.values(d.result)[0]; return { bids: b.bids.map((x) => [x[0], x[1]]), asks: b.asks.map((x) => [x[0], x[1]]) }; }
    const [d, fx] = await Promise.all([fetchJson('https://api.kraken.com/0/public/Depth?pair=TRXUSD&count=100'), krakenUsdtUsd()]);
    const b = Object.values(d.result)[0];
    const conv = (lv) => [String(Number(lv[0]) / fx), lv[1]];
    return { bids: b.bids.map(conv), asks: b.asks.map(conv) };
  },
  backpack: async (s) => {
    const [d, fx] = await Promise.all([fetchJson(`https://api.backpack.exchange/api/v1/depth?symbol=${s}_USDC&limit=100`), binanceUsdcUsdt()]);
    const norm = (arr, desc) => (arr || []).map((x) => [String(Number(x[0]) * fx), x[1]]).sort((a, b) => desc ? Number(b[0]) - Number(a[0]) : Number(a[0]) - Number(b[0]));
    return { bids: norm(d.bids, true), asks: norm(d.asks, false) };
  },
};

// 沿盘口吃 usdTarget 名义额，返回 { filledUsd, avg }（avg 为成交均价）
function walk(levels, usdTarget) {
  let spent = 0, base = 0;
  for (const lv of levels || []) {
    const px = Number(lv[0]), qty = Number(lv[1]);
    if (!(px > 0) || !(qty > 0)) continue;
    const room = usdTarget - spent;
    if (room <= 0) break;
    const takeUsd = Math.min(room, px * qty);
    spent += takeUsd; base += takeUsd / px;
  }
  return { filledUsd: spent, avg: base > 0 ? spent / base : null };
}

// SunSwap（V3 集中流动性）以恒定乘积近似模拟：池储备按美元价值对半拆分。
// buy：以 USDT 买 TRX（sunsap 为低价侧）；sell：卖 TRX 换 USDT（高价侧）。
// 返回与 walk 同形的 { filledUsd, avg }；filledUsd 为该腿实际吞吐的美元名义额。
function cpSim(reserveUsd, feePct, side, usdTarget, mid) {
  const sideRes = reserveUsd / 2; // 单侧储备（美元计）
  if (!(sideRes > 0) || !(mid > 0)) return { filledUsd: 0, avg: null };
  const feeMul = 1 - feePct / 100;
  if (side === 'buy') {
    const inEff = usdTarget * feeMul;
    const outUsdAtMid = sideRes * (inEff / (sideRes + inEff)); // 换得 TRX 按中间价计的美元值
    const baseGot = outUsdAtMid / mid;
    return { filledUsd: usdTarget, avg: baseGot > 0 ? usdTarget / baseGot : null };
  }
  const inEff = usdTarget * feeMul; // 卖入 TRX 按中间价计的美元值（扣费后）
  const outUsd = sideRes * (inEff / (sideRes + inEff)); // 换得 USDT
  return { filledUsd: usdTarget, avg: usdTarget > 0 ? mid * (outUsd / usdTarget) : null };
}

// ---------------- 场所状态（场所 × 资产 × 功能） ----------------
const normFn = (v) => {
  if (v === 'frozen' || v === 'closed' || v === 'disabled') return 'closed';
  if (v === 'normal' || v === 'open') return 'open';
  if (v === 'delayed') return 'delayed';
  return 'unknown';
};

async function gateStatus(sym) {
  const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/currencies/${sym}`);
  return {
    deposit: d.deposit_disabled ? 'closed' : 'open',
    withdraw: d.withdraw_disabled ? 'closed' : (d.withdraw_delayed ? 'delayed' : 'open'),
    trading: d.trade_disabled ? 'closed' : 'open',
    source: 'gate-api', at: Date.now(),
  };
}

let bitgetCoinsCache = null;
async function bitgetStatus(sym) {
  if (!bitgetCoinsCache) {
    const d = await fetchJson('https://api.bitget.com/api/v2/spot/public/coins');
    bitgetCoinsCache = d.data || [];
  }
  const coin = bitgetCoinsCache.find((c) => String(c.coin).toUpperCase() === sym);
  if (!coin) throw new Error('coin not listed');
  const chains = coin.chains || [];
  const wantName = sym === 'TRX' ? 'TRC20' : sym === 'ETH' ? 'ERC20' : null;
  const c = chains.find((x) => String(x.chain).toUpperCase() === sym)
    || chains.find((x) => wantName && String(x.chain).toUpperCase().includes(wantName))
    || chains[0];
  if (!c) throw new Error('no chains');
  const on = (v) => v === true || v === 'true';
  return {
    deposit: on(c.rechargeable) ? 'open' : 'closed',
    withdraw: on(c.withdrawable) ? 'open' : 'closed',
    trading: 'unknown', // 该接口不给交易状态，由本轮报价实测补
    source: 'bitget-api', at: Date.now(),
  };
}

function manualStatus(venueFile, venueKey, sym) {
  const vmap = venueFile.venues || {};
  const key = Object.keys(vmap).find((k) => k.toLowerCase() === venueKey.toLowerCase());
  if (!key) return { deposit: 'unknown', withdraw: 'unknown', trading: 'unknown', source: 'venue_status(无标记)', at: 0 };
  const v = vmap[key];
  const entry = (v.assets && v.assets[sym]) || null;
  let deposit, withdraw, trading, updatedAt, source;
  if (entry) {
    deposit = normFn(entry.deposit); withdraw = normFn(entry.withdraw); trading = normFn(entry.trading);
    updatedAt = entry.updatedAt || venueFile.updatedAt;
    source = `venue_status 人工标记${entry.source ? '：' + entry.source : ''}`;
  } else {
    const sum = normFn(v.depositWithdraw);
    deposit = withdraw = sum === 'open' || sum === 'closed' || sum === 'delayed' ? sum : 'unknown';
    trading = 'unknown';
    updatedAt = venueFile.updatedAt;
    source = 'venue_status 汇总标记';
  }
  const age = updatedAt ? Date.now() - Date.parse(updatedAt) : Infinity;
  const stale = !(age >= 0 && age <= STATUS_STALE_MS);
  if (stale) { deposit = 'unknown'; withdraw = 'unknown'; if (trading !== 'closed') trading = 'unknown'; }
  return { deposit, withdraw, trading, source, at: updatedAt ? Date.parse(updatedAt) : 0, stale };
}

async function sunsapPool(state) {
  const cache = state.sunsapPool;
  if (cache && cache.addr && Date.now() - (cache.at || 0) < 7 * 86400 * 1000) return cache;
  const d = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/tron/tokens/${USDT_TRON}?include=top_pools`);
  const pools = (d.included || []).filter((p) => p.type === 'pool'
    && String(p.attributes?.name || '').startsWith('USDT / WTRX'));
  pools.sort((a, b) => (Number(b.attributes.reserve_in_usd) || 0) - (Number(a.attributes.reserve_in_usd) || 0));
  if (!pools.length) throw new Error('sunsap pool not found');
  const p = pools[0];
  const feeMatch = String(p.attributes.name).match(/([\d.]+)%\s*$/);
  const info = { addr: p.id.replace(/^tron_/, ''), feePct: feeMatch ? Number(feeMatch[1]) : 0.3, at: Date.now() };
  state.sunsapPool = info;
  return info;
}

async function sunsapQuote(state) {
  const pool = await sunsapPool(state);
  const d = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/tron/pools/${pool.addr}`);
  const a = d.data?.attributes || {};
  const pxQuote = Number(a.base_token_price_quote_token); // 1 USDT = x TRX
  let mid = pxQuote > 0 ? 1 / pxQuote : null;
  if (!(mid > 0.1 && mid < 1.0)) mid = null; // TRX 合理价格带护栏
  return { mid, reserveUsd: Number(a.reserve_in_usd) || 0, feePct: pool.feePct };
}

// ---------------- 逐对评估（纯判定，live 与 replay 共用） ----------------
// quotes: { venue: mid }；sims: Map key=`lo>hi` -> { execBps, fillUsd }（回放为中间价代理）
// statuses: { venue: {deposit, withdraw, trading, source, stale} }
function classOf(lo, hi, statuses) {
  const sLo = statuses[lo] || {}, sHi = statuses[hi] || {};
  if (sLo.trading === 'closed' || sHi.trading === 'closed') {
    const which = sLo.trading === 'closed' ? lo : hi;
    return { cls: 'downgraded', label: `降级（${VENUE_CN[which] || which} 交易冻结，该对不计可执行）` };
  }
  const w = sLo.withdraw || 'unknown', d = sHi.deposit || 'unknown';
  if ((w === 'open' || w === 'delayed') && (d === 'open' || d === 'delayed')) {
    const delayed = w === 'delayed' || d === 'delayed';
    return { cls: 'open', label: delayed ? '搬砖成立（充提延迟档，按时滞计成本）' : '搬砖成立（充提双开）' };
  }
  if (w === 'closed' || d === 'closed') {
    const bits = [];
    if (w === 'closed') bits.push(`${VENUE_CN[lo] || lo} 提现关闭`);
    if (d === 'closed') bits.push(`${VENUE_CN[hi] || hi} 充值关闭`);
    return { cls: 'inventory', label: `仅库存型（${bits.join('、')}；双边已有库存才可做）` };
  }
  return { cls: 'inventory-unverified', label: '仅库存型（充提状态未实时核实；双边已有库存才可做）' };
}

function evaluatePairs(sym, quotes, sims, statuses, midFloorBps) {
  const venues = Object.keys(quotes).filter((v) => quotes[v] > 0);
  const pairs = [];
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i], b = venues[j];
      const lo = quotes[a] <= quotes[b] ? a : b;
      const hi = lo === a ? b : a;
      const midBps = (quotes[hi] / quotes[lo] - 1) * 10000;
      if (midBps < midFloorBps) continue;
      const sim = sims.get(`${lo}>${hi}`) || null;
      const { cls, label } = classOf(lo, hi, statuses);
      pairs.push({
        lo, hi, midBps, execBps: sim ? sim.execBps : null, fillUsd: sim ? sim.fillUsd : null,
        cls, label,
        pass: !!sim && sim.execBps >= EXEC_WARN_BPS && sim.fillUsd >= MIN_FILL_USD && cls !== 'downgraded',
      });
    }
  }
  pairs.sort((x, y) => (y.execBps ?? y.midBps) - (x.execBps ?? x.midBps));
  return pairs;
}

// ---------------- 状态迁移（关→开即信号） ----------------
function detectTransitions(state, sym, statuses) {
  const prevAll = state.statusPrev || (state.statusPrev = {});
  const reopen = []; // [{venue, fn}]
  const closedLog = [];
  for (const [venue, st] of Object.entries(statuses)) {
    if (venue === 'sunsap') continue;
    const key = `${venue}:${sym}`;
    const prev = prevAll[key];
    const cur = { deposit: st.deposit, withdraw: st.withdraw };
    if (prev) {
      for (const fn of ['deposit', 'withdraw']) {
        if (prev[fn] === 'closed' && (cur[fn] === 'open' || cur[fn] === 'delayed')) reopen.push({ venue, fn });
        if (prev[fn] === 'open' && cur[fn] === 'closed') closedLog.push({ venue, fn });
      }
    }
    if (cur.deposit !== 'unknown' || cur.withdraw !== 'unknown') {
      prevAll[key] = { ...(prev || {}), ...Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== 'unknown')) };
    }
  }
  return { reopen, closedLog };
}

// ---------------- 价格指纹（修法 1）：溢价快速收窄 → 疑似静默开启 ----------------
// 度量：每场所相对 CEX 全场中位的带符号脱位 d=价/中位-1（用中位不用
// 极值作基：极值基会被单个离群场所机械污染——今晨 OKX 溢价收窄时，
// 以最高价为基的「折价」曾让 Binance/Gate 双双误报）。触发（峰值压缩
// 式，2026-10-30 晚镜像回测两轮校准）：过去 60 分钟内（峰值距今 ≥15
// 分钟）脱位峰值 |d| ≥200bps，且当前 d 已压到峰值的 40% 以内（收窄
// ≥60%），且该场所充或提任一维不是已知 open（无官方源能解释这次收
// 敛）。每段行情只触发一次（脱位重回 ≥200bps 重新 arm）。校准记录：
// 单点参考式（30 分钟前样本 vs 梯队底部）在今晨真实序列上因溢价震荡
// 漏检、极值基峰值式在低侧场所误报；中位基峰值式 09:15 干净命中
// OKX（峰值 +244bps@08:30 → +56bps，09:00 静默开窗后的搬平段）。
function detectFingerprint(st, quotes, statuses) {
  const now = Date.now();
  const cexQuotes = Object.entries(quotes).filter(([v]) => v !== 'sunsap');
  if (cexQuotes.length < 3) return [];
  const pxs = cexQuotes.map(([, px]) => px).sort((a, b) => a - b);
  const median = pxs[Math.floor(pxs.length / 2)];
  const fp = st.fp || (st.fp = {});
  const fires = [];
  for (const [v, px] of cexQuotes) {
    const d = (px / median - 1) * 10000;
    const rec = fp[v] || (fp[v] = { hist: [], firedPrem: false, firedDisc: false });
    rec.hist = rec.hist.filter((h) => now - h.t <= FP_WINDOW_MS);
    const aged = rec.hist.filter((h) => now - h.t >= FP_PEAK_MIN_AGE_MS);
    const peakPrem = aged.length ? Math.max(...aged.map((h) => h.d)) : 0;
    const peakDisc = aged.length ? Math.min(...aged.map((h) => h.d)) : 0;
    rec.hist.push({ t: now, d });
    if (d >= FP_PEAK_BPS) rec.firedPrem = false;
    if (d <= -FP_PEAK_BPS) rec.firedDisc = false;
    const s = statuses[v] || {};
    const blind = (s.deposit !== 'open' && s.deposit !== 'delayed') || (s.withdraw !== 'open' && s.withdraw !== 'delayed');
    if (!blind) continue;
    if (!rec.firedPrem && peakPrem >= FP_PEAK_BPS && d <= peakPrem * FP_COMPRESS) {
      rec.firedPrem = true;
      fires.push({ venue: v, from: Math.round(peakPrem), to: Math.round(d), side: 'premium' });
    }
    if (!rec.firedDisc && peakDisc <= -FP_PEAK_BPS && d >= peakDisc * FP_COMPRESS) {
      rec.firedDisc = true;
      fires.push({ venue: v, from: Math.round(peakDisc), to: Math.round(d), side: 'discount' });
    }
  }
  return fires;
}

// ---------------- 主流程 ----------------
async function main() {
  const state = loadJson(STATE_FILE, {});
  if (Date.now() > EXPIRES_MS) {
    if (!state.expiredLogged) { state.expiredLogged = true; saveJson(STATE_FILE, state); console.log('[cex-cross] 已到期（2026-11-13），停用'); }
    return;
  }
  const venueFile = loadJson(VENUE_FILE, {});
  for (const sym of ASSETS) {
    try { await runAsset(sym, state, venueFile); }
    catch (e) { console.log(`[cex-cross] ${sym} 本轮异常：${String(e).slice(0, 160)}`); }
  }
  if (state.statusPrev) {
    for (const k of Object.keys(state.statusPrev)) {
      if (!CEX_VENUES.includes(k.split(':')[0])) delete state.statusPrev[k];
    }
  }
  saveJson(STATE_FILE, state);
}

async function runAsset(sym, state, venueFile) {
  const st = state[sym] || (state[sym] = { pairs: {}, active: false, peakBps: 0 });
  st.pairs = st.pairs || {}; // v1 旧状态无 pairs 字段，补齐防崩
  // 1) 中间价（含 SunSwap）
  const quotes = {};
  for (const name of CEX_VENUES) {
    try { const m = await midFetchers[name](sym); if (m > 0) quotes[name] = m; } catch { /* 单所不可达跳过 */ }
  }
  let sunsapInfo = null;
  if (sym === 'TRX') {
    try { sunsapInfo = await sunsapQuote(state); if (sunsapInfo.mid) quotes.sunsap = sunsapInfo.mid; }
    catch { /* 链上腿不可得则只评 CEX 对 */ }
  }
  const names = Object.keys(quotes);
  if (names.length < 3) { console.log(`[cex-cross] ${sym} 可用报价源不足（${names.length}），跳过`); return; }

  // 2) 充提状态（API 两所 + 人工两所 + 链上默认）
  const statuses = {};
  try { statuses.gate = await gateStatus(sym); } catch { statuses.gate = { deposit: 'unknown', withdraw: 'unknown', trading: 'unknown', source: 'gate-api(失败)', at: 0 }; }
  try { statuses.bitget = await bitgetStatus(sym); } catch { statuses.bitget = { deposit: 'unknown', withdraw: 'unknown', trading: 'unknown', source: 'bitget-api(失败)', at: 0 }; }
  for (const v of ['binance', 'okx', 'bybit', 'kraken', 'backpack']) statuses[v] = manualStatus(venueFile, v, sym);
  if (quotes.sunsap) statuses.sunsap = { deposit: 'open', withdraw: 'open', trading: 'open', source: '链上默认', at: Date.now() };
  // inferred 覆盖（v2.4 第 7 条）：热钱包簇推断标记某维 inferred-closed 且
  // 本轮该维为 unknown 时补成 closed；「开」方向一律不采信。文件不存在
  // （模块未启用）时无任何影响。
  const inferred = loadJson(INFERRED_FILE, null);
  if (inferred && inferred.venues) {
    for (const v of CEX_VENUES) {
      const iv = inferred.venues[v] && inferred.venues[v].assets && inferred.venues[v].assets[sym];
      if (!iv || !statuses[v]) continue;
      for (const fn of ['deposit', 'withdraw']) {
        if (iv[fn] === 'inferred-closed' && statuses[v][fn] === 'unknown') {
          statuses[v][fn] = 'closed';
          statuses[v].source = `${statuses[v].source}；hotwallet-inferred：链上出款停止推断（${iv.at || ''}）`;
        }
      }
    }
  }
  // Hyperliquid 永续参考（不进 quotes、不参与现货逐对）
  let hlRef = null;
  try {
    const ref = await hlPerpRef(sym);
    if (ref && ref.mark > 0) {
      const midsSorted = Object.values(quotes).sort((a, b) => a - b);
      const median = midsSorted[Math.floor(midsSorted.length / 2)];
      hlRef = { ...ref, basisBps: Math.round((ref.mark / median - 1) * 10000) };
    }
    if (await hlSpotListed(sym)) console.log(`[cex-cross] ${sym} 注意：Hyperliquid 已出现 ${sym} 现货对，现行版本仍按永续参考处理，待升级为现货腿`);
  } catch { /* HL 不可达则本轮无参考行 */ }

  // 交易状态以本轮报价实测为据（人工显式 closed 不覆盖）
  for (const v of names) {
    if (statuses[v] && statuses[v].trading !== 'closed') statuses[v].trading = 'open';
  }

  // 3) 状态迁移检测（关→开 → 本轮相关对免确认）
  const { reopen, closedLog } = detectTransitions(state, sym, statuses);
  for (const c of closedLog) console.log(`[cex-cross] ${sym} 状态变化记档：${VENUE_CN[c.venue]} ${c.fn === 'deposit' ? '充值' : '提现'} 开→关`);
  const reopenVenues = new Set(reopen.map((r) => r.venue));
  for (const r of reopen) console.log(`[cex-cross] ${sym} 状态变化信号：${VENUE_CN[r.venue]} ${r.fn === 'deposit' ? '充值' : '提现'} 关→开，相关对本轮免确认评估`);

  // 3.5) 价格指纹检测（修法 1）：命中场所参与的对同 reopen 待遇
  const fpFire = detectFingerprint(st, quotes, statuses);
  const fpVenues = new Set(fpFire.map((f) => f.venue));
  for (const f of fpFire) console.log(`[cex-cross] ${sym} 价格指纹信号：${VENUE_CN[f.venue]} ${f.side === 'discount' ? '折价' : '溢价'}峰值 ${f.from}bps→现 ${f.to}bps（一小时内收窄 ≥60%）且充提状态含未知/关闭，疑似静默开启，相关对免确认评估`);

  // 4) 逐对：中间价过门（或涉及刚重开场所）才拉盘口模拟
  const venues = Object.keys(quotes);
  const candidatePairs = [];
  for (let i = 0; i < venues.length; i++) for (let j = i + 1; j < venues.length; j++) {
    const a = venues[i], b = venues[j];
    const lo = quotes[a] <= quotes[b] ? a : b, hi = lo === a ? b : a;
    const midBps = (quotes[hi] / quotes[lo] - 1) * 10000;
    const floor = (reopenVenues.has(lo) || reopenVenues.has(hi) || fpVenues.has(lo) || fpVenues.has(hi)) ? REOPEN_MID_FLOOR_BPS : MID_TRIGGER_BPS;
    if (midBps >= floor) candidatePairs.push({ lo, hi, midBps });
  }
  if (!candidatePairs.length) {
    if (st.active) console.log(`[cex-cross] ${sym} 价差消解，转观察`);
    st.active = false; st.peakBps = 0; st.pairs = {};
    const top = [...venues].sort((x, y) => quotes[x] - quotes[y]);
    console.log(`[cex-cross] ${sym} 正常：最大中间价差 ${((quotes[top[top.length - 1]] / quotes[top[0]] - 1) * 10000).toFixed(0)}bps（${top.map((n) => `${n} ${quotes[n].toFixed(5)}`).join(' < ')}）${hlRef ? `；HL 永续 mark ${hlRef.mark}（基差 ${hlRef.basisBps >= 0 ? '+' : ''}${hlRef.basisBps}bps）` : ''}`);
    return;
  }
  const bookCache = {};
  const getBook = async (v) => {
    if (bookCache[v]) return bookCache[v];
    if (v === 'sunsap') return null; // 链上腿走 cpSim
    try { bookCache[v] = await bookFetchers[v](sym); } catch { bookCache[v] = null; }
    return bookCache[v];
  };
  const sims = new Map();
  for (const { lo, hi } of candidatePairs) {
    let buy = null, sell = null;
    if (lo === 'sunsap') buy = cpSim(sunsapInfo.reserveUsd, sunsapInfo.feePct, 'buy', SIM_USD, quotes.sunsap);
    else { const bk = await getBook(lo); if (bk) buy = walk(bk.asks, SIM_USD); }
    if (hi === 'sunsap') sell = cpSim(sunsapInfo.reserveUsd, sunsapInfo.feePct, 'sell', SIM_USD, quotes.sunsap);
    else { const bk = await getBook(hi); if (bk) sell = walk(bk.bids, SIM_USD); }
    if (buy?.avg && sell?.avg) {
      sims.set(`${lo}>${hi}`, {
        execBps: (sell.avg / buy.avg - 1) * 10000,
        fillUsd: Math.min(buy.filledUsd, sell.filledUsd),
        buyAvg: buy.avg, sellAvg: sell.avg,
        buyFill: buy.filledUsd, sellFill: sell.filledUsd,
      });
    }
  }
  const pairs = evaluatePairs(sym, quotes, sims, statuses, 0)
    .filter((p) => candidatePairs.some((c) => c.lo === p.lo && c.hi === p.hi));

  // 5) 逐对确认计数与入队判定
  let anyConfirmedPass = false, changed = false, bestExec = 0;
  const pairLines = [], downLines = [];
  for (const p of pairs) {
    const ukey = [p.lo, p.hi].sort().join('|');
    const rec = st.pairs[ukey] || (st.pairs[ukey] = { confirm: 0, cls: null });
    const sim = sims.get(`${p.lo}>${p.hi}`);
    const involvedReopen = reopenVenues.has(p.lo) || reopenVenues.has(p.hi);
    const involvedFp = fpVenues.has(p.lo) || fpVenues.has(p.hi);
    const fastTrack = p.cls === 'inventory-unverified' && p.execBps !== null && p.execBps >= FASTTRACK_EXEC_BPS;
    if (p.pass) {
      rec.confirm = (involvedReopen || involvedFp || fastTrack) ? 2 : (rec.confirm || 0) + 1;
      if (fastTrack) rec.fastTrack = true;
      if (rec.cls && rec.cls !== 'open' && p.cls === 'open') changed = true; // 库存型→搬砖型升级
      if (rec.cls === null) changed = true;
      rec.cls = p.cls; rec.execBps = Math.round(p.execBps);
      if (rec.confirm >= 2) { anyConfirmedPass = true; bestExec = Math.max(bestExec, p.execBps); }
    } else {
      rec.confirm = 0; rec.cls = p.cls;
    }
    const line = `- ${VENUE_CN[p.lo]}→${VENUE_CN[p.hi]}：中间价差 ${p.midBps.toFixed(0)}bps${sim ? `、$10k 模拟可成交 ${p.execBps.toFixed(0)}bps（买均价 ${sim.buyAvg.toFixed(5)} 可成交 $${Math.round(sim.buyFill).toLocaleString()} / 卖均价 ${sim.sellAvg.toFixed(5)} 可成交 $${Math.round(sim.sellFill).toLocaleString()}）` : '、盘口不可得'}｜路径：${p.label}${fastTrack && p.pass ? '｜⚡未核实快速通道：状态未知、可成交 ≥250bps 免一轮确认入队，研判须优先核该对状态' : ''}${involvedFp && p.pass ? '｜⚡价格指纹命中场所参与对（疑似静默开启，免确认入队）' : ''}`;
    if (p.cls === 'downgraded') downLines.push(line); else pairLines.push(line);
  }
  // 清理本轮未出现的对的确认计数
  for (const k of Object.keys(st.pairs)) {
    if (!pairs.some((p) => [p.lo, p.hi].sort().join('|') === k)) delete st.pairs[k];
  }

  if (!anyConfirmedPass) {
    if (fpFire.length) {
      // 指纹单独入队：价差已收窄到无对过门，但「疑似静默开启」本身要研判现查
      const ctxPairs = pairs.filter((p) => fpVenues.has(p.lo) || fpVenues.has(p.hi));
      const statusLineFp = [...CEX_VENUES, ...(quotes.sunsap ? ['sunsap'] : [])].map((n) => {
        if (!(n in quotes)) return `${VENUE_CN[n]} degraded（本轮不可达/无可用报价）`;
        const s = statuses[n] || {};
        return `${VENUE_CN[n]} 充 ${s.deposit}/提 ${s.withdraw}/交易 ${s.trading}（${s.source}${s.stale ? '，标记已过期' : ''}）`;
      }).join('；');
      const factsTextFp = [
        `${sym} 价格指纹信号（v2.4）：${fpFire.map((f) => `${VENUE_CN[f.venue]} ${f.side === 'discount' ? '折价' : '溢价'}峰值 ${f.from}bps 已收窄至 ${f.to}bps（一小时内收窄 ≥60%）`).join('；')}，且命中场所充提状态含未知/关闭、无官方源可证——疑似充提静默开启`,
        `- 场所状态：${statusLineFp}`,
        `- 当前各对价差已收窄、无对过可成交门${ctxPairs.length ? `；命中场所参与对现状：${ctxPairs.map((p) => `${VENUE_CN[p.lo]}→${VENUE_CN[p.hi]} 中间 ${p.midBps.toFixed(0)}bps${p.execBps !== null ? `、可成交 ${p.execBps.toFixed(0)}bps` : ''}（${p.cls}）`).join('；')}` : ''}`,
        `- 研判动作：优先现查命中场所的充提状态（官网充提页/公告/客服口径）；指纹为价格推断证据，不得单独改判「搬砖成立」；若现查证实开启且任一对仍有可成交价差，按逐对结论给执行策略`,
      ].join('\n');
      const rFp = enqueueArbEvent({
        type: 'spread', key: `${sym}@CEXX`, severity: 'warn',
        payload: { symbol: sym, trigger: 'fingerprint_reopen', fingerprint: fpFire, pairs: [] },
        factsText: factsTextFp,
      });
      console.log(`[cex-cross] ${sym} 价格指纹单独入队（无过门对，merged=${rFp.merged}）`);
      return;
    }
    const best = pairs[0];
    console.log(`[cex-cross] ${sym} 逐对评估：${pairs.length} 对过中间价门，最好 ${best ? `${best.lo}→${best.hi} 可成交 ${best.execBps === null ? '—' : best.execBps.toFixed(0) + 'bps'}（${best.cls}）` : '—'}，未达入队标准（确认中/深度/价差不足）`);
    return;
  }
  const deepen = bestExec > (st.peakBps || 0) + 100;
  if (st.active && !changed && !deepen && !reopen.length && !fpFire.length) {
    console.log(`[cex-cross] ${sym} 持续中：最佳可成交 ${bestExec.toFixed(0)}bps（峰值 ${st.peakBps.toFixed(0)}bps），已在队列`);
    return;
  }
  st.active = true; st.peakBps = Math.max(st.peakBps || 0, bestExec);
  const degraded = CEX_VENUES.filter((v) => !(v in quotes));
  if (degraded.length) console.log(`[cex-cross] ${sym} degraded 场所：${degraded.map((v) => VENUE_CN[v]).join('、')}（本轮不可达/无可用报价，不参与配对）`);
  const statusLine = [...CEX_VENUES, ...(quotes.sunsap ? ['sunsap'] : [])].map((n) => {
    if (!(n in quotes)) return `${VENUE_CN[n]} degraded（本轮不可达/无可用报价）`;
    const s = statuses[n] || {};
    return `${VENUE_CN[n]} 充 ${s.deposit}/提 ${s.withdraw}/交易 ${s.trading}（${s.source}${s.stale ? '，标记已过期' : ''}）`;
  }).join('；');
  const passingPairs = pairs.filter((p) => p.pass && (st.pairs[[p.lo, p.hi].sort().join('|')]?.confirm || 0) >= 2);
  const factsText = [
    `${sym} 跨所现货价差（逐对评估 v2.4）：中间价 ${names.map((n) => `${VENUE_CN[n]} ${quotes[n].toFixed(5)}`).join('；')}`,
    `- 场所状态：${statusLine}`,
    `- 逐对结论（过门对）：`,
    ...pairLines,
    ...(downLines.length ? [`- 降级对（不计可执行、仅背景）：`, ...downLines] : []),
    ...(reopen.length ? [`- ⚡ 状态变化触发：${reopen.map((r) => `${VENUE_CN[r.venue]} ${r.fn === 'deposit' ? '充值' : '提现'} 关→开`).join('、')}，相关对已免两轮确认入队——窗口可能短暂，研判优先处理`] : []),
    ...(fpFire.length ? [`- ⚡ 价格指纹触发：${fpFire.map((f) => `${VENUE_CN[f.venue]} ${f.side === 'discount' ? '折价' : '溢价'}峰值 ${f.from}bps→${f.to}bps（一小时内收窄 ≥60%）`).join('；')}，命中场所充提状态含未知/关闭——疑似充提静默开启，相关对已免确认入队；研判须现查该场所状态，指纹为推断证据、不得单独改判搬砖成立`] : []),
    hlRef
      ? `- Hyperliquid 参考（不计入现货逐对）：${sym} 无现货、仅永续，mark ${hlRef.mark}、oracle ${hlRef.oracle}，较现货中位基差 ${hlRef.basisBps >= 0 ? '+' : ''}${hlRef.basisBps}bps；HL 充提走 Arbitrum 桥、无公开状态接口（人工标记现 unknown）——基差只作背景，勿与现货价差混算`
      : `- Hyperliquid 参考：本轮不可达（degraded），无永续参考价`,
    `- 研判须按对定性：搬砖成立的对核双腿深度与提币费/到账时效；仅库存型对须先核用户在两所是否有账户与库存（未知就标未知，不得默认可做）；降级对只作背景、不得因其存在否掉其他对`,
  ].join('\n');
  const anyFastTrack = passingPairs.some((p) => st.pairs[[p.lo, p.hi].sort().join('|')]?.fastTrack);
  const r = enqueueArbEvent({
    type: 'spread', key: `${sym}@CEXX`, severity: bestExec >= EXEC_SEVERE_BPS ? 'severe' : 'warn',
    payload: {
      symbol: sym, trigger: reopen.length ? 'status_reopen' : fpFire.length ? 'fingerprint_reopen' : anyFastTrack ? 'unverified_fasttrack' : 'standard',
      reopen: reopen.length ? reopen : undefined,
      fingerprint: fpFire.length ? fpFire : undefined,
      pairs: passingPairs.map((p) => ({ lo: p.lo, hi: p.hi, midBps: Math.round(p.midBps), execBps: Math.round(p.execBps), fillUsd: Math.round(p.fillUsd), cls: p.cls })),
      loVenue: passingPairs[0]?.lo, hiVenue: passingPairs[0]?.hi,
      hlPerp: hlRef || undefined,
    },
    factsText,
  });
  console.log(`[cex-cross] ${sym} 已入队深化（最佳可成交 ${bestExec.toFixed(0)}bps，过门对 ${passingPairs.length} 条，merged=${r.merged}${reopen.length ? '，状态变化触发' : ''}）`);
}

// ---------------- 回放模式（验证用） ----------------
function replay(file) {
  const fx = loadJson(file, null);
  if (!fx || !Array.isArray(fx.snapshots)) { console.error('fixture 格式不对：需要 {snapshots:[...]}'); process.exit(2); }
  console.log('[replay] 中间价代理模式（execBps=midBps、深度视为充足）：只验证逐对识别与状态分类，不验证盘口门');
  for (const snap of fx.snapshots) {
    const sims = new Map();
    const venues = Object.keys(snap.mids || {});
    for (let i = 0; i < venues.length; i++) for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i], b = venues[j];
      const lo = snap.mids[a] <= snap.mids[b] ? a : b, hi = lo === a ? b : a;
      sims.set(`${lo}>${hi}`, { execBps: (snap.mids[hi] / snap.mids[lo] - 1) * 10000, fillUsd: SIM_USD });
    }
    const pairs = evaluatePairs('TRX', snap.mids, sims, snap.statuses || {}, EXEC_WARN_BPS);
    console.log(`\n[${snap.label}]`);
    if (!pairs.length) console.log('  （无 ≥150bps 的对）');
    for (const p of pairs) {
      console.log(`  ${p.lo}->${p.hi}  ${p.midBps.toFixed(0)}bps  class=${p.cls}  pass=${p.pass}  ${p.label}`);
    }
    const evPass = pairs.some((p) => p.pass);
    console.log(`  => 事件入队判定：${evPass ? '入队（存在过门对）' : '不入队'}`);
  }
}

if (process.argv[2] === '--replay') replay(process.argv[3]);
else await main();
