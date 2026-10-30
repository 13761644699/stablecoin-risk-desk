// arb_spread_watch.mjs — 主流币链上 vs 交易所 vs 预言机三方价差监控（套利体系整合块3）
//
// 立项标准（2026-10-30 用户定）：不按「异动」立项，按「可套利性」立项——本层存在的
// 唯一理由是：当 DEX 与预言机/CEX 脱节时（预言机窗口形态），第一时间把事件送进
// 深化研判队列，端出可执行分析（脱节在哪/窗口清单/路径/当刻深度/做不做）。
//
// 口径（全部为已定规则）：
// 1. 源白名单制（2026-10-30 拍板，替代双源复核）：只认下方写死的 Uniswap V3 深池
//    （按池子筛、不按名气），每轮按池子 TVL 复测准入（跌破门槛自动降级只观察）；
//    白名单源单源触发即成立，不再要第二源验真。
// 2. 报价纪律：DEX 用 slot0 中间价 + 市价模拟价（单 tick 区间近似，$100k 卖出）；
//    CEX 用币安 bookTicker 中间价；预言机用 Chainlink latestRoundData。绝不用最新成交价。
// 3. 计价口径：WBTC 的 DEX 价经 WETH 交叉换算成 USD 时，同时给出「全 DEX 口径」
//    （WBTC/WETH × WETH/USDT 池价）与「预言机交叉口径」，定级用全 DEX 口径对
//    BTC/USD 预言机的偏离——计价腿（ETH）自身在动时不把 ETH 的脱节算进 WBTC。
// 4. 阈值：|DEX − 预言机| 或 |DEX − CEX| ≥ 1.5%（150bps）预警、≥ 4%（400bps）严重。
//    首次检出须间隔 ~25 秒复采仍越线才入队（防单点坏印）；存续期升级到严重立即入队。
// 5. 推送时序（2026-10-30 定稿）：机会类一律先入队深化、分析完再推，本脚本不直推
//    机会警报；仅「已研判推送过的事件解除」可直发一条解除通知（闭环，非机会警报）。
// 6. 采样并入 sweep_loop（每 5 分钟一轮）：常态一轮一次采样；检出越线时在本轮内
//    每 30 秒加密采样（最多约 3 分钟，受 sweep timeout 约束），记录持续/峰值后入队。
//
// 状态：state/arb_spread_state.json。队列：state/arb_event_queue.jsonl（arb_lib）。
// 测试：ARB_NO_PUSH=1 时队列写 dryrun 文件、解除通知只打印。
import fs from 'fs';
import path from 'path';
import { STATE_DIR, NO_PUSH, chainlinkPrice, FEEDS, binanceMid, v3PoolState, v3SimSellRaw,
  TOKENS, readDone, enqueueArbEvent, sendPushplus, appendEpisodeSummary, fmtDurMin } from './arb_lib.mjs';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WARN_BPS = 150, SEVERE_BPS = 400, CLEAR_BPS = 50;
const STATE_FILE = path.join(STATE_DIR, 'arb_spread_state.json');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const bps = (a, b) => ((a - b) / b) * 10000;

// 白名单池（2026-10-30 经工厂合约解析 + TVL 实测选定；每轮复测 TVL，跌破 minTvlUsd 降级）
const ASSETS = [
  {
    symbol: 'ETH', feed: 'ETH/USD', cexPair: 'ETHUSDT', simBase: 100, // 模拟卖出 100 ETH
    pools: [
      { pool: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', label: 'Uniswap V3 WETH/USDC 0.05%', base: TOKENS.WETH.address, baseDec: 18, quote: USDC, quoteDec: 6, quoteUsd: 1, minTvlUsd: 5_000_000 },
      { pool: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', label: 'Uniswap V3 WETH/USDT 0.30%', base: TOKENS.WETH.address, baseDec: 18, quote: USDT, quoteDec: 6, quoteUsd: 1, minTvlUsd: 5_000_000 },
    ],
  },
  {
    symbol: 'WBTC', feed: 'BTC/USD', cexPair: 'BTCUSDT', simBase: 5, // 模拟卖出 5 WBTC（以 WETH 计价后再换算）
    pools: [
      { pool: '0x4585fe77225b41b697c938b018e2ac67ac5a20c0', label: 'Uniswap V3 WBTC/WETH 0.05%', base: TOKENS.WBTC.address, baseDec: 8, quote: TOKENS.WETH.address, quoteDec: 18, quoteUsd: null /* 运行时用 ETH 的 DEX 价 */, minTvlUsd: 2_000_000 },
    ],
  },
];

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 1)); }

