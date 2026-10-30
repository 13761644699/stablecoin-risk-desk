// cex_dip_watch.mjs — 交易所逐所盯跌层（2026-10-28 方案 v3，用户拍板）
//
// 定位：逐所独立盯跌——哪家所跌了报哪家（执行导向，不是复核配对）。
// 与 DEX 脱锚层（server.js scanDepegMonitor）的分工：DEX 层看全币/分链脱锚；
// 本层看单个交易所在单个币上的局部跌点（昨晚 USDD 三所 CEX 砸盘、链上锚不动
// 的事件形态，DEX 层看不见）。
//
// 口径（全部为用户已定，勿自行扩缩）：
// 1. 场所只用本机可达且盘口可执行的组合（币安走 data-api.binance.vision、
//    Gate、OKX、Kraken、Coinbase）。HTX 整体不用（用户拍板搁置，连信号源都不做）；
//    Bybit 整站不可达；Kraken 的 U/USD 是同名假币，严禁接入；KuCoin 可达性
//    不稳定，本版不纳入。组合与深度依据：
//    research_notes/cex-sources-stablecoins-20261028/report.md（2026-10-28 实测）。
// 2. 换算硬规则：USDT 计价对必须实时乘 USDT/USD（Kraken USDT/USD）换算成美元价
//    再判定（USDT 本身常年约 −13bp，禁止拿 USDT 对价格直接比 1.0）；USDC 计价对
//    同理乘 USDC/USD（Kraken USDC/USD）。
// 3. 触发：每「所×币」维护自身常态带宽（相对全局锚的滚动中位偏移，样本为
//    扫描周期采样、异常样本不入带），跌出带宽的超额偏离（excess）达到台内分级线
//    ±0.5% 预警 / ±1.5% 严重才进入判定（只看折价方向——本层是"盯跌"）。
//    判定必须过流动性关：触发当刻拉盘口做市价模拟，$10,000 能以折价实际成交
//    （成交 ≥95% 且模拟均价仍低于锚）才算数；过不了关只记日志不推送。
// 4. 锚复核（唯一保留的复核）：全局锚 = 该币最深 DEX 主池（现有腿）与「除本所外
//    其余合格所中位」的合成（leave-one-out，防跌点所自己污染锚）。
//    锚完好（±0.3% 内）而单所跌 → 局部流动性事件，推送附买入方案；
//    锚本身破 ±0.5% → 只提示、不给方案；0.3%–0.5% 灰区同样只提示（保守）。
// 5. 单源币（USDS、U：无第二家合格 CEX）：CEX 单源破线只记观察，须 DEX 腿
//    （流动性 ≥$100k）同向偏离 ≥25bps 确认才建事件（矩阵报告口径，与 metric
//    只观察规则同构）。
// 6. 通道：沿用台内分级——严重级白天 Bark+微信、预警级只微信；夜间
//    00:00–08:00 一律不走 Bark（用户 2026-10-28 拍板，强信号也只微信）。
//    USDD 沿用台内既有豁免：任何时段只微信、绝不 Bark（用户两次确认）。
//    早上 08:00–10:00 沿用台内惯例：预警级压住（建事件、延迟推送），严重级照常。
// 7. 去重/重报：按「所×币」独立事件；首次触发立即推；存续期只在加深 ≥0.3%
//    （30bps）或回锚解除时再推，不按固定间隔刷屏。半夜解除不推（台内惯例）。
// 8. 流动性自检：每日对全部纳入组合重跑盘口双向模拟，跌破可交易门槛
//    （$10k 双向成交 ≥95% 且滑点 ≤25bp）的自动降级只观察（不进锚、不建事件），
//    只记日志不唤起 agent；次日复检恢复合格自动回升。
//
// 状态文件：state/cex_dip_bands.json（带宽样本/降级/自检）、
//           state/cex_dip_events.json（事件/history）。
// 推送函数由调用方注入（server.js 传真实 sendPushplus/sendBark；
// dry-run 脚本传捕获桩，文案在推送前被拦截存档，绝不真发）。
//
// 运行方式（2026-10-28 晚加密，用户拍板「5 分钟长了点」）：本层已与 depeg
// sweep 解耦，由 startCexDipPoller 在 server.js 进程内自轮询——薄池/单源币
// 每 10 秒、深池币每 30 秒，只拉 ticker（盘口仍只在破线触发时拉）。定时器
// 带防重叠（上一轮未跑完跳过本轮）与单所失败退避；进程重启随 server.js
// 一起拉起，不新增任何进程/cron。DEX 锚腿取自主扫描最近一轮结果（注入）。

import fs from 'fs';
import path from 'path';
import { BINANCE_FAST_LANES, ALT_EXIT_VENUES, BINANCE_SPOT_LISTED } from './depeg_logic.mjs';
import { researchPushed, appendEpisodeSummary, fmtDurMin } from './arb_lib.mjs';

export const CEX_DIP_WARN_BPS = 50;    // 预警线（超额偏离，锚口径）
export const CEX_DIP_SEVERE_BPS = 150; // 严重线
export const CEX_DIP_CLEAR_BPS = 30;   // 回到 −0.3% 内解除
export const CEX_DIP_DEEPEN_BPS = 30;  // 存续期再推的加深门槛（0.3%）
export const CEX_DIP_MIN_SAMPLES = 12; // 带宽就绪所需样本（样本间距 4 分钟 ≈ 1 小时）
export const CEX_DIP_MAX_SAMPLES = 288; // 样本环（≈24 小时）
// 自轮询分层（2026-10-28 加密）：深池币 30 秒 / 薄池·单源币 10 秒。
// 带宽样本仍按 SAMPLE_GAP_MS 间距入带——加密只缩短「发现跌点」的延迟，
// 带宽的时间跨度（建带 ≈1 小时、样本环 ≈24 小时）与 5 分钟时代保持一致，
// 不让带宽中心被高频采样拖着跟跌点一起漂移。
export const CEX_DIP_SAMPLE_GAP_MS = 240_000;
export const CEX_DIP_FAST_SYMBOLS = ['USDS', 'USDe', 'PYUSD', 'USDD', 'U']; // 薄池/单源层：10 秒
export const CEX_DIP_SLOW_SYMBOLS = ['USDT', 'USDC', 'USD1', 'RLUSD', 'USDG']; // 深池层：30 秒
export const CEX_DIP_FAST_MS = 10_000;
export const CEX_DIP_SLOW_MS = 30_000;
const BAND_ADMIT_BPS = 40;             // 样本入带门槛：距当前中位 >40bp 的样本不入带（防跌点污染带宽）
const GATE_FILL_PCT = 95;              // 流动性关：$10k 模拟成交比例下限
const SELF_CHECK_MAX_SLIP_BPS = 25;    // 每日自检：$10k 双向滑点上限
const DEX_CONFIRM_BPS = 25;            // 单源币 DEX 代偿确认线（同向偏离）
export const DEPEG_TRIGGER_MIN_LIQ_USD_LOCAL = 100_000; // 与 server.js DEPEG_TRIGGER_MIN_LIQ_USD 对齐（$100k）

