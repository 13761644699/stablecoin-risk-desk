import { chainlinkPrice, FEEDS, binanceMid, v3GetPool, v3PoolState, v3SimSellRaw, aaveReserveState, TOKENS } from '../arb_lib.mjs';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH = TOKENS.WETH.address, WBTC = TOKENS.WBTC.address;

const [clEth, clBtc, bnEth, bnBtc] = await Promise.all([
  chainlinkPrice(FEEDS['ETH/USD']), chainlinkPrice(FEEDS['BTC/USD']),
  binanceMid('ETHUSDT'), binanceMid('BTCUSDT'),
]);
console.log('Chainlink ETH/USD', clEth, ' BTC/USD', clBtc);
console.log('Binance mid ETHUSDT', bnEth, ' BTCUSDT', bnBtc);

for (const [name, base, baseDec, quote, quoteDec] of [
  ['WETH/USDC', WETH, 18, USDC, 6],
  ['WETH/USDT', WETH, 18, USDT, 6],
  ['WBTC/WETH', WBTC, 8, WETH, 18],
]) {
  for (const fee of [500, 3000, 10000]) {
    const pool = await v3GetPool(base, quote, fee);
    if (!pool) continue;
    const st = await v3PoolState(pool, base, baseDec, quote, quoteDec);
    const tvlQuoteSide = st.balQuote * (name === 'WBTC/WETH' ? bnEth : 1);
    const tvlBaseSide = st.balBase * (name === 'WETH/USDC' || name === 'WETH/USDT' ? bnEth : bnBtc);
    console.log(`${name} fee=${fee} pool=${pool} price=${st.priceBaseInQuote.toFixed(2)} balBase=${st.balBase.toFixed(2)} balQuote=${st.balQuote.toFixed(0)} TVL≈$${Math.round(tvlQuoteSide + tvlBaseSide).toLocaleString()}`);
    if (name !== 'WBTC/WETH') {
      const sim = v3SimSellRaw(st.sqrtP, st.liquidity, st.baseIsToken0, 100n * 10n ** 18n);
      if (sim) {
        const outQuote = Number(sim.amountOutRaw) / 10 ** quoteDec;
        console.log(`   sim sell 100 ETH -> ${outQuote.toFixed(0)} quote, avg ${((outQuote / 100)).toFixed(2)} (spot ${st.priceBaseInQuote.toFixed(2)})`);
      }
    }
  }
}
for (const sym of ['WETH', 'WBTC']) {
  const rs = await aaveReserveState(TOKENS[sym].address);
  console.log(`Aave ${sym}: active=${rs.active} frozen=${rs.frozen} paused=${rs.paused} borrowEnabled=${rs.borrowingEnabled} availLiq(raw)=${rs.availableLiquidity}`);
}
