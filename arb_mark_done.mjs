// arb_mark_done.mjs — 研判 agent 完成一条队列事件后调用：
//   node arb_mark_done.mjs <entry-id> <pushed|skipped> [grade]
// 写 done 账本、从队列删除该条；脱锚条目同时回写 depeg_events（enriched=true，
// pushed 时写 lastPushAt，使旧 depeg-enrich hook 自动让行、解除通知可正常发）。
// 条目已被兜底清除时幂等：仍补写 done 并提示。
import { readQueue, removeFromQueue, appendDone, markDepegEvent } from './arb_lib.mjs';

const [id, outcome, grade] = process.argv.slice(2);
if (!id || !['pushed', 'skipped'].includes(outcome)) {
  console.error('用法：node arb_mark_done.mjs <entry-id> <pushed|skipped> [grade]');
  process.exit(2);
}
const entry = readQueue().find(e => e.id === id);
appendDone({ id, type: entry?.type || null, key: entry?.key || null, pushed: outcome === 'pushed', grade: grade || null, by: 'research-agent' });
if (entry) {
  removeFromQueue(id);
  if (entry.type === 'depeg') markDepegEvent(entry.key, { pushed: outcome === 'pushed' });
  console.log(`marked done: ${id} (${outcome}${grade ? ', grade ' + grade : ''})`);
} else {
  console.log(`entry ${id} 不在队列（可能已被兜底清除），done 已补记 (${outcome})`);
}