// 纳入组合：{ symbol, venue, pair, quote }。quote 为计价货币（换算链）。
// 依据矩阵报告 2026-10-28 盘口模拟：只收 $10k/$50k 双向偏差合格的组合。
export const CEX_DIP_COMBOS = [
  { symbol: 'USDT', venue: 'Kraken', pair: 'USDTUSD', quote: 'USD' },
  { symbol: 'USDT', venue: 'Coinbase', pair: 'USDT-USD', quote: 'USD' },
  { symbol: 'USDT', venue: 'Binance', pair: 'USDTUSD', quote: 'USD' },
  { symbol: 'USDC', venue: 'Binance', pair: 'USDCUSDT', quote: 'USDT' },
  { symbol: 'USDC', venue: 'OKX', pair: 'USDC-USDT', quote: 'USDT' },
  { symbol: 'USDC', venue: 'Gate', pair: 'USDC_USDT', quote: 'USDT' },
  { symbol: 'USDC', venue: 'Kraken', pair: 'USDCUSD', quote: 'USD' },
  { symbol: 'USDS', venue: 'Binance', pair: 'USDSUSDT', quote: 'USDT', singleSource: true },
  { symbol: 'USDe', venue: 'Binance', pair: 'USDEUSDT', quote: 'USDT' },
  { symbol: 'USDe', venue: 'Kraken', pair: 'USDEUSDC', quote: 'USDC' },
  { symbol: 'USD1', venue: 'Binance', pair: 'USD1USDT', quote: 'USDT' },
  { symbol: 'USD1', venue: 'Gate', pair: 'USD1_USDT', quote: 'USDT' },
  { symbol: 'USD1', venue: 'Coinbase', pair: 'USD1-USD', quote: 'USD' },
  { symbol: 'PYUSD', venue: 'Kraken', pair: 'PYUSDUSD', quote: 'USD' },
  { symbol: 'PYUSD', venue: 'OKX', pair: 'PYUSD-USDT', quote: 'USDT' },
  { symbol: 'RLUSD', venue: 'Binance', pair: 'RLUSDUSDT', quote: 'USDT' },
  { symbol: 'RLUSD', venue: 'OKX', pair: 'RLUSD-USDT', quote: 'USDT' },
  { symbol: 'RLUSD', venue: 'Kraken', pair: 'RLUSDUSD', quote: 'USD' },
  { symbol: 'USDG', venue: 'OKX', pair: 'USDG-USDT', quote: 'USDT' },
  { symbol: 'USDG', venue: 'Kraken', pair: 'USDGUSD', quote: 'USD' },
  // USDD：HTX 搁置、KuCoin 不纳入后只剩 Gate（用户已有账户、主执行场所）；
  // 其锚由 Tron 最深 DEX 主池（SunSwap）主导，单所跌点正是本层的原型场景。
  { symbol: 'USDD', venue: 'Gate', pair: 'USDD_USDT', quote: 'USDT' },
  { symbol: 'U', venue: 'Binance', pair: 'UUSDT', quote: 'USDT', singleSource: true },
];

const comboKey = (c) => `${c.symbol}@${c.venue}`;

// ---------- 工具 ----------
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round1 = (v) => Math.round(v * 10) / 10;
function cstHour() {
  return Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }));
}
function cstDay() {
  return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
}
export const isNightCst = () => { const h = cstHour(); return h >= 0 && h < 8; };
export const isMorningQuietCst = () => { const h = cstHour(); return h >= 8 && h < 10; };

async function fetchJson(url, ms = 15000) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'stablecoin-risk-desk/1.0' },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 价格抓取（真实实现；dry-run 可经 hooks 替换） ----------
// ---------- 场所失败退避 ----------
// 自轮询后请求频率高了两个数量级：单所失败不能每 10 秒硬打（打爆限额/招封）。
// 某所拉取失败 → 指数退避（10s→20s→40s→80s→封顶 120s）期间跳过该所，
// 其他所不受影响；恢复后清零并记一行日志。
const venueGate = new Map(); // venue -> { fails, blockedUntil }
function venueBlocked(venue) {
  const g = venueGate.get(venue);
  return !!g && Date.now() < g.blockedUntil;
}
function venueFail(venue, log) {
  const g = venueGate.get(venue) || { fails: 0, blockedUntil: 0 };
  g.fails += 1;
  const backMs = Math.min(120_000, 10_000 * 2 ** Math.min(g.fails - 1, 4));
  g.blockedUntil = Date.now() + backMs;
  venueGate.set(venue, g);
  log(`[cex-dip] ${venue} 拉取失败（累计 ${g.fails} 次），退避 ${Math.round(backMs / 1000)}s 后重试`);
}
function venueSuccess(venue, log) {
  const g = venueGate.get(venue);
  if (g && g.fails > 0) {
    log(`[cex-dip] ${venue} 已恢复（此前失败 ${g.fails} 次）`);
    venueGate.delete(venue);
  }
}

// 换算源组合：无论本轮扫哪一层，USDT/USD 与 USDC/USD 的来源对都要一并拉到，
// 否则 USDT/USDC 计价对无法换算。它们骑各所批量端点，边际成本 ≈0。
const CONVERSION_KEYS = new Set(['USDT@Kraken', 'USDT@Coinbase', 'USDT@Binance', 'USDC@Kraken']);

