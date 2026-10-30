#!/usr/bin/env node
// hotwallet_inferred_watch.mjs — 热钱包簇出款流量 inferred 信号（2026-10-30 定案
// 实施「判停」半边；OKX×TRON + Binance×TRON 先行）
// 职责：按场所×链的热钱包簇聚合「散户型出款」（簇内运营钱包 → 簇外且非已知
// 交易所地址的 TRX 原生转账笔数），以 5 分钟桶跑 live→stopped→resumed 状态机：
// - live→stopped（连续 2 桶零出款、此前为 live）：机器可判的「该场所该链
// 提现已停」硬证据 → 写 venue_status_inferred.json 的 withdraw=
// inferred-closed 并入队研判（风险侧 + F7 状态门输入）。
// - stopped→resumed（停后首个桶出现 ≥3 笔散户型出款）：「疑似恢复」入队，
// 供研判现查；inferred 的「开」方向不被任何消费者单独改判搬砖成立
// （arb_cex_cross_watch 只采信 inferred-closed 补 unknown 维）。
// 证据定级：低于官方公告/API、高于纯价格推断（对提现腿是链上直证）。
// 判据用笔数不用金额（2026-10-30 验证实证：鲸鱼收款方占金额约 42%）。
// 配置 state/hotwallet_config.json 的 enabled=true 且
// trongridApiKey 非空才发任何请求。TronGrid key 需用户本人邮箱注册，
// 未到位前本模块每轮只打一行「未启用」状态、不碰匿名额度（匿名额度
// 2026-10-30 两度 429，禁止硬跑生产）。
// 验证依据：research_notes/arb-system-redesign-20261030/
// okx_hotwallet_validation_20261030.md（OKX 主钱包出款 10:59:30 戛止、
// 其后整小时零出款；09:00 价格窗无出款特征——本信号看不见充值开关）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { STATE_DIR, enqueueArbEvent} from './arb_lib.mjs';

const CONFIG_FILE = path.join(STATE_DIR, 'hotwallet_config.json');
const STATE_FILE = path.join(STATE_DIR, 'hotwallet_state.json');
const INFERRED_FILE = path.join(STATE_DIR, 'venue_status_inferred.json');
const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8'));} catch { return d;}};
const saveJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));

// ---------------- 状态机（纯函数，--selftest 离线验证） ----------------
// 输入：按时间升序的已完成桶散户型出款笔数数组；输出：迁移事件列表。
// phase: learning（样本不足 24h）→ live ⇄ stopped。
export function runStateMachine(counts, params, initial = { phase: 'learning', zeroRun: 0}) {
const { stopZeroBuckets, resumeMinTxPerBucket, baselineHours, liveFloorRatio, bucketMinutes} = params;
const bucketsPerHour = 60 / bucketMinutes;
const baselineBuckets = baselineHours * bucketsPerHour;
let { phase, zeroRun} = initial;
const transitions = [];
const hourly = (endIdx) => {
let s = 0;
for (let i = Math.max(0, endIdx - bucketsPerHour + 1); i <= endIdx; i++) s += counts[i] || 0;
return s;
};
const baselineHourlyMedian = (endIdx) => {
const hs = [];
for (let e = baselineBuckets - 1; e <= endIdx; e += bucketsPerHour) hs.push(hourly(e));
hs.sort((a, b) => a - b);
return hs.length? hs[Math.floor(hs.length / 2)]: 0;
};
for (let i = 0; i < counts.length; i++) {
const c = counts[i] || 0;
if (phase === 'learning') {
if (i + 1 >= baselineBuckets) {
const med = baselineHourlyMedian(i);
if (med > 0 && hourly(i) >= Math.max(resumeMinTxPerBucket, med * liveFloorRatio)) { phase = 'live'; transitions.push({ at: i, to: 'live'});}
else if (med > 0) { phase = 'stopped'; transitions.push({ at: i, to: 'stopped'});}
}
continue;
}
if (phase === 'live') {
zeroRun = c === 0? zeroRun + 1: 0;
if (zeroRun >= stopZeroBuckets) { phase = 'stopped'; transitions.push({ at: i, to: 'stopped'}); zeroRun = 0;}
} else if (phase === 'stopped') {
if (c >= resumeMinTxPerBucket) { phase = 'live'; transitions.push({ at: i, to: 'resumed'});}
}
}
return { phase, transitions};
}

