// CEX 充提状态检查（供 depeg-enrich 慢线调用）。
// 用法：node check_cex_deposit.mjs USDe
// 输出 JSON：各所各网络的充值/提币开关。2026-10-03 实测 Gate/Bitget/KuCoin 公开 API 可用。
const SYM = (process.argv[2] || '').toUpperCase();
if (!SYM) { console.error('用法：node check_cex_deposit.mjs <SYMBOL>'); process.exit(1); }

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function gateio() {
  try {
    const d = await get(`https://api.gateio.ws/api/v4/wallet/currency_chains?currency=${SYM}`);
    return { ok: true, chains: (Array.isArray(d) ? d : []).map(c => ({
      chain: c.chain, deposit: !c.is_deposit_disabled, withdraw: !c.is_withdraw_disabled,
    })) };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function bitget() {
  try {
    const d = await get('https://api.bitget.com/api/v2/spot/public/coins');
    const coin = (d.data || []).find(c => String(c.coin).toUpperCase() === SYM);
    if (!coin) return { ok: true, chains: [], note: '未收录该币种' };
    return { ok: true, chains: coin.chains.map(c => ({
      chain: c.chain, deposit: c.rechargeable === 'true', withdraw: c.withdrawable === 'true',
    })) };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function kucoin() {
  try {
    const d = await get(`https://api.kucoin.com/api/v3/currencies/${SYM}`);
    const chains = (d.data && d.data.chains) || [];
    return { ok: true, chains: chains.map(c => ({
      chain: c.chainName, deposit: !!c.isDepositEnabled, withdraw: !!c.isWithdrawEnabled,
    })) };
  } catch (e) { return { ok: false, error: e.message }; }
}

const [g, b, k] = await Promise.all([gateio(), bitget(), kucoin()]);
const out = { symbol: SYM, checkedAt: new Date().toISOString(), gateio: g, bitget: b, kucoin: k };
// 一句话结论：有没有所暂停了该币种的充/提
const flags = [];
for (const [name, r] of [['Gate.io', g], ['Bitget', b], ['KuCoin', k]]) {
  if (!r.ok) { flags.push(`${name} 查询失败`); continue; }
  for (const c of r.chains) {
    if (!c.deposit || !c.withdraw) flags.push(`${name}/${c.chain} ${!c.deposit ? '停充' : ''}${!c.withdraw ? '停提' : ''}`.trim());
  }
}
out.summary = flags.length ? flags.join('；') : '三所充提均正常';
console.log(JSON.stringify(out, null, 2));
