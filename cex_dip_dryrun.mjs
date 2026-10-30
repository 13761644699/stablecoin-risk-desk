// cex_dip_dryrun.mjs — 逐所盯跌层 dry-run 验证（2026-10-28）
//
// 用途：注入假跌点，验证全链路（带宽建带 → 触发 → 盘口模拟过流动性关 →
// 锚复核 → 组装推送文案 → 事件状态机 加深/解除），推送在注入层被捕获拦截，
// 绝不真发（sendPushplus/sendBark 均为捕获桩）。文案存档到
// state/cex_dip_dryrun_last.json 供人工核对。
//
// 用法：
//   node cex_dip_dryrun.mjs          合成数据全链路 dry-run
//   node cex_dip_dryrun.mjs --live   真实行情只读实测一轮（真实抓价/抓盘口，
//                                    推送仍走捕获桩，状态写 /tmp，不碰生产状态）
import fs from 'fs';
import path from 'path';
import { scanCexDipWatch, CEX_DIP_COMBOS } from './cex_dip_watch.mjs';

const LIVE = process.argv.includes('--live');
const STATE_DIR = LIVE ? '/tmp/cex_dip_live_state' : '/tmp/cex_dip_dryrun_state';
fs.rmSync(STATE_DIR, { recursive: true, force: true });
fs.mkdirSync(STATE_DIR, { recursive: true });

const captured = [];
const sendPushplus = async (title, content) => { captured.push({ ch: 'pushplus', title, content }); return { ok: true, code: 200, dryRun: true }; };
const sendBark = async (title, content) => { captured.push({ ch: 'bark', title, content }); return { ok: true, dryRun: true }; };
const log = (m) => console.log(m);

// 合成 DEX 腿（锚来源）：USDD 用昨晚真实锚形态（SunSwap 0.9997、$2.15M）
function synthLegs() {
  const legs = [
    { symbol: 'USDD', chain: 'Tron', price: 0.9997, liq: 2_150_000, dex: 'sunswap', pair: 'USDT/USDD', method: 'gecko-primary' },
  ];
  for (const s of ['USDT', 'USDC', 'USDS', 'USDe', 'USD1', 'PYUSD', 'RLUSD', 'USDG', 'U']) {
    legs.push({ symbol: s, chain: 'Ethereum', price: 1.0000, liq: 600_000, dex: 'testdex', pair: `${s}/USDT`, method: 'direct' });
  }
  return legs;
}

// 合成目标美元价（venueUsd）：常态各所贴锚小幅偏移；Gate USDD 按实测常态 −20bp 左右
const NORMAL_USD = {
  'USDT@Kraken': 0.9987, 'USDT@Coinbase': 0.9987, 'USDT@Binance': 0.9987,
  'USDC@Binance': 0.9999, 'USDC@OKX': 0.9998, 'USDC@Gate': 0.9998, 'USDC@Kraken': 0.9998,
  'USDS@Binance': 0.9999, 'USDe@Binance': 1.0001, 'USDe@Kraken': 1.0000,
  'USD1@Binance': 1.0000, 'USD1@Gate': 1.0000, 'USD1@Coinbase': 1.0000,
  'PYUSD@Kraken': 0.9999, 'PYUSD@OKX': 0.9997,
  'RLUSD@Binance': 1.0000, 'RLUSD@OKX': 1.0000, 'RLUSD@Kraken': 1.0000,
  'USDG@OKX': 1.0000, 'USDG@Kraken': 1.0000,
  'USDD@Gate': 0.9976, 'U@Binance': 1.0001,
};
const USDT_USD = 0.9987, USDC_USD = 0.9998;
const quoteRateOf = (q) => (q === 'USD' ? 1 : q === 'USDT' ? USDT_USD : USDC_USD);

