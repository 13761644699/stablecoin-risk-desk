// CEX 稳定币现货 + LST 监控（2026-10-03 用户要求）
// 背景：stablecoin-risk-desk 常驻服务内新增的外部抓取全部 fetch failed（原因未明，
// 独立进程测试完全正常），故拆为独立脚本 + cron，每 5 分钟一轮。
//
// A. 稳定币 CEX 现货（9 条）：币安 7 个（USDT/USDC/USDS/USDe/USD1/RLUSD/U）+ Gate 2 个（PYUSD/USDG）
// 2026-10-10 用户要求去掉 Gate USDD：该交易对无流动性，报价无意义，只产噪音
// 锚定 $1，±0.5% 预警 / ±1.5% 严重，同脱锚口径。
// B. LST（8 个）：wstETH/weETH/rETH/JitoSOL/BNSOL/wBETH/sUSDe/sUSDS（2026-10-03 用户去掉 cbETH/mSOL）
// 跟踪 LST/native 比率（sUSDe/sUSDS 为 USD 价）相对 24h 基线的折价，-0.5% 预警 / -1.5% 严重，只看下跌。
// 双源复核：wstETH/weETH/JitoSOL 有备池，分歧 >50bps 标注。
// 出口（2026-10-30 迁移，用户定稿 + 11:45 事故修补）：机会类不再直推——
// 触发一律入统一队列（arb_lib.enqueueArbEvent）走「先研判后推」，与脱锚台
// DEX 腿/逐所盯跌/大跌同口径。此前本脚本自带直推是迁移缺口（2026-10-30
// 11:44 USDT@CEX-Binance 在币安充提冻结期间被直推即源于此）。
// 场所状态门（F7）：主要场所充提冻结期间（state/venue_status.json），该
// 场所自身腿只记档+背景、不入队不推送。静默口径：08:00–10:00 预警级不入
// 队（10 点后正常轮次补入，与原不推口径等价）；推送时点与 Bark 由研判层管。
import fs from 'fs';
import path from 'path';
import { fileURLToPath} from 'url';
import { enqueueArbEvent, removeFromQueue, venueDwFrozen } from './arb_lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(DIR, 'state', 'cex_lst_state.json');
const LST_HIST = path.join(DIR, 'state', 'cex_lst_ratio_hist.json');
const DEDUP_MS = 30 * 60 * 1000;

const STABLE_CEX = [
{ symbol: 'USDT', exchange: 'Binance', pair: 'USDTUSD', quote: 'USD'},
{ symbol: 'USDC', exchange: 'Binance', pair: 'USDCUSDT', quote: 'USDT'},
{ symbol: 'USDS', exchange: 'Binance', pair: 'USDSUSDT', quote: 'USDT'},
{ symbol: 'USDe', exchange: 'Binance', pair: 'USDEUSDT', quote: 'USDT'},
{ symbol: 'USD1', exchange: 'Binance', pair: 'USD1USDT', quote: 'USDT'},
{ symbol: 'RLUSD', exchange: 'Binance', pair: 'RLUSDUSDT', quote: 'USDT'},
{ symbol: 'U', exchange: 'Binance', pair: 'UUSDT', quote: 'USDT'},
{ symbol: 'PYUSD', exchange: 'Gate', pair: 'PYUSD_USDT', quote: 'USDT'},
{ symbol: 'USDG', exchange: 'Gate', pair: 'USDG_USDT', quote: 'USDT'},
];