function selftest() {
const params = { stopZeroBuckets: 2, resumeMinTxPerBucket: 3, baselineHours: 24, liveFloorRatio: 0.3, bucketMinutes: 5};
// 学习段：24h × 12 桶/时，每桶 10 笔 → 基线小时中位 120；随后 2 桶归零 → stopped；再一桶 5 笔 → resumed
const counts = Array(24 * 12).fill(10).concat([0, 0, 5, 6]);
const r = runStateMachine(counts, params);
const seq = r.transitions.map((t) => t.to).join('>');
const pass = seq === 'live>stopped>resumed' && r.phase === 'live';
console.log(`[hotwallet-selftest] transitions=${seq} finalPhase=${r.phase} => ${pass? 'PASS': 'FAIL'}`);
// 反例：学习期不足不得发布任何相位
const r2 = runStateMachine(Array(50).fill(0), params);
console.log(`[hotwallet-selftest] 短样本: phase=${r2.phase} transitions=${r2.transitions.length} => ${r2.phase === 'learning' && r2.transitions.length === 0? 'PASS': 'FAIL'}`);
process.exit(pass? 0: 1);
}

// ---------------- TronGrid 拉取（仅启用后） ----------------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function hexToBase58(hex) {
const bytes = Buffer.from(hex, 'hex');
const h1 = crypto.createHash('sha256').update(bytes).digest();
const h2 = crypto.createHash('sha256').update(h1).digest();
const full = Buffer.concat([bytes, h2.subarray(0, 4)]);
let n = BigInt('0x' + full.toString('hex'));
let s = '';
while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n;}
for (const b of full) { if (b === 0) s = '1' + s; else break;}
return s;
}

async function fetchRecentTransfers(addr, sinceMs, apiKey) {
const u = new URL(`https://api.trongrid.io/v1/accounts/${addr}/transactions`);
u.searchParams.set('only_confirmed', 'true');
u.searchParams.set('limit', '200');
u.searchParams.set('order_by', 'block_timestamp,desc');
u.searchParams.set('min_timestamp', String(sinceMs));
const r = await fetch(u, { headers: { 'user-agent': 'stablecoin-risk-desk/1.0', 'TRON-PRO-API-KEY': apiKey}, signal: AbortSignal.timeout(20000)});
if (!r.ok) throw new Error(`TronGrid ${r.status}`);
const d = await r.json();
const out = [];
for (const tx of d.data || []) {
const c = tx.raw_data?.contract?.[0];
if (!c || c.type!== 'TransferContract') continue;
if ((tx.ret || [])[0]?.contractRet!== 'SUCCESS') continue;
const v = c.parameter.value;
out.push({ ts: tx.block_timestamp, from: hexToBase58(v.owner_address), to: hexToBase58(v.to_address)});
}
return out;
}

