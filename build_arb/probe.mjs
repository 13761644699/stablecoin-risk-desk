import { chainlinkPrice, FEEDS, binanceMid, v3GetPool, TOKENS } from '../arb_lib.mjs';
const t = async (name, fn) => { const s = Date.now(); try { const v = await fn(); console.log(name, 'OK', Date.now()-s+'ms', JSON.stringify(v).slice(0,120)); } catch (e) { console.log(name, 'FAIL', Date.now()-s+'ms', String(e).slice(0,120)); } };
await t('chainlink ETH', () => chainlinkPrice(FEEDS['ETH/USD']));
await t('binance ETHUSDT mid', () => binanceMid('ETHUSDT'));
await t('v3 getPool WETH/USDC 500', () => v3GetPool(TOKENS.WETH.address, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 500));