// 返回 Map: comboKey -> pair 计价单位下的最新价（未换算）
// onlyCombos：本轮要扫的组合（分层轮询时为该层子集）；换算源组合恒一并拉取。
async function fetchAllPairPrices(log, onlyCombos = null) {
  const base = onlyCombos || CEX_DIP_COMBOS;
  const fetchSet = [...new Map(
    [...base, ...CEX_DIP_COMBOS.filter((c) => CONVERSION_KEYS.has(comboKey(c)))].map((c) => [comboKey(c), c]),
  ).values()];
  const inSet = (venue) => fetchSet.filter((c) => c.venue === venue);
  const out = new Map();
  // Binance（vision 批量）
  if (!venueBlocked('Binance')) {
    try {
      const pairs = inSet('Binance').map((c) => c.pair);
      const syms = encodeURIComponent(JSON.stringify(pairs));
      const data = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/price?symbols=${syms}`);
      const m = new Map((Array.isArray(data) ? data : []).map((d) => [d.symbol, Number(d.price)]));
      for (const c of inSet('Binance')) {
        const px = m.get(c.pair);
        if (px > 0) out.set(comboKey(c), px);
      }
      venueSuccess('Binance', log);
    } catch (e) { log(`[cex-dip] Binance 价格拉取失败：${e.message}`); venueFail('Binance', log); }
  }
  // Kraken（先用 AssetPairs 按 altname/wsname 解析真实 pair key，再批量 Ticker）
  if (!venueBlocked('Kraken')) {
    try {
      const wants = inSet('Kraken');
      const keyByCombo = await krakenResolveKeys(wants.map((c) => c.pair), log);
      const keys = [...new Set(Object.values(keyByCombo))];
      if (keys.length) {
        const data = await fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${keys.join(',')}`);
        const result = data?.result || {};
        for (const c of wants) {
          const k = keyByCombo[comboKey(c)];
          const px = k ? Number(result[k]?.c?.[0]) : NaN;
          if (px > 0) out.set(comboKey(c), px);
          else log(`[cex-dip] Kraken ${c.pair} 无价格（key=${k || '未解析'}）`);
        }
      }
      venueSuccess('Kraken', log);
    } catch (e) { log(`[cex-dip] Kraken 价格拉取失败：${e.message}`); venueFail('Kraken', log); }
  }
  // OKX（全量 tickers 一次）
  if (!venueBlocked('OKX')) {
    try {
      const data = await fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      const m = new Map((data?.data || []).map((d) => [d.instId, Number(d.last)]));
      for (const c of inSet('OKX')) {
        const px = m.get(c.pair);
        if (px > 0) out.set(comboKey(c), px);
      }
      venueSuccess('OKX', log);
    } catch (e) { log(`[cex-dip] OKX 价格拉取失败：${e.message}`); venueFail('OKX', log); }
  }
  // Gate（逐对）
  if (!venueBlocked('Gate')) {
    let okCount = 0, failCount = 0;
    for (const c of inSet('Gate')) {
      try {
        const data = await fetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${c.pair}`);
        const px = Number(Array.isArray(data) ? data[0]?.last : null);
        if (px > 0) { out.set(comboKey(c), px); okCount++; }
      } catch (e) { log(`[cex-dip] Gate ${c.pair} 拉取失败：${e.message}`); failCount++; }
      await sleep(120);
    }
    if (okCount > 0) venueSuccess('Gate', log);
    else if (failCount > 0) venueFail('Gate', log);
  }
  // Coinbase（逐对）
  if (!venueBlocked('Coinbase')) {
    let okCount = 0, failCount = 0;
    for (const c of inSet('Coinbase')) {
      try {
        const data = await fetchJson(`https://api.exchange.coinbase.com/products/${c.pair}/ticker`);
        const px = Number(data?.price);
        if (px > 0) { out.set(comboKey(c), px); okCount++; }
      } catch (e) { log(`[cex-dip] Coinbase ${c.pair} 拉取失败：${e.message}`); failCount++; }
      await sleep(120);
    }
    if (okCount > 0) venueSuccess('Coinbase', log);
    else if (failCount > 0) venueFail('Coinbase', log);
  }
  return out;
}

let krakenKeyCache = null;
async function krakenResolveKeys(altnames, log) {
  if (!krakenKeyCache) {
    const data = await fetchJson('https://api.kraken.com/0/public/AssetPairs');
    const map = {};
    for (const [key, info] of Object.entries(data?.result || {})) {
      if (key === 'error') continue;
      if (info?.altname) map[info.altname] = key;
      if (info?.wsname) map[String(info.wsname).replace('/', '')] = key;
    }
    krakenKeyCache = map;
  }
  const out = {};
  for (const c of CEX_DIP_COMBOS.filter((x) => x.venue === 'Kraken')) {
    if (altnames.includes(c.pair)) {
      const k = krakenKeyCache[c.pair];
      if (k) out[comboKey(c)] = k;
      else log(`[cex-dip] Kraken pair 未解析：${c.pair}（AssetPairs 无此 altname/wsname）`);
    }
  }
  return out;
}

// ---------- 盘口抓取（归一化：asks 升序 / bids 降序，[pair价, base量]） ----------
async function fetchBook(combo, log) {
  const norm = (asks, bids) => ({
    asks: (asks || []).map(([p, q]) => [Number(p), Number(q)]).filter(([p, q]) => p > 0 && q > 0).sort((a, b) => a[0] - b[0]),
    bids: (bids || []).map(([p, q]) => [Number(p), Number(q)]).filter(([p, q]) => p > 0 && q > 0).sort((a, b) => b[0] - a[0]),
  });
  if (combo.venue === 'Binance') {
    const d = await fetchJson(`https://data-api.binance.vision/api/v3/depth?symbol=${combo.pair}&limit=100`);
    return norm(d.asks, d.bids);
  }
  if (combo.venue === 'Gate') {
    const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${combo.pair}&limit=100`);
    return norm(d.asks, d.bids);
  }
  if (combo.venue === 'OKX') {
    const d = await fetchJson(`https://www.okx.com/api/v5/market/books?instId=${combo.pair}&sz=100`);
    const row = (d?.data || [])[0] || {};
    return norm(row.asks, row.bids);
  }
  if (combo.venue === 'Kraken') {
    const keyByCombo = await krakenResolveKeys([combo.pair], log);
    const k = keyByCombo[comboKey(combo)];
    if (!k) throw new Error(`Kraken pair 未解析 ${combo.pair}`);
    const d = await fetchJson(`https://api.kraken.com/0/public/Depth?pair=${k}&count=100`);
    const row = (d?.result || {})[k] || {};
    return norm(row.asks, row.bids);
  }
  if (combo.venue === 'Coinbase') {
    const d = await fetchJson(`https://api.exchange.coinbase.com/products/${combo.pair}/book?level=2`);
    return norm(d.asks, d.bids);
  }
  throw new Error(`未知场所 ${combo.venue}`);
}