async function main() {
const cfg = loadJson(CONFIG_FILE, null);
if (!cfg) { console.log('[hotwallet] 未启用：配置文件缺失（state/hotwallet_config.json）'); return;}
if (!cfg.enabled ||!cfg.trongridApiKey) {
console.log(`[hotwallet] 未启用：enabled=${!!cfg.enabled}、TronGrid API key ${cfg.trongridApiKey? '已配置': '未配置（待用户本人邮箱在 trongrid.io 注册后填入 state/hotwallet_config.json）'}——本轮不发出任何链上请求`);
return;
}
const params = {
stopZeroBuckets: cfg.params?.stopZeroBuckets?? 2,
resumeMinTxPerBucket: cfg.params?.resumeMinTxPerBucket?? 3,
baselineHours: cfg.params?.baselineHours?? 24,
liveFloorRatio: cfg.params?.liveFloorRatioOfBaselineHourlyMedian?? 0.3,
bucketMinutes: cfg.params?.bucketMinutes?? 5,
};
const bucketMs = params.bucketMinutes * 60 * 1000;
const known = new Set(cfg.knownExchangeTronAddresses || []);
const state = loadJson(STATE_FILE, { venues: {}});
const inferred = loadJson(INFERRED_FILE, { venues: {}});
const nowBucket = Math.floor(Date.now() / bucketMs) * bucketMs;

for (const [venue, vc] of Object.entries(cfg.venues || {})) {
const vs = state.venues[venue] || (state.venues[venue] = { lastSeenMs: 0, buckets: {}, phase: 'learning', zeroRun: 0, lastTransitions: []});
const cluster = new Set(vc.cluster || []);
try {
const since = vs.lastSeenMs || (Date.now() - 26 * 3600 * 1000);
for (const w of vc.watch || []) {
const txs = await fetchRecentTransfers(w, since, cfg.trongridApiKey);
for (const tx of txs) {
if (tx.ts > (vs.lastSeenMs || 0)) vs.lastSeenMs = tx.ts;
if (!cluster.has(tx.from) &&!(vc.watch || []).includes(tx.from)) continue;
if (!(vc.watch || []).includes(tx.from)) continue;
if (cluster.has(tx.to) || known.has(tx.to)) continue; // 簇内/已知交易所不算散户型出款
const b = String(Math.floor(tx.ts / bucketMs) * bucketMs);
vs.buckets[b] = (vs.buckets[b] || 0) + 1;
}
}
} catch (e) {
console.log(`[hotwallet] ${venue} 本轮拉取失败：${String(e).slice(0, 120)}（相位保持 ${vs.phase}）`);
continue;
}
// 只对已完成桶跑状态机；桶序列按时间补齐零值，保留最近 30h
const startBucket = nowBucket - 30 * 3600 * 1000;
const keys = [];
for (let b = startBucket; b < nowBucket; b += bucketMs) keys.push(b);
const counts = keys.map((b) => vs.buckets[String(b)] || 0);
const prevPhase = vs.phase;
const r = runStateMachine(counts, params, { phase: vs.phase === 'learning'? 'learning': vs.phase, zeroRun: vs.zeroRun || 0});
// runStateMachine 从 learning 开始时重放全部历史是确定性的；live/stopped
// 续跑则以末相位为准（transitions 只取本轮新出现的 stopped/resumed）
vs.phase = r.phase;
const fresh = r.transitions.filter((t) => (t.to === 'stopped' || t.to === 'resumed'));
const lastT = fresh[fresh.length - 1];
if (lastT && prevPhase!== 'learning' && ((lastT.to === 'stopped' && prevPhase!== 'stopped') || (lastT.to === 'resumed' && prevPhase === 'stopped'))) {
const stopped = lastT.to === 'stopped';
inferred.venues[venue] = inferred.venues[venue] || { assets: {}};
inferred.venues[venue].assets[vc.asset || 'TRX'] = {
withdraw: stopped? 'inferred-closed': 'inferred-open', deposit: null,
at: new Date().toISOString(), source: 'hotwallet-cluster（簇出款流量状态机）',
};
saveJson(INFERRED_FILE, inferred);
const factsText = [
`${venue.toUpperCase()}×${vc.chain.toUpperCase()} 热钱包簇出款推断（inferred，证据等级低于官方源）：运营钱包簇散户型出款${stopped? '连续归零、判定提现已停': '在停止后恢复、疑似重新开启'}`,
`- 相位迁移：${prevPhase} → ${stopped? 'stopped': 'live(resumed)'}；判据：5 分钟桶笔数（簇→簇外非已知交易所地址），基线为该簇自身 24h 小时中位`,
stopped
? `- 用途：venue_status inferred 来源（withdraw=inferred-closed）供 F7/逐对分类把未知维补成关闭；研判应结合官方源复核，不得据此单独断言场所故障`
: `- 用途：疑似恢复信号——研判须现查官方状态核实，不得单独改判「搬砖成立」`,
].join('\n');
const rr = enqueueArbEvent({
type: 'venue_inferred', key: `${venue}@${vc.chain.toUpperCase()}`, severity: 'warn',
payload: { venue, chain: vc.chain, asset: vc.asset || 'TRX', transition: stopped? 'live_to_stopped': 'stopped_to_resumed'},
factsText,
});
console.log(`[hotwallet] ${venue} 相位迁移 ${prevPhase}→${vs.phase}，已写 inferred 并入队（merged=${rr.merged}）`);
} else {
console.log(`[hotwallet] ${venue} 相位 ${vs.phase}（watch ${(vc.watch || []).length} 钱包，最近桶散户型出款 ${counts[counts.length - 1]?? 0} 笔）`);
}
// 清理 30h 外的桶
for (const k of Object.keys(vs.buckets)) if (Number(k) < startBucket) delete vs.buckets[k];
}
saveJson(STATE_FILE, state);
}

if (process.argv[2] === '--selftest') selftest();
else await main();
