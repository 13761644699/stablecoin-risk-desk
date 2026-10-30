// arb_fallback.mjs — 套利事件队列兜底（随 sweep 循环运行）
//
// 规则（2026-10-30 用户定稿）：机会类警报先深化再推，但研判约 10 分钟未产出
// 必须兜底先推一条简短提示，不许静默。本脚本每轮检查队列：
// - 已有 done 记录的条目 → 从队列清除（研判已交付/已判定）；
// - 底层事件已消解的条目（脱锚已解除/跌点已解除/价差已恢复）→ 静默清除记档，
//   不拿过期事件打扰用户；
// - 已到处理时点（dueSince，含静默时段顺延）且超 10 分钟仍无 done → 推兜底
//   简短提示（PushPlus，Bark 不走兜底通道），写 done(fallback) 并清除条目；
//   脱锚条目同时回写 depeg_events 的 lastPushAt（解除通知逻辑据此工作）。
// 研判 agent 若在兜底后才完成，照常交付深化推送（mark_done 对已清除条目幂等）。
import fs from 'fs';
import path from 'path';
import { STATE_DIR, NO_PUSH, readQueue, readDone, removeFromQueue, appendDone, sendPushplus, markDepegEvent, dueSince, isDue, executableSnapshot } from './arb_lib.mjs';

const FALLBACK_MS = 600_000; // 10 分钟

function loadJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }

function isStale(entry) {
  if (entry.type === 'depeg') {
    const store = loadJson(path.join(STATE_DIR, 'depeg_events.json'), { events: {} });
    const ev = (store.events || {})[entry.key];
    return !ev || ev.status !== 'active';
  }
  if (entry.type === 'cex_dip') {
    const store = loadJson(path.join(STATE_DIR, 'cex_dip_events.json'), { events: {} });
    const ev = (store.events || {})[entry.key];
    return !ev || ev.status !== 'active';
  }
  if (entry.type === 'spread') {
    const st = loadJson(path.join(STATE_DIR, 'arb_spread_state.json'), {});
    return !(st[entry.key] && st[entry.key].active);
  }
  return false; // arb_addr 等：行为记录不过期
}

async function main() {
  const q = readQueue();
  if (!q.length) { console.log('[arb-fallback] 队列为空'); return; }
  const done = new Map(readDone().map(d => [d.id, d]));
  const now = new Date();
  let cleared = 0, pushed = 0, waiting = 0;
  for (const entry of q) {
    if (done.has(entry.id)) { removeFromQueue(entry.id); cleared++; continue; }
    if (isStale(entry)) {
      appendDone({ id: entry.id, type: entry.type, key: entry.key, pushed: false, stale: true, note: '底层事件已消解，静默清除' });
      removeFromQueue(entry.id); cleared++;
      console.log(`[arb-fallback] ${entry.id} 底层事件已消解，静默清除`);
      continue;
    }
    if (!isDue(entry, now)) { waiting++; continue; }
    const age = now.getTime() - dueSince(entry, now);
    if (age < FALLBACK_MS) { waiting++; continue; }
    const title = `⏳ 套利事件待深化：${entry.type === 'depeg' ? '脱锚' : entry.type === 'cex_dip' ? '交易所跌点' : entry.type === 'spread' ? '主流币价差' : entry.type === 'arb_addr' ? '套利地址异动' : entry.type} ${entry.key}`;
    const snap = executableSnapshot(entry);
    const body = [
      `深化研判超 10 分钟未产出，先行提示（不许静默口径）：`,
      ``,
      entry.factsText || JSON.stringify(entry.payload || {}),
      ...(snap ? [``, snap] : []),
      ``,
      `- 入队时间：${entry.enqueuedAt}；兜底提示不等于研判结论，深化分析完成后会另行推送/记档`,
    ].join('\n');
    const r = await sendPushplus(title, body);
    if (r.ok) {
      appendDone({ id: entry.id, type: entry.type, key: entry.key, pushed: true, fallback: true });
      removeFromQueue(entry.id);
      if (entry.type === 'depeg') markDepegEvent(entry.key, { pushed: true });
      pushed++;
      console.log(`[arb-fallback] ${entry.id} 已推兜底提示（等待 ${(age / 60000).toFixed(1)} 分钟）`);
    } else {
      console.log(`[arb-fallback] ${entry.id} 兜底推送失败（${r.error || r.code}），保留队列下轮重试`);
    }
  }
  console.log(`[arb-fallback] 本轮：清除 ${cleared}、兜底推送 ${pushed}、等待中 ${waiting}${NO_PUSH ? '（NO_PUSH 干跑）' : ''}`);
}

main().catch(e => { console.error('[arb-fallback] 运行失败：', String(e).slice(0, 300)); process.exit(1); });