async function sampleAsset(cfg, ethDexUsd) {
  const [oracle, cex] = await Promise.all([
    chainlinkPrice(FEEDS[cfg.feed]).catch(() => null),
    binanceMid(cfg.cexPair).catch(() => null),
  ]);
  const poolReads = [];
  for (const p of cfg.pools) {
    try {
      const st = await v3PoolState(p.pool, p.base, p.baseDec, p.quote, p.quoteDec);
      const quoteUsd = p.quoteUsd ?? ethDexUsd;
      if (!(quoteUsd > 0)) { poolReads.push({ ...p, ok: false, why: '计价腿无价' }); continue; }
      const tvlUsd = st.balBase * (cfg.symbol === 'ETH' ? st.priceBaseInQuote * quoteUsd : (oracle?.price || 0)) + st.balQuote * quoteUsd;
      // 对 WBTC 池：balBase 估值用预言机 BTC 价（TVL 准入只是量级判断，不参与定级定价）
      const spotUsd = st.priceBaseInQuote * quoteUsd;
      const simRaw = v3SimSellRaw(st.sqrtP, st.liquidity, st.baseIsToken0, BigInt(cfg.simBase) * 10n ** BigInt(p.baseDec));
      let simUsd = null;
      if (simRaw) {
        const outQuote = Number(simRaw.amountOutRaw) / 10 ** p.quoteDec;
        simUsd = (outQuote / cfg.simBase) * quoteUsd;
      }
      poolReads.push({ ...p, ok: tvlUsd >= p.minTvlUsd, tvlUsd: Math.round(tvlUsd), spotUsd, simUsd, why: tvlUsd >= p.minTvlUsd ? '' : `TVL $${Math.round(tvlUsd).toLocaleString()} < 门槛 $${p.minTvlUsd.toLocaleString()}，降级只观察` });
    } catch (e) {
      poolReads.push({ ...p, ok: false, why: '读取失败 ' + String(e).slice(0, 80) });
    }
  }
  const good = poolReads.filter(p => p.ok);
  // 主池 = 合格池中 TVL 最大者（白名单内按深度选主）
  const main = good.sort((a, b) => b.tvlUsd - a.tvlUsd)[0] || null;
  return { oracle, cex, poolReads, main };
}

function evaluate(cfg, s) {
  if (!s.main || !s.oracle) return null;
  const dex = s.main.spotUsd;
  const devOracle = bps(dex, s.oracle.price);
  const devCex = s.cex ? bps(dex, s.cex) : null;
  const driver = devCex !== null && Math.abs(devCex) > Math.abs(devOracle) ? 'DEX-CEX' : 'DEX-预言机';
  const peak = Math.max(Math.abs(devOracle), Math.abs(devCex || 0));
  const level = peak >= SEVERE_BPS ? 'severe' : peak >= WARN_BPS ? 'warn' : null;
  return { dex, devOracle, devCex, driver, peak, level };
}