function makePriceFeed(usdTargets) {
  return async () => {
    const m = new Map();
    for (const c of CEX_DIP_COMBOS) {
      const key = `${c.symbol}@${c.venue}`;
      const usd = usdTargets[key];
      if (!(usd > 0)) continue;
      m.set(key, usd / quoteRateOf(c.quote));
    }
    return m;
  };
}
function makeBookFeed(usdTargets, dippedKey) {
  return async (combo) => {
    const key = `${combo.symbol}@${combo.venue}`;
    const rate = quoteRateOf(combo.quote);
    const toPair = (usdPx, qty) => [usdPx / rate, qty];
    if (key === dippedKey) {
      // 跌点盘口（美元口径分层，模拟昨晚 HTX/Gate 深度形态）
      return {
        asks: [toPair(0.9410, 9000), toPair(0.9480, 13000), toPair(0.9560, 16000), toPair(0.9680, 22000), toPair(0.9850, 30000)],
        bids: [toPair(0.9390, 6000), toPair(0.9350, 9000)],
      };
    }
    const mid = usdTargets[key];
    return {
      asks: [toPair(mid * 1.0001, 60000), toPair(mid * 1.0005, 90000)],
      bids: [toPair(mid * 0.9999, 60000), toPair(mid * 0.9995, 90000)],
    };
  };
}

async function runScan(usdTargets, dippedKey, label) {
  const before = captured.length;
  const summary = await scanCexDipWatch({
    legs: synthLegs(),
    sendPushplus, sendBark,
    options: {
      stateDir: STATE_DIR, log,
      sampleGapMs: 0, // dry-run 紧循环连扫：样本逐轮入带（生产自轮询默认 4 分钟间距）
      hooks: { fetchPrices: makePriceFeed(usdTargets), fetchBook: makeBookFeed(usdTargets, dippedKey) },
    },
  });
  console.log(`--- [${label}] summary=${JSON.stringify(summary)} 本轮捕获推送 ${captured.length - before} 条`);
  return summary;
}

if (LIVE) {
  const summary = await scanCexDipWatch({
    legs: synthLegs(), // 锚的 DEX 侧用合成腿占位：本模式只验 CEX 抓价/换算/盘口通道
    sendPushplus, sendBark,
    options: { stateDir: STATE_DIR, log, sampleGapMs: 0 },
  });
  console.log('LIVE summary:', JSON.stringify(summary));
  console.log(`LIVE 捕获推送 ${captured.length} 条（平静市应为 0；带宽样本不足时必然为 0）`);
  for (const p of captured) console.log('CAPTURED:', p.ch, p.title);
} else {
  // 1) 建带：15 轮常态采样（>=12 样本带宽就绪），含首轮每日自检（合成正常盘口应全过）
  for (let i = 0; i < 15; i++) await runScan(NORMAL_USD, null, `warmup ${i + 1}`);
  console.log(`建带完成，捕获推送应为 0，实际 ${captured.length}`);
  // 2) 注入假跌点：Gate USDD 跌到 0.9400（锚 SunSwap 0.9997 不动）
  const dip1 = { ...NORMAL_USD, 'USDD@Gate': 0.9400 };
  await runScan(dip1, 'USDD@Gate', 'dip-1 0.9400');
  // 3) 加深：跌到 0.9050（加深 >30bp 应再推一帧）
  const dip2 = { ...NORMAL_USD, 'USDD@Gate': 0.9050 };
  await runScan(dip2, 'USDD@Gate', 'dip-2 0.9050 deepen');
  // 4) 回锚：回到常态 0.9976（应发解除）
  await runScan(NORMAL_USD, null, 'resolve');
  // 存档 + 断言
  const outFile = path.join(process.cwd(), 'state', 'cex_dip_dryrun_last.json');
  fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), captured }, null, 1));
  console.log(`\n===== 捕获推送共 ${captured.length} 条（期望 3：新建/加深/解除，且 0 条 Bark） =====`);
  for (const p of captured) {
    console.log(`\n----- [${p.ch}] ${p.title}\n${p.content}`);
  }
  const pp = captured.filter((c) => c.ch === 'pushplus');
  const bark = captured.filter((c) => c.ch === 'bark');
  const okNew = pp.some((c) => c.title.includes('跌点') && c.content.includes('盘口实测') && c.content.includes('退出路径'));
  const okDeepen = pp.some((c) => c.title.includes('加深'));
  const okResolve = pp.some((c) => c.title.includes('解除'));
  console.log(`\n断言：新建带方案=${okNew} 加深=${okDeepen} 解除=${okResolve} Bark条数=${bark.length}（USDD 豁免应为 0）`);
  console.log(okNew && okDeepen && okResolve && bark.length === 0 ? 'DRY-RUN PASS' : 'DRY-RUN FAIL');
  console.log(`文案存档：${outFile}`);
}
