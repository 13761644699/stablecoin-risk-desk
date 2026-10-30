import { v3GetPool, v3PoolState, v3SimSellRaw, aaveReserveState, TOKENS, binanceMid } from '../arb_lib.mjs';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH = TOKENS.WETH.address, WBTC = TOKENS.WBTC.address;
const bnEth = await binanceMid('ETHUSDT'), bnBtc = await binanceMid('BTCUSDT');
console.log('bnEth', bnEth, 'bnBtc', bnBtc);
for (const [name, base, baseDec, quote, quoteDec] of [
  ['WETH/USDC', WETH, 18, USDC, 6],
  ['WETH/USDT', WETH, 18, USDT, 6],
  ['WBTC/WETH', WBTC, 8, WETH, 18],
]) {
  for (const fee of [500, 3000, 10000]) {
    try {
      const pool = await v3GetPool(base, quote, fee);
      if (!pool) { console.log(name, fee, 'no pool'); continue; }
      const st = await v3PoolState(pool, base, baseDec, quote, quoteDec);
      const baseUsd = name === 'WBTC/WETH' ? bnBtc : bnEth;
      const quoteUsd = name === 'WBTC/WETH' ? bnEth : 1;
      const tvl = st.balBase * baseUsd + st.balQuote * quoteUsd;
      console.log(`${name} fee=${fee} pool=${pool.slice(0,10)}.. price=${st.priceBaseInQuote.toFixed(4)} balBase=${st.balBase.toFixed(2)} balQuote=${st.balQuote.toFixed(0)} TVL≈$${Math.round(tvl).toLocaleString()}`);
      if (name !== 'WBTC/WETH') {
        const sim = v3SimSellRaw(st.sqrtP, st.liquidity, st.baseIsToken0, 100n * 10n ** 18n);
        if (sim) console.log(`   sim sell 100 ETH avg ${((Number(sim.amountOutRaw)/10**quoteDec)/100).toFixed(2)} vs spot ${st.priceBaseInQuote.toFixed(2)}`);
      } else {
        const sim = v3SimSellRaw(st.sqrtP, st.liquidity, st.baseIsToken0, 5n * 10n ** 8n);
        if (sim) console.log(`   sim sell 5 WBTC avg ${(Number(sim.amountOutRaw)/1e18/5).toFixed(4)} WETH vs spot ${st.priceBaseInQuote.toFixed(4)}`);
      }
    } catch (e) { console.log(name, fee, 'FAIL', String(e).slice(0,100)); }
  }
}
for (const sym of ['WETH', 'WBTC']) {
  try { const rs = await aaveReserveState(TOKENS[sym].address); console.log(`Aave ${sym}: frozen=${rs.frozen} paused=${rs.paused} borrow=${rs.borrowingEnabled} availLiqRaw=${rs.availableLiquidity}`); }
  catch (e) { console.log('Aave', sym, 'FAIL', String(e).slice(0,100)); }
}