function factsText(cfg, s, ev, extra) {
  const f4 = (v) => v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const lines = [
    `主流币价差事件：${cfg.symbol}（${ev.driver} 脱节）`,
    ``,
    `- DEX（白名单主池 ${s.main.label}）：${f4(ev.dex)}（池 TVL 约 $${(s.main.tvlUsd || 0).toLocaleString()}）`,
    `- 预言机（Chainlink ${cfg.feed}）：${f4(s.oracle?.price)} → DEX 偏离 ${ev.devOracle >= 0 ? '+' : ''}${ev.devOracle.toFixed(0)} bps`,
    `- 交易所（币安 ${cfg.cexPair} 中间价）：${f4(s.cex)} → DEX 偏离 ${ev.devCex === null ? '—' : (ev.devCex >= 0 ? '+' : '') + ev.devCex.toFixed(0) + ' bps'}`,
    `- 市价模拟（卖 ${cfg.simBase} ${cfg.symbol}）：均价 ${f4(s.main.simUsd)}（相对中间价 ${s.main.simUsd ? bps(s.main.simUsd, ev.dex).toFixed(0) : '—'} bps 滑点近似）`,
    `- 级别：${ev.level === 'severe' ? '严重（≥4%）' : '预警（≥1.5%）'}；首次检出 ${extra.firstSeen}；本轮峰值 ${extra.peakBps.toFixed(0)} bps；已持续约 ${extra.durMin} 分钟`,
  ];
  for (const p of s.poolReads) if (!p.ok) lines.push(`- ⚠️ 白名单池降级：${p.label}——${p.why}`);
  lines.push(`- 下一步：深化研判将核 Aave/Compound/Spark 借贷窗口状态（冻结/可借流动性）与可执行路径，给出做/不做结论`);
  return lines.join('\n');
}

