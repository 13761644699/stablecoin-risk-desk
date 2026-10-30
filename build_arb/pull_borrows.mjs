import { rpc, findBlockByTs, getLogs, keccak256, topicAddr, logAddr, wordUint, splitData, blockTs } from './eth_lib.mjs';
import fs from 'node:fs';

const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const T0 = Date.parse('2026-10-29T20:24:00Z') / 1000;
const T1 = Date.parse('2026-10-30T02:24:00Z') / 1000;

const latest = parseInt(await rpc('eth_blockNumber', []), 16);
console.log('latest block', latest);
const from = await findBlockByTs(T0, latest);
const to = (await findBlockByTs(T1, latest)) - 1;
console.log('window blocks', from, '->', to, `(${(await blockTs(from))} .. ${(await blockTs(to))})`);

const BORROW = '0x' + keccak256('Borrow(address,address,address,uint256,uint8,uint256,uint16)');
const REPAY = '0x' + keccak256('Repay(address,address,address,uint256,bool)');
const SUPPLY = '0x' + keccak256('Supply(address,address,address,uint256,uint16)');
console.log('topics', { BORROW, REPAY, SUPPLY });

console.log('pulling Borrow WETH...');
const bLogs = await getLogs(POOL, [BORROW, topicAddr(WETH)], from, to);
console.log('pulling Repay WETH...');
const rLogs = await getLogs(POOL, [REPAY, topicAddr(WETH)], from, to);
console.log('pulling Supply USDT...');
const sLogs = await getLogs(POOL, [SUPPLY, topicAddr(USDT)], from, to);

const borrowers = new Map();
for (const l of bLogs) {
  const obo = logAddr(l.topics[2]);
  const w = splitData(l.data);
  const amt = Number(wordUint(w[1])) / 1e18;
  const e = borrowers.get(obo) || { address: obo, borrowCount: 0, totalBorrowed: 0, firstBlock: Infinity, lastBlock: 0, txs: [] };
  e.borrowCount++; e.totalBorrowed += amt;
  e.firstBlock = Math.min(e.firstBlock, parseInt(l.blockNumber, 16));
  e.lastBlock = Math.max(e.lastBlock, parseInt(l.blockNumber, 16));
  e.txs.push({ block: parseInt(l.blockNumber, 16), amount: amt, tx: l.transactionHash });
  borrowers.set(obo, e);
}
const repayers = new Map();
for (const l of rLogs) {
  const user = logAddr(l.topics[2]);
  const w = splitData(l.data);
  const amt = Number(wordUint(w[0])) / 1e18;
  const e = repayers.get(user) || { address: user, repayCount: 0, totalRepaid: 0 };
  e.repayCount++; e.totalRepaid += amt;
  repayers.set(user, e);
}
const usdtSupplies = [];
for (const l of sLogs) {
  const obo = logAddr(l.topics[2]);
  const w = splitData(l.data);
  const amt = Number(wordUint(w[1])) / 1e6;
  if (amt > 1000000) usdtSupplies.push({ address: obo, amount: amt, block: parseInt(l.blockNumber, 16), tx: l.transactionHash });
}

const list = [...borrowers.values()].sort((a, b) => b.totalBorrowed - a.totalBorrowed);
console.log('\n=== unique WETH borrowers (onBehalfOf):', list.length);
for (const e of list.slice(0, 20)) {
  const r = repayers.get(e.address);
  console.log(`${e.address} borrowed=${e.totalBorrowed.toFixed(1)} x${e.borrowCount} repaid=${r ? r.totalRepaid.toFixed(1) : 0} blocks ${e.firstBlock}-${e.lastBlock}`);
}
console.log('\n=== big USDT supplies (>1M):');
for (const s of usdtSupplies) console.log(`${s.address} supplied=${s.amount.toFixed(0)} USDT block ${s.block} tx ${s.tx}`);

const p1 = list.find(e => e.address.startsWith('0x0cdd') && e.address.endsWith('61d8'));
console.log('\n=== #1 candidate 0x0cdd...61d8:', p1 ? JSON.stringify({ borrowed: p1.totalBorrowed, count: p1.borrowCount, repaid: repayers.get(p1.address)?.totalRepaid, firstBlock: p1.firstBlock }) : 'NOT FOUND');
if (p1) console.log('   first borrow block ts:', await blockTs(p1.firstBlock), '=', new Date((await blockTs(p1.firstBlock)) * 1000).toISOString(), `(window start ${new Date(T0 * 1000).toISOString()})`);

fs.writeFileSync(new URL('./borrow_pull.json', import.meta.url), JSON.stringify({ window: { from, to, t0: T0, t1: T1 }, borrowers: list, repayers: [...repayers.values()], usdtSupplies }, null, 1));
console.log('\nsaved build_arb/borrow_pull.json');