// 市价买入模拟：用 usdAmount 美元（经 quoteRate 换成计价货币预算）走 asks。
export function simBuy(book, usdAmount, quoteRate) {
  if (!book?.asks?.length || !(quoteRate > 0)) return null;
  let budget = usdAmount / quoteRate;
  const totalBudget = budget;
  let spent = 0, got = 0;
  for (const [px, qty] of book.asks) {
    if (budget - spent <= 1e-12) break;
    const take = Math.min(px * qty, budget - spent);
    spent += take; got += take / px;
  }
  if (!(got > 0) || !(spent > 0)) return null;
  const avgPair = spent / got;
  return { filledUsd: spent * quoteRate, filledPct: (spent / totalBudget) * 100, avgPair, avgUsd: avgPair * quoteRate };
}
// 事件价位内可买量（2026-10-30）：在 $10k/$30k/$50k 三档模拟里，取均价仍不高于
// capUsd（事件触发价）的最大一档；盘口先被吃空（成交<99.5%）时以实际可成交额为顶。
export function buyableWithinCap(book, quoteRate, capUsd) {
  let buyable = 0;
  for (const size of [10_000, 30_000, 50_000]) {
    const sim = simBuy(book, size, quoteRate);
    if (!sim) break;
    if (sim.avgUsd > capUsd) break; // 均价已超事件价位：更大量只会更贵
    if (sim.filledPct < 99.5) { buyable = Math.max(buyable, sim.filledUsd); break; } // 盘口吃空：以实际可成交额为顶
    buyable = Math.max(buyable, size);
  }
  return buyable;
}
// 市价卖出模拟：卖出 usdAmount 美元等值（按中间价折 base 量）走 bids（自检用）。
export function simSell(book, usdAmount, quoteRate) {
  if (!book?.bids?.length || !book?.asks?.length || !(quoteRate > 0)) return null;
  const midPair = (book.asks[0][0] + book.bids[0][0]) / 2;
  if (!(midPair > 0)) return null;
  let baseLeft = (usdAmount / quoteRate) / midPair;
  const totalBase = baseLeft;
  let proceeds = 0, sold = 0;
  for (const [px, qty] of book.bids) {
    if (baseLeft <= 1e-12) break;
    const take = Math.min(qty, baseLeft);
    proceeds += take * px; sold += take; baseLeft -= take;
  }
  if (!(sold > 0)) return null;
  const avgPair = proceeds / sold;
  return { filledPct: (sold / totalBase) * 100, avgPair, avgUsd: avgPair * quoteRate, midUsd: midPair * quoteRate };
}

// ---------- 状态 ----------
function loadJsonFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJsonFile(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1));
}

// ---------- 锚 ----------
function deepestDexLeg(legs, symbol) {
  const cands = (legs || []).filter((l) => l.symbol === symbol && l.price > 0);
  if (!cands.length) return null;
  const deep = cands.filter((l) => (l.liq || 0) >= DEPEG_TRIGGER_MIN_LIQ_USD_LOCAL)
    .sort((a, b) => (b.liq || 0) - (a.liq || 0))[0];
  if (deep) return deep;
  return [...cands].sort((a, b) => (b.liq || 0) - (a.liq || 0))[0];
}
const ANCHOR_ADMIT_BPS = 50; // 有 DEX 主池时，其余所报价偏离主池价的准入上限
// leave-one-out 锚：最深 DEX 主池价 + 其余所中位，两者再取中位（两值即均值）。
function anchorFor(symbol, selfKey, legs, usdBySymbol, bandState) {
  const cands = [];
  const dex = deepestDexLeg(legs, symbol);
  if (dex) cands.push(dex.price);
  const othersAll = (usdBySymbol.get(symbol) || [])
    .filter((v) => v.key !== selfKey && !bandState.combos[v.key]?.demoted)
    .map((v) => v.usd);
  // 2026-10-29 锚毒化修复（PYUSD@OKX 假报警）：有 DEX 主池时，其余所报价须在
  // 主池价 ±50bp 内才准入锚——防薄盘口坏印（如 Kraken PYUSD 最新价被几枚小单
  // 扫到 1.0562）把锚拖偏、反过来把正常所误判成跌点。真全币脱锚时 DEX 主池
  // 同步下移、各所仍落在带内，不受此过滤影响。
  const others = dex
    ? othersAll.filter((u) => Math.abs(((u - dex.price) / dex.price) * 10000) <= ANCHOR_ADMIT_BPS)
    : othersAll;
  if (others.length) cands.push(median(others));
  if (!cands.length) return null;
  return { price: median(cands), dex };
}

// ---------- 推送文案 ----------
function fmt$(v) { return v === null || v === undefined || !Number.isFinite(v) ? '—' : `$${Number(v).toFixed(4)}`; }
function exitLines(symbol, venue, legs) {
  const dex = deepestDexLeg(legs, symbol);
  const dexTxt = dex ? `${dex.dex || ''} ${dex.pair || ''}（${dex.chain}）` : '—';
  const lines = [];
  if (BINANCE_SPOT_LISTED[symbol]) {
    const lanes = (BINANCE_FAST_LANES[symbol] || []).slice().sort((a, b) => a.timeMin - b.timeMin);
    const lane = lanes[0];
    const laneTxt = lane ? `充币安卖出（最快网络 ${lane.network} 约 ${lane.timeMin} 分钟${lane.unverified ? '，该网络充值支持待核实' : ''}）` : '充币安卖出';
    lines.push(`- 退出路径：①在 ${venue} 等回锚后原所卖出；②${laneTxt}；③提至链上在最深 DEX 池卖出：${dexTxt}`);
  } else {
    // 本层文案过滤 HTX：用户 2026-10-28 拍板 HTX 整体搁置（连信号源都不做），
    // 不得出现在本层的买入方案里；共享 ALT_EXIT_VENUES 原数据不动（慢线仍在用）。
    const alts = (ALT_EXIT_VENUES[symbol] || []).filter((v) => !/HTX/i.test(v.venue))
      .map((v) => `${v.venue} ${v.pair}（${v.cost}）`).join('；');
    lines.push(`- 退出路径：币安无 ${symbol} 现货。①在 ${venue} 等回锚后原所卖出；②充其他所卖出：${alts || '暂无已验证退出所，链上持有等回归'}；③提至链上在最深 DEX 池卖出：${dexTxt}`);
  }
  if (symbol === 'USDD') {
    lines.push('- USDD 备注：Gate 买入后也可走 TRC20 提至自托管钱包 → SunSwap V3 主池（USDT/USDD）卖出（2026-10-28 复盘：池深约 $2.15M、滑点 bp 级）；Gate 该交易对 App 内不展示，只能网页/API 交易');
  }
  return lines;
}

