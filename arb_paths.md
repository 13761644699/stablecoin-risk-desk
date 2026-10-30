# 稳定币脱锚历史机会 · 套利路径清单

> 回测区间 2026-04-03 ~ 2026-10-03（小时线），32 个双源确认严重事件。路径以币安资金为起点、耗时最短；价格为事件峰值价。
> ❓币安无参考 = 该币无币安现货对，套利窗口无法确认，路径仅供参考。USDe Solana 腿已按 2026-10-03 实测修正（币安不收/不提 SOL 网络 USDe，双向均需经 LI.FI 或 Ethena 官方桥至 ETH）。

## [S] 级（5 个）

### 2026-04-06 17:00 · PYUSD@Ethereum（折价158.4bps，持续1h）❓币安无参考
- 峰值价：$0.9842｜广度：multi-chain
- 路径：在 Ethereum 按 $0.9842 买入 PYUSD → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-23 08:00 · PYUSD@Ethereum（折价242.5bps，持续3h）❓币安无参考
- 峰值价：$0.9758｜广度：multi-chain
- 路径：在 Ethereum 按 $0.9758 买入 PYUSD → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-24 05:00 · PYUSD@Solana（溢价272.4bps，持续1h）❓币安无参考
- 峰值价：$1.0272｜广度：multi-chain
- 路径：在币安买入 PYUSD → 经 SOL（Solana，约 1 分钟）提到 Solana → 在链上按 $1.0272 卖出

### 2026-07-22 04:00 · PYUSD@Solana（折价334.2bps，持续1h）❓币安无参考
- 峰值价：$0.9666｜广度：single
- 路径：在 Solana 按 $0.9666 买入 PYUSD → 经币安 SOL（Solana，约 1 分钟）充入 → 在币安按市价卖出

### 2026-09-27 08:00 · USDe@Solana（溢价310.4bps，持续2h）🎯
- 峰值价：$1.0310｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0310 卖出

## [A] 级（10 个）

### 2026-05-23 20:00 · USDe@Solana（溢价231.5bps，持续5h）🎯
- 峰值价：$1.0232｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0232 卖出

### 2026-06-05 13:00 · PYUSD@Ethereum（折价250.2bps，持续4h）❓币安无参考
- 峰值价：$0.9750｜广度：single
- 路径：在 Ethereum 按 $0.9750 买入 PYUSD → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-05 18:00 · USDe@Solana（折价288.1bps，持续14h）🎯
- 峰值价：$0.9712｜广度：single
- 路径：在 Solana 按 $0.9712 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-06 10:00 · PYUSD@Ethereum（折价205.4bps，持续4h）❓币安无参考
- 峰值价：$0.9795｜广度：single
- 路径：在 Ethereum 按 $0.9795 买入 PYUSD → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-08 04:00 · USD1@Ethereum（折价222.1bps，持续253h）🎯
- 峰值价：$0.9778｜广度：single
- 路径：在 Ethereum 按 $0.9778 买入 USD1 → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-07-08 01:00 · USDe@Solana（折价288.3bps，持续81h）🎯
- 峰值价：$0.9712｜广度：single
- 路径：在 Solana 按 $0.9712 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-08-22 02:00 · USDe@Solana（溢价223.4bps，持续9h）🎯
- 峰值价：$1.0223｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0223 卖出

### 2026-09-04 12:00 · RLUSD@Ethereum（折价271.8bps，持续1h）🎯
- 峰值价：$0.9728｜广度：single
- 路径：在 Ethereum 按 $0.9728 买入 RLUSD → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-09-13 22:00 · USDe@Solana（折价213.4bps，持续1h）🎯
- 峰值价：$0.9787｜广度：single
- 路径：在 Solana 按 $0.9787 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-09-17 05:00 · USDe@Solana（溢价243.6bps，持续9h）🎯
- 峰值价：$1.0244｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0244 卖出

## [B] 级（13 个）

