import { rpc, findBlockByTs, getLogs, keccak256, topicAddr, logAddr, wordAddr, wordUint, splitData } from './eth_lib.mjs';
import fs from 'node:fs';

const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const BORROW = '0x' + keccak256('Borrow(address,address,address,uint256,uint8,uint256,uint16)');
const FLASH = '0x' + keccak256('FlashLoan(address,address,address,uint256,uint8,uint256,uint16)');

const latest = parseInt(await rpc('eth_blockNumber', []), 16);
// wider window: start 20:00 UTC
const fromWide = await findBlockByTs(Date.parse('2026-10-29T20:00:00Z') / 1000, latest);
const fromMain = await findBlockByTs(Date.parse('2026-10-29T20:24:00Z') / 1000, latest);
const toMain = (await findBlockByTs(Date.parse('2026-10-30T02:24:00Z') / 1000, latest)) - 1;
console.log('blocks wide/main/to:', fromWide, fromMain, toMain);

const logs = await getLogs(POOL, [BORROW, topicAddr(WETH)], fromWide, toMain);
const rows = logs.map(l => {
  const w = splitData(l.data);
  return {
    block: parseInt(l.blockNumber, 16),
    tx: l.transactionHash,
    onBehalfOf: logAddr(l.topics[2]),
    user: wordAddr(w[0]),
    amount: Number(wordUint(w[1])) / 1e18,
    mode: Number(wordUint(w[2])),
  };
});
const inMain = rows.filter(r => r.block >= fromMain);
const uniq = (arr, k) => new Set(arr.map(r => r[k]));
console.log('borrow logs wide/main:', rows.length, inMain.length);
console.log('unique onBehalfOf  wide:', uniq(rows, 'onBehalfOf').size, ' main:', uniq(inMain, 'onBehalfOf').size);
console.log('unique user        wide:', uniq(rows, 'user').size, ' main:', uniq(inMain, 'user').size);
const unionMain = new Set([...inMain.map(r => r.onBehalfOf), ...inMain.map(r => r.user)]);
console.log('union(user,obo) main:', unionMain.size);
console.log('borrow modes:', [...new Set(rows.map(r => r.mode))]);

// tx senders for main-window borrows
const txs = [...new Set(inMain.map(r => r.tx))];
console.log('unique borrow txs (main):', txs.length);
const froms = new Map();
for (let i = 0; i < txs.length; i++) {
  const t = await rpc('eth_getTransactionByHash', [txs[i]]);
  if (t) froms.set(txs[i], t.from.toLowerCase());
}
const senderSet = new Set([...froms.values()]);
console.log('unique tx senders (main):', senderSet.size);
const oboByTx = new Map(inMain.map(r => [r.tx, r.onBehalfOf]));
let senderNeObo = 0;
for (const [tx, f] of froms) if (oboByTx.get(tx) && oboByTx.get(tx) !== f) senderNeObo++;
console.log('txs where sender != onBehalfOf:', senderNeObo);

// flashloan WETH initiators in main window
const fLogs = await getLogs(POOL, [FLASH, topicAddr(WETH)], fromMain, toMain);
const initiators = new Map();
for (const l of fLogs) {
  const w = splitData(l.data);
  const init = wordAddr(w[0]); // initiator is first non-indexed? FlashLoan: target indexed, initiator in data w0, asset indexed topic2
  const amt = Number(wordUint(w[2])) / 1e18;
  initiators.set(init, (initiators.get(init) || 0) + amt);
}
console.log('flashloan WETH logs:', fLogs.length, 'unique initiators:', initiators.size);
for (const [a, v] of [...initiators.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) console.log('  flash', a, v.toFixed(1));

fs.writeFileSync(new URL('./borrow_rows.json', import.meta.url), JSON.stringify({ rows, fromWide, fromMain, toMain, txFroms: [...froms.entries()] }, null, 1));
console.log('saved borrow_rows.json');
