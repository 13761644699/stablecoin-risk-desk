// news_ignite_watch.mjs — 快讯点火（2026-10-30 整合，按 prep_news_ignition.md 草稿落地）
// 定位：新闻只负责叫醒，不定性。TG 公开源一级触发 → 脚本建「待核事件」→
// 每轮做市场核查（价差/脱锚队列共现、双源独立确认+状态证据、元地址异动），
// 过升级门才 enqueueArbEvent 入统一研判队列；不过门只记日志，6 小时过期记档。
// 源（TG 公开预览页 t.me/s/，无账号、零付费；2026-10-30 实测可达）：
//   security: PeckShieldAlert, CyversAlerts（一级）
//   news:     wublockchainenglish（吴说，一级补充）
//   flash:    ForesightNews, Odailychina（二级确认）
// BlockSec/SlowMist/PANews 无公开预览，待 X API 拍板后再补（见 ARB_INTEGRATION）。
// 状态：state/news_ignite_state.json（游标）、state/news_pending.json（待核事件）、
//       state/news_source_stats.json（分源命中/过期统计，供月度降级评估）
import fs from 'fs';
import path from 'path';
import { STATE_DIR, enqueueArbEvent, readQueue, NO_PUSH } from './arb_lib.mjs';

const SOURCES = [
  { name: 'PeckShieldAlert', group: 'security', aliases: ['peckshield'] },
  { name: 'CyversAlerts', group: 'security', aliases: ['cyvers'] },
  { name: 'wublockchainenglish', group: 'news', aliases: ['wu blockchain', 'wublockchain', '吴说'] },
  { name: 'ForesightNews', group: 'flash', aliases: ['foresight'] },
  { name: 'Odailychina', group: 'flash', aliases: ['odaily', '星球日报'] },
];
const STATE_FILE = path.join(STATE_DIR, 'news_ignite_state.json');
const PENDING_FILE = path.join(STATE_DIR, 'news_pending.json');
const STATS_FILE = path.join(STATE_DIR, 'news_source_stats.json');
const VENUE_FILE = path.join(STATE_DIR, 'venue_status.json');
const SPREAD_FILE = path.join(STATE_DIR, 'arb_spread_state.json');
const ADDR_FILE = path.join(STATE_DIR, 'arb_addr_state.json');
const PENDING_TTL_MS = 6 * 3600 * 1000;
const THROTTLE_MS = 240 * 1000;

const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const saveJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
const nowIso = () => new Date().toISOString();

// ---------- 触发分类（纯函数，--selftest 与主流程共用） ----------
const HACK_RE = /hack(ed|ing|s)?\b|exploit|stolen|drain(ed|ing)?\b|private key|hot wallet|unauthori[sz]ed|security (incident|breach)|被盗|黑客|漏洞利用|私钥|热钱包|异常流出|大额流出|被攻击|跑路/;
const SUSPEND_RE = /(suspend|suspension|paus\w*|halt\w*|freez\w*|frozen)[^.。]{0,50}(withdraw|deposit)|(withdraw|deposit)[^.。]{0,50}(suspend|suspension|paus\w*|halt\w*|freez\w*|frozen)|暂停(提现|提币|充提|充值|出入金)|冻结/;
const FREEZE_ASSET_RE = /(freez\w+|frozen)[^.。]{0,45}(\$|usdt|usdc|funds|assets|wallets?|addresses)/i;
const MAINT_RE = /maintenance|scheduled|upgrade|维护|升级/;
const ENTITIES = [
  ['binance', /binance|币安/i], ['okx', /\bokx\b|欧易/i], ['bybit', /bybit/i],
  ['gate', /gate\.io|\bgate\b/i], ['kraken', /kraken/i], ['coinbase', /coinbase/i],
  ['bitget', /bitget/i], ['kucoin', /kucoin/i], ['htx', /\bhtx\b|huobi|火币/i], ['mexc', /mexc/i],
  ['aave', /aave/i], ['compound', /compound/i], ['spark', /spark protocol|\bspark\b/i],
  ['uniswap', /uniswap/i], ['curve', /curve finance|\bcurve\b/i], ['lido', /lido/i],
  ['ethena', /ethena/i], ['tether', /tether/i], ['circle', /\bcircle\b/i],
  ['usdt', /\busdt\b/i], ['usdc', /\busdc\b/i], ['usde', /\busde\b/i], ['usds', /\busds\b/i],
  ['usd1', /\busd1\b/i], ['pyusd', /\bpyusd\b/i], ['rlusd', /\brlusd\b/i], ['usdd', /\busdd\b/i],
];
function parseAmountUsd(text) {
  let m = text.match(/\$([\d,.]+)\s*(billion|million|bn|b|m|k)\b/i);
  if (m) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    const u = m[2].toLowerCase();
    return v * (u.startsWith('b') ? 1e9 : u === 'm' || u === 'million' ? 1e6 : 1e3);
  }
  m = text.match(/([\d,.]+)\s*亿美元/);
  if (m) return parseFloat(m[1].replace(/,/g, '')) * 1e8;
  m = text.match(/([\d,.]+)\s*万美元/);
  if (m) return parseFloat(m[1].replace(/,/g, '')) * 1e4;
  return null;
}
export function classify(text) {
  const t = String(text || '');
  const hack = HACK_RE.test(t);
  const susp = SUSPEND_RE.test(t) || FREEZE_ASSET_RE.test(t);
  if (!hack && !susp) return { fire: false, why: '无高危动作词' };
  if (MAINT_RE.test(t) && !hack) return { fire: false, why: '维护类暂停，非事件' };
  const entity = (ENTITIES.find(([, re]) => re.test(t)) || [null])[0];
  const amountUsd = parseAmountUsd(t);
  const genericVenue = /(exchange|protocol|platform|dex|cex|交易所|协议|平台)/i.test(t);
  if (!entity && !(amountUsd >= 1e7) && !(amountUsd >= 1e6 && genericVenue)) {
    return { fire: false, why: '无已知实体且金额不达重要性门槛' };
  }
  const actionClass = hack ? 'hack' : (SUSPEND_RE.test(t) && /冻结|freez|frozen/i.test(t) ? 'freeze' : 'suspend');
  return { fire: true, actionClass, entity: entity || 'unknown', amountUsd, hack, suspClaim: susp };
}

