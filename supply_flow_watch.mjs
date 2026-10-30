// 稳定币供应量流动监控（2026-10-03，第1条借鉴：铸造/赎回流先行指标）。
// 数据源：DefiLlama stablecoins API（免费、无 key、逐日供应量历史）。
// 逻辑：供应量净变化 = 净铸造 − 净赎回。持续净流出 = 赎回压力/机构撤离的先行信号。
// 告警：7天净流出 >2% 或 本周流出加速（>上周2倍且>1%）。
// 建议每周跑一次（cron），数据是日频，高频跑无意义。
const COINS = {
  USDT: 1, USDC: 2, USDD: 14, PYUSD: 120, USDe: 146,
  USDS: 209, RLUSD: 250, USD1: 262, USDG: 286, U: 336,
};
const OUTFLOW_WARN_PCT = 2;   // 7天净流出超 2% 告警
const ACCEL_MULT = 2;         // 本周流出 > 上周 N 倍视为加速

async function supplyHistory(id) {
  const r = await fetch(`https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=${id}`,
    { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const pts = await r.json();
  return pts.map(p => ({ t: Number(p.date) * 1000, v: p.totalCirculatingUSD.peggedUSD }))
    .filter(p => p.v > 0).sort((a, b) => a.t - b.t);
}

function pctChange(hist, daysBack, windowDays) {
  // 取 daysBack 天前 vs daysBack+window 天前
  const now = hist[hist.length - 1].t;
  const at = (ts) => {
    let best = hist[0];
    for (const p of hist) { if (p.t <= ts) best = p; else break; }
    return best.v;
  };
  const end = at(now - daysBack * 864e5), start = at(now - (daysBack + windowDays) * 864e5);
  return start > 0 ? ((end - start) / start) * 100 : 0;
}

const rows = [];
for (const [sym, id] of Object.entries(COINS)) {
  try {
    const h = await supplyHistory(id);
    if (h.length < 21) { rows.push({ sym, note: '数据不足' }); continue; }
    const w1 = pctChange(h, 0, 7), w2 = pctChange(h, 7, 7);
    const supplyB = (h[h.length - 1].v / 1e9).toFixed(2);
    let flag = null;
    if (w1 <= -OUTFLOW_WARN_PCT) flag = `7天净流出 ${w1.toFixed(1)}%`;
    else if (w1 <= -1 && w1 < w2 * ACCEL_MULT && w2 < 0) flag = `流出加速（上周${w2.toFixed(1)}%→本周${w1.toFixed(1)}%）`;
    rows.push({ sym, supply: supplyB + 'B', w1: w1.toFixed(1) + '%', w2: w2.toFixed(1) + '%', flag });
  } catch (e) { rows.push({ sym, note: '拉取失败: ' + e.message }); }
  await new Promise(r => setTimeout(r, 300));
}

const alerts = rows.filter(r => r.flag);
console.log(`稳定币供应量流动扫描 ${new Date().toISOString().slice(0, 10)}（DefiLlama 日频）`);
for (const r of rows) {
  console.log(`  ${r.sym.padEnd(6)} 供应$${r.supply || '-'}  本周${r.w1 || '-'}  上周${r.w2 || '-'}${r.flag ? '  ⚠️ ' + r.flag : ''}${r.note ? '  ' + r.note : ''}`);
}
console.log(alerts.length ? `\n⚠️ ${alerts.length} 个币种出现赎回压力信号` : '\n✅ 10 个币种供应量流动均正常');
