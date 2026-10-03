# Stablecoin Risk Desk / 稳定币脱锚监控台

监控稳定币**脱锚风险**与**跨链搬砖路径**的本地看板。实时抓取稳定币价格、发行量、链上分布与跨链报价，把「偏离锚定多少、有多少量、搬过去划不划算」一次性摊开。

> A lightweight local dashboard for monitoring stablecoin depeg risk and evaluating cross-chain routes.

⚠️ **免责声明**：本项目是数据聚合与展示工具，**不构成任何投资建议**。看板中的 A0/A1 只是**人工复核优先级**，不是自动套利信号；跨链路径的报价、费率与到账时间均由第三方接口给出，可能延迟或失真，务必自行复核后再做任何决策。加密资产风险极高，请自行承担全部后果。

---

## 功能

- **脱锚看板**：按锚定偏离绝对值排序的稳定币观察列表，偏离越大越靠前。
- **发行量与链分布**：单币各链供应占比、24h 供应变化，用于判断是「个别链挤兑」还是「全局失血」。
- **跨链路径模拟**：USDC / USDT / DAI / FRAX / USDe 在主流 EVM 链之间的搬运路径，含桥/工具、预估到账、手续费、gas、耗时。
- **A0 外部提醒（可选）**：命中高优先级复核项时，可通过 Twilio 发短信/拨电话，或推送到自建 Webhook。默认关闭。

## 快速开始

```bash
npm install
npm run dev
```

打开 <http://localhost:5173>。后端 API 监听 <http://localhost:8787>。

生产构建：

```bash
npm run build     # 产出 dist/
npm run api       # 仅起后端
npm run preview   # 预览构建产物
```

Windows 下也可直接双击 `start-dashboard.bat`（或 `start-dashboard.ps1`）一键启动。

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写，**`.env` 已被 git 忽略，切勿提交真实密钥**。

| 变量 | 说明 |
| --- | --- |
| `A0_NOTIFY_ENABLED` | `1` 才真正发送提醒，默认 `0` |
| `A0_NOTIFY_CHANNELS` | `sms,call,webhook`，逗号分隔 |
| `A0_NOTIFICATION_COOLDOWN_MS` | 同一组 A0 的重复提醒冷却，默认 30 分钟 |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` / `ALERT_TO` | Twilio 短信/电话配置 |
| `A0_WEBHOOK_URL` / `A0_WEBHOOK_TOKEN` | 自建服务、飞书/企业微信/Telegram 中转等 |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | 可选，留空则走公开接口 |

未配置时看板只显示状态，不会发送任何短信或拨打电话。

## 数据源

| 来源 | 用途 |
| --- | --- |
| [DeFiLlama Stablecoins](https://stablecoins.llama.fi/) | 美元锚定资产的供应量、价格、链分布、供应变化 |
| [LI.FI Quote API](https://li.quest/) | 跨链路径、桥/工具、预估到账、费用、gas、耗时 |
| Binance / CoinGecko | 交易所侧价格与深度参考 |

## 技术栈

React 19 + TypeScript + Vite（前端）· Express 5（后端）· Lucide React（图标）

## Roadmap

- [ ] Curve / GeckoTerminal / DexScreener 的 DEX 池深度
- [ ] Binance / OKX / Bybit 的 CEX 盘口深度
- [ ] 扣除买入滑点、跨链路径、卖出深度、gas 与延迟后的**净套利**计算
- [ ] 脱锚与正净收益路径的 Telegram / Webhook 推送

## 目录结构

```text
server.js          # Express 后端：数据抓取、缓存、提醒、API
src/               # React 前端源码
public/            # 静态资源
dist/              # 构建产物（未入库）
.env.example       # 环境变量模板
```