function composePush(ev, kind, ctx) {
  // kind: 'local'（锚完好，附方案） | 'notice'（锚破位/灰区，只提示） | 'deepen' | 'resolved'
  const sev = ev.level === 'severe' ? '严重' : '预警';
  if (kind === 'resolved') {
    return {
      title: `✅ ${ev.symbol}@${ev.venue} 跌点解除`,
      body: [
        `✅ 交易所跌点解除：${ev.symbol} @ ${ev.venue}`,
        ``,
        `- 现价：${fmt$(ev.priceUsd)}（相对锚超额 ${ev.excessBps >= 0 ? '+' : ''}${ev.excessBps.toFixed(1)} bps，已回锚）`,
        `- 事件峰值：超额 ${ev.peakExcessBps.toFixed(1)} bps；首次发现 ${ev.firstSeen}`,
        ...(ev.resolvedAt ? [`- 持续时长：约 ${fmtDurMin(ev.firstSeen, ev.resolvedAt)}`] : []),
        ...(ev.peakBuyableUsd ? [`- 期间最大可买量：约 $${Math.round(ev.peakBuyableUsd).toLocaleString()}（事件价位内，盘口模拟峰值）`] : []),
      ].join('\n'),
    };
  }
  const head = kind === 'notice'
    ? `⚠️ 交易所跌点（锚已破位，只提示不给方案）：${ev.symbol} @ ${ev.venue}`
    : `🎯 交易所单所跌点（可买）：${ev.symbol} @ ${ev.venue}`;
  const title = `${ev.level === 'severe' ? '🚨' : '🎯'} ${ev.symbol}@${ev.venue} ${kind === 'deepen' ? '跌点加深' : '单所跌点'} ${Math.abs(ev.excessBps).toFixed(0)}bps${kind === 'notice' ? '（锚破位·只提示）' : ''}`;
  const lines = [
    head,
    ``,
    `- 定性：${kind === 'notice'
      ? `全局锚 ${fmt$(ev.anchor)}（偏离 ${ev.anchorDevBps.toFixed(1)} bps，${Math.abs(ev.anchorDevBps) >= CEX_DIP_WARN_BPS ? '已破 ±0.5%' : '在 0.3%–0.5% 灰区'}），疑似全币事件——只提示、不给买入方案，等深化研判定性`
      : `全局锚 ${fmt$(ev.anchor)}（偏离 ${ev.anchorDevBps.toFixed(1)} bps，±0.3% 内完好），属单所局部流动性事件`}`,
    `- ${ev.venue} 现价：${fmt$(ev.priceUsd)}（${ev.pair}，相对锚超额 ${ev.excessBps.toFixed(1)} bps；已扣除该所常态偏移 ${ev.bandMedianBps >= 0 ? '+' : ''}${ev.bandMedianBps.toFixed(1)} bps）`,
    `- 级别：${sev}（超额线 预警 −0.5% / 严重 −1.5%，锚口径）；首次发现 ${ev.firstSeen}`,
  ];
  if (ctx.othersTxt) lines.push(`- 其他所同币价：${ctx.othersTxt}`);
  if (kind !== 'notice') {
    const s10 = ev.sim10, s30 = ev.sim30;
    const net10 = s10 ? ((ev.anchor - s10.avgUsd) / ev.anchor) * 10000 : null;
    const net30 = s30 ? ((ev.anchor - s30.avgUsd) / ev.anchor) * 10000 : null;
    lines.push(`- 盘口实测（触发当刻）：买 $10,000 均价 ${fmt$(s10?.avgUsd)}（净折价 ${net10 === null ? '—' : net10.toFixed(1) + ' bps'}，成交 ${s10 ? s10.filledPct.toFixed(0) : '—'}%）；买 $30,000 均价 ${fmt$(s30?.avgUsd)}（净折价 ${net30 === null ? '—' : net30.toFixed(1) + ' bps'}，成交 ${s30 ? s30.filledPct.toFixed(0) : '—'}%）`);
    lines.push(...exitLines(ev.symbol, ev.venue, ctx.legs));
    lines.push(`- 作废条件：锚跌破 ±0.5%、或 ${ev.venue} 该对充提异常、或价格回锚（超额回到 −0.3% 内将发解除通知）`);
  }
  return { title, body: lines.join('\n') };
}

// 机会类推送改入队（2026-10-30 套利体系整合，用户定稿：机会类先深化后推）：
// deps.enqueueArb 存在时，机会类（local/notice/deepen）不再直推，改为写入统一
// 套利事件队列，由研判层深化后推送；返回 {ok:true} 让调用方照常更新 lastPush*
// 状态（语义 = 已交付研判层，研判推过后由 arb_mark_done 回写 depeg 状态）。
// deps.enqueueArb 不存在时（如 dry-run 脚本）回落原直推通道。resolved 不走这里（保持直发）。
async function oppPush(deps, ev, kind, ctx) {
  const { title, body } = composePush(ev, kind, ctx);
  if (typeof deps.enqueueArb === 'function') {
    const r = deps.enqueueArb({
      id: `cex_dip:${ev.key}`,
      type: 'cex_dip',
      key: ev.key,
      severity: ev.level === 'severe' ? 'severe' : 'warn',
      payload: {
        key: ev.key, symbol: ev.symbol, venue: ev.venue, pair: ev.pair, kind,
        level: ev.level, excessBps: ev.excessBps, peakExcessBps: ev.peakExcessBps,
        priceUsd: ev.priceUsd, anchor: ev.anchor, anchorDevBps: ev.anchorDevBps,
        bandMedianBps: ev.bandMedianBps,
        sim10: ev.sim10 || null, sim30: ev.sim30 || null,
        firstSeen: ev.firstSeen,
      },
      factsText: `${title}\n\n${body}`,
    });
    return { ok: !!r?.enqueued, enqueued: true };
  }
  return deps.sendPushplus(title, body);
}

