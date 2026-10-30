import { keccak256 } from './keccak.mjs';
export { keccak256 };

export const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://eth-mainnet.public.blastapi.io',
];
let rpcIdx = 0;
export async function rpc(method, params, tries = RPCS.length) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const url = RPCS[(rpcIdx + i) % RPCS.length];
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
      rpcIdx = (rpcIdx + i) % RPCS.length;
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all RPCs failed');
}
const hex = n => '0x' + n.toString(16);
export async function blockTs(n) {
  const b = await rpc('eth_getBlockByNumber', [hex(n), false]);
  return parseInt(b.timestamp, 16);
}
export async function findBlockByTs(ts, latest) {
  // first block with timestamp >= ts
  let lo = 1, hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const t = await blockTs(mid);
    if (t < ts) lo = mid + 1; else hi = mid;
  }
  return lo;
}
export async function getLogs(address, topics, from, to, chunk = 400) {
  const out = [];
  for (let s = from; s <= to; s += chunk) {
    const e = Math.min(s + chunk - 1, to);
    const logs = await rpc('eth_getLogs', [{ address, topics, fromBlock: hex(s), toBlock: hex(e) }]);
    out.push(...logs);
    process.stderr.write(`  logs ${s}-${e}: +${logs.length} (total ${out.length})\n`);
  }
  return out;
}
export const topicAddr = a => '0x' + '0'.repeat(24) + a.replace(/^0x/, '').toLowerCase();
export const logAddr = t => '0x' + t.slice(26).toLowerCase();
export const wordAddr = w => '0x' + w.slice(24).toLowerCase();
export const wordUint = w => BigInt('0x' + w);
export function splitData(data) {
  const d = data.replace(/^0x/, '');
  const words = [];
  for (let i = 0; i < d.length; i += 64) words.push(d.slice(i, i + 64));
  return words;
}