// token: 主网 LST token 地址（dex 查询用）；pair: 主池地址；secPair/secToken: 备池
const LST = [
{ symbol: 'wstETH', native: 'ETH', kind: 'ratio', token: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
pair: '0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa', chain: 'ethereum', label: 'Uniswap主网',
secToken: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', secPair: '0x861A2922bE165a5Bd41b1E482B49216b465e1B5F', secChain: 'base', secLabel: 'Aerodrome Base'},
{ symbol: 'weETH', native: 'ETH', kind: 'ratio', token: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
pair: '0x202A6012894Ae5c288eA824cbc8A9bfb26A49b93', chain: 'ethereum', label: 'Uniswap主网', // 2026-10-07 修：原主池 0x7A41…CAe3 已死，换 Uniswap v3 现存活池（$4.8M）
secToken: '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A', secPair: '0x91F0f34916Ca4E2cCe120116774b0e4fA0cdcaA8', secChain: 'base', secLabel: 'Aerodrome Base'},
{ symbol: 'rETH', native: 'ETH', kind: 'ratio', token: '0xae78736cd615f374d3085c652b38249b0d0b2d9056c',
pair: '0x553e9C493678d8606d6a5ba284643dB2110Df823', chain: 'ethereum', label: 'Uniswap主网'},
{ symbol: 'JitoSOL', native: 'SOL', kind: 'ratio', token: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
pair: 'Hp53XEtt4S8SvPCXarsLSdGfZBuUr5mMmZmX2DRNXQKp', chain: 'solana', label: 'Orca',
secToken: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', secPair: 'ERgpKaq59Nnfm9YRVAAhnq16cZhHxGcDoDWCzXbhiaNw', secChain: 'solana', secLabel: 'Meteora'},
{ symbol: 'BNSOL', native: 'SOL', kind: 'ratio', cex: 'BNSOLSOL', label: 'Binance现货'},
{ symbol: 'wBETH', native: 'ETH', kind: 'ratio', cex: 'WBETHETH', label: 'Binance现货'},
{ symbol: 'sUSDe', native: 'USD', kind: 'usd', token: '0x9d39a5de30e57443bff2a07b575536f56b539d',
pair: '0xb20351bcf606dcc3525d2ed36760a86a5dec7423b77d41125bd4a416ba93448b', chain: 'ethereum', label: 'Uniswap主网sUSDe/USDT'},
{ symbol: 'sUSDS', native: 'USD', kind: 'usd', token: '0xa3931d71877c0e7a3148cb22b658ac27d26f3527',
pair: '0x81A2612F6dEA269a6Dd1F6DeAb45C5424EE2c4b7', chain: 'ethereum', label: 'Curve主网sUSDS/frxUSD'},
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function loadJson(f, fb) { try { return JSON.parse(fs.readFileSync(f, 'utf8'));} catch { return fb;}}
function saveJson(f, o) {
fs.mkdirSync(path.dirname(f), { recursive: true});
fs.writeFileSync(f, JSON.stringify(o));
}
async function fetchJson(url, ms = 15000) {
const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'cex-lst-watch/1.0'}, signal: AbortSignal.timeout(ms)});
if (!r.ok) throw new Error(`HTTP ${r.status}`);
return r.json();
}
// 2026-10-04 用户要求：08:00–10:00 预警级不推，严重级照常穿透（09:40 澄清）
// 2026-10-30 迁移后语义平移为：预警级静默时段不入队，10 点后正常轮次补入。
function isMorningQuiet() {
const h = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false}));
return h >= 8 && h < 10;
}
// （直推通道 sendPushplus/sendBark 已于 2026-10-30 迁移时拆除：本脚本不再
// 持有任何推送出口，触发只入统一队列，见文件尾主流程。）

// ---- A. 稳定币 CEX 现货 ----
async function getStableCex() {
const out = [];
const bn = STABLE_CEX.filter((c) => c.exchange === 'Binance');
try {
const syms = encodeURIComponent(JSON.stringify(bn.map((c) => c.pair)));
const data = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/price?symbols=${syms}`);
const m = new Map((Array.isArray(data)? data: []).map((d) => [String(d.symbol).toUpperCase(), Number(d.price)]));
for (const c of bn) {
const px = m.get(c.pair.toUpperCase());
if (px > 0) out.push({ key: `${c.symbol}@CEX-Binance`, symbol: c.symbol, venue: 'CEX-Binance', gateVenue: 'Binance', price: px, devBps: (px - 1) * 10000, detail: `${c.pair}（${c.quote}本位）@${c.exchange}`,
src: `Binance 现货 API（${c.pair}，${c.quote}本位）`, chain: 'CEX-Binance', kind: 'cex' });
await sleep(100);
}
} catch (e) { console.log('[cex-lst] Binance 现货失败：' + e.message);}
for (const c of STABLE_CEX.filter((c) => c.exchange === 'Gate')) {
try {
const data = await fetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${c.pair}`);
const px = Number(Array.isArray(data)? data[0]?.last: null);
if (px > 0) out.push({ key: `${c.symbol}@CEX-Gate`, symbol: c.symbol, venue: 'CEX-Gate', gateVenue: 'Gate', price: px, devBps: (px - 1) * 10000, detail: `${c.pair}（${c.quote}本位）@${c.exchange}`,
src: `Gate 现货 API（${c.pair}，${c.quote}本位）`, chain: 'CEX-Gate', kind: 'cex' });
} catch (e) { console.log(`[cex-lst] Gate ${c.pair} 失败：` + e.message);}
await sleep(300);
}
return out;
}