// ---------- 主扫描 ----------
// deps: { legs, sendPushplus, sendBark, options?: { stateDir, hooks?: { fetchPrices, fetchBook }, log } }
export async function scanCexDipWatch(deps) {
  const log = deps.options?.log || ((m) => console.log(m));
  const stateDir = deps.options?.stateDir || path.join(process.cwd(), 'state');
  const bandsFile = path.join(stateDir, 'cex_dip_bands.json');
  const eventsFile = path.join(stateDir, 'cex_dip_events.json');
  const hooks = deps.options?.hooks || {};
  // 分层轮询：options.onlySymbols 给定时只扫该层币种的组合（带宽/事件状态文件
  // 仍全量读写，两层由轮询器串行调用、不会并发写坏）；不给则全量扫（dry-run）。
  const onlySymbols = deps.options?.onlySymbols || null;
  const tier = deps.options?.tier || 'full';
  const activeCombos = onlySymbols
    ? CEX_DIP_COMBOS.filter((c) => onlySymbols.includes(c.symbol))
    : CEX_DIP_COMBOS;
  const fetchPrices = hooks.fetchPrices || ((lg) => fetchAllPairPrices(lg, activeCombos));
  const fetchBookFn = hooks.fetchBook || ((combo, lg) => fetchBook(combo, lg));
  const legs = deps.legs || [];
  const nowIso = new Date().toISOString();
  const today = cstDay();
  const night = isNightCst();
  const morning = isMorningQuietCst();

  const bandState = loadJsonFile(bandsFile, { combos: {}, lastSelfCheckDay: null });
  bandState.combos = bandState.combos || {};
  const evState = loadJsonFile(eventsFile, { events: {}, history: [] });
  evState.events = evState.events || {};
  evState.history = evState.history || [];

  // 1) 抓价 + 换算
  const pairPrices = await fetchPrices(log);
  const getPx = (symbol, venue) => pairPrices.get(`${symbol}@${venue}`);
  const usdtUsdRaw = getPx('USDT', 'Kraken');
  const usdtUsd = usdtUsdRaw > 0 ? usdtUsdRaw
    : median(['Coinbase', 'Binance'].map((v) => getPx('USDT', v)).filter((x) => x > 0));
  let usdcUsd = getPx('USDC', 'Kraken');
  if (!(usdcUsd > 0) && usdtUsd > 0) {
    const via = CEX_DIP_COMBOS.filter((c) => c.symbol === 'USDC' && c.quote === 'USDT')
      .map((c) => getPx(c.symbol, c.venue)).filter((x) => x > 0).map((x) => x * usdtUsd);
    usdcUsd = median(via);
  }
  const quoteRate = (q) => (q === 'USD' ? 1 : q === 'USDT' ? usdtUsd : q === 'USDC' ? usdcUsd : null);

  const usdByCombo = new Map(); // key -> { usd, combo }
  const usdBySymbol = new Map(); // symbol -> [{key, usd}]
  for (const c of activeCombos) {
    const px = getPx(c.symbol, c.venue);
    const rate = quoteRate(c.quote);
    if (!(px > 0) || !(rate > 0)) continue;
    const usd = px * rate;
    usdByCombo.set(comboKey(c), { usd, combo: c });
    if (!usdBySymbol.has(c.symbol)) usdBySymbol.set(c.symbol, []);
    usdBySymbol.get(c.symbol).push({ key: comboKey(c), usd });
  }

  // 2) 每日流动性自检（全组合双向模拟；不合格自动降级只观察，次日复检）
  // 分层轮询下按组合逐个判「今日未检」：本层组合在当天首轮补检，盘口拉取
  // 失败的组合不落 lastSelfCheck、下一轮自动重试（旧版全局日标记会跳过它一整天）。
  const dueSelfCheck = activeCombos.filter((c) => bandState.combos[comboKey(c)]?.lastSelfCheck?.day !== today);
  if (dueSelfCheck.length && usdtUsd > 0) {
    let changed = 0;
    for (const c of dueSelfCheck) {
      const key = comboKey(c);
      const rate = quoteRate(c.quote);
      if (!(rate > 0)) continue;
      try {
        const book = await fetchBookFn(c, log);
        const buy = simBuy(book, 10_000, rate);
        const sell = simSell(book, 10_000, rate);
        const midUsd = sell?.midUsd || null;
        const buySlip = buy && midUsd ? ((buy.avgUsd - midUsd) / midUsd) * 10000 : Infinity;
        const sellSlip = sell && midUsd ? ((midUsd - sell.avgUsd) / midUsd) * 10000 : Infinity;
        const pass = !!buy && !!sell && buy.filledPct >= GATE_FILL_PCT && sell.filledPct >= GATE_FILL_PCT
          && buySlip <= SELF_CHECK_MAX_SLIP_BPS && sellSlip <= SELF_CHECK_MAX_SLIP_BPS;
        const st = (bandState.combos[key] = bandState.combos[key] || { samples: [], demoted: false });
        if (pass && st.demoted) { st.demoted = false; changed++; log(`[cex-dip] 自检恢复：${key} 盘口重新合格，退出只观察（买滑 ${buySlip.toFixed(1)}bp / 卖滑 ${sellSlip.toFixed(1)}bp）`); }
        if (!pass && !st.demoted) { st.demoted = true; changed++; log(`[cex-dip] 自检降级：${key} 盘口跌破可交易门槛，降为只观察（买成交 ${buy ? buy.filledPct.toFixed(0) : '—'}% 滑 ${Number.isFinite(buySlip) ? buySlip.toFixed(1) : '—'}bp / 卖成交 ${sell ? sell.filledPct.toFixed(0) : '—'}% 滑 ${Number.isFinite(sellSlip) ? sellSlip.toFixed(1) : '—'}bp）`); }
        st.lastSelfCheck = { day: today, pass, buySlipBps: Number.isFinite(buySlip) ? round1(buySlip) : null, sellSlipBps: Number.isFinite(sellSlip) ? round1(sellSlip) : null };
      } catch (e) {
        log(`[cex-dip] 自检 ${key} 盘口拉取失败（保持原状态）：${e.message}`);
      }
      await sleep(80);
    }
    bandState.lastSelfCheckDay = today;
    if (changed) log(`[cex-dip] 每日流动性自检完成：${changed} 个组合状态变更`);
  }

  // 3) 逐组合：带宽采样 → 超额偏离 → 事件状态机
  let created = 0, pushed = 0;
  for (const c of activeCombos) {
    const key = comboKey(c);
    const entry = usdByCombo.get(key);
    const st = (bandState.combos[key] = bandState.combos[key] || { samples: [], demoted: false });
    st.samples = Array.isArray(st.samples) ? st.samples : [];
    const ev = evState.events[key];

    if (!entry) {
      if (ev) log(`[cex-dip] ${key} 本轮无价格，事件保持`);
      continue;
    }
    const anchor = anchorFor(c.symbol, key, legs, usdBySymbol, bandState);
    if (!anchor) {
      if (ev) log(`[cex-dip] ${key} 本轮无锚，事件保持`);
      continue;
    }
    const offsetBps = ((entry.usd - anchor.price) / anchor.price) * 10000;
    // 样本入带（异常样本不入，防跌点污染自己的带宽中心）。
    // 自轮询加密后采样按 SAMPLE_GAP_MS 间距入带：触发判定每 10/30 秒跑，
    // 但带宽只按 ≈4 分钟一个样本生长，时间跨度与 5 分钟时代一致。
    const curMedian = st.samples.length >= 3 ? median(st.samples) : null;
    const sampleGapMs = deps.options?.sampleGapMs ?? CEX_DIP_SAMPLE_GAP_MS;
    const lastSampleMs = st.lastSampleAt ? Date.parse(st.lastSampleAt) : 0;
    const sampleDue = !lastSampleMs || Date.now() - lastSampleMs >= sampleGapMs;
    if (sampleDue && (curMedian === null || Math.abs(offsetBps - curMedian) <= BAND_ADMIT_BPS)) {
      st.samples.push(round1(offsetBps));
      st.lastSampleAt = nowIso;
      if (st.samples.length > CEX_DIP_MAX_SAMPLES) st.samples = st.samples.slice(-CEX_DIP_MAX_SAMPLES);
    }
    st.updatedAt = nowIso;
    if (st.samples.length < CEX_DIP_MIN_SAMPLES) {
      if (ev) log(`[cex-dip] ${key} 带宽样本不足（${st.samples.length}/${CEX_DIP_MIN_SAMPLES}），事件保持`);
      continue;
    }
    const bandMedianBps = median(st.samples);
    const excessBps = offsetBps - bandMedianBps;
    const anchorDevBps = ((anchor.price - 1) / 1) * 10000;
    const level = excessBps <= -CEX_DIP_SEVERE_BPS ? 'severe' : excessBps <= -CEX_DIP_WARN_BPS ? 'warn' : null;
    const anchorState = Math.abs(anchorDevBps) <= CEX_DIP_CLEAR_BPS ? 'intact'
      : Math.abs(anchorDevBps) >= CEX_DIP_WARN_BPS ? 'broken' : 'gray';

    const othersTxt = (usdBySymbol.get(c.symbol) || [])
      .filter((v) => v.key !== key)
      .map((v) => `${v.key.split('@')[1]} $${v.usd.toFixed(4)}`).join(' / ') || null;

    // --- 存续事件 ---
    if (ev && ev.status === 'active') {
      ev.lastSeen = nowIso;
      ev.priceUsd = entry.usd;
      ev.anchor = anchor.price;
      ev.anchorDevBps = round1(anchorDevBps);
      ev.excessBps = round1(excessBps);
      ev.peakExcessBps = Math.min(ev.peakExcessBps ?? excessBps, excessBps);
      if (level) ev.level = level;
      if (excessBps >= -CEX_DIP_CLEAR_BPS) {
        // 回锚解除
        ev.status = 'resolved';
        ev.resolvedAt = nowIso;
        evState.history.unshift({ ...ev });
        evState.history = evState.history.slice(0, 200);
        delete evState.events[key];
        // 2026-10-30 口径收紧：解除小结只对研判层「实际推送过」的事件发（done 账本
        // pushed=true 为准）；仅入队未推的（研判判 B/C）解除不打扰。归档不受时段限制。
        const wasPushed = researchPushed('cex_dip', key, ev.firstSeen);
        if (wasPushed) {
          appendEpisodeSummary({ type: 'cex_dip', key, peakTxt: `峰值超额 ${Math.abs(ev.peakExcessBps).toFixed(1)} bps`, durMin: Math.max(1, Math.round((Date.parse(ev.resolvedAt) - Date.parse(ev.firstSeen)) / 60000)), volumeTxt: ev.peakBuyableUsd ? `期间最大可买量约 $${Math.round(ev.peakBuyableUsd).toLocaleString()}（事件价位内模拟）` : '' });
        }
        if (wasPushed && !night) {
          const { title, body } = composePush(ev, 'resolved', { legs });
          const r = await deps.sendPushplus(title, body);
          if (r?.ok) pushed++;
        } else if (wasPushed) {
          log(`[cex-dip] ${key} 跌点解除（半夜不推，只记日志）`);
        }
        continue;
      }
      // 延迟推送（早上静默压住的新事件，10 点后仍在跌点中 → 补推为新事件）
      if (ev.pendingPush && !morning && level) {
        const kind = anchorState === 'intact' ? 'local' : 'notice';
        const r = await oppPush(deps, ev, kind, { legs, othersTxt });
        if (r?.ok) {
          ev.pendingPush = false;
          ev.lastPushExcessBps = round1(excessBps);
          ev.lastPushAt = nowIso;
          pushed++;
          // Bark 改由研判层按 S 级口径决定（2026-10-30 整合），此处不再直发
        }
        continue;
      }
      // 加深再推（≥30bps；不按固定间隔刷屏）
      if (!ev.pendingPush && ev.lastPushExcessBps !== null && ev.lastPushExcessBps !== undefined
        && (ev.lastPushExcessBps - excessBps) >= CEX_DIP_DEEPEN_BPS) {
        if (morning && ev.level !== 'severe') {
          log(`[cex-dip] ${key} 加深至 ${excessBps.toFixed(1)}bps（早上静默预警级，延迟推送）`);
          continue;
        }
        // 加深推送前刷新盘口模拟（锚完好时文案带新数字）
        if (anchorState === 'intact') {
          try {
            const book = await fetchBookFn(c, log);
            const rate = quoteRate(c.quote);
            ev.sim10 = simBuy(book, 10_000, rate);
            ev.sim30 = simBuy(book, 30_000, rate);
            const pb = buyableWithinCap(book, rate, ev.priceUsd);
            if (pb > 0) ev.peakBuyableUsd = Math.max(ev.peakBuyableUsd || 0, Math.round(pb));
          } catch (e) { log(`[cex-dip] ${key} 加深复核盘口失败：${e.message}`); }
        }
        const kind = anchorState === 'intact' ? 'deepen' : 'notice';
        const r = await oppPush(deps, { ...ev, level: ev.level }, kind, { legs, othersTxt });
        if (r?.ok) {
          ev.lastPushExcessBps = round1(excessBps);
          ev.lastPushAt = nowIso;
          pushed++;
          // Bark 改由研判层按 S 级口径决定（2026-10-30 整合），此处不再直发
        }
      }
      continue;
    }

    // --- 无事件：是否新建 ---
    if (!level) continue;
    if (st.demoted) {
      log(`[cex-dip] ${key} 跌出带宽 ${excessBps.toFixed(1)}bps，但该组合已被自检降级只观察，不建事件`);
      continue;
    }
    // 2026-10-29 自价护栏（PYUSD@OKX 假报警后加）：本所 USD 价本身在 ±0.5% 内时，
    // 不许仅凭锚偏离建跌点事件——锚被坏源毒化时正常所会被误判；此种情形判为
    // 锚/数据源异常，只记观察不推送。真跌点必然表现为本所价自身跌破 $1，不受影响。
    if (Math.abs((entry.usd - 1) * 10000) <= CEX_DIP_WARN_BPS) {
      if (st.lastSelfGuardDay !== today) {
        st.lastSelfGuardDay = today;
        evState.history.unshift({
          key, symbol: c.symbol, venue: c.venue, pair: c.pair,
          price: entry.usd, excessBps: round1(excessBps), level,
          firstSeen: nowIso, status: 'anchor-anomaly-observe',
          note: `本所价 ${entry.usd.toFixed(4)} 在 ±0.5% 内、锚 ${anchor.price.toFixed(4)} 偏离 ${anchorDevBps.toFixed(1)}bps，判为锚/数据源异常而非跌点，只记观察不推送`,
        });
        evState.history = evState.history.slice(0, 200);
      }
      log(`[cex-dip] ${key} 本所价 ${entry.usd.toFixed(4)} 在 ±0.5% 内但锚偏离 ${anchorDevBps.toFixed(1)}bps，判锚异常，不建事件`);
      continue;
    }
    if (c.singleSource) {
      // 单源币：须 DEX 腿（≥$100k）同向确认才建事件，否则只记观察（矩阵报告口径）
      const confirmed = (legs || []).some((l) => l.symbol === c.symbol && l.price > 0
        && (l.liq || 0) >= DEPEG_TRIGGER_MIN_LIQ_USD_LOCAL && ((l.price - 1) * 10000) <= -DEX_CONFIRM_BPS);
      if (!confirmed) {
        if (st.lastObserveDay !== today) {
          st.lastObserveDay = today;
          evState.history.unshift({
            key, symbol: c.symbol, venue: c.venue, pair: c.pair,
            price: entry.usd, excessBps: round1(excessBps), level,
            firstSeen: nowIso, status: 'single-source-observe',
            note: '单 CEX 源破线，DEX 腿未同向确认（≥$100k 腿偏离未达 −25bps），只记观察不推送（矩阵报告口径）',
          });
          evState.history = evState.history.slice(0, 200);
        }
        log(`[cex-dip] ${key} 单源破线 ${excessBps.toFixed(1)}bps，DEX 未确认，只观察`);
        continue;
      }
    }
    // 流动性关：触发当刻盘口模拟
    let book = null, sim10 = null, sim30 = null;
    try {
      book = await fetchBookFn(c, log);
      const rate = quoteRate(c.quote);
      sim10 = simBuy(book, 10_000, rate);
      sim30 = simBuy(book, 30_000, rate);
    } catch (e) {
      log(`[cex-dip] ${key} 触发但盘口拉取失败，不建事件：${e.message}`);
      continue;
    }
    const gatePass = !!sim10 && sim10.filledPct >= GATE_FILL_PCT && sim10.avgUsd < anchor.price;
    if (!gatePass) {
      if (st.lastLiqBlockDay !== today) {
        st.lastLiqBlockDay = today;
        evState.history.unshift({
          key, symbol: c.symbol, venue: c.venue, pair: c.pair,
          price: entry.usd, excessBps: round1(excessBps), level,
          sim10: sim10 ? { avgUsd: sim10.avgUsd, filledPct: round1(sim10.filledPct) } : null,
          firstSeen: nowIso, status: 'liquidity-blocked',
          note: `跌出带宽但盘口模拟未过流动性关（$10k 成交 ${sim10 ? sim10.filledPct.toFixed(0) : '—'}% / 均价 ${sim10 ? sim10.avgUsd.toFixed(4) : '—'} vs 锚 ${anchor.price.toFixed(4)}），只记日志不推送`,
        });
        evState.history = evState.history.slice(0, 200);
      }
      log(`[cex-dip] ${key} 跌 ${excessBps.toFixed(1)}bps 未过流动性关：$10k 成交 ${sim10 ? sim10.filledPct.toFixed(0) : '—'}%，均价 ${sim10 ? sim10.avgUsd.toFixed(4) : '—'}，锚 ${anchor.price.toFixed(4)}，不推送`);
      continue;
    }
    // 建事件
    const newEv = {
      key, symbol: c.symbol, venue: c.venue, pair: c.pair,
      price: entry.usd, priceUsd: entry.usd,
      anchor: anchor.price, anchorDevBps: round1(anchorDevBps),
      bandMedianBps: round1(bandMedianBps),
      excessBps: round1(excessBps), peakExcessBps: round1(excessBps),
      level, sim10, sim30,
      peakBuyableUsd: book ? Math.round(buyableWithinCap(book, quoteRate(c.quote), entry.usd)) : 0,
      firstSeen: nowIso, lastSeen: nowIso,
      lastPushAt: null, lastPushExcessBps: null, pendingPush: false,
      status: 'active',
    };
    evState.events[key] = newEv;
    created++;
    // 早上静默：预警级建事件但压住推送，10 点后由存续逻辑补推
    if (morning && level !== 'severe') {
      newEv.pendingPush = true;
      log(`[cex-dip] ${key} 新跌点 ${excessBps.toFixed(1)}bps（早上静默预警级，已建事件延迟推送）`);
      continue;
    }
    const kind = anchorState === 'intact' ? 'local' : 'notice';
    const r = await oppPush(deps, newEv, kind, { legs, othersTxt });
    if (r?.ok) {
      newEv.lastPushExcessBps = round1(excessBps);
      newEv.lastPushAt = nowIso;
      pushed++;
      // Bark 改由研判层按 S 级口径决定（2026-10-30 整合：仅 S 级、00:00–08:00 不发、
      // USDD 永不发），此处不再直发
    }
  }

  saveJsonFile(bandsFile, bandState);
  saveJsonFile(eventsFile, evState);
  const active = Object.keys(evState.events).length;
  log(`[cex-dip] 逐所盯跌扫描完成（${tier}层）：${usdByCombo.size}/${activeCombos.length} 组合有价，新建 ${created}，推送 ${pushed}，活跃 ${active}`);
  return { combos: usdByCombo.size, total: activeCombos.length, tier, created, pushed, active, usdtUsd };
}

