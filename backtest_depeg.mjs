#!/usr/bin/env node
// backtest_depeg.mjs — 脱锚阈值半年回测（2026-04-03 ~ 2026-10-03）
// 判定逻辑直接调用 depeg_logic.mjs 的 classifyDepeg/isCleared，与线上同一套。
// 历史价格：CoinGecko market_chart 日线（免费）；分链历史免费拿不到 → 币级回测，见报告局限。
// 用法：node backtest_depeg.mjs [--write-report]
import fs from 'fs';
import path from 'path';
import { classifyDepeg, isCleared, devBpsFromPrice } from './depeg_logic.mjs';

const FROM = '2026-04-03';
const TO = '2026-10-03';
const WARN_BPS = 50;
const SEVERE_BPS = 150;
const CLEAR_BPS = 30;

const COINS = [
  ['USDT', 'tether'],
  ['USDC', 'usd-coin'],
  ['USDS', 'usds'],
  ['USDe', 'ethena-usde'],
  ['USD1', 'usd1-wlfi'],
  ['PYUSD', 'paypal-usd'],
  ['RLUSD', 'ripple-usd'],
  ['USDG', 'global-dollar'],
  ['USDD', 'usdd'],
  ['U', 'united-stables'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDaily(id) {
  // 免费版用 days 参数（from/to 是 Pro 的 /market_chart/range）；days=183 ≈ 2026-04-03 起
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=183`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status} for ${id}`);
  const data = await res.json();
  // 按天去重（market_chart 日线粒度每天一个点；取每天最后一个）
  const byDay = new Map();
  for (const [ts, price] of data.prices || []) {
    const day = new Date(ts).toISOString().slice(0, 10);
    byDay.set(day, price);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function backtestCoin(symbol, daily) {
  // 模拟线上事件机（日线分辨率）：new / escalate / resolve
  const triggers = [];
  let active = null; // { level, startDay, peakBps }
  for (const [day, price] of daily) {
    const devBps = devBpsFromPrice(price);
    if (devBps === null) continue;
    const level = classifyDepeg(devBps, WARN_BPS, SEVERE_BPS);
    if (!level) {
      if (active && isCleared(devBps, CLEAR_BPS)) {
        triggers.push({ day, symbol, price, devBps: +devBps.toFixed(1), kind: 'resolved',
          note: `持续 ${active.days} 天后解除（峰值 ${active.peakBps.toFixed(1)} bps）` });
        active = null;
      } else if (active && Math.abs(devBps) < WARN_BPS) {
        // 回到预警线下但未达解除线：保持 active（与线上一致：不清零）
      }
      continue;
    }
    if (!active) {
      active = { level, startDay: day, days: 1, peakBps: Math.abs(devBps) };
      triggers.push({ day, symbol, price, devBps: +devBps.toFixed(1), kind: `new-${level}`,
        note: level === 'severe' ? '首次触发即严重' : '首次触发预警' });
    } else {
      active.days += 1;
      active.peakBps = Math.max(active.peakBps, Math.abs(devBps));
      if (active.level === 'warn' && level === 'severe') {
        active.level = 'severe';
        triggers.push({ day, symbol, price, devBps: +devBps.toFixed(1), kind: 'escalated',
          note: `预警升级为严重（已持续 ${active.days} 天）` });
      }
    }
  }
  if (active) {
    triggers.push({ day: TO, symbol, price: daily[daily.length - 1][1],
      devBps: +devBpsFromPrice(daily[daily.length - 1][1]).toFixed(1),
      kind: 'open-at-end', note: `截至回测期末仍未解除（峰值 ${active.peakBps.toFixed(1)} bps）` });
  }
  return triggers;
}

function fmt(n, d = 4) { return Number(n).toFixed(d); }

async function main() {
  const allTriggers = [];
  const coverage = [];
  for (const [symbol, id] of COINS) {
    try {
      const daily = await fetchDaily(id);
      coverage.push([symbol, daily.length, daily[0][0], daily[daily.length - 1][0]]);
      const tr = backtestCoin(symbol, daily);
      allTriggers.push(...tr);
      console.log(`${symbol}: ${daily.length} 天数据，触发 ${tr.length} 次`);
    } catch (e) {
      console.log(`${symbol}: 拉取失败 ${e.message}`);
      coverage.push([symbol, 0, '-', '-']);
    }
    await sleep(8000); // 免费限频
  }
  allTriggers.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.symbol < b.symbol ? -1 : 1));

  const counts = { 'new-warn': 0, 'new-severe': 0, escalated: 0, resolved: 0, 'open-at-end': 0 };
  for (const t of allTriggers) counts[t.kind] = (counts[t.kind] || 0) + 1;

  const lines = [];
  lines.push('# 稳定币脱锚阈值回测报告');
  lines.push('');
  lines.push(`- 回测区间：${FROM} ~ ${TO}（183 天）`);
  lines.push(`- 阈值：预警 ±${WARN_BPS} bps（0.5%）/ 严重 ±${SEVERE_BPS} bps（1.5%）/ 解除 ±${CLEAR_BPS} bps（0.3%）`);
  lines.push(`- 判定函数：\`depeg_logic.mjs\` 的 \`classifyDepeg\` / \`isCleared\`（与线上监控同一套逻辑）`);
  lines.push(`- 数据源：CoinGecko market_chart 日线（免费）；**币级回测**——分链历史价格免费渠道拿不到，见文末局限`);
  lines.push('');
  lines.push('## 数据覆盖');
  lines.push('');
  lines.push('| 币种 | 天数 | 起 | 止 |');
  lines.push('|---|---|---|---|');
  for (const [s, n, a, b] of coverage) lines.push(`| ${s} | ${n} | ${a} | ${b} |`);
  lines.push('');
  lines.push('## 触发统计');
  lines.push('');
  lines.push(`- 首次预警（new-warn）：${counts['new-warn']}`);
  lines.push(`- 首次即严重（new-severe）：${counts['new-severe']}`);
  lines.push(`- 预警升级为严重（escalated）：${counts['escalated']}`);
  lines.push(`- 解除（resolved）：${counts['resolved']}`);
  lines.push(`- 期末仍未解除（open-at-end）：${counts['open-at-end']}`);
  lines.push(`- **去重后独立事件数：${counts['new-warn'] + counts['new-severe']}**`);
  lines.push('');
  lines.push('## 完整触发清单');
  lines.push('');
  lines.push('| 日期 | 币种 | 价格 | 偏离(bps) | 类型 | 说明 |');
  lines.push('|---|---|---|---|---|---|');
  for (const t of allTriggers) {
    lines.push(`| ${t.day} | ${t.symbol} | $${fmt(t.price)} | ${t.devBps} | ${t.kind} | ${t.note} |`);
  }
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  lines.push('（由回测执行人填写：阈值太松/太严、噪音评估）');
  lines.push('');

  const report = lines.join('\n');
  const outPath = path.join(process.cwd(), 'backtest_report.md');
  if (process.argv.includes('--write-report')) {
    fs.writeFileSync(outPath, report);
    console.log(`\n报告已写入 ${outPath}`);
  } else {
    console.log('\n' + report);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
