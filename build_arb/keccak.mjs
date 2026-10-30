// Minimal Keccak-256 (Ethereum variant) using BigInt lanes. Self-tested below.
const MASK = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];
// rotation offsets r[x][y]
const R = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14]
];
const rotl = (v, n) => n === 0 ? v : (((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK);
function keccakF(state) {
  for (let round = 0; round < 24; round++) {
    const C = [], D = [];
    for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x + 5 * y] ^= D[x];
    const B = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(state[x + 5 * y], R[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y] & MASK) & B[((x + 2) % 5) + 5 * y]);
    state[0] ^= RC[round];
  }
}
export function keccak256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const rate = 136;
  const state = new Array(25).fill(0n);
  const padded = Array.from(bytes);
  padded.push(0x01);
  while (padded.length % rate !== rate - 1) padded.push(0);
  padded.push(0x80);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) lane |= BigInt(padded[off + i * 8 + j]) << BigInt(8 * j);
      state[i] ^= lane;
    }
    keccakF(state);
  }
  const out = [];
  for (let i = 0; i < 4; i++) {
    let lane = state[i];
    for (let j = 0; j < 8; j++) { out.push(Number(lane & 0xffn)); lane >>= 8n; }
  }
  return out.map(b => b.toString(16).padStart(2, '0')).join('');
}
// self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  const t1 = keccak256('');
  const t2 = keccak256('Transfer(address,address,uint256)');
  const t3 = keccak256('Borrow(address,address,address,uint256,uint8,uint256,uint16)');
  console.log('empty:', t1, t1 === 'c5d2460186f7233c927e7db2dcc703c0aae500b653ca82273b7bfad8045d85a470' ? 'OK' : 'FAIL');
  console.log('transfer:', t2, t2 === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' ? 'OK' : 'FAIL');
  console.log('borrow topic0: 0x' + t3);
}
