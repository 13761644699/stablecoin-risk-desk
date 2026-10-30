#!/usr/bin/env node
// arb_cex_cross_watch.mjs — 冻结期跨所现货价差盯盘（2026-10-30 用户指示
// 「最近机会应该很多你关注下」临时加强线，非常设监控）
// 职责：TRX/ETH 在 Binance/Gate/OKX/KuCoin 的 USDT 现货价跨所比对。
// 中间价价差 ≥200bps 才进一步做 $10k 盘口深度模拟；模拟可成交价差
// ≥150bps 且双腿可成交额 ≥$3k、连续两轮确认，才入统一研判队列
// （type=spread，只入队不直推）。低/高价侧涉及充提冻结场所时在
// factsText 标注 F7 冻结折价/退出受限，由研判定性（冻结场所买得进
// 提不出，不是搬砖）。
// 到期：2026-11-13 23:59 CST 自动停用（币安冻结 regime 临时线）。
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
const EXPIRES_MS = Date.parse('2026-11-13T23:59:59+08:00');
const SIM_USD = 10000, MIN_FILL_USD = 3000;
const MID_TRIGGER_BPS = 200, EXEC_WARN_BPS = 150, EXEC_SEVERE_BPS = 400;
const ASSETS = ['TRX', 'ETH'];