// ---------- TG 公开页抓取与解析 ----------
async function fetchChannel(name) {
  const r = await fetch(`https://t.me/s/${name}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const items = [];
  const parts = html.split('data-post="');
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const ref = seg.slice(0, seg.indexOf('"'));
    const id = parseInt(ref.split('/')[1], 10);
    if (!Number.isFinite(id)) continue;
    const tm = seg.match(/datetime="([^"]+)"/);
    const ti = seg.indexOf('tgme_widget_message_text');
    let text = '';
    if (ti >= 0) {
      const raw = seg.slice(ti, ti + 6000);
      const gt = raw.indexOf('>');
      text = raw.slice(gt + 1, raw.indexOf('</div>'))
        .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
    }
    items.push({ id, at: tm ? tm[1] : null, text, url: `https://t.me/${name}/${id}` });
  }
  return items;
}

// ---------- 升级门 ----------
function evaluateGates(ev) {
  const firstMs = Date.parse(ev.firstSeen);
  const spread = loadJson(SPREAD_FILE, {});
  for (const st of Object.values(spread)) {
    if (st && st.active && (st.level === 'severe' || (st.peakBps || 0) >= 400)) {
      return { gate: 'G1', why: '三方价差处于严重线' };
    }
  }
  try {
    const since = firstMs - 15 * 60000;
    const hit = readQueue().find(e => ['spread', 'cex_dip', 'depeg'].includes(e.type)
      && Date.parse(e.enqueuedAt || e.updatedAt || 0) >= since);
    if (hit) return { gate: 'G1', why: `市场线已入队 ${hit.id}` };
  } catch { /* 队列不可读时跳过 */ }
  const groups = new Set(ev.sources.filter(x => !x.echo).map(x => x.group));
  if (groups.size >= 2 && ev.statusEvidence) {
    return { gate: 'G2', why: `独立来源组 ${[...groups].join('+')} 确认且有充提/冻结状态证据` };
  }
  const addr = loadJson(ADDR_FILE, {});
  for (const ts of Object.values(addr.lastEnqueue || {})) {
    const ms = Date.parse(ts);
    if (ms >= firstMs - 10 * 60000) return { gate: 'G3', why: '元地址借贷异动与快讯同向共现' };
  }
  return null;
}

// ---------- 点火两问初筛（2026-10-30 样本外建议 6，只管被盗类） ----------
// 预言机窗口的两个必要条件：Q1 涉事场所充提实际冻结（切断搬运）；
// Q2 被盗资产在 DEX 不计价换仓（刚性买卖盘，市场脱节是其可见迹象）。
// 两问皆否即 Bybit 形态（史上最大被盗后 9 小时偏离仅 54bps），只记档不入队。
function marketSignals(ev) {
  let spreadSevere = false;
  const spread = loadJson(SPREAD_FILE, {});
  for (const st of Object.values(spread)) {
    if (st && st.active && (st.level === 'severe' || (st.peakBps || 0) >= 400)) spreadSevere = true;
  }
  let marketQueued = false;
  try {
    marketQueued = !!readQueue().find(e => ['spread', 'cex_dip', 'depeg'].includes(e.type)
      && Date.parse(e.enqueuedAt || e.updatedAt || 0) >= Date.parse(ev.firstSeen) - 15 * 60000);
  } catch { /* 队列不可读时按无信号 */ }
  return { spreadSevere, marketQueued };
}
export function computeScreen(ev, ctx) {
  const q1 = !!(ctx.venueFrozen || ev.statusEvidence);
  const q2 = !!(ctx.spreadSevere || ctx.marketQueued);
  return { q1, q2, pass: q1 || q2 };
}