// ---- B. LST ----
async function dexValue(sym, token, chain, pairAddr, kind) {
const queries = [sym, token];
for (const q of queries) {
try {
const d = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
const p = (d.pairs || []).find(
(x) => String(x.pairAddress || '').toLowerCase() === pairAddr.toLowerCase() && x.chainId === chain);
if (p) {
let v = kind === 'usd' ? Number(p.priceUsd) : Number(p.priceNative);
if (!(v > 0)) return null;
if (kind === 'ratio' && v < 1.0) v = 1 / v; // LST/native 比率恒 ≥1.0，小于 1 说明池子报价方向反了
return v;
}
} catch {}
await sleep(400);
}
return null;
}
async function getLst() {
const out = [];
const hist = loadJson(LST_HIST, {});
const nowMs = Date.now();
for (const c of LST) {
try {
let value = null, disagree = '';
if (c.cex) {
const d = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${c.cex}`);
value = Number(d.price) || null;
} else {
value = await dexValue(c.symbol, c.token, c.chain, c.pair, c.kind);
if (c.secPair && value) {
try {
const v2 = await dexValue(c.symbol, c.secToken, c.secChain, c.secPair, c.kind);
if (v2) {
const diffBps = (Math.abs(value - v2) / v2) * 10000;
if (diffBps > 50) disagree = `（⚠️双源分歧${diffBps.toFixed(0)}bps：主${value.toFixed(4)}/备${v2.toFixed(4)}）`;
}
} catch { /* 备源失败不影响主源 */}
await sleep(300);
}
}
if (!(value > 0)) { console.log(`[cex-lst] LST 无价：${c.symbol}`); continue;}
hist[c.symbol] = hist[c.symbol] || [];
hist[c.symbol].push({ t: nowMs, v: value});
hist[c.symbol] = hist[c.symbol].filter((x) => x.t > nowMs - 30 * 3600e3);
const target = nowMs - 24 * 3600e3;
// 2026-10-06 防误报：基线取 24h 前 ±30min 窗口的中位数（原单点最近值易被坏点毒化）
// 注意：不要加"连续相同值判卡死"——LST 比率（如 wstETH/ETH）本身变化极慢，1 小时不动是正常的，
// 加了会把正常监控杀掉（2026-10-06 实测已验证）。usd 腿靠下面的"美元锚"防数据源跳变型误报。
const winPts = hist[c.symbol].filter((x) => Math.abs(x.t - target) <= 30 * 60e3).map((x) => x.v).sort((a, b) => a - b);
const spanH = hist[c.symbol].length? (nowMs - hist[c.symbol][0].t) / 3600e3: 0;
if (winPts.length < 3 || spanH < 12) {
console.log(`[cex-lst] ${c.symbol} 基线积累中（${hist[c.symbol].length}点）`);
continue;
}
const baseV = winPts[Math.floor(winPts.length / 2)];
const raw = ((value - baseV) / baseV) * 10000;
let devBps = raw < 0? raw: 0; // 只看折价
let vsDollarTxt = '';
if (c.kind === 'usd') {
// 2026-10-06 防误报：usd 腿同时要求相对 $1 也折价（取两者中更接近 0 的）
// sUSDS 是美元储蓄代币，$1 之上不算脱锚；单一样本跳变多为数据源跳变而非市场
const vsDollar = ((value - 1) / 1) * 10000;
const vsDollarNeg = vsDollar < 0? vsDollar: 0;
devBps = Math.max(devBps, vsDollarNeg);
vsDollarTxt = `，相对$1 ${vsDollarNeg.toFixed(1)}bps`;
}
const unit = c.kind === 'usd'? 'USD价': '比率';
const src = c.cex? `Binance 现货 API（${c.cex}）`: `DexScreener · ${c.label}`;
out.push({
key: `${c.symbol}@LST-${c.native}`, symbol: c.symbol, venue: `LST-${c.native}`,
gateVenue: c.cex ? 'Binance' : null, // 现货源为币安的 LST 腿同样过场所状态门；DEX 源腿无场所门
price: value, devBps, src, chain: c.chain || c.native, kind: 'lst',
detail: `${c.symbol}/${c.native} ${unit}${value.toFixed(4)}，24h基线${baseV.toFixed(4)}${vsDollarTxt}${disagree}（${c.label}）`,
});
} catch (e) { console.log(`[cex-lst] LST ${c.symbol} 失败：` + e.message);}
await sleep(400);
}
saveJson(LST_HIST, hist);
return out;
}

// ---- 主流程 ----
const legs = [...(await getStableCex()),...(await getLst())];
const state = loadJson(STATE, { alerts: {}});
const nowMs = Date.now();
// 2026-10-04 用户澄清：08:00–10:00 预警级不推（不写去重，10 点后正常推）；严重级照常推送
const morningQuiet = isMorningQuiet();
// 原始偏离级别（不过滤，供事件 resolve 用）
const rawLevels = new Map();
const measuredKeys = new Set();
for (const leg of legs) {
measuredKeys.add(leg.key);
const a = Math.abs(leg.devBps);
const lv = a >= 150? 'severe': a >= 50? 'warn': null;
if (lv) rawLevels.set(leg.key, lv);
}
const hits = [];
for (const leg of legs) {
const level = rawLevels.get(leg.key);
if (!level) continue;
if (morningQuiet && level !== 'severe') continue;
const key = `${leg.key}:${level}`;
if (nowMs - (state.alerts[key] || 0) < DEDUP_MS) continue;
hits.push({...leg, level});
}
// 注意：去重时间戳在推送成功后才写（见末尾）；推送失败不写，下次重推（2026-10-04 修）

// 2026-10-06：把 cex-lst 事件写入 depeg_events.json，供慢线富化消费
// （与主脱锚监控同 schema；key 格式不同无冲突；resolve 逻辑见末尾）
const EVENTS_FILE = path.join(DIR, 'state', 'depeg_events.json');
function loadEvents() {
try {
const d = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
d.events = d.events || {}; d.history = d.history || [];
return d;
} catch { return { events: {}, history: []};}
}
function syncCexLstEvents(hitList) {
const store = loadEvents();
const nowIso = new Date(nowMs).toISOString();
const hitKeys = new Set(hitList.map((h) => h.key));
for (const h of hitList) {
const prev = store.events[h.key];
const dev = Math.round(h.devBps * 10) / 10;
if (prev && prev.status === 'active') {
prev.lastSeen = nowIso; prev.price = h.price; prev.devBps = dev;
prev.peakDevBps = Math.max(prev.peakDevBps || 0, Math.abs(dev));
if (prev.level === 'warn' && h.level === 'severe') prev.level = 'severe';
// 2026-10-30 迁移：不再有直推，lastPushAt 不再由本脚本写；入队/背景分别记账
if (h.enqueued) { prev.lastEnqueueAt = nowIso; prev.lastPushKind = `enqueued-${h.level}`;}
if (h.background) { prev.venueBackground = true; prev.lastPushKind = 'background-venue-frozen';}
prev.src = h.src;
} else {
store.events[h.key] = {
key: h.key, symbol: h.symbol, chain: h.chain,
price: h.price, liq: null,
dex: h.kind === 'cex'? h.src.split('现货')[0].trim(): 'DexScreener',
pair: h.detail, method: 'cex-lst',
src: h.src, // 数据源：交易所或池子（2026-10-06 用户要求推送写清）
gateVenue: h.gateVenue || null,
venueBackground: !!h.background,
confirm: 'likely', confirmSrc: h.src,
devBps: dev, level: h.level,
peakDevBps: Math.abs(dev),
firstSeen: nowIso, lastSeen: nowIso,
lastPushAt: null, lastPushKind: h.background? 'background-venue-frozen': h.enqueued? `enqueued-${h.level}`: null,
lastEnqueueAt: h.enqueued? nowIso: null,
enriched: false, status: 'active',
};
}
}
// resolve：本轮已实测且不再偏离的 cex-lst 事件自动解除；超过 2h 未更新的也解除
for (const [k, ev] of Object.entries(store.events)) {
if (ev.method !== 'cex-lst' || ev.status !== 'active') continue;
const gone = (measuredKeys.has(k) && !rawLevels.has(k))
|| (nowMs - new Date(ev.lastSeen || 0).getTime() > 2 * 3600e3);
if (gone && !hitKeys.has(k)) {
ev.status = 'resolved';
ev.note = 'cex-lst 本轮未再触发，自动解除';
// 曾入队且仍未被研判消费的条目随解除一并清出队列（与脱锚台解除口径一致）
if (ev.lastEnqueueAt) { try { removeFromQueue(`depeg:${k}`);} catch { /* 队列无此条目不阻断 */ } }
}
}
fs.writeFileSync(EVENTS_FILE, JSON.stringify(store));
console.log(`[cex-lst] 富化事件已同步：${hitList.length} 活跃`);
}

if (!hits.length) {
// 无触发也做一次 resolve 同步（静默，不推送）
try { syncCexLstEvents([]);} catch (e) { console.log('[cex-lst] 事件同步失败：' + e.message);}
console.log(`[${new Date().toISOString()}] cex-lst 正常：${legs.length} 条有价，无触发`);
process.exit(0);
}
// 2026-10-30 迁移：触发一律入统一队列走「先研判后推」，本脚本无推送出口。
// 场所状态门（F7）先行：主要场所充提冻结期间，其自身腿只记档+背景。
const enqueued = [], backgrounded = [];
for (const h of hits) {
if (h.gateVenue && venueDwFrozen(h.gateVenue)) {
h.background = true; backgrounded.push(h);
console.log(`[cex-lst] 场所状态门（F7）：${h.key} 场所 ${h.gateVenue} 充提冻结中，只记档+背景、不入队不推送（${h.devBps.toFixed(1)}bps）`);
continue;
}
const dir = h.devBps < 0? '折价': '溢价';
try {
const r = enqueueArbEvent({
id: `depeg:${h.key}`, type: 'depeg', key: h.key,
severity: h.level === 'severe'? 'severe': 'warn',
payload: {
key: h.key, symbol: h.symbol, chain: h.chain, kind: 'cex-lst', level: h.level,
devBps: Math.round(h.devBps * 10) / 10, peakDevBps: Math.abs(Math.round(h.devBps * 10) / 10),
price: h.price, venue: h.venue, gateVenue: h.gateVenue || null,
src: h.src, detail: h.detail, firstSeen: new Date(nowMs).toISOString(),
},
factsText: `[cex-lst] ${h.level === 'severe'? '🚨': '⚠️'} ${h.symbol}@${h.venue} ${dir} ${Math.abs(h.devBps).toFixed(1)}bps\n- ${h.detail}\n- 数据源：${h.src}\n- 口径：CEX/LST 快线触发（±0.5% 预警 / ±1.5% 严重）；研判须先过 F1/F4/F7 再定性，路径涉及冻结场所的腿判不可执行`,
});
if (r.enqueued) { h.enqueued = true; enqueued.push(h); console.log(`[cex-lst] ${h.key} 已入队深化研判（${h.level}）`);}
} catch (e) { console.log(`[cex-lst] ${h.key} 入队失败：${e.message}`);}
}
// 去重时间戳在入队成功后才写（原「推送成功才写」口径平移，2026-10-04 修的
// 语义保留）；入队失败不写、下轮重试；背景条目不写去重（持续记档更新）。
if (enqueued.length) {
for (const h of enqueued) state.alerts[`${h.key}:${h.level}`] = nowMs;
saveJson(STATE, state);
}
try { syncCexLstEvents(hits);} catch (e) { console.log('[cex-lst] 事件同步失败：' + e.message);}
console.log(`[${new Date().toISOString()}] 触发 ${hits.length} 条：入队 ${enqueued.length}、场所门背景 ${backgrounded.length}`);