// ---------- 自轮询（与 depeg sweep 解耦，2026-10-28 加密） ----------
// getDeps()：每次取最新 deps（server.js 注入最近一轮 DEX 锚腿 + 真实推送函数）。
// 一个 10 秒定时器驱动两层：fast 层每轮都跑；slow 层每 slowMs 跑一次。
// 两层在同一定时器内串行 await，天然不并发写状态文件；再加 running 守卫：
// 上一轮未跑完时跳过本轮（只计数、节流记日志），绝不堆积。
// opts: { log, fastMs, slowMs, onSummary(tier, summary) }
export function startCexDipPoller(getDeps, opts = {}) {
  const log = opts.log || ((m) => console.log(m));
  const fastMs = opts.fastMs ?? CEX_DIP_FAST_MS;
  const slowMs = opts.slowMs ?? CEX_DIP_SLOW_MS;
  let running = false;
  let stopped = false;
  let lastSlowAt = 0;
  let skipped = 0;

  async function tick() {
    if (stopped) return;
    if (running) {
      skipped++;
      if (skipped === 1 || skipped % 30 === 0) log(`[cex-dip] 自轮询上一轮未结束，跳过本轮（累计跳过 ${skipped} 次）`);
      return;
    }
    running = true;
    try {
      let base = null;
      try {
        base = getDeps() || {};
      } catch (e) {
        log(`[cex-dip] 自轮询取 deps 失败：${e.message}`);
        return;
      }
      const runTier = async (tierName, symbols) => {
        try {
          const summary = await scanCexDipWatch({
            ...base,
            options: { ...(base.options || {}), onlySymbols: symbols, tier: tierName },
          });
          if (opts.onSummary) opts.onSummary(tierName, summary);
        } catch (e) {
          log(`[cex-dip] 自轮询 ${tierName} 层异常：${e.message}`);
        }
      };
      await runTier('fast', CEX_DIP_FAST_SYMBOLS);
      if (Date.now() - lastSlowAt >= slowMs) {
        lastSlowAt = Date.now();
        await runTier('slow', CEX_DIP_SLOW_SYMBOLS);
      }
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, fastMs);
  if (timer.unref) timer.unref();
  tick();
  log(`[cex-dip] 逐所盯跌自轮询已启动：fast 层（${CEX_DIP_FAST_SYMBOLS.join('/')}）每 ${fastMs / 1000}s、slow 层（${CEX_DIP_SLOW_SYMBOLS.join('/')}）每 ${slowMs / 1000}s，进程内运行、零 agent 唤起`);
  return {
    stop: () => { stopped = true; clearInterval(timer); },
  };
}