// ---------- 自测 ----------
if (process.argv.includes('--selftest')) {
  const cases = [
    ['#PeckShieldAlert Binance hot wallet exploited, about $6.3 billion drained, withdrawals suspended', true],
    ['Ethereum price surges 5% as ETF inflows hit record high', false],
    ['OKX will suspend withdrawals for scheduled wallet maintenance on Nov 2, 2 hours', false],
    ['吴说获悉，币安因安全事件暂停充提，PeckShield 称热钱包被盗', true],
    ['Small lending protocol on BSC exploited for $200K, team investigating', false],
    ['某交易所被盗，损失约 1.2 亿美元，平台已暂停提现', true],
    ['Tether freezes $12 million USDT linked to sanctioned addresses', true],
    ['Binance lists new token, trading opens at 16:00 UTC', false],
  ];
  let fail = 0;
  for (const [text, want] of cases) {
    const c = classify(text);
    const ok = c.fire === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} fire=${c.fire} want=${want} ${c.fire ? `${c.actionClass}:${c.entity}` : c.why} :: ${text.slice(0, 60)}`);
  }
  const scrCases = [
    [{ statusEvidence: false }, { venueFrozen: false, spreadSevere: false, marketQueued: false }, false],
    [{ statusEvidence: true }, { venueFrozen: false, spreadSevere: false, marketQueued: false }, true],
    [{ statusEvidence: false }, { venueFrozen: false, spreadSevere: true, marketQueued: false }, true],
    [{ statusEvidence: false }, { venueFrozen: true, spreadSevere: false, marketQueued: false }, true],
    [{ statusEvidence: false }, { venueFrozen: false, spreadSevere: false, marketQueued: true }, true],
  ];
  for (const [ev, ctx, want] of scrCases) {
    const s = computeScreen(ev, ctx);
    const ok = s.pass === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} screen pass=${s.pass} want=${want} q1=${s.q1} q2=${s.q2}`);
  }
  process.exit(fail ? 1 : 0);
}

// ---------- 主流程 ----------
const state = loadJson(STATE_FILE, { cursors: {}, lastRunAt: 0});
const pending = loadJson(PENDING_FILE, { events: []});
const stats = loadJson(STATS_FILE, { sources: {}, escalations: 0, expired: 0, updatedAt: null});