const midFetchers = {
  binance: async (s) => { const d = await fetchJson(`https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=${s}USDT`); return (Number(d.bidPrice) + Number(d.askPrice)) / 2; },
  gate: async (s) => { const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${s}_USDT`); const t = d[0]; return (Number(t.highest_bid) + Number(t.lowest_ask)) / 2; },
  okx: async (s) => { const d = await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${s}-USDT`); const t = d.data[0]; return (Number(t.bidPx) + Number(t.askPx)) / 2; },
  kucoin: async (s) => { const d = await fetchJson(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${s}-USDT`); return (Number(d.data.bestBid) + Number(d.data.bestAsk)) / 2; },
};
const bookFetchers = {
  binance: async (s) => { const d = await fetchJson(`https://data-api.binance.vision/api/v3/depth?symbol=${s}USDT&limit=100`); return { bids: d.bids, asks: d.asks }; },
  gate: async (s) => { const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${s}_USDT&limit=100`); return { bids: d.bids, asks: d.asks }; },
  okx: async (s) => { const d = await fetchJson(`https://www.okx.com/api/v5/market/books?instId=${s}-USDT&sz=100`); const b = d.data[0]; return { bids: b.bids, asks: b.asks }; },
  kucoin: async (s) => { const d = await fetchJson(`https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${s}-USDT`); return { bids: d.data.bids, asks: d.data.asks }; },
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

function venueStatus(venueFile, name) {
  const vmap = venueFile.venues || {};
  const key = Object.keys(vmap).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? vmap[key] : null;
}

async function main() {
  const state = loadJson(STATE_FILE, {});
  if (Date.now() > EXPIRES_MS) {
    if (!state.expiredLogged) { state.expiredLogged = true; saveJson(STATE_FILE, state); console.log('[cex-cross] 已到期（2026-11-13），停用'); }
    return;
  }
  const venueFile = loadJson(VENUE_FILE, {});
  for (const sym of ASSETS) {
    const st = state[sym] || (state[sym] = { confirm: 0, active: false, peakBps: 0 });
    const mids = {};
    for (const [name, fn] of Object.entries(midFetchers)) {
      try { const m = await fn(sym); if (m > 0) mids[name] = m; } catch { /* 单所不可达跳过 */ }
    }
    const names = Object.keys(mids);
    if (names.length < 3) { console.log(`[cex-cross] ${sym} 可用报价源不足（${names.length}），跳过`); continue; }
    const lo = names.reduce((a, b) => (mids[a] <= mids[b] ? a : b));
    const hi = names.reduce((a, b) => (mids[a] >= mids[b] ? a : b));
    const midBps = (mids[hi] / mids[lo] - 1) * 10000;
    if (midBps < MID_TRIGGER_BPS) {
      if (st.active) console.log(`[cex-cross] ${sym} 价差消解（中间价差 ${midBps.toFixed(0)}bps），转观察`);
      st.confirm = 0; st.active = false; st.peakBps = 0;
      console.log(`[cex-cross] ${sym} 正常：跨所中间价差 ${midBps.toFixed(0)}bps（低 ${lo} ${mids[lo].toFixed(5)} / 高 ${hi} ${mids[hi].toFixed(5)}）`);
      continue;
    }
    // 中间价差达触发线 → 盘口模拟（F6：以可成交价差为准）
    let buy = null, sell = null;
    try { const bk = await bookFetchers[lo](sym); buy = walk(bk.asks, SIM_USD); } catch { /* 买腿盘口不可得 */ }
    try { const bk = await bookFetchers[hi](sym); sell = walk(bk.bids, SIM_USD); } catch { /* 卖腿盘口不可得 */ }
    const fillMin = Math.min(buy?.filledUsd || 0, sell?.filledUsd || 0);
    const execBps = buy?.avg && sell?.avg ? (sell.avg / buy.avg - 1) * 10000 : null;
    if (execBps === null || execBps < EXEC_WARN_BPS || fillMin < MIN_FILL_USD) {
      st.confirm = 0;
      console.log(`[cex-cross] ${sym} 中间价差 ${midBps.toFixed(0)}bps（${lo}→${hi}）但模拟不过：可成交价差 ${execBps === null ? '—' : execBps.toFixed(0) + 'bps'}、双腿可成交 $${Math.round(fillMin).toLocaleString()}，只观察`);
      continue;
    }
    st.confirm++;
    const deepen = execBps > (st.peakBps || 0) + 100;
    if (st.confirm < 2) { console.log(`[cex-cross] ${sym} 可成交价差 ${execBps.toFixed(0)}bps 初检越线，待下一轮确认`); continue; }
    if (!st.active || deepen) {
      st.active = true; st.peakBps = Math.max(st.peakBps || 0, execBps);
      const loStatus = venueStatus(venueFile, lo), hiStatus = venueStatus(venueFile, hi);
      const frozenNotes = [];
      if (loStatus?.depositWithdraw === 'frozen') frozenNotes.push(`⚠️ 低价侧 ${lo} 充提冻结中：买入后无法提出该所，跨所搬砖腿不成立——此价差属冻结折价（F7），不是搬砖机会，研判按冻结折价/恢复后收敛定性`);
      if (hiStatus?.depositWithdraw === 'frozen') frozenNotes.push(`⚠️ 高价侧 ${hi} 充提冻结中：卖出后资金提出受限，退出腿风险须计入`);
      const factsText = [
        `${sym} 跨所现货价差（冻结期临时盯盘）：低价侧 ${lo}、高价侧 ${hi}`,
        `- 中间价：${names.map(n => `${n} ${mids[n].toFixed(5)}`).join('；')}；中间价差 ${midBps.toFixed(0)}bps`,
        `- $10k 盘口模拟：${lo} 买入均价 ${buy.avg.toFixed(5)}（可成交 $${Math.round(buy.filledUsd).toLocaleString()}）、${hi} 卖出均价 ${sell.avg.toFixed(5)}（可成交 $${Math.round(sell.filledUsd).toLocaleString()}）、可成交价差 ${execBps.toFixed(0)}bps`,
        ...frozenNotes,
        `- 研判须复核：双腿当刻深度与充提状态（F7）、提币费与到账时效、价差在转账时滞内是否存续`,
      ].join('\n');
      const r = enqueueArbEvent({
        type: 'spread', key: `${sym}@CEXX`, severity: execBps >= EXEC_SEVERE_BPS ? 'severe' : 'warn',
        payload: { symbol: sym, loVenue: lo, hiVenue: hi, midSpreadBps: Math.round(midBps), execSpreadBps: Math.round(execBps), fillUsd: Math.round(fillMin), buyAvg: buy.avg, sellAvg: sell.avg, frozenLeg: loStatus?.depositWithdraw === 'frozen' ? lo : (hiStatus?.depositWithdraw === 'frozen' ? hi : null) },
        factsText,
      });
      console.log(`[cex-cross] ${sym} 已入队深化（可成交 ${execBps.toFixed(0)}bps，低 ${lo} → 高 ${hi}，merged=${r.merged}）`);
    } else {
      console.log(`[cex-cross] ${sym} 持续中：可成交价差 ${execBps.toFixed(0)}bps（峰值 ${st.peakBps.toFixed(0)}bps），已在队列`);
    }
  }
  saveJson(STATE_FILE, state);
}

await main();
