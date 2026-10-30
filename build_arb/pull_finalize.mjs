import { rpc, findBlockByTs, getLogs, keccak256, topicAddr, logAddr, wordUint, splitData } from './eth_lib.mjs';
import fs from 'node:fs';

const POOL_V3 = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const POOL_V2 = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const pull = JSON.parse(fs.readFileSync(new URL('./borrow_pull.json', import.meta.url)));
const { from, to } = pull.window;

// Aave V2 WETH borrows in same window (completeness check)
const BORROW_V2 = '0x' + keccak256('Borrow(address,address,address,uint256,uint256,uint256,uint256)');
try {
  const v2 = await getLogs(POOL_V2, [BORROW_V2, topicAddr(WETH)], from, to, 900);
  const v2addrs = new Set(v2.map(l => logAddr(l.topics[2])));
  console.log('Aave V2 WETH borrow logs:', v2.length, 'unique onBehalfOf:', v2addrs.size, [...v2addrs].slice(0, 5));
} catch (e) { console.log('V2 check failed:', String(e).slice(0, 120)); }

// All stablecoin supplies (USDT+USDC, any amount) in window, per onBehalfOf
const SUPPLY = '0x' + keccak256('Supply(address,address,address,uint256,uint16)');
const supplies = new Map();
for (const [sym, addr, dec] of [['USDT', USDT, 1e6], ['USDC', USDC, 1e6]]) {
  const logs = await getLogs(POOL_V3, [SUPPLY, topicAddr(addr)], from, to);
  for (const l of logs) {
    const obo = logAddr(l.topics[2]);
    const w = splitData(l.data);
    const amt = Number(wordUint(w[1])) / dec;
    const e = supplies.get(obo) || { USDT: 0, USDC: 0 };
    e[sym] += amt;
    supplies.set(obo, e);
  }
}
console.log('addresses with stable supplies in window:', supplies.size);

// diag rows for user-only addresses
const diag = JSON.parse(fs.readFileSync(new URL('./borrow_rows.json', import.meta.url)));
const mainRows = diag.rows.filter(r => r.block >= diag.fromMain);
const oboSet = new Set(mainRows.map(r => r.onBehalfOf));
const userOnly = [...new Set(mainRows.map(r => r.user))].filter(u => !oboSet.has(u));
console.log('user-only addresses (initiators, not position owners):', userOnly);

const HACKER = '0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a';
const seed = pull.borrowers
  .filter(b => b.address !== HACKER)
  .map(b => {
    const rep = pull.repayers.find(r => r.address === b.address);
    const sup = supplies.get(b.address) || { USDT: 0, USDC: 0 };
    return {
      address: b.address,
      totalBorrowedEth: +b.totalBorrowed.toFixed(4),
      borrowCount: b.borrowCount,
      totalRepaidEth: rep ? +rep.totalRepaid.toFixed(4) : 0,
      repaidFull: rep ? Math.abs(rep.totalRepaid - b.totalBorrowed) < 0.5 : false,
      suppliedUsdt: Math.round(sup.USDT),
      suppliedUsdc: Math.round(sup.USDC),
      firstBorrowBlock: b.firstBlock,
      lastBorrowBlock: b.lastBlock,
      borrowTxs: b.txs.map(t => t.tx),
    };
  });
console.log('seed (excl hacker):', seed.length);
fs.writeFileSync(new URL('./seed_list.json', import.meta.url), JSON.stringify({ hacker: HACKER, seed, userOnly, window: pull.window }, null, 1));
console.log('saved seed_list.json');