async function main() {
if (!process.argv.includes('--force') && Date.now() - (state.lastRunAt || 0) < THROTTLE_MS) return;
state.lastRunAt = Date.now();

// 1) 拉新消息 → 分类 → 建/并待核事件
for (const src of SOURCES) {
let items;
try { items = await fetchChannel(src.name);} catch (e) {
console.log(`[news-ignite] ${src.name} 抓取失败：${String(e).slice(0, 100)}`);
continue;
}
if (!items.length) continue;
const maxId = Math.max(...items.map(x => x.id));
const cursor = state.cursors[src.name];
if (cursor == null) { // 首次：只立基线，不处理历史
state.cursors[src.name] = maxId;
console.log(`[news-ignite] ${src.name} 基线游标=${maxId}（共 ${items.length} 条）`);
continue;
}
const fresh = items.filter(x => x.id > cursor && x.text).sort((a, b) => a.id - b.id);
state.cursors[src.name] = maxId;
for (const it of fresh) {
const c = classify(it.text);
if (!c.fire) continue;
const fp = `${c.actionClass}:${c.entity}`;
let ev = pending.events.find(e => e.fp === fp
&& Date.now() - Date.parse(e.firstSeen) < PENDING_TTL_MS);
const echo = ev ? ev.sources.some(s => s.name !== src.name
&& (SOURCES.find(x => x.name === s.name)?.aliases || []).some(a => it.text.toLowerCase().includes(a))) : false;
if (!ev) {
ev = { fp, actionClass: c.actionClass, entity: c.entity, firstSeen: it.at || nowIso(),
lastSeen: it.at || nowIso(), sources: [], statusEvidence: false, escalated: false,
headline: it.text.slice(0, 220)};
pending.events.push(ev);
}
ev.lastSeen = it.at || nowIso();
if (c.suspClaim) ev.statusEvidence = true;
if (!ev.sources.some(s => s.name === src.name)) {
ev.sources.push({ name: src.name, group: src.group, at: it.at, url: it.url, echo});
}
stats.sources[src.name] = stats.sources[src.name] || { fired: 0};
stats.sources[src.name].fired++;
console.log(`[news-ignite] 待核 +${fp} ← ${src.name} #${it.id}${echo? '（转述，不计独立确认）': ''}：${it.text.slice(0, 90)}`);
}
}

// 2) 场所状态文件里的 frozen 也算状态证据
const venues = loadJson(VENUE_FILE, {});
for (const ev of pending.events) {
const vmap = venues.venues || {};
const v = vmap[ev.entity] || vmap[Object.keys(vmap).find(k => k.toLowerCase() === String(ev.entity).toLowerCase())];
if (v && v.depositWithdraw === 'frozen') ev.statusEvidence = true;
}

// 3) 升级判定 → 入统一研判队列（只入队一次，后续靠 enqueueArbEvent 合并更新）
for (const ev of pending.events) {
if (ev.escalated) continue;
let scr = null;
if (ev.actionClass === 'hack') {
const vmap2 = venues.venues || {};
const v = vmap2[ev.entity] || vmap2[Object.keys(vmap2).find(k => k.toLowerCase() === String(ev.entity).toLowerCase())];
scr = computeScreen(ev, { venueFrozen: !!(v && v.depositWithdraw === 'frozen'), ...marketSignals(ev) });
ev.screen = scr;
if (!scr.pass) {
if (!ev.screenLogged) { ev.screenLogged = true; console.log(`[news-ignite] 初筛拦截 ${ev.fp}：被盗类两问皆否（Q1 无冻结证据、Q2 无市场脱节），只记档`); }
continue;
}
}
const g = evaluateGates(ev);
if (!g) continue;
ev.escalated = true;
stats.escalations++;
const srcTxt = ev.sources.map(s => `${s.name}（${s.group}${s.echo? '，转述': ''}）${s.url}`).join('；');
const factsText = [
`${ev.entity} ${ev.actionClass} 事件（新闻只点火，定性以下方当刻市场数据为准）`,
`- 首发：${ev.firstSeen}；来源：${srcTxt}`,
`- 标题：${ev.headline}`,
`- 升级门：${g.gate} — ${g.why}；状态证据（充提暂停/冻结）：${ev.statusEvidence? '有': '无'}`,
...(scr ? [`- 点火初筛两问：Q1 充提实际冻结/暂停证据=${scr.q1? '是': '否'}（冻结口径不含延迟/拥堵档，延迟按 F7 delayed 处理）；Q2 DEX 不计价换仓/市场脱节迹象=${scr.q2? '是': '否'}（研判复核；两问皆否应已在脚本侧拦截）`] : []),
`- 研判须按 RESEARCH_SPEC 现查：三方价差、相关稳定币真实偏离（先做计价换算）、涉事场所充提状态（F7 场所状态门）、Aave 等借贷池冻结/可借状态、元地址动向`,
].join('\n');
const r = enqueueArbEvent({
type: 'news_ignite', key: ev.fp, severity: 'event',
payload: { entity: ev.entity, actionClass: ev.actionClass, gate: g.gate, gateWhy: g.why, screen: scr || undefined,
statusEvidence: ev.statusEvidence, firstSeen: ev.firstSeen,
sources: ev.sources.map(s => ({ name: s.name, group: s.group, url: s.url, echo: s.echo}))},
factsText,
});
ev.enqueuedId = r.id;
console.log(`[news-ignite] 待核事件升级入队 ${ev.fp}（${g.gate}：${g.why}，merged=${r.merged}）`);
}

// 4) 过期清理（6 小时未升级或已升级完结 → 记档）
const before = pending.events.length;
pending.events = pending.events.filter(ev => {
if (Date.now() - Date.parse(ev.firstSeen) < PENDING_TTL_MS) return true;
if (!ev.escalated) stats.expired++;
return false;
});
if (pending.events.length!== before) {
console.log(`[news-ignite] 过期待核事件清理 ${before - pending.events.length} 条（累计过期 ${stats.expired}）`);
}

stats.updatedAt = nowIso();
saveJson(STATE_FILE, state);
saveJson(PENDING_FILE, pending);
saveJson(STATS_FILE, stats);
if (NO_PUSH) console.log('[news-ignite] ARB_NO_PUSH=1：队列写入 dryrun 文件');
}

main().catch(e => { console.error('[news-ignite] 异常：', String(e).slice(0, 300)); process.exit(1);});