async function main() {
  const state = loadState();
  const now = new Date();
  // 先采 ETH（WBTC 的计价腿需要 ETH 的 DEX 价）
  const samples = {};
  let ethDexUsd = null;
  for (const cfg of ASSETS) {
    samples[cfg.symbol] = await sampleAsset(cfg, ethDexUsd);
    if (cfg.symbol === 'ETH' && samples.ETH.main) ethDexUsd = samples.ETH.main.spotUsd;
  }
  // WBTC 采样时 ethDexUsd 已就绪（ASSETS 顺序 ETH 在前）；若上面 WBTC 先于 ETH 价采样则补采一次
  if (!samples.WBTC.main && ethDexUsd) samples.WBTC = await sampleAsset(ASSETS[1], ethDexUsd);

  for (const cfg of ASSETS) {
    const s = samples[cfg.symbol];
    const key = cfg.symbol;
    const st = state[key] || { active: false };
    let ev = evaluate(cfg, s);
    if (!ev) { console.log(`[arb-spread] ${key} 无合格主池或预言机无价，跳过`); state[key] = st; continue; }

    if (!st.active && ev.level) {
      // 首次越线：25 秒后复采确认（防单点坏印），并在本轮内加密采样看持续性
      console.log(`[arb-spread] ${key} 初检越线 ${ev.peak.toFixed(0)}bps（${ev.level}），复采确认中…`);
      await sleep(25_000);
      const s2 = await sampleAsset(cfg, key === 'WBTC' ? ethDexUsd : null);
      const ev2 = evaluate(cfg, s2);
      if (!ev2?.level) { console.log(`[arb-spread] ${key} 复采未越线（${ev2 ? ev2.peak.toFixed(0) : '—'}bps），判定单点噪音，不入队`); state[key] = st; continue; }
      Object.assign(s, s2); ev = ev2;
      st.active = true; st.level = ev.level; st.firstSeen = now.toISOString();
      st.peakBps = ev.peak; st.pushedKnown = false; st.peakTvlUsd = s.main.tvlUsd || 0;
      // 加密采样：每 30 秒一采，最多再 4 轮，更新峰值（持续性证据写进 payload）
      for (let i = 0; i < 4; i++) {
        await sleep(30_000);
        const sN = await sampleAsset(cfg, key === 'WBTC' ? ethDexUsd : null);
        const evN = evaluate(cfg, sN);
        if (!evN) break;
        st.peakBps = Math.max(st.peakBps, evN.peak);
        if (evN.level === 'severe') st.level = 'severe';
        Object.assign(s, sN); ev = evN;
        if (!evN.level) break;
      }
      const durMin = Math.max(1, Math.round((Date.now() - Date.parse(st.firstSeen)) / 60000));
      const ft = factsText(cfg, s, ev, { firstSeen: st.firstSeen, peakBps: st.peakBps, durMin });
      const r = enqueueArbEvent({
        type: 'spread', key, severity: st.level === 'severe' ? 'severe' : 'warn',
        payload: { symbol: key, dex: ev.dex, oracle: s.oracle?.price, cex: s.cex, devOracleBps: Math.round(ev.devOracle), devCexBps: ev.devCex === null ? null : Math.round(ev.devCex), driver: ev.driver, pool: s.main.label, poolTvlUsd: s.main.tvlUsd, simUsd: s.main.simUsd, firstSeen: st.firstSeen, peakBps: Math.round(st.peakBps) },
        factsText: ft,
      });
      console.log(`[arb-spread] ${key} 已入队深化（${st.level}，峰值 ${st.peakBps.toFixed(0)}bps，merged=${r.merged}）`);
    } else if (st.active) {
      // 存续：更新峰值；升级到 severe 立即入队更新；回落到清除线以下收尾
      st.peakBps = Math.max(st.peakBps || 0, ev.peak);
      st.peakTvlUsd = Math.max(st.peakTvlUsd || 0, s.main.tvlUsd || 0);
      if (!st.pushedKnown) {
        const done = readDone().filter(d => d.id === `spread:${key}` && d.pushed && Date.parse(d.at) > Date.parse(st.firstSeen || 0));
        if (done.length) st.pushedKnown = true;
      }
      if (ev.level === 'severe' && st.level !== 'severe') {
        st.level = 'severe';
        const durMin = Math.max(1, Math.round((Date.now() - Date.parse(st.firstSeen)) / 60000));
        const ft = factsText(cfg, s, ev, { firstSeen: st.firstSeen, peakBps: st.peakBps, durMin });
        enqueueArbEvent({ type: 'spread', key, severity: 'severe', payload: { symbol: key, escalated: true, dex: ev.dex, oracle: s.oracle?.price, cex: s.cex, devOracleBps: Math.round(ev.devOracle), devCexBps: ev.devCex === null ? null : Math.round(ev.devCex), driver: ev.driver, pool: s.main.label, poolTvlUsd: s.main.tvlUsd, simUsd: s.main.simUsd, firstSeen: st.firstSeen, peakBps: Math.round(st.peakBps) }, factsText: ft });
        console.log(`[arb-spread] ${key} 升级为严重，已更新队列条目`);
      }
      if (Math.abs(ev.devOracle) < CLEAR_BPS && (ev.devCex === null || Math.abs(ev.devCex) < CLEAR_BPS)) {
        console.log(`[arb-spread] ${key} 价差已回落至清除线内（${ev.devOracle.toFixed(0)}bps），事件结束，峰值 ${st.peakBps.toFixed(0)}bps`);
        if (st.pushedKnown) {
          await sendPushplus(`✅ ${key} 链上价差已恢复`, `主流币价差解除：${key}\n\n- DEX ${s.main.label}：$${ev.dex.toFixed(2)}\n- 预言机：$${s.oracle.price.toFixed(2)}（偏离 ${ev.devOracle.toFixed(0)} bps）\n- 事件峰值偏离 ${st.peakBps.toFixed(0)} bps，首次检出 ${st.firstSeen}\n- 持续时长：约 ${fmtDurMin(st.firstSeen, new Date().toISOString())}${st.peakTvlUsd ? `\n- 期间主池 TVL 峰值：$${Math.round(st.peakTvlUsd).toLocaleString()}` : ''}\n- 借贷窗口类机会随价差回归关闭，未平仓的借入仓位应已回补`);
          appendEpisodeSummary({ type: 'spread', key, peakTxt: `峰值偏离 ${Math.round(st.peakBps)} bps`, durMin: Math.max(1, Math.round((Date.now() - Date.parse(st.firstSeen)) / 60000)), volumeTxt: st.peakTvlUsd ? `主池 TVL 峰值 $${Math.round(st.peakTvlUsd).toLocaleString()}` : '' });
        }
        state[key] = { active: false };
        continue;
      }
      state[key] = st;
    } else {
      state[key] = st;
    }
    if (!ev.level && !st.active) console.log(`[arb-spread] ${key} 正常：DEX $${ev.dex.toFixed(2)} vs 预言机 ${ev.devOracle.toFixed(0)}bps / CEX ${ev.devCex === null ? '—' : ev.devCex.toFixed(0) + 'bps'}（主池 ${s.main.label} TVL $${(s.main.tvlUsd || 0).toLocaleString()}）`);
  }
  saveState(state);
}

main().catch(e => { console.error('[arb-spread] 运行失败：', String(e).slice(0, 300)); process.exit(1); });