### 2026-04-27 18:00 · USD1@Ethereum（折价247.1bps，持续5h）🎯
- 峰值价：$0.9753｜广度：single
- 路径：在 Ethereum 按 $0.9753 买入 USD1 → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-05-10 21:00 · USDe@Solana（折价170.9bps，持续19h）🎯
- 峰值价：$0.9829｜广度：single
- 路径：在 Solana 按 $0.9829 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-06 14:00 · USD1@Ethereum（折价206.9bps，持续21h）🎯
- 峰值价：$0.9793｜广度：single
- 路径：在 Ethereum 按 $0.9793 买入 USD1 → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-07 19:00 · USDe@Solana（折价189.6bps，持续14h）🎯
- 峰值价：$0.9810｜广度：single
- 路径：在 Solana 按 $0.9810 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-07 20:00 · USD1@Ethereum（折价195.9bps，持续7h）🎯
- 峰值价：$0.9804｜广度：single
- 路径：在 Ethereum 按 $0.9804 买入 USD1 → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-06-09 14:00 · USDe@Solana（折价160.3bps，持续9h）🎯
- 峰值价：$0.9840｜广度：single
- 路径：在 Solana 按 $0.9840 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-08-08 01:00 · PYUSD@Solana（折价235.2bps，持续2h）❓币安无参考
- 峰值价：$0.9765｜广度：single
- 路径：在 Solana 按 $0.9765 买入 PYUSD → 经币安 SOL（Solana，约 1 分钟）充入 → 在币安按市价卖出

### 2026-08-16 21:00 · USDe@Solana（折价150.3bps，持续5h）🎯
- 峰值价：$0.9850｜广度：single
- 路径：在 Solana 按 $0.9850 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-08-25 07:00 · USDe@Solana（折价181.2bps，持续20h）🎯
- 峰值价：$0.9819｜广度：single
- 路径：在 Solana 按 $0.9819 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-09-09 09:00 · USDe@Solana（折价163.6bps，持续19h）🎯
- 峰值价：$0.9836｜广度：single
- 路径：在 Solana 按 $0.9836 买入 USDe → 需先经 LI.FI 或 Ethena 官方桥将 USDe 从 Solana 桥至 Ethereum（约 5-10 分钟 + 桥费） → 经币安 ERC20（Ethereum，约 15 分钟）充入 → 在币安按市价卖出

### 2026-09-14 07:00 · USDC@Solana（折价247.1bps，持续1h）🎯
- 峰值价：$0.9753｜广度：single
- 路径：在 Solana 按 $0.9753 买入 USDC → 经币安 SOL（Solana，约 1 分钟）充入 → 在币安按市价卖出

### 2026-09-24 13:00 · USDe@Solana（溢价162.2bps，持续5h）🎯
- 峰值价：$1.0162｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0162 卖出

### 2026-09-25 16:00 · USDe@Solana（溢价162.6bps，持续13h）🎯
- 峰值价：$1.0163｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0163 卖出

## [C] 级（4 个）

### 2026-07-14 12:00 · USDe@Solana（溢价195.9bps，持续2h）🎯
- 峰值价：$1.0196｜广度：single
- 路径：在币安买入 USDe → 经 ERC20（Ethereum，约 15 分钟）提到 Ethereum → 再经 LI.FI 或 Ethena 官方桥至 Solana（约 5-10 分钟 + 桥费） → 在链上按 $1.0196 卖出

### 2026-07-30 11:00 · PYUSD@Solana（溢价155.9bps，持续1h）❓币安无参考
- 峰值价：$1.0156｜广度：single
- 路径：在币安买入 PYUSD → 经 SOL（Solana，约 1 分钟）提到 Solana → 在链上按 $1.0156 卖出

### 2026-08-19 20:00 · USDC@Arbitrum（溢价155.0bps，持续1h）🎯
- 峰值价：$1.0155｜广度：single
- 路径：在币安买入 USDC → 经 ARBITRUM（Arbitrum，约 10 分钟）提到 Arbitrum → 在链上按 $1.0155 卖出

### 2026-09-11 13:00 · USDC@Base（溢价152.3bps，持续1h）🎯
- 峰值价：$1.0152｜广度：single
- 路径：在币安买入 USDC → 经 BASE（Base，约 10 分钟）提到 Base → 在链上按 $1.0152 卖出

---
生成时间 2026-10-03；路径函数 `depeg_logic.mjs::fastestArbPath`（已含 USDe 双向桥接修正）。实盘前请复核币安当时是否支持对应网络充提。