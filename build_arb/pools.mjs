import { v3GetPool, TOKENS } from '../arb_lib.mjs';
const USDC='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', USDT='0xdAC17F958D2ee523a2206206994597C13D831ec7';
console.log('WETH/USDC 500 :', await v3GetPool(TOKENS.WETH.address, USDC, 500));
console.log('WETH/USDT 3000:', await v3GetPool(TOKENS.WETH.address, USDT, 3000));
console.log('WBTC/WETH 500 :', await v3GetPool(TOKENS.WBTC.address, TOKENS.WETH.address, 500));
console.log('WBTC/WETH 3000:', await v3GetPool(TOKENS.WBTC.address, TOKENS.WETH.address, 3000));
