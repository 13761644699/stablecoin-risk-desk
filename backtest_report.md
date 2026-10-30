# 稳定币脱锚阈值回测报告

- 回测区间：2026-04-03 ~ 2026-10-03（183 天）
- 阈值：预警 ±50 bps（0.5%）/ 严重 ±150 bps（1.5%）/ 解除 ±30 bps（0.3%）
- 判定函数：`depeg_logic.mjs` 的 `classifyDepeg` / `isCleared`（与线上监控同一套逻辑）
- 数据源：CoinGecko market_chart 日线（免费）；**币级回测**——分链历史价格免费渠道拿不到，见文末局限

## 数据覆盖

| 币种 | 天数 | 起 | 止 |
|---|---|---|---|
| USDT | 183 | 2026-04-04 | 2026-10-03 |
| USDC | 183 | 2026-04-04 | 2026-10-03 |
| USDS | 183 | 2026-04-04 | 2026-10-03 |
| USDe | 183 | 2026-04-04 | 2026-10-03 |
| USD1 | 183 | 2026-04-04 | 2026-10-03 |
| PYUSD | 183 | 2026-04-04 | 2026-10-03 |
| RLUSD | 183 | 2026-04-04 | 2026-10-03 |
| USDG | 183 | 2026-04-04 | 2026-10-03 |
| USDD | 183 | 2026-04-04 | 2026-10-03 |
| U | 183 | 2026-04-04 | 2026-10-03 |

## 触发统计

- 首次预警（new-warn）：1
- 首次即严重（new-severe）：1
- 预警升级为严重（escalated）：0
- 解除（resolved）：2
- 期末仍未解除（open-at-end）：0
- **去重后独立事件数：2**

## 完整触发清单

| 日期 | 币种 | 价格 | 偏离(bps) | 类型 | 说明 |
|---|---|---|---|---|---|
| 2026-04-04 | USDG | $1.0351 | 351.1 | new-severe | 首次触发即严重 |
| 2026-04-11 | USDG | $1.0000 | -0.5 | resolved | 持续 7 天后解除（峰值 351.1 bps） |
| 2026-06-27 | USDD | $0.9883 | -116.9 | new-warn | 首次触发预警 |
| 2026-06-28 | USDD | $0.9976 | -23.7 | resolved | 持续 1 天后解除（峰值 116.9 bps） |

## 结论

**触发频率**：183 天 × 10 币 = 1830 个币-天，仅 2 个独立事件（USDG 严重 1 次、USDD 预警 1 次）。对比之前除息阈值回测的前车之鉴（28 次命中里 27 次是噪音），这套 ±0.5%/±1.5% 阈值在日线粒度下非常干净——**不松**。

**两个事件的定性**：
- **USDG（2026-04-04，+351 bps 持续 7 天）很可能是数据坏点，而非真实脱锚**。同期 USDG/INR 仅 +0.24%，且第三方分析称 USDG 历史 24h 偏离仅 0.002–0.006%、"无脱锚事件"。CoinGecko 聚合价偶发坏点会被当成严重事件——线上已用"价格带 [0.5,1.5] + 最小流动性 $20k"过滤部分坏点，但聚合源坏点仍可能漏网。**慢线新闻定性时必须多源复核价格，不能只看单一报价**。
- **USDD（2026-06-27，-116.9 bps，次日解除）**：幅度刚过预警线、一天即修复，是阈值设计想要抓的典型小脱锚（若为真，属于可套利型）。符合预期。

**阈值是太松还是太严**：以"半年 2 次"计，不松；以"USDD 这种 -1.17% 一天即修复"的事件能被抓住计，不严。当前档位合理，**建议保持**。

**噪音评估与真正的风险**（必读）：
1. **回测是日线收盘价，线上是 5 分钟 DEX 价**——两者噪音不在一个量级。回测证明的是"阈值本身不制造噪音"，**不证明**线上 5 分钟轮询不会吵。DEX 盘中 0.5% 的抖动比日线收盘常见得多，实际报警频率会高于回测。
2. 建议线上跑 2 周后用实际报警数复核一次：若每天多次误报，再考虑把预警线提到 0.7% 或加"连续 N 轮确认"机制；现在不动。
3. 分链价差回测做不了（免费无分链历史）——而分链恰恰是线上监控的核心增量，这部分效果只能靠线上实盘验证。

## 方法局限
- 日线粒度看不到盘中脱锚；真正的套利机会多在小时/分钟级，**回测系统性低估实际触发次数**。
- 币级聚合价回测，分链独立判定逻辑未被回测覆盖。
- CoinGecko 聚合价 ≠ DEX 可执行价；回测事件不代表当时真有可执行的套利。

## 小时线回测 v2（2026-10-03 追加）

- 区间：2026-04-03 ~ 2026-10-03；粒度：小时线；判定：classifyDepeg/isCleared/**confirmDepeg**（与线上同一套）
- 数据源 A（主）：GeckoTerminal 各链最深池 OHLCV 小时线；数据源 B（交叉）：**同链第二池**；Binance 现货小时线仅作参考列
- 交叉规则：双源同向越线=confirmed/副源过半=likely 计有效；副源正常或反向=suspicious 拦截；无副源=unconfirmed 保守放行

### 数据覆盖（23/26 腿；Tron 3 腿 GeckoTerminal 无此网络，未覆盖）

| 链腿 | 池与数据量 |
|---|---|
| USDT@Ethereum | 主池 gt USDT / USDS $50208772 / 无第二池，4378 小时 |
| USDT@Tron | GeckoTerminal 无此网络（Tron），未覆盖 |
| USDT@Solana | 主池 gt USDT / USDC $1055642 / 副池 raydium $62352，4223 小时 |
| USDT@BSC | 主池 gt USDT / WBNB $85517160 / 副池 gt $13472492，4393 小时 |
| USDT@Arbitrum | 主池 uniswap USD₮0/USDC $34392 / 副池 uniswap $34188，3822 小时 |
| USDC@Ethereum | 主池 gt USDC / USDT $45038588 / 副池 uniswap $3545577，4391 小时 |
| USDC@Solana | 主池 raydium USDC/USDT $1469348 / 副池 orca $712393，4393 小时 |
| USDC@Base | 主池 alien-base USDC/USDbC $127549 / 副池 quickswap $91142，3351 小时 |
| USDC@Arbitrum | 主池 gt USDC / WETH 0.05% $36714846 / 副池 gt $7851333，4393 小时 |
| USDC@BSC | 主池 gt USDC / WBNB 0.01% $2132441 / 无第二池，4393 小时 |
| USDS@Ethereum | 主池 uniswap USDS/USDT $50004056 / 副池 uniswap $10263169，4378 小时 |
| USDS@Solana | 主池 gt USDS / USDC $1073578 / 副池 gt $29593，3346 小时 |
| USDe@Ethereum | 主池 gt USDe / USDC 0.01% $2436903 / 副池 gt $714700，4135 小时 |
| USDe@Solana | 主池 gt USDe / PYUSD $2159171 / 副池 gt $1524208，3103 小时 |
| USD1@BSC | 主池 gt USD1 / WBNB 0.05% $2406484 / 副池 pancakeswap $188902，4393 小时 |
| USD1@Ethereum | 主池 gt USD1 / crv2pool $10089870 / 副池 gt $286994，856 小时 |
| USD1@Tron | GeckoTerminal 无此网络（Tron），未覆盖 |
| PYUSD@Ethereum | 主池 gt PYUSD / USDS $100245811 / 副池 gt $27076964，4167 小时 |
| PYUSD@Solana | 主池 gt PYUSD / USDC $16859270 / 副池 gt $9610467，4095 小时 |
| RLUSD@Ethereum | 主池 gt RLUSD / USDS $20064765 / 副池 gt $2471655，774 小时 |
| USDG@Ethereum | 主池 gt USDG / USDC $20109515 / 副池 gt $4039188，3115 小时 |
| USDG@Solana | 主池 gt USDG / USDC $17046188 / 副池 gt $4595548，4307 小时 |
| USDD@Ethereum | 主池 gt USDD / USDT 0.01% $49793 / 无第二池，745 小时 |
| USDD@BSC | 主池 gt USDD / USDT 0.01% $100227 / 副池 gt $17689，743 小时 |
| USDD@Tron | GeckoTerminal 无此网络（Tron），未覆盖 |
| U@BSC | 主池 gt U / USDT 0.01% $19006316 / 副池 gt $2036139，4365 小时 |

### 触发统计

- 首次预警：1502；首次即严重：94；升级：105；解除：1595；期末未解除：1
- **去重后有效事件数：1596**；双源拦截的疑似坏点：1120

### 有效触发清单

| 时间(UTC) | 链腿 | 价格 | 偏离(bps) | 副池偏离 | 交叉 | 类型 | 说明 | 币安参考 |
|---|---|---|---|---|---|---|---|---|
| 2026-04-03 00:00Z | USDG@Ethereum | $0.9912 | -87.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-03 00:00Z | USDe@Solana | $1.0239 | 238.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9997 |
| 2026-04-03 06:00Z | PYUSD@Solana | $1.0069 | 68.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-03 07:00Z | PYUSD@Solana | $1.0005 | 5 | - | - | resolved | 持续 1.0h 后解除（峰值 68.8 bps） | - |
| 2026-04-03 10:00Z | PYUSD@Solana | $1.0443 | 442.6 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-03 11:00Z | PYUSD@Solana | $1.0001 | 1.2 | - | - | resolved | 持续 1.0h 后解除（峰值 442.6 bps） | - |
| 2026-04-03 12:00Z | PYUSD@Solana | $1.0086 | 86.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-03 14:00Z | PYUSD@Solana | $0.9981 | -19.5 | - | - | resolved | 持续 2.0h 后解除（峰值 86.5 bps） | - |
| 2026-04-04 02:00Z | USDS@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-04 02:00Z | USDT@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-04 03:00Z | USDS@Ethereum | $1.0016 | 15.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.6 bps） | - |
| 2026-04-04 03:00Z | USDT@Ethereum | $1.0016 | 15.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.6 bps） | - |
| 2026-04-04 07:00Z | PYUSD@Solana | $1.0060 | 59.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-04 08:00Z | USDe@Solana | $0.9985 | -14.7 | - | - | resolved | 持续 32.0h 后解除（峰值 433.1 bps） | 0.9997 |
| 2026-04-04 09:00Z | PYUSD@Solana | $0.9983 | -17.3 | - | - | resolved | 持续 2.0h 后解除（峰值 59.8 bps） | - |
| 2026-04-04 09:00Z | USDS@Ethereum | $0.9948 | -52.1 | -34.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-04 09:00Z | USDT@Ethereum | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-04 10:00Z | USDS@Ethereum | $0.9971 | -29.3 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | - |
| 2026-04-04 10:00Z | USDT@Ethereum | $0.9971 | -29.3 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | - |
| 2026-04-04 13:00Z | USDe@Solana | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-04-04 16:00Z | USDe@Solana | $1.0001 | 0.7 | - | - | resolved | 持续 3.0h 后解除（峰值 102.4 bps） | 0.9998 |
| 2026-04-04 19:00Z | USDS@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-04 19:00Z | USDT@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-05 01:00Z | USDS@Ethereum | $1.0006 | 5.8 | - | - | resolved | 持续 6.0h 后解除（峰值 51.6 bps） | - |
| 2026-04-05 01:00Z | USDT@Ethereum | $1.0006 | 5.8 | - | - | resolved | 持续 6.0h 后解除（峰值 51.6 bps） | - |
| 2026-04-05 05:00Z | USDS@Ethereum | $0.9947 | -52.5 | -48.3 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-05 05:00Z | USDT@Ethereum | $0.9947 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-05 08:00Z | USDS@Ethereum | $0.9981 | -19 | - | - | resolved | 持续 3.0h 后解除（峰值 55.2 bps） | - |
| 2026-04-05 08:00Z | USDT@Ethereum | $0.9981 | -19 | - | - | resolved | 持续 3.0h 后解除（峰值 55.2 bps） | - |
| 2026-04-05 08:00Z | USDe@Solana | $0.9923 | -76.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-04-05 10:00Z | PYUSD@Solana | $0.9857 | -143.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-05 11:00Z | PYUSD@Solana | $1.0014 | 14.1 | - | - | resolved | 持续 1.0h 后解除（峰值 143.1 bps） | - |
| 2026-04-05 15:00Z | USDe@Solana | $0.9993 | -6.9 | - | - | resolved | 持续 7.0h 后解除（峰值 84.5 bps） | 0.9997 |
| 2026-04-05 17:00Z | USDe@Solana | $1.0063 | 62.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-04-05 19:00Z | USDe@Solana | $0.9973 | -26.6 | - | - | resolved | 持续 2.0h 后解除（峰值 62.5 bps） | 0.9998 |
| 2026-04-05 20:00Z | USDe@Solana | $0.9938 | -62.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-04-05 22:00Z | PYUSD@Ethereum | $1.0092 | 92.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-05 22:00Z | USDe@Solana | $0.9989 | -11.3 | - | - | resolved | 持续 2.0h 后解除（峰值 62.4 bps） | 0.9998 |
| 2026-04-05 23:00Z | PYUSD@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 92.1 bps） | - |
| 2026-04-05 23:00Z | USDe@Solana | $0.9918 | -82.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-04-06 00:00Z | USDe@Solana | $1.0001 | 1.4 | - | - | resolved | 持续 1.0h 后解除（峰值 82.5 bps） | 0.9999 |
| 2026-04-06 04:00Z | USDe@Solana | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-04-06 09:00Z | USDG@Ethereum | $1.0027 | 26.8 | - | - | resolved | 持续 81.0h 后解除（峰值 106.0 bps） | - |
| 2026-04-06 10:00Z | USDG@Ethereum | $0.9911 | -89.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-06 10:00Z | USDe@Solana | $1.0027 | 26.7 | - | - | resolved | 持续 6.0h 后解除（峰值 50.8 bps） | 1.0001 |
| 2026-04-06 12:00Z | U@BSC | $0.9872 | -127.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-06 13:00Z | PYUSD@Solana | $0.9739 | -260.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-06 13:00Z | U@BSC | $1.0020 | 19.9 | - | - | resolved | 持续 1.0h 后解除（峰值 127.7 bps） | - |
| 2026-04-06 14:00Z | PYUSD@Solana | $0.9982 | -17.5 | - | - | resolved | 持续 1.0h 后解除（峰值 260.8 bps） | - |
| 2026-04-06 17:00Z | PYUSD@Ethereum | $0.9842 | -158.4 | -57.9 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-04-06 18:00Z | PYUSD@Ethereum | $0.9997 | -2.9 | - | - | resolved | 持续 1.0h 后解除（峰值 158.4 bps） | - |
| 2026-04-07 00:00Z | PYUSD@Solana | $0.9754 | -245.6 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-07 01:00Z | USDS@Ethereum | $0.9946 | -53.9 | -30.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-07 01:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 02:00Z | PYUSD@Solana | $1.0005 | 4.8 | - | - | resolved | 持续 2.0h 后解除（峰值 245.6 bps） | - |
| 2026-04-07 02:00Z | USDG@Ethereum | $0.9990 | -9.6 | - | - | resolved | 持续 16.0h 后解除（峰值 109.6 bps） | - |
| 2026-04-07 02:00Z | USDe@Solana | $0.9765 | -235.2 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0003 |
| 2026-04-07 03:00Z | USDS@Ethereum | $0.9987 | -13.3 | - | - | resolved | 持续 2.0h 后解除（峰值 53.9 bps） | - |
| 2026-04-07 03:00Z | USDT@Ethereum | $0.9987 | -13.3 | - | - | resolved | 持续 2.0h 后解除（峰值 53.9 bps） | - |
| 2026-04-07 06:00Z | USDG@Ethereum | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 08:00Z | PYUSD@Solana | $1.0258 | 257.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-07 09:00Z | PYUSD@Solana | $1.0009 | 8.7 | - | - | resolved | 持续 1.0h 后解除（峰值 257.7 bps） | - |
| 2026-04-07 10:00Z | USDG@Ethereum | $0.9974 | -25.8 | - | - | resolved | 持续 4.0h 后解除（峰值 56.2 bps） | - |
| 2026-04-07 11:00Z | USDG@Ethereum | $0.9915 | -84.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 12:00Z | PYUSD@Ethereum | $0.9906 | -94.4 | -33.4 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-07 12:00Z | USDe@Solana | $1.0000 | 0.1 | - | - | resolved | 持续 10.0h 后解除（峰值 287.3 bps） | 0.9998 |
| 2026-04-07 13:00Z | PYUSD@Ethereum | $0.9985 | -15.1 | - | - | resolved | 持续 1.0h 后解除（峰值 94.4 bps） | - |
| 2026-04-07 14:00Z | USDG@Ethereum | $1.0002 | 2.1 | - | - | resolved | 持续 3.0h 后解除（峰值 87.0 bps） | - |
| 2026-04-07 15:00Z | USDG@Ethereum | $0.9894 | -106.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 17:00Z | PYUSD@Ethereum | $1.0113 | 112.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 17:00Z | USDT@Arbitrum | $0.9937 | -63.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 17:00Z | USDe@Solana | $1.0126 | 125.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-04-07 18:00Z | USDT@Arbitrum | $1.0012 | 12 | - | - | resolved | 持续 1.0h 后解除（峰值 63.5 bps） | - |
| 2026-04-07 19:00Z | USDG@Ethereum | $0.9991 | -8.6 | - | - | resolved | 持续 4.0h 后解除（峰值 106.3 bps） | - |
| 2026-04-07 19:00Z | USDe@Solana | $1.0315 | 314.6 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-04-07 20:00Z | USDG@Ethereum | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-07 21:00Z | PYUSD@Ethereum | $1.0195 | 195.4 | -72.3 | suspicious | escalated | 预警升级为严重 | - |
| 2026-04-07 22:00Z | USDG@Ethereum | $0.9999 | -1.5 | - | - | resolved | 持续 2.0h 后解除（峰值 68.1 bps） | - |
| 2026-04-07 23:00Z | USDe@Solana | $1.0021 | 20.9 | - | - | resolved | 持续 6.0h 后解除（峰值 366.7 bps） | 0.9999 |
| 2026-04-08 01:00Z | PYUSD@Ethereum | $0.9996 | -3.7 | - | - | resolved | 持续 8.0h 后解除（峰值 195.4 bps） | - |
| 2026-04-08 01:00Z | USDG@Ethereum | $0.9933 | -67.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-08 04:00Z | PYUSD@Ethereum | $1.0059 | 59.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-08 05:00Z | USDe@Solana | $0.9846 | -153.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9999 |
| 2026-04-08 06:00Z | PYUSD@Ethereum | $1.0012 | 12.5 | - | - | resolved | 持续 2.0h 后解除（峰值 59.4 bps） | - |
| 2026-04-08 07:00Z | USDe@Solana | $0.9992 | -7.8 | - | - | resolved | 持续 2.0h 后解除（峰值 153.9 bps） | 0.9999 |
| 2026-04-08 11:00Z | USDe@Solana | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-04-08 12:00Z | USDe@Solana | $1.0025 | 24.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | 1 |
| 2026-04-08 14:00Z | USDe@Solana | $0.9770 | -230 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9999 |
| 2026-04-08 17:00Z | PYUSD@Ethereum | $1.0065 | 65.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-08 19:00Z | PYUSD@Ethereum | $1.0002 | 2.2 | - | - | resolved | 持续 2.0h 后解除（峰值 76.4 bps） | - |
| 2026-04-09 01:00Z | PYUSD@Solana | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-09 02:00Z | PYUSD@Solana | $0.9996 | -4.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | - |
| 2026-04-09 04:00Z | USDe@Solana | $1.0004 | 3.8 | - | - | resolved | 持续 14.0h 后解除（峰值 310.2 bps） | 0.9998 |
| 2026-04-09 07:00Z | PYUSD@Solana | $1.0079 | 78.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-09 08:00Z | PYUSD@Solana | $1.0013 | 13.2 | - | - | resolved | 持续 1.0h 后解除（峰值 78.8 bps） | - |
| 2026-04-09 11:00Z | PYUSD@Solana | $0.9740 | -259.6 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-09 11:00Z | USDD@Ethereum | $0.9949 | -51 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-09 12:00Z | PYUSD@Solana | $0.9990 | -10.3 | - | - | resolved | 持续 1.0h 后解除（峰值 259.6 bps） | - |
| 2026-04-09 14:00Z | USDe@Solana | $0.9879 | -120.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-04-09 17:00Z | PYUSD@Ethereum | $1.0081 | 81.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-09 18:00Z | PYUSD@Ethereum | $0.9998 | -1.8 | - | - | resolved | 持续 1.0h 后解除（峰值 81.3 bps） | - |
| 2026-04-09 23:00Z | PYUSD@Solana | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 00:00Z | PYUSD@Solana | $1.0003 | 2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-04-10 00:00Z | USDD@Ethereum | $1.0003 | 3.4 | - | - | resolved | 持续 13.0h 后解除（峰值 51.0 bps） | - |
| 2026-04-10 02:00Z | USDG@Ethereum | $0.9973 | -26.7 | - | - | resolved | 持续 49.0h 后解除（峰值 128.0 bps） | - |
| 2026-04-10 03:00Z | USDG@Ethereum | $0.9943 | -57.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 04:00Z | USDG@Ethereum | $0.9983 | -16.5 | - | - | resolved | 持续 1.0h 后解除（峰值 57.5 bps） | - |
| 2026-04-10 04:00Z | USDe@Solana | $0.9982 | -18.1 | - | - | resolved | 持续 14.0h 后解除（峰值 145.0 bps） | 0.9996 |
| 2026-04-10 06:00Z | USDG@Ethereum | $0.9940 | -59.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 07:00Z | USDT@Ethereum | $0.9948 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 09:00Z | USDG@Ethereum | $0.9980 | -19.8 | - | - | resolved | 持续 3.0h 后解除（峰值 73.0 bps） | - |
| 2026-04-10 09:00Z | USDT@Ethereum | $0.9991 | -9.2 | - | - | resolved | 持续 2.0h 后解除（峰值 51.5 bps） | - |
| 2026-04-10 10:00Z | PYUSD@Solana | $1.0146 | 145.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 10:00Z | USDe@Solana | $1.0051 | 50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-04-10 11:00Z | PYUSD@Ethereum | $1.0116 | 116.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 11:00Z | PYUSD@Solana | $0.9986 | -14 | - | - | resolved | 持续 1.0h 后解除（峰值 145.9 bps） | - |
| 2026-04-10 11:00Z | USDG@Ethereum | $0.9929 | -70.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 12:00Z | PYUSD@Solana | $1.0051 | 50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 13:00Z | PYUSD@Ethereum | $1.0026 | 25.5 | - | - | resolved | 持续 2.0h 后解除（峰值 116.5 bps） | - |
| 2026-04-10 13:00Z | PYUSD@Solana | $1.0016 | 16 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | - |
| 2026-04-10 14:00Z | USDe@Solana | $1.0181 | 180.8 | - | unconfirmed | escalated | 预警升级为严重 | 0.9994 |
| 2026-04-10 15:00Z | PYUSD@Solana | $1.0092 | 92.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 16:00Z | PYUSD@Ethereum | $1.0066 | 66.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-10 16:00Z | PYUSD@Solana | $1.0005 | 5.3 | - | - | resolved | 持续 1.0h 后解除（峰值 92.2 bps） | - |
| 2026-04-10 17:00Z | PYUSD@Ethereum | $1.0016 | 15.7 | - | - | resolved | 持续 1.0h 后解除（峰值 66.5 bps） | - |
| 2026-04-10 18:00Z | USDe@Solana | $0.9971 | -29.4 | - | - | resolved | 持续 8.0h 后解除（峰值 180.8 bps） | 0.9994 |
| 2026-04-11 05:00Z | USDe@Solana | $0.9895 | -104.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-04-11 07:00Z | PYUSD@Solana | $0.9774 | -226.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-11 08:00Z | PYUSD@Solana | $0.9998 | -1.7 | - | - | resolved | 持续 1.0h 后解除（峰值 226.3 bps） | - |
| 2026-04-12 01:00Z | PYUSD@Ethereum | $0.9743 | -256.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-12 04:00Z | PYUSD@Ethereum | $0.9987 | -13.3 | - | - | resolved | 持续 3.0h 后解除（峰值 256.7 bps） | - |
| 2026-04-12 04:00Z | USDS@Ethereum | $0.9947 | -53.2 | -32.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-12 04:00Z | USDT@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-12 05:00Z | USDS@Ethereum | $0.9983 | -17.4 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | 0.9994 |
| 2026-04-12 05:00Z | USDT@Ethereum | $0.9983 | -17.4 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-04-12 17:00Z | USDD@Ethereum | $0.9890 | -110 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-12 17:00Z | USDT@Ethereum | $1.0055 | 54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-12 18:00Z | USDT@Ethereum | $0.9975 | -24.7 | - | - | resolved | 持续 1.0h 后解除（峰值 54.5 bps） | - |
| 2026-04-12 21:00Z | USDD@Ethereum | $0.9734 | -266.5 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-04-12 22:00Z | PYUSD@Ethereum | $0.9911 | -88.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-12 23:00Z | USDD@Ethereum | $0.9999 | -1 | - | - | resolved | 持续 6.0h 后解除（峰值 266.5 bps） | - |
| 2026-04-13 01:00Z | PYUSD@Ethereum | $0.9985 | -14.8 | - | - | resolved | 持续 3.0h 后解除（峰值 88.7 bps） | - |
| 2026-04-13 02:00Z | PYUSD@Solana | $0.9896 | -103.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 02:00Z | USDD@Ethereum | $0.9938 | -61.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 02:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 03:00Z | PYUSD@Solana | $0.9991 | -8.9 | - | - | resolved | 持续 1.0h 后解除（峰值 103.9 bps） | - |
| 2026-04-13 05:00Z | USDD@Ethereum | $1.0009 | 8.6 | - | - | resolved | 持续 3.0h 后解除（峰值 65.1 bps） | - |
| 2026-04-13 05:00Z | USDT@Ethereum | $0.9977 | -22.6 | - | - | resolved | 持续 3.0h 后解除（峰值 55.1 bps） | - |
| 2026-04-13 06:00Z | PYUSD@Ethereum | $1.0058 | 58.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 07:00Z | USDD@Ethereum | $0.9943 | -56.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 08:00Z | PYUSD@Ethereum | $0.9992 | -7.9 | - | - | resolved | 持续 2.0h 后解除（峰值 58.3 bps） | - |
| 2026-04-13 08:00Z | USDD@Ethereum | $1.0003 | 3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 56.6 bps） | - |
| 2026-04-13 19:00Z | U@BSC | $0.9940 | -60.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-13 20:00Z | U@BSC | $1.0008 | 8.1 | - | - | resolved | 持续 1.0h 后解除（峰值 60.1 bps） | - |
| 2026-04-13 22:00Z | USDe@Ethereum | $1.0069 | 69.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-04-13 22:00Z | USDe@Solana | $1.0198 | 198 | - | unconfirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-04-13 23:00Z | USDe@Ethereum | $1.0013 | 13.4 | - | - | resolved | 持续 1.0h 后解除（峰值 69.3 bps） | 1.0001 |
| 2026-04-14 00:00Z | PYUSD@Solana | $0.9730 | -270.5 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-14 00:00Z | USDS@Ethereum | $0.9947 | -52.6 | -33.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9992 |
| 2026-04-14 00:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 01:00Z | USDS@Ethereum | $0.9983 | -16.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | 0.9991 |
| 2026-04-14 01:00Z | USDT@Ethereum | $0.9983 | -16.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | - |
| 2026-04-14 02:00Z | PYUSD@Solana | $0.9989 | -10.9 | - | - | resolved | 持续 2.0h 后解除（峰值 270.5 bps） | - |
| 2026-04-14 04:00Z | USDD@Ethereum | $0.9878 | -121.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 04:00Z | USDS@Ethereum | $0.9876 | -123.9 | -104 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9992 |
| 2026-04-14 04:00Z | USDT@Ethereum | $0.9876 | -123.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 05:00Z | USDS@Ethereum | $1.0010 | 9.9 | - | - | resolved | 持续 1.0h 后解除（峰值 123.9 bps） | 0.9992 |
| 2026-04-14 05:00Z | USDT@Ethereum | $1.0010 | 9.9 | - | - | resolved | 持续 1.0h 后解除（峰值 123.9 bps） | - |
| 2026-04-14 10:00Z | PYUSD@Ethereum | $0.9942 | -57.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 12:00Z | PYUSD@Ethereum | $0.9998 | -2.4 | - | - | resolved | 持续 2.0h 后解除（峰值 72.0 bps） | - |
| 2026-04-14 13:00Z | USDG@Ethereum | $1.0000 | 0.4 | - | - | resolved | 持续 98.0h 后解除（峰值 138.0 bps） | - |
| 2026-04-14 13:00Z | USDe@Solana | $1.0015 | 15 | - | - | resolved | 持续 80.0h 后解除（峰值 340.8 bps） | 0.9997 |
| 2026-04-14 14:00Z | PYUSD@Ethereum | $0.9901 | -99.4 | -118.9 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-14 14:00Z | USDG@Ethereum | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 15:00Z | USDT@Ethereum | $0.9944 | -55.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 15:00Z | USDe@Solana | $0.9827 | -173.2 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9998 |
| 2026-04-14 16:00Z | USDG@Ethereum | $0.9995 | -5.3 | - | - | resolved | 持续 2.0h 后解除（峰值 64.2 bps） | - |
| 2026-04-14 16:00Z | USDT@Ethereum | $1.0007 | 6.6 | - | - | resolved | 持续 1.0h 后解除（峰值 55.8 bps） | - |
| 2026-04-14 17:00Z | PYUSD@Ethereum | $0.9996 | -4.5 | - | - | resolved | 持续 3.0h 后解除（峰值 103.8 bps） | - |
| 2026-04-14 18:00Z | PYUSD@Ethereum | $0.9892 | -107.8 | -52.5 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-14 18:00Z | USDD@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 14.0h 后解除（峰值 121.7 bps） | - |
| 2026-04-14 19:00Z | PYUSD@Ethereum | $0.9992 | -7.6 | - | - | resolved | 持续 1.0h 后解除（峰值 107.8 bps） | - |
| 2026-04-14 19:00Z | USDG@Ethereum | $0.9926 | -73.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 19:00Z | USDS@Ethereum | $1.0051 | 50.6 | 42.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-14 19:00Z | USDT@Ethereum | $1.0051 | 50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-14 21:00Z | USDS@Ethereum | $0.9993 | -6.6 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | 0.9995 |
| 2026-04-14 21:00Z | USDT@Ethereum | $0.9993 | -6.6 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | - |
| 2026-04-14 22:00Z | PYUSD@Ethereum | $0.9947 | -53.2 | -57.9 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-14 23:00Z | PYUSD@Ethereum | $0.9981 | -19.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-04-15 01:00Z | USD1@Ethereum | $0.9907 | -92.6 | -36.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.999 |
| 2026-04-15 08:00Z | USD1@Ethereum | $0.9975 | -25.5 | - | - | resolved | 持续 7.0h 后解除（峰值 108.1 bps） | 0.9991 |
| 2026-04-15 10:00Z | USD1@Ethereum | $0.9905 | -94.6 | -38.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9991 |
| 2026-04-15 10:00Z | USDS@Ethereum | $0.9948 | -52.1 | -38.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-15 10:00Z | USDT@Ethereum | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-15 11:00Z | USDG@Ethereum | $0.9974 | -25.6 | - | - | resolved | 持续 16.0h 后解除（峰值 73.6 bps） | - |
| 2026-04-15 11:00Z | USDS@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | 0.9994 |
| 2026-04-15 11:00Z | USDT@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | - |
| 2026-04-15 12:00Z | USDG@Ethereum | $0.9938 | -62.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-15 13:00Z | USDG@Ethereum | $1.0011 | 10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 62.2 bps） | - |
| 2026-04-15 17:00Z | USDG@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-15 18:00Z | USD1@Ethereum | $0.9987 | -13.3 | - | - | resolved | 持续 8.0h 后解除（峰值 94.6 bps） | 0.999 |
| 2026-04-15 18:00Z | USDe@Solana | $1.0002 | 1.8 | - | - | resolved | 持续 27.0h 后解除（峰值 441.6 bps） | 1 |
| 2026-04-15 19:00Z | USDe@Solana | $1.0081 | 81.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-04-15 22:00Z | PYUSD@Ethereum | $1.0051 | 50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-15 22:00Z | USDS@Ethereum | $0.9946 | -54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-04-15 22:00Z | USDT@Ethereum | $0.9946 | -54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-15 23:00Z | PYUSD@Ethereum | $1.0022 | 21.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-04-15 23:00Z | USDS@Ethereum | $0.9983 | -17.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | 0.9994 |
| 2026-04-15 23:00Z | USDT@Ethereum | $0.9983 | -17.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | - |
| 2026-04-16 02:00Z | USDe@Solana | $1.0012 | 12.3 | - | - | resolved | 持续 7.0h 后解除（峰值 81.4 bps） | 0.9998 |
| 2026-04-16 03:00Z | USD1@Ethereum | $0.9923 | -77 | -31.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-16 05:00Z | USDG@Ethereum | $0.9970 | -29.6 | - | - | resolved | 持续 12.0h 后解除（峰值 59.4 bps） | - |
| 2026-04-16 07:00Z | PYUSD@Ethereum | $0.9943 | -56.9 | -31.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-16 08:00Z | PYUSD@Ethereum | $1.0000 | 0.2 | - | - | resolved | 持续 1.0h 后解除（峰值 56.9 bps） | - |
| 2026-04-16 08:00Z | PYUSD@Solana | $1.0091 | 91.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-16 08:00Z | USD1@Ethereum | $1.0002 | 1.9 | - | - | resolved | 持续 5.0h 后解除（峰值 77.0 bps） | 0.9999 |
| 2026-04-16 09:00Z | PYUSD@Solana | $1.0008 | 8.4 | - | - | resolved | 持续 1.0h 后解除（峰值 91.5 bps） | - |
| 2026-04-16 10:00Z | PYUSD@Solana | $0.9914 | -85.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-16 11:00Z | PYUSD@Solana | $1.0021 | 20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 85.6 bps） | - |
| 2026-04-16 13:00Z | USDe@Solana | $1.0095 | 94.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-04-16 14:00Z | USDe@Solana | $0.9846 | -154.1 | - | unconfirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-04-16 15:00Z | USD1@Ethereum | $0.9944 | -56 | -29.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-04-16 15:00Z | USDe@Solana | $0.9983 | -16.7 | - | - | resolved | 持续 2.0h 后解除（峰值 154.1 bps） | 0.9999 |
| 2026-04-16 16:00Z | USD1@Ethereum | $0.9977 | -23.2 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | 1 |
| 2026-04-16 16:00Z | USDG@Ethereum | $0.9921 | -79 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-16 17:00Z | USDe@Solana | $0.9929 | -71.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-04-16 19:00Z | USDe@Solana | $1.0017 | 17.2 | - | - | resolved | 持续 2.0h 后解除（峰值 71.4 bps） | 0.9998 |
| 2026-04-16 20:00Z | USD1@Ethereum | $0.9929 | -70.7 | -29.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-04-16 20:00Z | USDD@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-16 20:00Z | USDG@Ethereum | $0.9972 | -28.2 | - | - | resolved | 持续 4.0h 后解除（峰值 79.0 bps） | - |
| 2026-04-17 03:00Z | USDD@Ethereum | $1.0021 | 21.3 | - | - | resolved | 持续 7.0h 后解除（峰值 53.0 bps） | - |
| 2026-04-17 03:00Z | USDS@Ethereum | $0.9947 | -52.7 | -32.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-17 03:00Z | USDT@Ethereum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-17 05:00Z | USDC@Base | $0.9949 | -50.9 | -56.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-04-17 05:00Z | USDS@Ethereum | $1.0001 | 0.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.7 bps） | 0.9995 |
| 2026-04-17 05:00Z | USDT@Ethereum | $1.0001 | 0.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.7 bps） | - |
| 2026-04-17 05:00Z | USDe@Solana | $0.9725 | -274.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9995 |
| 2026-04-17 06:00Z | PYUSD@Ethereum | $0.9942 | -57.6 | -33.4 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-17 07:00Z | PYUSD@Ethereum | $1.0028 | 28.2 | - | - | resolved | 持续 1.0h 后解除（峰值 57.6 bps） | - |
| 2026-04-17 07:00Z | USDC@Base | $1.0015 | 15.4 | - | - | resolved | 持续 2.0h 后解除（峰值 50.9 bps） | 0.9997 |
| 2026-04-17 08:00Z | PYUSD@Ethereum | $1.0136 | 136.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-17 09:00Z | USDG@Ethereum | $0.9939 | -61.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-17 10:00Z | PYUSD@Ethereum | $0.9998 | -2.3 | - | - | resolved | 持续 2.0h 后解除（峰值 136.1 bps） | - |
| 2026-04-17 10:00Z | USDG@Ethereum | $0.9972 | -28.2 | - | - | resolved | 持续 1.0h 后解除（峰值 61.4 bps） | - |
| 2026-04-17 11:00Z | USD1@Ethereum | $1.0019 | 19.5 | - | - | resolved | 持续 15.0h 后解除（峰值 82.1 bps） | 0.9997 |
| 2026-04-17 13:00Z | PYUSD@Ethereum | $1.0072 | 71.8 | 29.5 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-17 13:00Z | USDG@Ethereum | $0.9898 | -101.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-17 14:00Z | USDe@Solana | $0.9979 | -20.6 | - | - | resolved | 持续 9.0h 后解除（峰值 274.7 bps） | 0.9995 |
| 2026-04-17 15:00Z | PYUSD@Ethereum | $1.0007 | 6.7 | - | - | resolved | 持续 2.0h 后解除（峰值 82.2 bps） | - |
| 2026-04-17 15:00Z | USDe@Solana | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-04-17 16:00Z | PYUSD@Ethereum | $1.0056 | 56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-17 17:00Z | PYUSD@Ethereum | $1.0026 | 25.8 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | - |
| 2026-04-17 17:00Z | USD1@Ethereum | $0.9884 | -116.2 | -27.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-17 17:00Z | USDe@Solana | $1.0022 | 21.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.3 bps） | 0.9994 |
| 2026-04-17 20:00Z | USDe@Solana | $0.9915 | -85.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-04-18 06:00Z | PYUSD@Solana | $0.9824 | -176.2 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-18 08:00Z | PYUSD@Ethereum | $0.9901 | -99 | -69.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-18 08:00Z | PYUSD@Solana | $1.0025 | 24.7 | - | - | resolved | 持续 2.0h 后解除（峰值 176.2 bps） | - |
| 2026-04-18 08:00Z | USDC@Base | $1.0050 | 50 | 36.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-18 08:00Z | USDe@Solana | $0.9810 | -189.7 | - | unconfirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-04-18 09:00Z | PYUSD@Ethereum | $0.9996 | -4.3 | - | - | resolved | 持续 1.0h 后解除（峰值 99.0 bps） | - |
| 2026-04-18 10:00Z | PYUSD@Ethereum | $0.9932 | -67.8 | -77.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-18 10:00Z | USDC@Base | $1.0026 | 25.7 | - | - | resolved | 持续 2.0h 后解除（峰值 50.0 bps） | 0.9996 |
| 2026-04-18 11:00Z | PYUSD@Ethereum | $0.9989 | -11.1 | - | - | resolved | 持续 1.0h 后解除（峰值 67.8 bps） | - |
| 2026-04-18 16:00Z | USD1@Ethereum | $0.9977 | -22.8 | - | - | resolved | 持续 23.0h 后解除（峰值 142.7 bps） | 0.9998 |
| 2026-04-18 18:00Z | PYUSD@Ethereum | $0.9937 | -62.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-18 18:00Z | USD1@Ethereum | $0.9936 | -63.6 | -32.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-04-18 18:00Z | USDG@Ethereum | $1.0027 | 27 | - | - | resolved | 持续 29.0h 后解除（峰值 128.9 bps） | - |
| 2026-04-18 19:00Z | PYUSD@Ethereum | $0.9990 | -9.7 | - | - | resolved | 持续 1.0h 后解除（峰值 62.6 bps） | - |
| 2026-04-18 20:00Z | USDG@Ethereum | $0.9917 | -82.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-18 20:00Z | USDe@Solana | $1.0011 | 10.8 | - | - | resolved | 持续 24.0h 后解除（峰值 325.3 bps） | 0.9998 |
| 2026-04-19 00:00Z | PYUSD@Solana | $1.0463 | 463 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-19 00:00Z | USDG@Ethereum | $0.9975 | -24.9 | - | - | resolved | 持续 4.0h 后解除（峰值 104.4 bps） | - |
| 2026-04-19 01:00Z | PYUSD@Solana | $1.0003 | 2.8 | - | - | resolved | 持续 1.0h 后解除（峰值 463.0 bps） | - |
| 2026-04-19 01:00Z | USDG@Ethereum | $0.9921 | -78.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-19 02:00Z | USDe@Solana | $0.9906 | -94.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-04-19 03:00Z | USDG@Ethereum | $0.9982 | -18.5 | - | - | resolved | 持续 2.0h 后解除（峰值 78.5 bps） | - |
| 2026-04-19 05:00Z | PYUSD@Ethereum | $0.9937 | -63.2 | -93.7 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-19 06:00Z | PYUSD@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 1.0h 后解除（峰值 63.2 bps） | - |
| 2026-04-19 06:00Z | PYUSD@Solana | $0.9919 | -80.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-19 06:00Z | USDG@Ethereum | $0.9907 | -92.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-19 07:00Z | PYUSD@Solana | $0.9996 | -3.8 | - | - | resolved | 持续 1.0h 后解除（峰值 80.9 bps） | - |
| 2026-04-19 07:00Z | USDe@Solana | $0.9807 | -193.4 | - | unconfirmed | escalated | 预警升级为严重 | 0.9991 |
| 2026-04-19 08:00Z | USDG@Ethereum | $0.9972 | -27.9 | - | - | resolved | 持续 2.0h 后解除（峰值 107.7 bps） | - |
| 2026-04-19 09:00Z | USDG@Ethereum | $0.9905 | -95.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-19 11:00Z | USDe@Solana | $1.0002 | 1.7 | - | - | resolved | 持续 9.0h 后解除（峰值 193.4 bps） | 0.9994 |
| 2026-04-19 15:00Z | USDe@Solana | $0.9905 | -94.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9996 |
| 2026-04-19 21:00Z | USDS@Ethereum | $0.9947 | -52.6 | -34.7 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-19 21:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-19 22:00Z | USDS@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | 0.9994 |
| 2026-04-19 22:00Z | USDT@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | - |
| 2026-04-19 22:00Z | USDe@Solana | $0.9666 | -334.2 | - | unconfirmed | escalated | 预警升级为严重 | 0.9993 |
| 2026-04-20 00:00Z | PYUSD@Solana | $0.9750 | -250.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-20 00:00Z | USDS@Ethereum | $1.0055 | 55.4 | 28.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-20 00:00Z | USDT@Ethereum | $1.0055 | 55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 01:00Z | PYUSD@Solana | $0.9973 | -27.3 | - | - | resolved | 持续 1.0h 后解除（峰值 250.4 bps） | - |
| 2026-04-20 03:00Z | USDS@Ethereum | $0.9995 | -5.1 | - | - | resolved | 持续 3.0h 后解除（峰值 55.4 bps） | 0.9994 |
| 2026-04-20 03:00Z | USDT@Ethereum | $0.9995 | -5.1 | - | - | resolved | 持续 3.0h 后解除（峰值 55.4 bps） | - |
| 2026-04-20 07:00Z | PYUSD@Solana | $1.0051 | 50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 07:00Z | USDG@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 22.0h 后解除（峰值 118.0 bps） | - |
| 2026-04-20 08:00Z | PYUSD@Solana | $1.0013 | 13.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-04-20 08:00Z | USDG@Ethereum | $0.9934 | -65.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 10:00Z | USDG@Ethereum | $0.9971 | -29.4 | - | - | resolved | 持续 2.0h 后解除（峰值 82.7 bps） | - |
| 2026-04-20 10:00Z | USDS@Ethereum | $0.9946 | -54.3 | -39.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9993 |
| 2026-04-20 10:00Z | USDT@Ethereum | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 11:00Z | USDG@Ethereum | $0.9940 | -59.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 11:00Z | USDS@Ethereum | $0.9980 | -20 | - | - | resolved | 持续 1.0h 后解除（峰值 54.3 bps） | 0.9994 |
| 2026-04-20 11:00Z | USDT@Ethereum | $0.9980 | -20 | - | - | resolved | 持续 1.0h 后解除（峰值 54.3 bps） | - |
| 2026-04-20 12:00Z | USDG@Solana | $0.9914 | -86.2 | -25.9 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-20 15:00Z | USDG@Ethereum | $0.9985 | -15.4 | - | - | resolved | 持续 4.0h 后解除（峰值 59.8 bps） | - |
| 2026-04-20 15:00Z | USDG@Solana | $0.9975 | -25 | - | - | resolved | 持续 3.0h 后解除（峰值 86.2 bps） | - |
| 2026-04-20 16:00Z | USDS@Ethereum | $0.9947 | -53.1 | -39.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-20 16:00Z | USDT@Ethereum | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-20 17:00Z | USDS@Ethereum | $0.9981 | -19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | 0.9994 |
| 2026-04-20 17:00Z | USDT@Ethereum | $0.9981 | -19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | - |
| 2026-04-20 21:00Z | PYUSD@Ethereum | $0.9896 | -104 | -48.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-20 22:00Z | PYUSD@Ethereum | $0.9988 | -12.1 | - | - | resolved | 持续 1.0h 后解除（峰值 104.0 bps） | - |
| 2026-04-20 23:00Z | USD1@Ethereum | $1.0013 | 13 | - | - | resolved | 持续 53.0h 后解除（峰值 143.3 bps） | 0.9996 |
| 2026-04-21 00:00Z | USD1@Ethereum | $0.9936 | -64 | -31.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-21 01:00Z | USD1@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 64.0 bps） | 0.9996 |
| 2026-04-21 02:00Z | USDG@Ethereum | $0.9944 | -55.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-21 02:00Z | USDS@Ethereum | $0.9947 | -52.9 | -29.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-21 02:00Z | USDT@Ethereum | $0.9947 | -52.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-21 03:00Z | USD1@Ethereum | $0.9918 | -81.5 | -30.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-21 03:00Z | USDS@Ethereum | $0.9988 | -12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.9 bps） | 0.9994 |
| 2026-04-21 03:00Z | USDT@Ethereum | $0.9988 | -12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.9 bps） | - |
| 2026-04-21 04:00Z | USDG@Ethereum | $0.9973 | -26.7 | - | - | resolved | 持续 2.0h 后解除（峰值 55.9 bps） | - |
| 2026-04-21 06:00Z | USD1@Ethereum | $0.9987 | -12.8 | - | - | resolved | 持续 3.0h 后解除（峰值 81.5 bps） | 0.9997 |
| 2026-04-21 12:00Z | USDS@Ethereum | $1.0055 | 54.6 | 25.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9994 |
| 2026-04-21 12:00Z | USDT@Ethereum | $1.0055 | 54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-21 13:00Z | USDS@Ethereum | $0.9984 | -15.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | 0.9994 |
| 2026-04-21 13:00Z | USDT@Ethereum | $0.9984 | -15.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | - |
| 2026-04-21 14:00Z | PYUSD@Ethereum | $0.9941 | -59.3 | -25.3 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-21 14:00Z | USDe@Solana | $0.9984 | -15.9 | - | - | resolved | 持续 47.0h 后解除（峰值 334.2 bps） | 0.999 |
| 2026-04-21 15:00Z | PYUSD@Ethereum | $1.0001 | 1.2 | - | - | resolved | 持续 1.0h 后解除（峰值 59.3 bps） | - |
| 2026-04-21 15:00Z | USDG@Ethereum | $0.9928 | -71.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-21 15:00Z | USDe@Solana | $0.9930 | -70.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9991 |
| 2026-04-21 16:00Z | USDG@Ethereum | $0.9971 | -28.5 | - | - | resolved | 持续 1.0h 后解除（峰值 71.9 bps） | - |
| 2026-04-21 17:00Z | USD1@Ethereum | $0.9948 | -51.6 | -29.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-21 17:00Z | USDC@Base | $0.9948 | -51.5 | -50.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-04-21 17:00Z | USDe@Solana | $0.9993 | -7.1 | - | - | resolved | 持续 2.0h 后解除（峰值 70.1 bps） | 0.9991 |
| 2026-04-21 18:00Z | USDC@Base | $1.0011 | 11.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.5 bps） | 0.9996 |
| 2026-04-21 19:00Z | PYUSD@Ethereum | $0.9916 | -83.8 | -89.6 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-21 19:00Z | USDe@Solana | $0.9922 | -78.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.999 |
| 2026-04-21 20:00Z | PYUSD@Ethereum | $1.0004 | 3.5 | - | - | resolved | 持续 1.0h 后解除（峰值 83.8 bps） | - |
| 2026-04-21 21:00Z | USDC@Base | $0.9946 | -54.3 | -49.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-21 22:00Z | USDG@Ethereum | $0.9942 | -58.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-21 23:00Z | USDC@Base | $0.9983 | -16.8 | - | - | resolved | 持续 2.0h 后解除（峰值 54.3 bps） | 0.9996 |
| 2026-04-22 00:00Z | USD1@Ethereum | $1.0011 | 10.6 | - | - | resolved | 持续 7.0h 后解除（峰值 69.4 bps） | 0.9997 |
| 2026-04-22 01:00Z | PYUSD@Solana | $0.9615 | -385.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-22 02:00Z | PYUSD@Solana | $1.0004 | 3.8 | - | - | resolved | 持续 1.0h 后解除（峰值 385.1 bps） | - |
| 2026-04-22 03:00Z | PYUSD@Ethereum | $1.0052 | 52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-22 04:00Z | PYUSD@Ethereum | $1.0002 | 2.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.0 bps） | - |
| 2026-04-22 04:00Z | USDe@Solana | $1.0218 | 218.1 | - | unconfirmed | escalated | 预警升级为严重 | 0.9991 |
| 2026-04-22 05:00Z | USD1@Ethereum | $0.9941 | -58.9 | -29.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-04-22 05:00Z | USDS@Ethereum | $0.9947 | -52.8 | -34.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-22 05:00Z | USDT@Ethereum | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-22 06:00Z | USDS@Ethereum | $1.0014 | 13.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | 0.9994 |
| 2026-04-22 06:00Z | USDT@Ethereum | $1.0014 | 13.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-04-22 08:00Z | USDC@Base | $0.9946 | -53.7 | -54.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-04-22 08:00Z | USDe@Solana | $0.9992 | -7.9 | - | - | resolved | 持续 13.0h 后解除（峰值 302.6 bps） | 0.9992 |
| 2026-04-22 09:00Z | USDe@Solana | $1.0084 | 83.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9992 |
| 2026-04-22 10:00Z | USDC@Base | $0.9975 | -25.1 | - | - | resolved | 持续 2.0h 后解除（峰值 53.7 bps） | 0.9997 |
| 2026-04-22 11:00Z | USDT@Ethereum | $1.0053 | 52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-22 14:00Z | USDT@Ethereum | $1.0028 | 27.7 | - | - | resolved | 持续 3.0h 后解除（峰值 52.6 bps） | - |
| 2026-04-22 15:00Z | PYUSD@Solana | $0.9913 | -86.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-22 16:00Z | PYUSD@Solana | $1.0020 | 20.4 | - | - | resolved | 持续 1.0h 后解除（峰值 86.7 bps） | - |
| 2026-04-22 16:00Z | USD1@Ethereum | $0.9991 | -9 | - | - | resolved | 持续 11.0h 后解除（峰值 98.4 bps） | 0.9999 |
| 2026-04-22 17:00Z | USD1@Ethereum | $0.9920 | -79.8 | -29.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-22 17:00Z | USDe@Solana | $0.9836 | -163.9 | - | unconfirmed | escalated | 预警升级为严重 | 0.9989 |
| 2026-04-22 19:00Z | USDe@Solana | $1.0002 | 2.1 | - | - | resolved | 持续 10.0h 后解除（峰值 163.9 bps） | 0.9993 |
| 2026-04-22 23:00Z | USDe@Solana | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-04-23 01:00Z | PYUSD@Solana | $1.0367 | 366.6 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-23 02:00Z | PYUSD@Ethereum | $0.9918 | -81.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 02:00Z | PYUSD@Solana | $0.9986 | -14.3 | - | - | resolved | 持续 1.0h 后解除（峰值 366.6 bps） | - |
| 2026-04-23 02:00Z | USDe@Solana | $0.9834 | -165.8 | - | unconfirmed | escalated | 预警升级为严重 | 0.9992 |
| 2026-04-23 04:00Z | PYUSD@Ethereum | $1.0030 | 29.7 | - | - | resolved | 持续 2.0h 后解除（峰值 81.7 bps） | - |
| 2026-04-23 04:00Z | PYUSD@Solana | $1.0069 | 69.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 05:00Z | PYUSD@Solana | $1.0024 | 24.4 | - | - | resolved | 持续 1.0h 后解除（峰值 69.2 bps） | - |
| 2026-04-23 07:00Z | USD1@Ethereum | $0.9993 | -6.6 | - | - | resolved | 持续 14.0h 后解除（峰值 105.7 bps） | 0.9997 |
| 2026-04-23 07:00Z | USDS@Ethereum | $0.9948 | -52.4 | -32.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-23 07:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 08:00Z | USDS@Ethereum | $1.0026 | 26 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | 0.9996 |
| 2026-04-23 08:00Z | USDT@Ethereum | $1.0026 | 26 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | - |
| 2026-04-23 09:00Z | PYUSD@Ethereum | $0.9901 | -99.1 | -69.1 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-23 09:00Z | USDS@Ethereum | $0.9948 | -51.7 | -29.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-23 09:00Z | USDT@Ethereum | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 10:00Z | PYUSD@Ethereum | $0.9993 | -6.7 | - | - | resolved | 持续 1.0h 后解除（峰值 99.1 bps） | - |
| 2026-04-23 11:00Z | USD1@Ethereum | $0.9896 | -103.6 | -28.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-04-23 11:00Z | USDG@Ethereum | $0.9991 | -8.6 | - | - | resolved | 持续 37.0h 后解除（峰值 103.0 bps） | - |
| 2026-04-23 11:00Z | USDS@Ethereum | $0.9995 | -5.4 | - | - | resolved | 持续 2.0h 后解除（峰值 51.7 bps） | 0.9995 |
| 2026-04-23 11:00Z | USDT@Ethereum | $0.9995 | -5.4 | - | - | resolved | 持续 2.0h 后解除（峰值 51.7 bps） | - |
| 2026-04-23 13:00Z | USDG@Ethereum | $0.9923 | -77 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 14:00Z | USD1@Ethereum | $1.0017 | 17 | - | - | resolved | 持续 3.0h 后解除（峰值 103.6 bps） | 0.9997 |
| 2026-04-23 14:00Z | USDG@Ethereum | $0.9981 | -19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 77.0 bps） | - |
| 2026-04-23 15:00Z | USDG@Ethereum | $0.9942 | -57.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 17:00Z | PYUSD@Ethereum | $0.9902 | -98 | -100 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-23 17:00Z | USDS@Ethereum | $1.0054 | 53.8 | 31.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-23 17:00Z | USDT@Ethereum | $1.0054 | 53.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-23 18:00Z | PYUSD@Ethereum | $1.0028 | 27.6 | - | - | resolved | 持续 1.0h 后解除（峰值 98.0 bps） | - |
| 2026-04-23 19:00Z | USDS@Ethereum | $0.9986 | -14.1 | - | - | resolved | 持续 2.0h 后解除（峰值 53.8 bps） | 0.9995 |
| 2026-04-23 19:00Z | USDT@Ethereum | $0.9986 | -14.1 | - | - | resolved | 持续 2.0h 后解除（峰值 53.8 bps） | - |
| 2026-04-23 23:00Z | USDG@Ethereum | $0.9976 | -23.7 | - | - | resolved | 持续 8.0h 后解除（峰值 86.3 bps） | - |
| 2026-04-24 01:00Z | PYUSD@Solana | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-24 01:00Z | USDG@Ethereum | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-24 01:00Z | USDe@Solana | $1.0002 | 2.4 | - | - | resolved | 持续 26.0h 后解除（峰值 244.5 bps） | 0.9991 |
| 2026-04-24 02:00Z | PYUSD@Solana | $1.0018 | 18 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-04-24 02:00Z | USDG@Ethereum | $0.9972 | -27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.6 bps） | - |
| 2026-04-24 03:00Z | PYUSD@Ethereum | $0.9895 | -105.3 | -83.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-04-24 03:00Z | USDG@Ethereum | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-24 03:00Z | USDe@Solana | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9991 |
| 2026-04-24 04:00Z | PYUSD@Ethereum | $0.9989 | -10.6 | - | - | resolved | 持续 1.0h 后解除（峰值 105.3 bps） | - |
| 2026-04-24 05:00Z | USDG@Ethereum | $0.9982 | -17.9 | - | - | resolved | 持续 2.0h 后解除（峰值 54.1 bps） | - |
| 2026-04-24 07:00Z | USDG@Ethereum | $0.9929 | -70.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-24 08:00Z | PYUSD@Solana | $1.0128 | 128.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-24 08:00Z | USD1@Ethereum | $0.9943 | -57.1 | -35.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-04-24 09:00Z | PYUSD@Solana | $0.9976 | -24 | - | - | resolved | 持续 1.0h 后解除（峰值 128.5 bps） | - |
| 2026-04-24 15:00Z | USDC@Base | $0.9950 | -50.3 | -56.7 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9995 |
| 2026-04-24 16:00Z | USDG@Ethereum | $1.0006 | 6.4 | - | - | resolved | 持续 9.0h 后解除（峰值 70.7 bps） | - |
| 2026-04-24 20:00Z | USD1@Ethereum | $1.0005 | 4.8 | - | - | resolved | 持续 12.0h 后解除（峰值 57.1 bps） | 0.9997 |
| 2026-04-24 20:00Z | USDC@Base | $1.0028 | 27.9 | - | - | resolved | 持续 5.0h 后解除（峰值 50.3 bps） | 0.9996 |
| 2026-04-24 21:00Z | USDG@Ethereum | $0.9939 | -61.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-25 01:00Z | USDG@Ethereum | $0.9991 | -9.3 | - | - | resolved | 持续 4.0h 后解除（峰值 61.1 bps） | - |
| 2026-04-25 03:00Z | PYUSD@Solana | $1.0403 | 402.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-25 04:00Z | PYUSD@Solana | $1.0023 | 23.4 | - | - | resolved | 持续 1.0h 后解除（峰值 402.9 bps） | - |
| 2026-04-25 04:00Z | USDG@Solana | $1.0109 | 108.9 | 27.3 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-04-25 05:00Z | PYUSD@Solana | $0.9896 | -104.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-25 05:00Z | USD1@Ethereum | $0.9944 | -56.2 | -32.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-25 05:00Z | USDG@Solana | $1.0002 | 1.8 | - | - | resolved | 持续 1.0h 后解除（峰值 108.9 bps） | - |
| 2026-04-25 06:00Z | PYUSD@Solana | $0.9983 | -17.4 | - | - | resolved | 持续 1.0h 后解除（峰值 104.4 bps） | - |
| 2026-04-25 06:00Z | USD1@Ethereum | $1.0028 | 27.8 | - | - | resolved | 持续 1.0h 后解除（峰值 56.2 bps） | 0.9996 |
| 2026-04-25 11:00Z | USDG@Ethereum | $0.9948 | -52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-25 17:00Z | USDG@Ethereum | $0.9979 | -21.1 | - | - | resolved | 持续 6.0h 后解除（峰值 56.3 bps） | - |
| 2026-04-25 18:00Z | USDC@Base | $1.0053 | 53.5 | 48 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-25 21:00Z | USDC@Base | $0.9994 | -6.1 | - | - | resolved | 持续 3.0h 后解除（峰值 53.5 bps） | 0.9996 |
| 2026-04-25 22:00Z | USDC@Base | $1.0054 | 53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9996 |
| 2026-04-26 01:00Z | USDC@Base | $0.9972 | -28.2 | - | - | resolved | 持续 3.0h 后解除（峰值 53.9 bps） | 0.9996 |
| 2026-04-26 05:00Z | PYUSD@Ethereum | $1.0061 | 60.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-26 06:00Z | PYUSD@Ethereum | $1.0001 | 0.6 | - | - | resolved | 持续 1.0h 后解除（峰值 60.9 bps） | - |
| 2026-04-26 08:00Z | USDG@Ethereum | $0.9940 | -60 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-26 09:00Z | PYUSD@Solana | $0.9923 | -77.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-26 10:00Z | PYUSD@Solana | $0.9994 | -6.2 | - | - | resolved | 持续 1.0h 后解除（峰值 77.1 bps） | - |
| 2026-04-26 11:00Z | USDS@Ethereum | $1.0051 | 51.5 | 37.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-26 11:00Z | USDT@Ethereum | $1.0051 | 51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-26 12:00Z | USD1@Ethereum | $0.9925 | -74.9 | -31.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-26 14:00Z | USDS@Ethereum | $0.9979 | -20.6 | - | - | resolved | 持续 3.0h 后解除（峰值 51.5 bps） | 0.9995 |
| 2026-04-26 14:00Z | USDT@Ethereum | $0.9979 | -20.6 | - | - | resolved | 持续 3.0h 后解除（峰值 51.5 bps） | - |
| 2026-04-26 19:00Z | USDe@Solana | $1.0000 | -0.2 | - | - | resolved | 持续 64.0h 后解除（峰值 100.4 bps） | 0.9993 |
| 2026-04-26 21:00Z | USDC@Base | $0.9943 | -56.8 | -25.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-04-26 21:00Z | USDe@Solana | $0.9927 | -72.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-04-26 22:00Z | USD1@Ethereum | $0.9845 | -155.1 | -31.9 | likely | escalated | 预警升级为严重 | 0.9998 |
| 2026-04-26 22:00Z | USDe@Solana | $0.9981 | -18.8 | - | - | resolved | 持续 1.0h 后解除（峰值 72.8 bps） | 0.9994 |
| 2026-04-26 23:00Z | USDC@Base | $0.9982 | -18.3 | - | - | resolved | 持续 2.0h 后解除（峰值 56.8 bps） | 0.9996 |
| 2026-04-26 23:00Z | USDS@Ethereum | $1.0055 | 55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-04-26 23:00Z | USDT@Ethereum | $1.0055 | 55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 00:00Z | USDS@Ethereum | $1.0005 | 4.8 | - | - | resolved | 持续 1.0h 后解除（峰值 55.2 bps） | 0.9995 |
| 2026-04-27 00:00Z | USDT@Ethereum | $1.0005 | 4.8 | - | - | resolved | 持续 1.0h 后解除（峰值 55.2 bps） | - |
| 2026-04-27 04:00Z | PYUSD@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 04:00Z | USDD@BSC | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 05:00Z | PYUSD@Ethereum | $0.9835 | -165.4 | -1.8 | suspicious | escalated | 预警升级为严重 | - |
| 2026-04-27 05:00Z | USDe@Solana | $0.9791 | -209.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9993 |
| 2026-04-27 06:00Z | PYUSD@Ethereum | $1.0003 | 3.2 | - | - | resolved | 持续 2.0h 后解除（峰值 165.4 bps） | - |
| 2026-04-27 07:00Z | USDG@Ethereum | $1.0002 | 2.2 | - | - | resolved | 持续 23.0h 后解除（峰值 89.0 bps） | - |
| 2026-04-27 12:00Z | USDe@Solana | $0.9994 | -6.3 | - | - | resolved | 持续 7.0h 后解除（峰值 247.9 bps） | 0.9994 |
| 2026-04-27 13:00Z | USD1@Ethereum | $1.0004 | 4.2 | - | - | resolved | 持续 25.0h 后解除（峰值 155.1 bps） | 0.9998 |
| 2026-04-27 14:00Z | PYUSD@Solana | $0.9865 | -134.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 14:00Z | USDe@Solana | $1.0054 | 54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-04-27 15:00Z | USDG@Ethereum | $0.9933 | -67.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 15:00Z | USDe@Solana | $0.9828 | -172.5 | - | unconfirmed | escalated | 预警升级为严重 | 0.9994 |
| 2026-04-27 16:00Z | PYUSD@Solana | $0.9978 | -21.9 | - | - | resolved | 持续 2.0h 后解除（峰值 134.8 bps） | - |
| 2026-04-27 16:00Z | USDG@Ethereum | $0.9977 | -23.5 | - | - | resolved | 持续 1.0h 后解除（峰值 67.5 bps） | - |
| 2026-04-27 18:00Z | USD1@Ethereum | $0.9753 | -247.1 | -30.5 | likely | new-severe | 首次触发即严重（双源大概率真） | 0.9999 |
| 2026-04-27 21:00Z | USDG@Ethereum | $0.9895 | -105 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 21:00Z | USDe@Solana | $0.9987 | -13 | - | - | resolved | 持续 7.0h 后解除（峰值 172.5 bps） | 0.9994 |
| 2026-04-27 22:00Z | USDS@Ethereum | $1.0054 | 54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-04-27 22:00Z | USDT@Ethereum | $1.0054 | 54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-27 23:00Z | USD1@Ethereum | $1.0004 | 4.5 | - | - | resolved | 持续 5.0h 后解除（峰值 247.1 bps） | 0.9999 |
| 2026-04-27 23:00Z | USDG@Ethereum | $1.0015 | 14.6 | - | - | resolved | 持续 2.0h 后解除（峰值 105.0 bps） | - |
| 2026-04-27 23:00Z | USDS@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | 0.9996 |
| 2026-04-27 23:00Z | USDT@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | - |
| 2026-04-28 00:00Z | PYUSD@Solana | $1.0736 | 735.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-28 00:00Z | USDG@Ethereum | $0.9901 | -98.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 02:00Z | PYUSD@Solana | $1.0002 | 2.4 | - | - | resolved | 持续 2.0h 后解除（峰值 735.7 bps） | - |
| 2026-04-28 02:00Z | USDG@Ethereum | $1.0024 | 24.2 | - | - | resolved | 持续 2.0h 后解除（峰值 98.6 bps） | - |
| 2026-04-28 02:00Z | USDS@Ethereum | $0.9948 | -51.8 | -91.6 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9995 |
| 2026-04-28 02:00Z | USDT@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 03:00Z | USD1@Ethereum | $0.9867 | -133.3 | -29.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-28 03:00Z | USDS@Ethereum | $0.9979 | -21.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | 0.9995 |
| 2026-04-28 03:00Z | USDT@Ethereum | $0.9979 | -21.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | - |
| 2026-04-28 06:00Z | U@BSC | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 06:00Z | USDe@Solana | $0.9870 | -129.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-04-28 07:00Z | U@BSC | $1.0025 | 24.9 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | - |
| 2026-04-28 07:00Z | USDS@Ethereum | $1.0055 | 55.3 | 33.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-04-28 07:00Z | USDT@Ethereum | $1.0055 | 55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 08:00Z | PYUSD@Solana | $0.9913 | -87.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 08:00Z | USDG@Ethereum | $0.9915 | -85.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 08:00Z | USDS@Ethereum | $0.9977 | -23.2 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | 0.9995 |
| 2026-04-28 08:00Z | USDT@Ethereum | $0.9977 | -23.2 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-04-28 09:00Z | PYUSD@Solana | $1.0002 | 2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 87.2 bps） | - |
| 2026-04-28 09:00Z | USDe@Solana | $0.9826 | -174.2 | - | unconfirmed | escalated | 预警升级为严重 | 0.9994 |
| 2026-04-28 12:00Z | USDC@Base | $0.9941 | -58.5 | -28.9 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-28 12:00Z | USDG@Ethereum | $0.9987 | -12.5 | - | - | resolved | 持续 4.0h 后解除（峰值 85.2 bps） | - |
| 2026-04-28 13:00Z | USDD@BSC | $1.0011 | 10.7 | - | - | resolved | 持续 33.0h 后解除（峰值 50.4 bps） | - |
| 2026-04-28 15:00Z | USDC@Base | $0.9985 | -14.8 | - | - | resolved | 持续 3.0h 后解除（峰值 58.5 bps） | 1 |
| 2026-04-28 16:00Z | USDG@Ethereum | $0.9890 | -109.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 17:00Z | USDG@Ethereum | $1.0000 | 0.3 | - | - | resolved | 持续 1.0h 后解除（峰值 109.9 bps） | - |
| 2026-04-28 18:00Z | PYUSD@Ethereum | $1.0052 | 51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 19:00Z | USDG@Ethereum | $0.9916 | -84.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-28 20:00Z | PYUSD@Ethereum | $0.9994 | -6 | - | - | resolved | 持续 2.0h 后解除（峰值 51.9 bps） | - |
| 2026-04-28 20:00Z | USDG@Ethereum | $1.0013 | 12.6 | - | - | resolved | 持续 1.0h 后解除（峰值 84.2 bps） | - |
| 2026-04-28 22:00Z | USDS@Ethereum | $0.9947 | -52.5 | -37.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-04-28 22:00Z | USDT@Ethereum | $0.9947 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 00:00Z | USDS@Ethereum | $0.9978 | -22.4 | - | - | resolved | 持续 2.0h 后解除（峰值 52.5 bps） | 0.9999 |
| 2026-04-29 00:00Z | USDT@Ethereum | $0.9978 | -22.4 | - | - | resolved | 持续 2.0h 后解除（峰值 52.5 bps） | - |
| 2026-04-29 03:00Z | PYUSD@Ethereum | $1.0120 | 120.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 03:00Z | USDG@Ethereum | $0.9931 | -69.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 04:00Z | USD1@Ethereum | $1.0015 | 15.4 | - | - | resolved | 持续 25.0h 后解除（峰值 133.3 bps） | 1.0001 |
| 2026-04-29 04:00Z | USDG@Ethereum | $0.9997 | -2.7 | - | - | resolved | 持续 1.0h 后解除（峰值 69.5 bps） | - |
| 2026-04-29 07:00Z | PYUSD@Ethereum | $0.9986 | -14.2 | - | - | resolved | 持续 4.0h 后解除（峰值 120.2 bps） | - |
| 2026-04-29 07:00Z | PYUSD@Solana | $1.0076 | 76.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 08:00Z | PYUSD@Solana | $0.9990 | -9.9 | - | - | resolved | 持续 1.0h 后解除（峰值 76.5 bps） | - |
| 2026-04-29 10:00Z | PYUSD@Ethereum | $1.0060 | 60.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 12:00Z | PYUSD@Ethereum | $1.0010 | 9.7 | - | - | resolved | 持续 2.0h 后解除（峰值 60.4 bps） | - |
| 2026-04-29 13:00Z | PYUSD@Ethereum | $0.9942 | -58.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 15:00Z | USDG@Ethereum | $0.9926 | -74.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 16:00Z | PYUSD@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 3.0h 后解除（峰值 70.0 bps） | - |
| 2026-04-29 16:00Z | USDG@Ethereum | $0.9994 | -6.4 | - | - | resolved | 持续 1.0h 后解除（峰值 74.1 bps） | - |
| 2026-04-29 18:00Z | USDG@Ethereum | $0.9916 | -84.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 19:00Z | PYUSD@Ethereum | $0.9833 | -166.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-04-29 19:00Z | U@BSC | $0.9897 | -102.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-29 20:00Z | U@BSC | $0.9975 | -24.7 | - | - | resolved | 持续 1.0h 后解除（峰值 102.8 bps） | - |
| 2026-04-29 21:00Z | PYUSD@Ethereum | $1.0009 | 8.6 | - | - | resolved | 持续 2.0h 后解除（峰值 166.8 bps） | - |
| 2026-04-29 21:00Z | USDe@Solana | $1.0011 | 10.5 | - | - | resolved | 持续 39.0h 后解除（峰值 313.8 bps） | 0.9995 |
| 2026-04-30 00:00Z | PYUSD@Ethereum | $1.0087 | 86.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-30 00:00Z | USDT@Ethereum | $1.0053 | 53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-30 01:00Z | PYUSD@Ethereum | $0.9992 | -8.2 | - | - | resolved | 持续 1.0h 后解除（峰值 86.6 bps） | - |
| 2026-04-30 03:00Z | USDT@Ethereum | $0.9994 | -6.3 | - | - | resolved | 持续 3.0h 后解除（峰值 53.3 bps） | - |
| 2026-04-30 11:00Z | PYUSD@Solana | $1.0130 | 130.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-30 11:00Z | USDG@Ethereum | $1.0026 | 25.6 | - | - | resolved | 持续 17.0h 后解除（峰值 119.0 bps） | - |
| 2026-04-30 12:00Z | PYUSD@Solana | $0.9987 | -13 | - | - | resolved | 持续 1.0h 后解除（峰值 130.1 bps） | - |
| 2026-04-30 14:00Z | USDe@Solana | $1.0055 | 55.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-04-30 19:00Z | USDG@Ethereum | $0.9944 | -56.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-30 21:00Z | USDS@Ethereum | $0.9949 | -50.6 | -31.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-04-30 21:00Z | USDT@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-04-30 22:00Z | USDC@Base | $0.9947 | -53.1 | -57.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-04-30 23:00Z | USDC@Base | $1.0022 | 22.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | 1.0001 |
| 2026-04-30 23:00Z | USDD@BSC | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-01 00:00Z | PYUSD@Solana | $0.9790 | -209.6 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-01 01:00Z | USDS@Ethereum | $0.9995 | -5.1 | - | - | resolved | 持续 4.0h 后解除（峰值 50.6 bps） | 0.9999 |
| 2026-05-01 01:00Z | USDT@Ethereum | $0.9995 | -5.1 | - | - | resolved | 持续 4.0h 后解除（峰值 50.6 bps） | - |
| 2026-05-01 02:00Z | PYUSD@Solana | $0.9998 | -2.3 | - | - | resolved | 持续 2.0h 后解除（峰值 401.4 bps） | - |
| 2026-05-01 07:00Z | USDG@Ethereum | $0.9975 | -25 | - | - | resolved | 持续 12.0h 后解除（峰值 63.2 bps） | - |
| 2026-05-01 08:00Z | USD1@Ethereum | $0.9942 | -57.8 | -26.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-01 10:00Z | USD1@Ethereum | $0.9997 | -2.7 | - | - | resolved | 持续 2.0h 后解除（峰值 57.8 bps） | 1.0002 |
| 2026-05-01 11:00Z | USD1@Ethereum | $0.9931 | -69.3 | -26.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-05-01 13:00Z | USDG@Ethereum | $0.9930 | -70 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-01 16:00Z | USDe@Solana | $1.0024 | 24.5 | - | - | resolved | 持续 26.0h 后解除（峰值 72.0 bps） | 0.9993 |
| 2026-05-01 21:00Z | USDe@Solana | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-05-01 23:00Z | USD1@Ethereum | $0.9980 | -19.8 | - | - | resolved | 持续 12.0h 后解除（峰值 94.3 bps） | 1 |
| 2026-05-02 01:00Z | USDT@Ethereum | $1.0054 | 53.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-02 02:00Z | PYUSD@Solana | $1.0210 | 210.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-02 02:00Z | USDG@Ethereum | $1.0014 | 13.5 | - | - | resolved | 持续 13.0h 后解除（峰值 79.4 bps） | - |
| 2026-05-02 02:00Z | USDT@Ethereum | $0.9992 | -8 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | - |
| 2026-05-02 03:00Z | USD1@Ethereum | $0.9925 | -75.5 | -28.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-02 05:00Z | PYUSD@Solana | $0.9994 | -6.3 | - | - | resolved | 持续 3.0h 后解除（峰值 210.3 bps） | - |
| 2026-05-02 08:00Z | USD1@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 5.0h 后解除（峰值 75.5 bps） | 0.9999 |
| 2026-05-02 09:00Z | PYUSD@Solana | $1.0062 | 62.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-02 09:00Z | USDG@Ethereum | $0.9943 | -56.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-02 10:00Z | PYUSD@Solana | $0.9982 | -18 | - | - | resolved | 持续 1.0h 后解除（峰值 62.4 bps） | - |
| 2026-05-02 10:00Z | USDD@BSC | $1.0029 | 29 | - | - | resolved | 持续 35.0h 后解除（峰值 52.3 bps） | - |
| 2026-05-02 14:00Z | USDG@Ethereum | $1.0015 | 15 | - | - | resolved | 持续 5.0h 后解除（峰值 71.0 bps） | - |
| 2026-05-02 16:00Z | USDG@Ethereum | $0.9939 | -61.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-02 16:00Z | USDe@Solana | $0.9981 | -18.6 | - | - | resolved | 持续 19.0h 后解除（峰值 53.7 bps） | 0.9992 |
| 2026-05-02 17:00Z | PYUSD@Solana | $1.0250 | 250.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-02 17:00Z | USD1@Ethereum | $0.9921 | -79 | -28.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-05-02 18:00Z | PYUSD@Solana | $0.9979 | -21.5 | - | - | resolved | 持续 1.0h 后解除（峰值 250.1 bps） | - |
| 2026-05-02 21:00Z | USDS@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-05-02 21:00Z | USDT@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-02 22:00Z | USDS@Ethereum | $0.9985 | -15.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | 1 |
| 2026-05-02 22:00Z | USDT@Ethereum | $0.9985 | -15.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | - |
| 2026-05-03 00:00Z | PYUSD@Solana | $1.0232 | 232.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-03 01:00Z | PYUSD@Solana | $1.0024 | 23.9 | - | - | resolved | 持续 1.0h 后解除（峰值 232.1 bps） | - |
| 2026-05-03 01:00Z | USDG@Ethereum | $0.9977 | -23.2 | - | - | resolved | 持续 9.0h 后解除（峰值 67.1 bps） | - |
| 2026-05-03 01:00Z | USDT@Ethereum | $0.9945 | -55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-03 03:00Z | USDT@Ethereum | $1.0009 | 9.3 | - | - | resolved | 持续 2.0h 后解除（峰值 55.4 bps） | - |
| 2026-05-03 07:00Z | PYUSD@Ethereum | $1.0053 | 52.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-03 09:00Z | PYUSD@Solana | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-03 10:00Z | PYUSD@Solana | $0.9971 | -29 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | - |
| 2026-05-03 11:00Z | PYUSD@Ethereum | $0.9996 | -3.7 | - | - | resolved | 持续 4.0h 后解除（峰值 52.9 bps） | - |
| 2026-05-03 12:00Z | USDG@Ethereum | $0.9926 | -73.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-03 13:00Z | PYUSD@Solana | $1.0102 | 102.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-03 14:00Z | PYUSD@Solana | $0.9985 | -15.5 | - | - | resolved | 持续 1.0h 后解除（峰值 102.1 bps） | - |
| 2026-05-03 16:00Z | USDe@Solana | $0.9939 | -61.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-05-03 20:00Z | USDe@Solana | $0.9972 | -28.2 | - | - | resolved | 持续 4.0h 后解除（峰值 65.5 bps） | 0.9994 |
| 2026-05-03 23:00Z | USDS@Ethereum | $0.9948 | -52 | -27.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-05-03 23:00Z | USDT@Ethereum | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-04 00:00Z | USDe@Solana | $0.9873 | -126.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-05-04 01:00Z | USD1@Ethereum | $0.9971 | -28.9 | - | - | resolved | 持续 32.0h 后解除（峰值 92.2 bps） | 1 |
| 2026-05-04 01:00Z | USDC@Base | $0.9942 | -58.4 | -57.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-05-04 01:00Z | USDS@Ethereum | $0.9978 | -22.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.5 bps） | 0.9999 |
| 2026-05-04 01:00Z | USDT@Ethereum | $0.9978 | -22.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.5 bps） | - |
| 2026-05-04 02:00Z | USDC@Base | $0.9973 | -26.7 | - | - | resolved | 持续 1.0h 后解除（峰值 58.4 bps） | 1.0001 |
| 2026-05-04 03:00Z | USDG@Solana | $0.9882 | -118.2 | -25.6 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-05-04 04:00Z | PYUSD@Ethereum | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-04 04:00Z | USDG@Solana | $1.0008 | 8.4 | - | - | resolved | 持续 1.0h 后解除（峰值 118.2 bps） | - |
| 2026-05-04 05:00Z | PYUSD@Ethereum | $0.9996 | -4.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-05-04 06:00Z | USDe@Ethereum | $0.9925 | -74.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-05-04 07:00Z | USD1@Ethereum | $0.9902 | -98.4 | -29.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-04 07:00Z | USDe@Ethereum | $0.9989 | -11 | - | - | resolved | 持续 1.0h 后解除（峰值 74.9 bps） | 0.9994 |
| 2026-05-04 09:00Z | USDe@Solana | $1.0019 | 18.7 | - | - | resolved | 持续 9.0h 后解除（峰值 126.7 bps） | 0.9994 |
| 2026-05-04 12:00Z | USDG@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 24.0h 后解除（峰值 102.7 bps） | - |
| 2026-05-04 15:00Z | PYUSD@Ethereum | $1.0083 | 82.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-04 15:00Z | USD1@Ethereum | $1.0008 | 8.4 | - | - | resolved | 持续 8.0h 后解除（峰值 98.4 bps） | 0.9998 |
| 2026-05-04 15:00Z | USDG@Ethereum | $0.9939 | -60.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-04 17:00Z | USDe@Solana | $1.0081 | 81 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9992 |
| 2026-05-04 18:00Z | PYUSD@Ethereum | $1.0016 | 16.3 | - | - | resolved | 持续 3.0h 后解除（峰值 82.8 bps） | - |
| 2026-05-04 19:00Z | USDG@Ethereum | $0.9979 | -21.1 | - | - | resolved | 持续 4.0h 后解除（峰值 60.8 bps） | - |
| 2026-05-04 19:00Z | USDT@Ethereum | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-04 21:00Z | USDS@Ethereum | $1.0052 | 51.6 | 30.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-05-04 22:00Z | USD1@Ethereum | $0.9920 | -80.3 | -29.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-04 23:00Z | USDS@Ethereum | $1.0005 | 5 | - | - | resolved | 持续 2.0h 后解除（峰值 51.6 bps） | 0.9998 |
| 2026-05-04 23:00Z | USDT@Ethereum | $1.0005 | 5 | - | - | resolved | 持续 4.0h 后解除（峰值 54.6 bps） | - |
| 2026-05-05 01:00Z | USDe@Solana | $0.9995 | -4.8 | - | - | resolved | 持续 8.0h 后解除（峰值 81.0 bps） | 0.9993 |
| 2026-05-05 02:00Z | USDD@Ethereum | $1.0054 | 54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 04:00Z | USD1@Ethereum | $0.9977 | -22.5 | - | - | resolved | 持续 6.0h 后解除（峰值 80.3 bps） | 1 |
| 2026-05-05 04:00Z | USDG@Ethereum | $0.9939 | -60.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 06:00Z | USDe@Solana | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-05-05 09:00Z | PYUSD@Ethereum | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 09:00Z | PYUSD@Solana | $1.0068 | 67.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 10:00Z | PYUSD@Ethereum | $1.0010 | 9.6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | - |
| 2026-05-05 10:00Z | PYUSD@Solana | $0.9984 | -16 | - | - | resolved | 持续 1.0h 后解除（峰值 67.7 bps） | - |
| 2026-05-05 12:00Z | USDT@Ethereum | $1.0053 | 53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 13:00Z | USDT@Ethereum | $1.0010 | 10.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-05-05 15:00Z | USD1@Ethereum | $0.9934 | -65.7 | -28.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-05 18:00Z | USDT@Ethereum | $1.0051 | 51.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-05 19:00Z | USDT@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.2 bps） | - |
| 2026-05-05 20:00Z | USDe@Solana | $0.9978 | -22.1 | - | - | resolved | 持续 14.0h 后解除（峰值 89.6 bps） | 0.9994 |
| 2026-05-05 23:00Z | PYUSD@Solana | $0.9889 | -111.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-06 00:00Z | PYUSD@Solana | $0.9997 | -2.7 | - | - | resolved | 持续 1.0h 后解除（峰值 111.2 bps） | - |
| 2026-05-06 01:00Z | USD1@Ethereum | $0.9976 | -23.9 | - | - | resolved | 持续 10.0h 后解除（峰值 140.3 bps） | 0.9997 |
| 2026-05-06 01:00Z | USDG@Ethereum | $0.9984 | -15.6 | - | - | resolved | 持续 21.0h 后解除（峰值 60.6 bps） | - |
| 2026-05-06 02:00Z | USDe@Solana | $0.9944 | -55.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9993 |
| 2026-05-06 03:00Z | PYUSD@Solana | $1.0266 | 266.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-06 04:00Z | PYUSD@Solana | $1.0004 | 4.3 | - | - | resolved | 持续 1.0h 后解除（峰值 266.3 bps） | - |
| 2026-05-06 04:00Z | USDe@Solana | $0.9971 | -28.6 | - | - | resolved | 持续 2.0h 后解除（峰值 89.6 bps） | 0.9994 |
| 2026-05-06 06:00Z | USDD@Ethereum | $0.9985 | -15.4 | - | - | resolved | 持续 28.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-06 08:00Z | PYUSD@Ethereum | $1.0091 | 91.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-06 10:00Z | PYUSD@Ethereum | $1.0178 | 177.6 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-05-06 11:00Z | USDG@Ethereum | $0.9936 | -64 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-06 13:00Z | PYUSD@Ethereum | $0.9989 | -11.1 | - | - | resolved | 持续 5.0h 后解除（峰值 177.6 bps） | - |
| 2026-05-06 13:00Z | PYUSD@Solana | $0.9834 | -165.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-06 13:00Z | USDe@Solana | $0.9889 | -111.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-05-06 14:00Z | PYUSD@Solana | $0.9999 | -0.8 | - | - | resolved | 持续 1.0h 后解除（峰值 165.7 bps） | - |
| 2026-05-06 14:00Z | USD1@Ethereum | $0.9898 | -102.1 | -31.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-05-06 14:00Z | USDe@Solana | $0.9805 | -194.6 | - | unconfirmed | escalated | 预警升级为严重 | 0.9993 |
| 2026-05-06 17:00Z | USDG@Ethereum | $1.0005 | 5 | - | - | resolved | 持续 6.0h 后解除（峰值 73.9 bps） | - |
| 2026-05-06 18:00Z | PYUSD@Ethereum | $0.9942 | -57.7 | -91.3 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-06 19:00Z | PYUSD@Ethereum | $0.9989 | -11.3 | - | - | resolved | 持续 1.0h 后解除（峰值 57.7 bps） | - |
| 2026-05-06 20:00Z | USDG@Ethereum | $0.9914 | -86.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-06 22:00Z | USDD@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-06 22:00Z | USDe@Solana | $0.9981 | -19.4 | - | - | resolved | 持续 9.0h 后解除（峰值 194.6 bps） | 0.9996 |
| 2026-05-07 00:00Z | PYUSD@Ethereum | $0.9937 | -63.4 | -93.5 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-07 00:00Z | USDe@Solana | $0.9904 | -95.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-05-07 01:00Z | PYUSD@Ethereum | $0.9985 | -15 | - | - | resolved | 持续 1.0h 后解除（峰值 63.4 bps） | - |
| 2026-05-07 01:00Z | USDG@Ethereum | $0.9973 | -26.7 | - | - | resolved | 持续 5.0h 后解除（峰值 91.4 bps） | - |
| 2026-05-07 01:00Z | USDe@Solana | $0.9849 | -151.4 | - | unconfirmed | escalated | 预警升级为严重 | 0.9995 |
| 2026-05-07 02:00Z | USDG@Ethereum | $0.9926 | -74.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-07 05:00Z | USDG@Ethereum | $0.9987 | -13.1 | - | - | resolved | 持续 3.0h 后解除（峰值 74.5 bps） | - |
| 2026-05-07 06:00Z | USDD@Ethereum | $0.9994 | -5.9 | - | - | resolved | 持续 8.0h 后解除（峰值 55.0 bps） | - |
| 2026-05-07 06:00Z | USDG@Ethereum | $0.9894 | -106.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-07 11:00Z | USDD@Ethereum | $1.0050 | 50.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-07 12:00Z | USDG@Ethereum | $0.9975 | -24.9 | - | - | resolved | 持续 6.0h 后解除（峰值 106.1 bps） | - |
| 2026-05-07 12:00Z | USDe@Solana | $0.9982 | -18.4 | - | - | resolved | 持续 12.0h 后解除（峰值 214.4 bps） | 0.9994 |
| 2026-05-07 14:00Z | PYUSD@Solana | $0.9936 | -63.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-07 14:00Z | USDG@Ethereum | $0.9915 | -84.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-07 15:00Z | PYUSD@Solana | $1.0000 | 0.4 | - | - | resolved | 持续 1.0h 后解除（峰值 63.6 bps） | - |
| 2026-05-07 16:00Z | USDC@Base | $0.9944 | -56.1 | -27.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-07 17:00Z | USDC@Base | $1.0026 | 25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.1 bps） | 1 |
| 2026-05-08 03:00Z | USDD@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 16.0h 后解除（峰值 50.3 bps） | - |
| 2026-05-08 06:00Z | USDe@Solana | $0.9929 | -70.7 | -72.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-05-08 09:00Z | USDe@Solana | $0.9987 | -13.1 | - | - | resolved | 持续 3.0h 后解除（峰值 70.7 bps） | 0.9997 |
| 2026-05-08 11:00Z | USDT@Ethereum | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-08 12:00Z | USDS@Ethereum | $0.9947 | -52.7 | -41.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-05-08 13:00Z | USDS@Ethereum | $1.0026 | 25.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | 0.9999 |
| 2026-05-08 13:00Z | USDT@Ethereum | $1.0026 | 25.5 | - | - | resolved | 持续 2.0h 后解除（峰值 52.7 bps） | - |
| 2026-05-08 17:00Z | USDT@Ethereum | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-08 20:00Z | USDT@Ethereum | $1.0006 | 5.8 | - | - | resolved | 持续 3.0h 后解除（峰值 52.5 bps） | - |
| 2026-05-09 01:00Z | USDT@Ethereum | $1.0052 | 51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-09 02:00Z | USDT@Ethereum | $0.9992 | -8.1 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | - |
| 2026-05-09 09:00Z | USDC@Base | $0.9949 | -50.6 | -36.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-09 11:00Z | USDC@Base | $1.0016 | 15.7 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | 1 |
| 2026-05-09 14:00Z | USDe@Solana | $0.9932 | -67.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-05-09 15:00Z | USDT@Ethereum | $1.0054 | 54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-09 16:00Z | USDT@Ethereum | $0.9980 | -20.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-09 16:00Z | USDe@Solana | $0.9987 | -13.4 | - | - | resolved | 持续 2.0h 后解除（峰值 67.7 bps） | 0.9995 |
| 2026-05-10 00:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 01:00Z | USDG@Ethereum | $0.9992 | -8.1 | - | - | resolved | 持续 59.0h 后解除（峰值 106.5 bps） | - |
| 2026-05-10 01:00Z | USDT@Ethereum | $1.0023 | 22.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-05-10 04:00Z | USDG@Ethereum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 12:00Z | USD1@Ethereum | $0.9997 | -2.6 | - | - | resolved | 持续 94.0h 后解除（峰值 140.1 bps） | 0.9992 |
| 2026-05-10 12:00Z | USDG@Ethereum | $0.9971 | -28.8 | - | - | resolved | 持续 8.0h 后解除（峰值 52.7 bps） | - |
| 2026-05-10 16:00Z | PYUSD@Ethereum | $1.0067 | 67.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 17:00Z | USDG@Ethereum | $0.9942 | -58.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 18:00Z | PYUSD@Ethereum | $0.9993 | -6.8 | - | - | resolved | 持续 2.0h 后解除（峰值 146.3 bps） | - |
| 2026-05-10 20:00Z | PYUSD@Ethereum | $0.9914 | -85.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 21:00Z | USDe@Ethereum | $0.9895 | -105.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-05-10 21:00Z | USDe@Solana | $0.9829 | -170.9 | -144.6 | confirmed | new-severe | 首次触发即严重（双源确认） | 0.9998 |
| 2026-05-10 23:00Z | PYUSD@Ethereum | $0.9991 | -9.2 | - | - | resolved | 持续 3.0h 后解除（峰值 87.3 bps） | - |
| 2026-05-10 23:00Z | USDT@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-10 23:00Z | USDe@Ethereum | $1.0003 | 2.9 | - | - | resolved | 持续 2.0h 后解除（峰值 105.5 bps） | 0.9997 |
| 2026-05-11 00:00Z | PYUSD@Ethereum | $0.9877 | -122.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-11 00:00Z | USDD@BSC | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-11 01:00Z | USDT@Ethereum | $0.9971 | -29.2 | - | - | resolved | 持续 2.0h 后解除（峰值 51.6 bps） | - |
| 2026-05-11 05:00Z | USDT@Ethereum | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-11 06:00Z | PYUSD@Ethereum | $1.0006 | 6.1 | - | - | resolved | 持续 6.0h 后解除（峰值 122.6 bps） | - |
| 2026-05-11 07:00Z | USDC@Base | $0.9948 | -51.8 | -53.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-05-11 07:00Z | USDT@Ethereum | $1.0015 | 15.3 | - | - | resolved | 持续 2.0h 后解除（峰值 54.6 bps） | - |
| 2026-05-11 09:00Z | USDC@Base | $0.9983 | -16.9 | - | - | resolved | 持续 2.0h 后解除（峰值 51.8 bps） | 1.0001 |
| 2026-05-11 12:00Z | USD1@Ethereum | $0.9936 | -64 | -36.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9992 |
| 2026-05-11 13:00Z | PYUSD@Solana | $1.0183 | 183.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-11 14:00Z | PYUSD@Solana | $0.9976 | -23.7 | - | - | resolved | 持续 1.0h 后解除（峰值 183.4 bps） | - |
| 2026-05-11 16:00Z | USDe@Solana | $0.9981 | -19.4 | - | - | resolved | 持续 19.0h 后解除（峰值 170.9 bps） | 0.9999 |
| 2026-05-12 01:00Z | PYUSD@Ethereum | $0.9883 | -117.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-12 03:00Z | PYUSD@Ethereum | $0.9986 | -13.9 | - | - | resolved | 持续 2.0h 后解除（峰值 117.5 bps） | - |
| 2026-05-12 04:00Z | USDD@BSC | $1.0025 | 24.7 | - | - | resolved | 持续 28.0h 后解除（峰值 51.9 bps） | - |
| 2026-05-12 08:00Z | USDe@Solana | $0.9883 | -116.8 | -89.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-05-12 09:00Z | PYUSD@Ethereum | $0.9937 | -63.1 | -85.6 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-12 10:00Z | PYUSD@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 63.1 bps） | - |
| 2026-05-12 15:00Z | PYUSD@Ethereum | $0.9936 | -64.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-12 15:00Z | USDe@Solana | $0.9822 | -177.5 | -158.1 | confirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-05-12 16:00Z | PYUSD@Ethereum | $1.0006 | 5.6 | - | - | resolved | 持续 1.0h 后解除（峰值 64.4 bps） | - |
| 2026-05-12 23:00Z | USD1@Ethereum | $0.9833 | -167 | -37.9 | likely | escalated | 预警升级为严重 | 0.9994 |
| 2026-05-12 23:00Z | USDT@Ethereum | $0.9948 | -52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-13 00:00Z | USDT@Ethereum | $0.9981 | -18.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.2 bps） | - |
| 2026-05-13 01:00Z | PYUSD@Solana | $0.9548 | -451.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-13 01:00Z | USDe@Solana | $0.9989 | -10.9 | - | - | resolved | 持续 17.0h 后解除（峰值 177.5 bps） | 0.9997 |
| 2026-05-13 02:00Z | PYUSD@Solana | $0.9996 | -3.8 | - | - | resolved | 持续 1.0h 后解除（峰值 451.8 bps） | - |
| 2026-05-13 02:00Z | USD1@Ethereum | $0.9971 | -28.8 | - | - | resolved | 持续 38.0h 后解除（峰值 167.0 bps） | 0.9996 |
| 2026-05-13 03:00Z | USD1@Ethereum | $0.9889 | -111.4 | -33.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-05-13 05:00Z | USD1@Ethereum | $0.9990 | -10 | - | - | resolved | 持续 2.0h 后解除（峰值 111.4 bps） | 0.9998 |
| 2026-05-13 09:00Z | USD1@Ethereum | $0.9943 | -57.1 | -31 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-05-13 09:00Z | USDe@Solana | $1.0073 | 73.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-05-13 10:00Z | USDG@Ethereum | $0.9981 | -19.1 | - | - | resolved | 持续 65.0h 后解除（峰值 109.5 bps） | - |
| 2026-05-13 12:00Z | PYUSD@Ethereum | $0.9939 | -61.3 | -75.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-13 13:00Z | USDG@Ethereum | $0.9918 | -82.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-13 13:00Z | USDS@Ethereum | $0.9947 | -53.4 | -28.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-05-13 13:00Z | USDT@Ethereum | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-13 14:00Z | PYUSD@Ethereum | $1.0029 | 28.8 | - | - | resolved | 持续 2.0h 后解除（峰值 86.2 bps） | - |
| 2026-05-13 14:00Z | USDS@Ethereum | $0.9971 | -28.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.4 bps） | 1.0001 |
| 2026-05-13 14:00Z | USDT@Ethereum | $0.9971 | -28.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.4 bps） | - |
| 2026-05-13 14:00Z | USDe@Solana | $1.0020 | 20.1 | - | - | resolved | 持续 5.0h 后解除（峰值 73.1 bps） | 1 |
| 2026-05-13 15:00Z | PYUSD@Ethereum | $0.9940 | -59.9 | -76.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-13 15:00Z | USDG@Ethereum | $1.0006 | 6.5 | - | - | resolved | 持续 2.0h 后解除（峰值 93.1 bps） | - |
| 2026-05-13 16:00Z | PYUSD@Ethereum | $1.0002 | 1.7 | - | - | resolved | 持续 1.0h 后解除（峰值 59.9 bps） | - |
| 2026-05-13 17:00Z | USDG@Ethereum | $0.9905 | -95.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-13 20:00Z | USDT@Ethereum | $1.0053 | 53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-13 21:00Z | USDT@Ethereum | $0.9971 | -28.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-05-14 00:00Z | USDe@Solana | $1.0088 | 87.7 | 59.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-05-14 03:00Z | USDe@Solana | $0.9993 | -7.2 | - | - | resolved | 持续 3.0h 后解除（峰值 87.7 bps） | 1.0005 |
| 2026-05-14 04:00Z | USDe@Solana | $0.9944 | -56 | -25.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-05-14 10:00Z | USDe@Solana | $0.9992 | -7.7 | - | - | resolved | 持续 6.0h 后解除（峰值 128.0 bps） | 1.0006 |
| 2026-05-14 14:00Z | PYUSD@Ethereum | $1.0057 | 56.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-14 14:00Z | USDe@Solana | $1.0132 | 132 | 127.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-05-14 15:00Z | USDe@Solana | $1.0215 | 214.5 | 231.3 | confirmed | escalated | 预警升级为严重 | 1.0005 |
| 2026-05-14 16:00Z | PYUSD@Ethereum | $1.0004 | 4.3 | - | - | resolved | 持续 2.0h 后解除（峰值 56.5 bps） | - |
| 2026-05-14 18:00Z | USDe@Solana | $0.9979 | -20.7 | - | - | resolved | 持续 4.0h 后解除（峰值 227.9 bps） | 1.0005 |
| 2026-05-14 20:00Z | PYUSD@Ethereum | $0.9933 | -67 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-14 20:00Z | USDe@Solana | $0.9903 | -97.1 | -89.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-05-14 21:00Z | PYUSD@Ethereum | $0.9991 | -8.5 | - | - | resolved | 持续 1.0h 后解除（峰值 67.0 bps） | - |
| 2026-05-15 00:00Z | PYUSD@Solana | $1.0117 | 116.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 01:00Z | PYUSD@Solana | $0.9971 | -29 | - | - | resolved | 持续 1.0h 后解除（峰值 116.5 bps） | - |
| 2026-05-15 01:00Z | USDG@Ethereum | $0.9996 | -4.1 | - | - | resolved | 持续 32.0h 后解除（峰值 127.6 bps） | - |
| 2026-05-15 02:00Z | PYUSD@Solana | $1.0634 | 634.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-15 02:00Z | USDG@Ethereum | $0.9924 | -75.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 02:00Z | USDe@Solana | $0.9805 | -194.9 | -178.7 | confirmed | escalated | 预警升级为严重 | 1.0005 |
| 2026-05-15 03:00Z | PYUSD@Ethereum | $0.9937 | -62.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 03:00Z | PYUSD@Solana | $1.0000 | 0 | - | - | resolved | 持续 1.0h 后解除（峰值 634.3 bps） | - |
| 2026-05-15 04:00Z | USDS@Ethereum | $0.9945 | -54.9 | -32.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-15 04:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 05:00Z | PYUSD@Ethereum | $1.0002 | 1.7 | - | - | resolved | 持续 2.0h 后解除（峰值 84.3 bps） | - |
| 2026-05-15 05:00Z | USDS@Ethereum | $0.9982 | -17.7 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | 1 |
| 2026-05-15 05:00Z | USDT@Ethereum | $0.9982 | -17.7 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-05-15 07:00Z | PYUSD@Ethereum | $1.0098 | 98 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 09:00Z | PYUSD@Ethereum | $0.9992 | -7.8 | - | - | resolved | 持续 2.0h 后解除（峰值 98.0 bps） | - |
| 2026-05-15 12:00Z | USDe@Solana | $0.9992 | -8.3 | - | - | resolved | 持续 16.0h 后解除（峰值 315.7 bps） | 1.0005 |
| 2026-05-15 13:00Z | PYUSD@Ethereum | $0.9894 | -105.9 | -70.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-15 13:00Z | USDG@Ethereum | $1.0020 | 20.1 | - | - | resolved | 持续 11.0h 后解除（峰值 104.0 bps） | - |
| 2026-05-15 14:00Z | PYUSD@Ethereum | $1.0000 | 0 | - | - | resolved | 持续 1.0h 后解除（峰值 105.9 bps） | - |
| 2026-05-15 14:00Z | USDG@Ethereum | $0.9926 | -73.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 15:00Z | USDT@Ethereum | $1.0054 | 53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-15 15:00Z | USDe@Solana | $0.9855 | -145.3 | -152.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-05-15 16:00Z | USDe@Solana | $0.9841 | -159.5 | -137.7 | confirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-05-15 17:00Z | USDT@Ethereum | $0.9977 | -23 | - | - | resolved | 持续 2.0h 后解除（峰值 53.7 bps） | - |
| 2026-05-16 02:00Z | U@BSC | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 03:00Z | U@BSC | $1.0000 | -0.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-05-16 07:00Z | USDe@Solana | $0.9976 | -23.7 | - | - | resolved | 持续 16.0h 后解除（峰值 159.5 bps） | 1.0004 |
| 2026-05-16 09:00Z | PYUSD@Solana | $1.0054 | 54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 10:00Z | PYUSD@Ethereum | $0.9882 | -118.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 10:00Z | PYUSD@Solana | $0.9974 | -25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-16 11:00Z | PYUSD@Ethereum | $1.0001 | 1.5 | - | - | resolved | 持续 1.0h 后解除（峰值 118.3 bps） | - |
| 2026-05-16 15:00Z | USDe@Solana | $1.0059 | 59 | 29.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0004 |
| 2026-05-16 16:00Z | PYUSD@Solana | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 16:00Z | USDT@Ethereum | $0.9946 | -54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 17:00Z | PYUSD@Solana | $0.9978 | -22.1 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-05-16 17:00Z | USDT@Ethereum | $0.9988 | -11.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.5 bps） | - |
| 2026-05-16 18:00Z | USDS@Solana | $1.0094 | 94.1 | 95.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-05-16 19:00Z | USDS@Solana | $1.0013 | 13.4 | - | - | resolved | 持续 1.0h 后解除（峰值 94.1 bps） | 1.0001 |
| 2026-05-16 21:00Z | USDe@Solana | $1.0008 | 7.5 | - | - | resolved | 持续 6.0h 后解除（峰值 80.0 bps） | 1.0005 |
| 2026-05-16 22:00Z | USDS@Ethereum | $1.0050 | 50.1 | 42 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-16 22:00Z | USDT@Ethereum | $1.0050 | 50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-16 23:00Z | USDS@Ethereum | $0.9988 | -12.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | 1.0001 |
| 2026-05-16 23:00Z | USDT@Ethereum | $0.9988 | -12.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-05-17 03:00Z | USDS@Ethereum | $1.0052 | 52.3 | 31 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-17 03:00Z | USDT@Ethereum | $1.0052 | 52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-17 04:00Z | USDS@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | 1.0001 |
| 2026-05-17 04:00Z | USDT@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | - |
| 2026-05-17 05:00Z | USDe@Solana | $1.0078 | 78.1 | 72.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-05-17 10:00Z | USDe@Solana | $1.0022 | 21.9 | - | - | resolved | 持续 5.0h 后解除（峰值 78.1 bps） | 1.0006 |
| 2026-05-17 15:00Z | USDe@Solana | $0.9947 | -53.3 | -56.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-05-17 23:00Z | PYUSD@Ethereum | $0.9725 | -274.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-18 00:00Z | USDe@Solana | $0.9987 | -12.7 | - | - | resolved | 持续 9.0h 后解除（峰值 148.2 bps） | 1.0004 |
| 2026-05-18 02:00Z | PYUSD@Ethereum | $0.9972 | -27.6 | - | - | resolved | 持续 3.0h 后解除（峰值 274.9 bps） | - |
| 2026-05-18 11:00Z | USDe@Solana | $1.0083 | 83.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-05-18 13:00Z | USD1@Ethereum | $0.9820 | -179.9 | 36.1 | suspicious | escalated | 预警升级为严重 | 1.0005 |
| 2026-05-18 14:00Z | USDS@Ethereum | $1.0051 | 51.1 | 42.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-18 14:00Z | USDT@Ethereum | $1.0051 | 51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-18 14:00Z | USDe@Solana | $0.9999 | -1.2 | - | - | resolved | 持续 3.0h 后解除（峰值 83.4 bps） | 1.0005 |
| 2026-05-18 15:00Z | USDS@Ethereum | $0.9990 | -9.7 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | 1.0001 |
| 2026-05-18 15:00Z | USDT@Ethereum | $0.9990 | -9.7 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | - |
| 2026-05-18 18:00Z | USD1@Ethereum | $0.9971 | -29.3 | - | - | resolved | 持续 129.0h 后解除（峰值 179.9 bps） | 1.0004 |
| 2026-05-18 18:00Z | USDe@Solana | $0.9922 | -78.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-05-18 19:00Z | USDe@Solana | $0.9988 | -12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 78.2 bps） | 1.0004 |
| 2026-05-19 01:00Z | PYUSD@Ethereum | $0.9936 | -63.9 | -98.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-19 01:00Z | USD1@Ethereum | $0.9898 | -101.9 | -28.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-19 01:00Z | USDe@Solana | $0.9936 | -64 | -94.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-05-19 02:00Z | PYUSD@Ethereum | $0.9990 | -9.8 | - | - | resolved | 持续 1.0h 后解除（峰值 63.9 bps） | - |
| 2026-05-19 04:00Z | USDe@Solana | $1.0027 | 26.9 | - | - | resolved | 持续 3.0h 后解除（峰值 64.0 bps） | 1.0006 |
| 2026-05-19 09:00Z | PYUSD@Ethereum | $0.9942 | -57.6 | -86.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-19 09:00Z | USDe@Solana | $0.9938 | -62.2 | -58.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-05-19 10:00Z | PYUSD@Ethereum | $1.0013 | 13 | - | - | resolved | 持续 1.0h 后解除（峰值 57.6 bps） | - |
| 2026-05-19 10:00Z | USDe@Solana | $0.9997 | -3.3 | - | - | resolved | 持续 1.0h 后解除（峰值 62.2 bps） | 1.0005 |
| 2026-05-19 14:00Z | USDT@Ethereum | $1.0055 | 54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-19 14:00Z | USDe@Solana | $0.9887 | -113.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-05-19 15:00Z | USDT@Ethereum | $0.9979 | -21 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | - |
| 2026-05-19 16:00Z | USD1@Ethereum | $0.9994 | -5.8 | - | - | resolved | 持续 15.0h 后解除（峰值 101.9 bps） | 1.0003 |
| 2026-05-19 16:00Z | USDe@Solana | $1.0011 | 11 | - | - | resolved | 持续 2.0h 后解除（峰值 113.1 bps） | 1.0005 |
| 2026-05-19 17:00Z | PYUSD@Ethereum | $1.0063 | 63.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-19 18:00Z | PYUSD@Ethereum | $1.0008 | 8.3 | - | - | resolved | 持续 1.0h 后解除（峰值 63.2 bps） | - |
| 2026-05-20 05:00Z | PYUSD@Ethereum | $1.0073 | 73.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-20 06:00Z | USDT@Ethereum | $1.0055 | 55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-20 06:00Z | USDe@Solana | $1.0070 | 70.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-05-20 07:00Z | PYUSD@Ethereum | $1.0005 | 5.1 | - | - | resolved | 持续 2.0h 后解除（峰值 73.1 bps） | - |
| 2026-05-20 08:00Z | USDT@Ethereum | $0.9971 | -28.6 | - | - | resolved | 持续 2.0h 后解除（峰值 55.2 bps） | - |
| 2026-05-20 10:00Z | USDe@Solana | $0.9986 | -13.6 | - | - | resolved | 持续 4.0h 后解除（峰值 70.4 bps） | 1.0006 |
| 2026-05-20 13:00Z | PYUSD@Ethereum | $0.9944 | -56.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-20 14:00Z | USDe@Solana | $1.0097 | 96.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-05-20 15:00Z | PYUSD@Ethereum | $1.0002 | 2.4 | - | - | resolved | 持续 2.0h 后解除（峰值 95.6 bps） | - |
| 2026-05-20 15:00Z | USDG@Ethereum | $1.0017 | 17.4 | - | - | resolved | 持续 121.0h 后解除（峰值 135.1 bps） | - |
| 2026-05-20 16:00Z | USDe@Solana | $0.9977 | -22.5 | - | - | resolved | 持续 2.0h 后解除（峰值 96.5 bps） | 1.0006 |
| 2026-05-20 17:00Z | USDG@Ethereum | $0.9912 | -88.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-20 18:00Z | USDS@Ethereum | $0.9945 | -55.4 | -26.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-05-20 18:00Z | USDT@Ethereum | $0.9945 | -55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-20 19:00Z | USDS@Ethereum | $0.9985 | -15.4 | - | - | resolved | 持续 1.0h 后解除（峰值 55.4 bps） | 1.0005 |
| 2026-05-20 19:00Z | USDT@Ethereum | $0.9985 | -15.4 | - | - | resolved | 持续 1.0h 后解除（峰值 55.4 bps） | - |
| 2026-05-21 01:00Z | USDT@Ethereum | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 03:00Z | USDT@Ethereum | $1.0027 | 27.2 | - | - | resolved | 持续 2.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-21 05:00Z | USDT@Ethereum | $0.9950 | -50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 07:00Z | USDD@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 07:00Z | USDG@Ethereum | $1.0006 | 6.4 | - | - | resolved | 持续 14.0h 后解除（峰值 88.2 bps） | - |
| 2026-05-21 07:00Z | USDT@Ethereum | $0.9981 | -19.3 | - | - | resolved | 持续 2.0h 后解除（峰值 50.0 bps） | - |
| 2026-05-21 09:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 10:00Z | PYUSD@Ethereum | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 10:00Z | USDG@Ethereum | $0.9946 | -54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 12:00Z | PYUSD@Ethereum | $0.9997 | -3.1 | - | - | resolved | 持续 2.0h 后解除（峰值 55.3 bps） | - |
| 2026-05-21 12:00Z | USDT@Ethereum | $0.9973 | -27.5 | - | - | resolved | 持续 3.0h 后解除（峰值 54.9 bps） | - |
| 2026-05-21 13:00Z | USDG@Ethereum | $1.0000 | 0.4 | - | - | resolved | 持续 3.0h 后解除（峰值 69.6 bps） | - |
| 2026-05-21 14:00Z | USDG@Ethereum | $0.9935 | -65.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 17:00Z | USDG@Ethereum | $1.0004 | 4.1 | - | - | resolved | 持续 3.0h 后解除（峰值 77.2 bps） | - |
| 2026-05-21 17:00Z | USDe@Solana | $1.0095 | 94.8 | 104.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-05-21 18:00Z | USDG@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-21 19:00Z | USDD@Ethereum | $0.9992 | -8.5 | - | - | resolved | 持续 12.0h 后解除（峰值 53.9 bps） | - |
| 2026-05-21 20:00Z | USDe@Solana | $0.9994 | -6.4 | - | - | resolved | 持续 3.0h 后解除（峰值 94.8 bps） | 0.9999 |
| 2026-05-21 22:00Z | USDD@Ethereum | $0.9949 | -51.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 05:00Z | USDS@Ethereum | $0.9946 | -54 | -26.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-05-22 05:00Z | USDT@Ethereum | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 06:00Z | USDS@Ethereum | $1.0005 | 5.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.0 bps） | 1.0008 |
| 2026-05-22 06:00Z | USDT@Ethereum | $1.0005 | 5.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.0 bps） | - |
| 2026-05-22 08:00Z | USDe@Solana | $0.9944 | -55.9 | -34.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-22 11:00Z | USDe@Solana | $0.9985 | -14.5 | - | - | resolved | 持续 3.0h 后解除（峰值 55.9 bps） | 1.0001 |
| 2026-05-22 13:00Z | USDe@Solana | $0.9923 | -77.4 | -44.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-05-22 14:00Z | USDG@Ethereum | $0.9994 | -5.5 | - | - | resolved | 持续 20.0h 后解除（峰值 70.6 bps） | - |
| 2026-05-22 15:00Z | USDD@BSC | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 15:00Z | USDe@Solana | $0.9993 | -6.9 | - | - | resolved | 持续 2.0h 后解除（峰值 77.4 bps） | 1.0002 |
| 2026-05-22 16:00Z | USDG@Ethereum | $0.9927 | -72.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 17:00Z | USDG@Ethereum | $0.9983 | -17.3 | - | - | resolved | 持续 1.0h 后解除（峰值 72.8 bps） | - |
| 2026-05-22 18:00Z | USDG@Ethereum | $0.9931 | -68.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 18:00Z | USDe@Solana | $0.9888 | -112.2 | -63.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-05-22 19:00Z | PYUSD@Ethereum | $0.9809 | -191.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-22 20:00Z | USDe@Solana | $0.9991 | -8.7 | - | - | resolved | 持续 2.0h 后解除（峰值 112.2 bps） | 1.0001 |
| 2026-05-22 21:00Z | PYUSD@Ethereum | $1.0022 | 22.3 | - | - | resolved | 持续 2.0h 后解除（峰值 191.4 bps） | - |
| 2026-05-22 21:00Z | USDT@Ethereum | $1.0055 | 54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-22 23:00Z | USDT@Ethereum | $0.9973 | -27.4 | - | - | resolved | 持续 2.0h 后解除（峰值 54.5 bps） | - |
| 2026-05-22 23:00Z | USDe@Solana | $0.9907 | -93 | -75.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-05-23 01:00Z | USDT@Ethereum | $1.0055 | 54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 02:00Z | USDT@Ethereum | $0.9989 | -11.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-05-23 03:00Z | USDD@BSC | $1.0027 | 27.4 | - | - | resolved | 持续 12.0h 后解除（峰值 50.7 bps） | - |
| 2026-05-23 04:00Z | USDe@Solana | $0.9978 | -21.8 | - | - | resolved | 持续 5.0h 后解除（峰值 95.1 bps） | 1.0003 |
| 2026-05-23 08:00Z | USD1@Ethereum | $0.9884 | -115.8 | -26.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-05-23 08:00Z | USDe@Solana | $0.9933 | -66.8 | -42.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-23 10:00Z | USDT@Ethereum | $1.0050 | 50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 10:00Z | USDe@Solana | $0.9985 | -14.8 | - | - | resolved | 持续 2.0h 后解除（峰值 66.8 bps） | 1.0002 |
| 2026-05-23 13:00Z | USDT@Ethereum | $0.9993 | -7.1 | - | - | resolved | 持续 3.0h 后解除（峰值 50.1 bps） | - |
| 2026-05-23 14:00Z | U@BSC | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 15:00Z | U@BSC | $1.0016 | 15.9 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-05-23 16:00Z | U@BSC | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 16:00Z | USDD@BSC | $0.9942 | -58.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 17:00Z | U@BSC | $0.9988 | -12 | - | - | resolved | 持续 1.0h 后解除（峰值 52.5 bps） | - |
| 2026-05-23 20:00Z | PYUSD@Ethereum | $1.0355 | 355.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-05-23 20:00Z | USDS@Ethereum | $1.0052 | 52.4 | 34.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-05-23 20:00Z | USDT@Ethereum | $1.0052 | 52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-23 20:00Z | USDe@Solana | $1.0232 | 231.5 | 232.5 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0003 |
| 2026-05-23 21:00Z | USDG@Ethereum | $0.9994 | -6.2 | - | - | resolved | 持续 27.0h 后解除（峰值 117.8 bps） | - |
| 2026-05-23 22:00Z | PYUSD@Ethereum | $1.0029 | 29.4 | - | - | resolved | 持续 2.0h 后解除（峰值 355.3 bps） | - |
| 2026-05-23 22:00Z | USD1@Ethereum | $0.9985 | -15 | - | - | resolved | 持续 14.0h 后解除（峰值 119.8 bps） | 1.0003 |
| 2026-05-23 23:00Z | USDS@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 3.0h 后解除（峰值 54.2 bps） | 1.001 |
| 2026-05-23 23:00Z | USDT@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 3.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-24 01:00Z | USDe@Solana | $1.0004 | 4.2 | - | - | resolved | 持续 5.0h 后解除（峰值 231.5 bps） | 1.0005 |
| 2026-05-24 03:00Z | USDD@BSC | $1.0018 | 17.6 | - | - | resolved | 持续 11.0h 后解除（峰值 58.2 bps） | - |
| 2026-05-24 05:00Z | USD1@Ethereum | $0.9937 | -62.6 | -27.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-24 12:00Z | USDe@Solana | $0.9946 | -53.8 | -38.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-24 13:00Z | USDe@Solana | $0.9981 | -19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | 1.0001 |
| 2026-05-24 15:00Z | USDG@Ethereum | $0.9920 | -79.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-24 17:00Z | USDD@BSC | $0.9934 | -66.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-24 17:00Z | USDT@Arbitrum | $0.9928 | -71.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-24 18:00Z | USDT@Arbitrum | $0.9983 | -16.7 | - | - | resolved | 持续 1.0h 后解除（峰值 71.5 bps） | - |
| 2026-05-24 19:00Z | USDe@Solana | $0.9900 | -100.5 | -74.6 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-05-24 21:00Z | PYUSD@Ethereum | $0.9922 | -77.7 | -76.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-05-24 21:00Z | USDe@Solana | $0.9763 | -237.3 | -223.4 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-05-24 23:00Z | PYUSD@Ethereum | $1.0029 | 29.3 | - | - | resolved | 持续 2.0h 后解除（峰值 116.7 bps） | - |
| 2026-05-24 23:00Z | USDD@BSC | $1.0014 | 13.9 | - | - | resolved | 持续 6.0h 后解除（峰值 66.2 bps） | - |
| 2026-05-24 23:00Z | USDG@Ethereum | $0.9999 | -0.8 | - | - | resolved | 持续 8.0h 后解除（峰值 79.9 bps） | - |
| 2026-05-25 04:00Z | PYUSD@Ethereum | $1.0070 | 70.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-25 05:00Z | PYUSD@Ethereum | $1.0013 | 13.2 | - | - | resolved | 持续 1.0h 后解除（峰值 70.2 bps） | - |
| 2026-05-25 07:00Z | PYUSD@Ethereum | $1.0051 | 50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-25 08:00Z | USDD@Ethereum | $0.9991 | -9.2 | - | - | resolved | 持续 82.0h 后解除（峰值 51.2 bps） | - |
| 2026-05-25 08:00Z | USDe@Solana | $0.9979 | -21.2 | - | - | resolved | 持续 13.0h 后解除（峰值 237.3 bps） | 1.0001 |
| 2026-05-25 09:00Z | PYUSD@Ethereum | $1.0021 | 21 | - | - | resolved | 持续 2.0h 后解除（峰值 65.8 bps） | - |
| 2026-05-25 11:00Z | USDD@BSC | $0.9937 | -62.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-25 14:00Z | USD1@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 33.0h 后解除（峰值 84.8 bps） | 0.9997 |
| 2026-05-25 15:00Z | USDe@Solana | $0.9941 | -59 | -41.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-05-25 16:00Z | USDD@BSC | $0.9994 | -6.3 | - | - | resolved | 持续 5.0h 后解除（峰值 62.8 bps） | - |
| 2026-05-25 16:00Z | USDG@Ethereum | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-25 18:00Z | USDS@Ethereum | $0.9945 | -54.7 | -26.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-05-25 18:00Z | USDT@Ethereum | $0.9945 | -54.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-25 19:00Z | USDS@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.7 bps） | 1.0007 |
| 2026-05-25 19:00Z | USDT@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.7 bps） | - |
| 2026-05-25 22:00Z | USDG@Ethereum | $0.9976 | -23.5 | - | - | resolved | 持续 6.0h 后解除（峰值 50.8 bps） | - |
| 2026-05-26 00:00Z | USDe@Solana | $0.9813 | -187.3 | -122.1 | confirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-05-26 01:00Z | USDD@BSC | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-26 01:00Z | USDG@Ethereum | $0.9925 | -75 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-26 07:00Z | USD1@Ethereum | $0.9908 | -92.2 | -34.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-05-26 09:00Z | USDe@Solana | $0.9971 | -28.6 | - | - | resolved | 持续 18.0h 后解除（峰值 232.6 bps） | 1 |
| 2026-05-26 14:00Z | USDe@Solana | $1.0127 | 127.4 | 91.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-05-26 16:00Z | USDD@Ethereum | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-26 18:00Z | USDe@Solana | $0.9996 | -4.4 | - | - | resolved | 持续 4.0h 后解除（峰值 137.4 bps） | 1.0001 |
| 2026-05-26 19:00Z | USDG@Ethereum | $0.9982 | -17.6 | - | - | resolved | 持续 18.0h 后解除（峰值 88.9 bps） | - |
| 2026-05-26 20:00Z | USDD@Ethereum | $0.9983 | -16.9 | - | - | resolved | 持续 4.0h 后解除（峰值 53.4 bps） | - |
| 2026-05-26 20:00Z | USDG@Ethereum | $0.9906 | -93.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-26 20:00Z | USDT@Ethereum | $1.0054 | 54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-26 21:00Z | USDS@Ethereum | $1.0051 | 50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-05-27 00:00Z | U@BSC | $0.9941 | -59.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 00:00Z | USDS@Ethereum | $0.9995 | -5.3 | - | - | resolved | 持续 3.0h 后解除（峰值 50.9 bps） | 1.001 |
| 2026-05-27 00:00Z | USDT@Ethereum | $0.9995 | -5.3 | - | - | resolved | 持续 4.0h 后解除（峰值 54.2 bps） | - |
| 2026-05-27 00:00Z | USDT@BSC | $0.9938 | -62.4 | -34.7 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-05-27 01:00Z | U@BSC | $1.0011 | 11.3 | - | - | resolved | 持续 1.0h 后解除（峰值 59.3 bps） | - |
| 2026-05-27 01:00Z | USDG@Ethereum | $0.9983 | -17.3 | - | - | resolved | 持续 5.0h 后解除（峰值 93.5 bps） | - |
| 2026-05-27 03:00Z | USDG@Ethereum | $0.9926 | -73.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 03:00Z | USDT@BSC | $0.9996 | -4.1 | - | - | resolved | 持续 3.0h 后解除（峰值 62.4 bps） | - |
| 2026-05-27 08:00Z | PYUSD@Ethereum | $1.0082 | 82.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 09:00Z | PYUSD@Ethereum | $1.0028 | 28.3 | - | - | resolved | 持续 1.0h 后解除（峰值 82.1 bps） | - |
| 2026-05-27 12:00Z | USDG@Ethereum | $1.0003 | 3 | - | - | resolved | 持续 9.0h 后解除（峰值 103.8 bps） | - |
| 2026-05-27 12:00Z | USDT@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 13:00Z | USDG@Ethereum | $0.9930 | -70.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 13:00Z | USDe@Solana | $0.9918 | -81.8 | -45.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-05-27 16:00Z | USDT@Ethereum | $1.0006 | 6.4 | - | - | resolved | 持续 4.0h 后解除（峰值 50.6 bps） | - |
| 2026-05-27 17:00Z | USDG@Ethereum | $0.9997 | -2.6 | - | - | resolved | 持续 4.0h 后解除（峰值 76.3 bps） | - |
| 2026-05-27 18:00Z | USDG@Ethereum | $0.9931 | -68.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-27 21:00Z | USDT@BSC | $0.9948 | -51.7 | -26 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-05-27 21:00Z | USDe@Solana | $0.9809 | -191 | -144.6 | confirmed | escalated | 预警升级为严重 | 1.0003 |
| 2026-05-27 22:00Z | USDT@BSC | $1.0002 | 2.1 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | - |
| 2026-05-28 04:00Z | U@BSC | $0.9898 | -102.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-28 06:00Z | U@BSC | $1.0020 | 19.7 | - | - | resolved | 持续 2.0h 后解除（峰值 102.3 bps） | - |
| 2026-05-28 06:00Z | USDT@Ethereum | $1.0053 | 53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-28 07:00Z | USDG@Ethereum | $1.0027 | 26.8 | - | - | resolved | 持续 13.0h 后解除（峰值 96.8 bps） | - |
| 2026-05-28 07:00Z | USDT@Ethereum | $0.9991 | -8.8 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-05-28 08:00Z | USDG@Ethereum | $0.9893 | -107 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-28 14:00Z | USDD@BSC | $1.0004 | 3.6 | - | - | resolved | 持续 61.0h 后解除（峰值 62.4 bps） | - |
| 2026-05-28 15:00Z | PYUSD@Ethereum | $1.0060 | 60.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-28 16:00Z | PYUSD@Ethereum | $1.0027 | 27.3 | - | - | resolved | 持续 1.0h 后解除（峰值 60.4 bps） | - |
| 2026-05-28 16:00Z | USDe@Solana | $1.0006 | 5.7 | - | - | resolved | 持续 27.0h 后解除（峰值 456.9 bps） | 1.0003 |
| 2026-05-28 19:00Z | USDe@Solana | $1.0142 | 141.5 | 150.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-05-28 21:00Z | USDe@Solana | $0.9975 | -24.6 | - | - | resolved | 持续 2.0h 后解除（峰值 141.5 bps） | 1.0004 |
| 2026-05-28 22:00Z | USDT@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-28 22:00Z | USDe@Solana | $0.9900 | -100 | -69.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-05-29 00:00Z | USDT@Ethereum | $0.9975 | -25.2 | - | - | resolved | 持续 2.0h 后解除（峰值 53.0 bps） | - |
| 2026-05-29 01:00Z | USDG@Ethereum | $0.9982 | -17.9 | - | - | resolved | 持续 17.0h 后解除（峰值 119.1 bps） | - |
| 2026-05-29 02:00Z | USDG@Ethereum | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-29 06:00Z | USDD@Ethereum | $1.0061 | 61.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-29 09:00Z | PYUSD@Solana | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-29 09:00Z | USDe@Solana | $0.9976 | -23.7 | - | - | resolved | 持续 11.0h 后解除（峰值 123.6 bps） | 1.0001 |
| 2026-05-29 10:00Z | PYUSD@Solana | $1.0004 | 3.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-05-29 10:00Z | USDe@Solana | $0.9946 | -53.7 | -62.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-05-29 11:00Z | USDD@BSC | $0.9941 | -59.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-29 11:00Z | USDS@Solana | $1.0054 | 54 | 49.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0018 |
| 2026-05-29 12:00Z | USDG@Solana | $1.0110 | 109.6 | 31.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-05-29 13:00Z | USDS@Solana | $0.9974 | -25.8 | - | - | resolved | 持续 2.0h 后解除（峰值 54.0 bps） | 1.0015 |
| 2026-05-29 13:00Z | USDe@Solana | $0.9829 | -171.5 | -136.2 | confirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-05-29 14:00Z | USDG@Solana | $1.0007 | 6.9 | - | - | resolved | 持续 2.0h 后解除（峰值 109.6 bps） | - |
| 2026-05-29 15:00Z | USDD@Ethereum | $0.9997 | -2.5 | - | - | resolved | 持续 9.0h 后解除（峰值 61.3 bps） | - |
| 2026-05-29 16:00Z | USDG@Ethereum | $1.0014 | 14.2 | - | - | resolved | 持续 14.0h 后解除（峰值 77.4 bps） | - |
| 2026-05-29 16:00Z | USDe@Solana | $1.0001 | 0.6 | - | - | resolved | 持续 6.0h 后解除（峰值 235.4 bps） | 1.0002 |
| 2026-05-29 17:00Z | USDG@Ethereum | $0.9906 | -93.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-29 19:00Z | USDD@BSC | $0.9970 | -29.7 | - | - | resolved | 持续 8.0h 后解除（峰值 59.3 bps） | - |
| 2026-05-29 21:00Z | USD1@Ethereum | $1.0305 | 304.9 | -34.8 | suspicious | escalated | 预警升级为严重 | 0.9995 |
| 2026-05-29 22:00Z | USDe@Solana | $0.9889 | -111 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-05-30 04:00Z | PYUSD@Ethereum | $0.9922 | -78.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-30 07:00Z | PYUSD@Ethereum | $1.0022 | 21.5 | - | - | resolved | 持续 3.0h 后解除（峰值 78.2 bps） | - |
| 2026-05-30 20:00Z | USDe@Solana | $1.0024 | 24.3 | - | - | resolved | 持续 22.0h 后解除（峰值 111.0 bps） | 1.0004 |
| 2026-05-30 22:00Z | USDS@Ethereum | $0.9949 | -51.4 | -31.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0011 |
| 2026-05-30 22:00Z | USDT@Ethereum | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-30 23:00Z | USDD@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-30 23:00Z | USDS@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | 1.001 |
| 2026-05-30 23:00Z | USDT@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-05-31 01:00Z | USDD@Ethereum | $0.9981 | -19.4 | - | - | resolved | 持续 2.0h 后解除（峰值 55.1 bps） | - |
| 2026-05-31 07:00Z | USDD@Ethereum | $0.9943 | -57.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-31 07:00Z | USDS@Ethereum | $0.9947 | -53.2 | -28.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-05-31 07:00Z | USDT@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-05-31 09:00Z | USDT@Solana | $0.9949 | -51.2 | -32.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-05-31 10:00Z | USDD@Ethereum | $1.0003 | 2.6 | - | - | resolved | 持续 3.0h 后解除（峰值 57.1 bps） | - |
| 2026-05-31 10:00Z | USDT@Solana | $0.9971 | -29.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.2 bps） | - |
| 2026-05-31 11:00Z | USDS@Ethereum | $0.9976 | -23.8 | - | - | resolved | 持续 4.0h 后解除（峰值 53.2 bps） | 1.0011 |
| 2026-05-31 11:00Z | USDT@Ethereum | $0.9976 | -23.8 | - | - | resolved | 持续 4.0h 后解除（峰值 53.2 bps） | - |
| 2026-05-31 16:00Z | USDe@Solana | $0.9848 | -151.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0002 |
| 2026-05-31 23:00Z | USDT@Arbitrum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 00:00Z | USDT@Arbitrum | $0.9992 | -7.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | - |
| 2026-06-01 01:00Z | USDS@Ethereum | $0.9948 | -52.3 | -25.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-06-01 01:00Z | USDT@Ethereum | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 02:00Z | USDS@Ethereum | $0.9976 | -23.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | 1.001 |
| 2026-06-01 02:00Z | USDT@Ethereum | $0.9976 | -23.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | - |
| 2026-06-01 03:00Z | USDD@BSC | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 08:00Z | USD1@Ethereum | $0.9991 | -8.7 | - | - | resolved | 持续 145.0h 后解除（峰值 513.5 bps） | 0.9994 |
| 2026-06-01 08:00Z | USDS@Ethereum | $1.0055 | 55.4 | 37.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-06-01 08:00Z | USDT@Ethereum | $1.0055 | 55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 09:00Z | U@BSC | $1.0053 | 52.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 09:00Z | USDS@Ethereum | $0.9987 | -13.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.4 bps） | 1.0009 |
| 2026-06-01 09:00Z | USDT@Ethereum | $0.9987 | -13.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.4 bps） | - |
| 2026-06-01 10:00Z | U@BSC | $0.9986 | -13.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.9 bps） | - |
| 2026-06-01 12:00Z | PYUSD@Ethereum | $1.0054 | 53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 13:00Z | USD1@BSC | $0.9944 | -55.6 | -52.8 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-06-01 13:00Z | USDT@BSC | $0.9947 | -52.9 | -52.7 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-01 14:00Z | PYUSD@Ethereum | $1.0002 | 2.1 | - | - | resolved | 持续 2.0h 后解除（峰值 63.5 bps） | - |
| 2026-06-01 14:00Z | USDT@Ethereum | $0.9949 | -51.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 15:00Z | USD1@BSC | $1.0000 | 0.4 | - | - | resolved | 持续 2.0h 后解除（峰值 55.6 bps） | 0.9997 |
| 2026-06-01 15:00Z | USDG@Ethereum | $1.0001 | 0.6 | - | - | resolved | 持续 70.0h 后解除（峰值 137.0 bps） | - |
| 2026-06-01 15:00Z | USDT@BSC | $1.0001 | 1.4 | - | - | resolved | 持续 2.0h 后解除（峰值 53.4 bps） | - |
| 2026-06-01 16:00Z | USDG@Ethereum | $0.9913 | -86.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-01 16:00Z | USDT@Ethereum | $0.9993 | -7 | - | - | resolved | 持续 2.0h 后解除（峰值 51.2 bps） | - |
| 2026-06-01 18:00Z | USDD@BSC | $0.9999 | -1.4 | - | - | resolved | 持续 15.0h 后解除（峰值 51.9 bps） | - |
| 2026-06-01 20:00Z | USDG@Ethereum | $0.9827 | -173.4 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-06-02 03:00Z | USDT@Ethereum | $1.0054 | 54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-02 06:00Z | PYUSD@Solana | $1.0076 | 76.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-02 06:00Z | USDT@Ethereum | $1.0005 | 4.6 | - | - | resolved | 持续 3.0h 后解除（峰值 54.3 bps） | - |
| 2026-06-02 08:00Z | PYUSD@Solana | $1.0009 | 8.5 | - | - | resolved | 持续 2.0h 后解除（峰值 95.4 bps） | - |
| 2026-06-02 08:00Z | USDT@Ethereum | $0.9949 | -51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-02 10:00Z | USDT@Ethereum | $0.9979 | -20.5 | - | - | resolved | 持续 2.0h 后解除（峰值 51.1 bps） | - |
| 2026-06-02 15:00Z | USDC@Base | $1.0059 | 59.2 | 39.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0012 |
| 2026-06-02 16:00Z | USDC@Base | $1.0016 | 16.4 | - | - | resolved | 持续 1.0h 后解除（峰值 59.2 bps） | 1.0012 |
| 2026-06-02 19:00Z | USD1@Ethereum | $0.9883 | -116.8 | -30.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-06-02 22:00Z | USDS@Ethereum | $0.9945 | -54.9 | -57.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-06-02 22:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-02 23:00Z | USDS@Ethereum | $0.9994 | -6 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | 1.0008 |
| 2026-06-02 23:00Z | USDT@Ethereum | $0.9994 | -6 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-06-03 03:00Z | USDG@Ethereum | $0.9996 | -3.6 | - | - | resolved | 持续 35.0h 后解除（峰值 173.4 bps） | - |
| 2026-06-03 04:00Z | USDG@Ethereum | $0.9890 | -110 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 05:00Z | PYUSD@Ethereum | $1.0144 | 144.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 06:00Z | PYUSD@Ethereum | $1.0021 | 20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 144.4 bps） | - |
| 2026-06-03 06:00Z | USDG@Ethereum | $0.9837 | -163.2 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-06-03 08:00Z | USD1@Ethereum | $0.9814 | -186 | -34.8 | likely | escalated | 预警升级为严重 | 0.9996 |
| 2026-06-03 09:00Z | USDD@BSC | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 09:00Z | USDe@Solana | $0.9996 | -4.5 | - | - | resolved | 持续 65.0h 后解除（峰值 793.7 bps） | 1 |
| 2026-06-03 11:00Z | USDD@BSC | $0.9988 | -12.3 | - | - | resolved | 持续 2.0h 后解除（峰值 55.2 bps） | - |
| 2026-06-03 12:00Z | USDD@BSC | $0.9944 | -56.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 13:00Z | USDe@Solana | $0.9911 | -89.3 | -79 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-06-03 15:00Z | USDe@Solana | $0.9763 | -236.8 | -186.3 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-03 17:00Z | PYUSD@Ethereum | $1.0072 | 72.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 18:00Z | USDT@Ethereum | $1.0051 | 51.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 19:00Z | USDT@Ethereum | $0.9977 | -23.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.2 bps） | - |
| 2026-06-03 21:00Z | PYUSD@Ethereum | $1.0153 | 152.8 | -143.8 | suspicious | escalated | 预警升级为严重 | - |
| 2026-06-03 21:00Z | USDT@Arbitrum | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-03 21:00Z | USDe@Solana | $0.9983 | -16.6 | - | - | resolved | 持续 8.0h 后解除（峰值 393.4 bps） | 0.9999 |
| 2026-06-03 22:00Z | PYUSD@Ethereum | $1.0007 | 7 | - | - | resolved | 持续 5.0h 后解除（峰值 152.8 bps） | - |
| 2026-06-03 22:00Z | USDT@Arbitrum | $0.9993 | -6.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-06-03 23:00Z | USDe@Solana | $0.9908 | -92.2 | -86.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-06-04 00:00Z | USDD@BSC | $1.0004 | 4.3 | - | - | resolved | 持续 12.0h 后解除（峰值 56.3 bps） | - |
| 2026-06-04 00:00Z | USDe@Solana | $0.9765 | -235.1 | -255.5 | confirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-06-04 02:00Z | USDT@Ethereum | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 03:00Z | USDT@Ethereum | $0.9980 | -20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-06-04 05:00Z | PYUSD@Ethereum | $0.9885 | -114.7 | -181.5 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-04 05:00Z | USDT@Ethereum | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 05:00Z | USDe@Solana | $1.0001 | 1 | - | - | resolved | 持续 6.0h 后解除（峰值 523.7 bps） | 0.9999 |
| 2026-06-04 06:00Z | PYUSD@Ethereum | $1.0027 | 27 | - | - | resolved | 持续 1.0h 后解除（峰值 114.7 bps） | - |
| 2026-06-04 06:00Z | USDD@BSC | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 07:00Z | USDe@Solana | $0.9913 | -87.1 | -120 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-06-04 08:00Z | USDD@BSC | $1.0024 | 23.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.6 bps） | - |
| 2026-06-04 08:00Z | USDT@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 3.0h 后解除（峰值 51.6 bps） | - |
| 2026-06-04 08:00Z | USDe@Solana | $0.9790 | -210.1 | -242.7 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-04 09:00Z | PYUSD@Ethereum | $0.9928 | -71.5 | -124.7 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-04 10:00Z | PYUSD@Ethereum | $1.0005 | 5.3 | - | - | resolved | 持续 1.0h 后解除（峰值 71.5 bps） | - |
| 2026-06-04 13:00Z | U@BSC | $0.9937 | -62.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 13:00Z | USDe@Solana | $1.0021 | 20.5 | - | - | resolved | 持续 6.0h 后解除（峰值 210.1 bps） | 0.9997 |
| 2026-06-04 14:00Z | U@BSC | $0.9971 | -29.4 | - | - | resolved | 持续 1.0h 后解除（峰值 62.8 bps） | - |
| 2026-06-04 14:00Z | USDe@Solana | $0.9939 | -60.5 | -62.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-06-04 15:00Z | USDe@Solana | $0.9975 | -25.3 | - | - | resolved | 持续 1.0h 后解除（峰值 60.5 bps） | 0.9997 |
| 2026-06-04 17:00Z | USDD@BSC | $0.9942 | -58.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 20:00Z | USDe@Solana | $0.9907 | -92.9 | -64.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-06-04 21:00Z | USDe@Solana | $0.9806 | -193.8 | -237.9 | confirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-06-04 23:00Z | U@BSC | $0.9934 | -65.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-04 23:00Z | USDD@BSC | $0.9979 | -21 | - | - | resolved | 持续 6.0h 后解除（峰值 58.4 bps） | - |
| 2026-06-05 02:00Z | USDG@Ethereum | $0.9979 | -21.5 | - | - | resolved | 持续 46.0h 后解除（峰值 236.4 bps） | - |
| 2026-06-05 03:00Z | USDG@Ethereum | $0.9938 | -62.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-05 03:00Z | USDS@Ethereum | $0.9945 | -55.1 | -27.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-06-05 03:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-05 04:00Z | U@BSC | $1.0014 | 13.8 | - | - | resolved | 持续 5.0h 后解除（峰值 65.9 bps） | - |
| 2026-06-05 04:00Z | USDS@Ethereum | $0.9998 | -2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | 1.0007 |
| 2026-06-05 04:00Z | USDT@Ethereum | $0.9998 | -2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | - |
| 2026-06-05 06:00Z | PYUSD@Ethereum | $0.9898 | -101.6 | -50.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-05 07:00Z | USDG@Ethereum | $0.9835 | -164.6 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-06-05 08:00Z | PYUSD@Ethereum | $0.9990 | -10.2 | - | - | resolved | 持续 2.0h 后解除（峰值 101.6 bps） | - |
| 2026-06-05 11:00Z | PYUSD@Ethereum | $0.9904 | -95.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-05 11:00Z | USDe@Solana | $0.9996 | -3.6 | - | - | resolved | 持续 15.0h 后解除（峰值 580.4 bps） | 1 |
| 2026-06-05 12:00Z | PYUSD@Ethereum | $1.0025 | 25.2 | - | - | resolved | 持续 1.0h 后解除（峰值 95.6 bps） | - |
| 2026-06-05 13:00Z | PYUSD@Ethereum | $0.9750 | -250.2 | -140.5 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-06-05 13:00Z | USDe@Solana | $0.9918 | -82.3 | -106.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-05 17:00Z | PYUSD@Ethereum | $1.0026 | 25.7 | - | - | resolved | 持续 4.0h 后解除（峰值 250.2 bps） | - |
| 2026-06-05 17:00Z | USDe@Solana | $1.0007 | 6.9 | - | - | resolved | 持续 4.0h 后解除（峰值 144.9 bps） | 1.0001 |
| 2026-06-05 18:00Z | U@BSC | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-05 18:00Z | USDT@Arbitrum | $0.9938 | -61.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-05 18:00Z | USDe@Solana | $0.9712 | -288.1 | -278.3 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0002 |
| 2026-06-05 19:00Z | U@BSC | $0.9973 | -26.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | - |
| 2026-06-05 19:00Z | USDT@Arbitrum | $0.9981 | -18.8 | - | - | resolved | 持续 1.0h 后解除（峰值 61.9 bps） | - |
| 2026-06-06 02:00Z | USDS@Ethereum | $0.9945 | -55.2 | -30 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-06-06 02:00Z | USDT@Ethereum | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-06 03:00Z | USDS@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 1.0h 后解除（峰值 55.2 bps） | 1 |
| 2026-06-06 03:00Z | USDT@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 1.0h 后解除（峰值 55.2 bps） | - |
| 2026-06-06 06:00Z | USD1@Ethereum | $1.0003 | 2.5 | - | - | resolved | 持续 83.0h 后解除（峰值 253.9 bps） | 0.9997 |
| 2026-06-06 06:00Z | USDG@Ethereum | $1.0025 | 25.3 | - | - | resolved | 持续 27.0h 后解除（峰值 274.1 bps） | - |
| 2026-06-06 06:00Z | USDS@Ethereum | $0.9945 | -55.1 | -29 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-06-06 06:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-06 07:00Z | USDG@Ethereum | $0.9757 | -243.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-06-06 07:00Z | USDS@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | 1 |
| 2026-06-06 07:00Z | USDT@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | - |
| 2026-06-06 08:00Z | USDS@Ethereum | $0.9949 | -50.5 | -30.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-06-06 08:00Z | USDT@Ethereum | $0.9949 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-06 08:00Z | USDe@Solana | $0.9995 | -4.7 | - | - | resolved | 持续 14.0h 后解除（峰值 686.1 bps） | 0.9999 |
| 2026-06-06 09:00Z | USDS@Ethereum | $1.0005 | 5.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.5 bps） | 1 |
| 2026-06-06 09:00Z | USDT@Ethereum | $1.0005 | 5.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.5 bps） | - |
| 2026-06-06 10:00Z | PYUSD@Ethereum | $0.9795 | -205.4 | -177.3 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-06-06 11:00Z | USDS@Ethereum | $0.9946 | -53.7 | -35.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-06-06 11:00Z | USDT@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-06 11:00Z | USDe@Solana | $1.0105 | 104.9 | 179.4 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-06-06 12:00Z | USDS@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.7 bps） | 1.0001 |
| 2026-06-06 12:00Z | USDT@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.7 bps） | - |
| 2026-06-06 12:00Z | USDe@Solana | $1.0229 | 228.6 | 186 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-06 14:00Z | PYUSD@Ethereum | $1.0024 | 24.1 | - | - | resolved | 持续 4.0h 后解除（峰值 205.4 bps） | - |
| 2026-06-06 14:00Z | USD1@Ethereum | $0.9793 | -206.9 | -33.1 | likely | new-severe | 首次触发即严重（双源大概率真） | 0.9999 |
| 2026-06-06 14:00Z | USDS@Ethereum | $0.9947 | -53.5 | -29.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-06-06 14:00Z | USDT@Ethereum | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-06 15:00Z | USDS@Ethereum | $0.9972 | -27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | 1.0001 |
| 2026-06-06 15:00Z | USDT@Ethereum | $0.9972 | -27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-06-07 01:00Z | USDe@Solana | $1.0009 | 9.4 | - | - | resolved | 持续 14.0h 后解除（峰值 228.6 bps） | 1 |
| 2026-06-07 02:00Z | PYUSD@Ethereum | $0.9943 | -57.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 03:00Z | PYUSD@Ethereum | $1.0021 | 20.8 | - | - | resolved | 持续 1.0h 后解除（峰值 57.3 bps） | - |
| 2026-06-07 03:00Z | USDe@Solana | $1.0075 | 74.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-06-07 05:00Z | USDe@Solana | $1.0159 | 158.8 | 173.9 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-07 08:00Z | PYUSD@Ethereum | $1.0129 | 129.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 08:00Z | USDT@Arbitrum | $0.9942 | -57.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 09:00Z | PYUSD@Ethereum | $0.9994 | -6.3 | - | - | resolved | 持续 1.0h 后解除（峰值 129.4 bps） | - |
| 2026-06-07 09:00Z | USDT@Arbitrum | $1.0010 | 10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 57.5 bps） | - |
| 2026-06-07 11:00Z | USD1@Ethereum | $1.0018 | 17.8 | - | - | resolved | 持续 21.0h 后解除（峰值 206.9 bps） | 0.9997 |
| 2026-06-07 12:00Z | PYUSD@Ethereum | $0.9941 | -59.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 13:00Z | PYUSD@Ethereum | $0.9995 | -4.9 | - | - | resolved | 持续 1.0h 后解除（峰值 59.3 bps） | - |
| 2026-06-07 16:00Z | USDe@Solana | $0.9975 | -25 | - | - | resolved | 持续 13.0h 后解除（峰值 270.4 bps） | 1.0002 |
| 2026-06-07 19:00Z | PYUSD@Ethereum | $0.9900 | -99.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 19:00Z | USDe@Solana | $0.9810 | -189.6 | -195 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-06-07 20:00Z | USD1@Ethereum | $0.9804 | -195.9 | -33.1 | likely | new-severe | 首次触发即严重（双源大概率真） | 0.9998 |
| 2026-06-07 21:00Z | PYUSD@Ethereum | $1.0009 | 9.2 | - | - | resolved | 持续 2.0h 后解除（峰值 99.7 bps） | - |
| 2026-06-07 22:00Z | USDS@Ethereum | $0.9947 | -53 | -38.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-06-07 22:00Z | USDT@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-07 23:00Z | USDS@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | 1.0002 |
| 2026-06-07 23:00Z | USDT@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | - |
| 2026-06-08 02:00Z | USDD@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-08 03:00Z | USD1@Ethereum | $0.9991 | -9 | - | - | resolved | 持续 7.0h 后解除（峰值 239.9 bps） | 0.9995 |
| 2026-06-08 04:00Z | PYUSD@Ethereum | $0.9920 | -80.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-08 04:00Z | USD1@Ethereum | $0.9778 | -222.1 | -33.3 | likely | new-severe | 首次触发即严重（双源大概率真） | 0.9994 |
| 2026-06-08 09:00Z | PYUSD@Ethereum | $0.9973 | -26.9 | - | - | resolved | 持续 5.0h 后解除（峰值 126.3 bps） | - |
| 2026-06-08 09:00Z | USDe@Solana | $1.0003 | 2.7 | - | - | resolved | 持续 14.0h 后解除（峰值 255.2 bps） | 1 |
| 2026-06-08 11:00Z | PYUSD@Ethereum | $1.0090 | 89.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-08 11:00Z | USDT@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-08 12:00Z | USDT@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-06-08 12:00Z | USDe@Solana | $1.0175 | 175.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0001 |
| 2026-06-08 13:00Z | PYUSD@Ethereum | $0.9988 | -11.7 | - | - | resolved | 持续 2.0h 后解除（峰值 89.9 bps） | - |
| 2026-06-08 14:00Z | USDe@Solana | $0.9979 | -21 | - | - | resolved | 持续 2.0h 后解除（峰值 175.1 bps） | 0.9999 |
| 2026-06-08 15:00Z | USDG@Ethereum | $1.0027 | 26.6 | - | - | resolved | 持续 56.0h 后解除（峰值 286.3 bps） | - |
| 2026-06-08 16:00Z | PYUSD@Ethereum | $0.9943 | -57.2 | -234.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-08 16:00Z | USDG@Ethereum | $0.9778 | -221.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-06-08 17:00Z | PYUSD@Ethereum | $1.0007 | 7.4 | - | - | resolved | 持续 1.0h 后解除（峰值 57.2 bps） | - |
| 2026-06-08 21:00Z | USDe@Solana | $1.0108 | 107.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-06-08 22:00Z | USDe@Solana | $0.9976 | -23.5 | - | - | resolved | 持续 1.0h 后解除（峰值 107.7 bps） | 0.9998 |
| 2026-06-08 23:00Z | USDe@Solana | $0.9939 | -61.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-06-09 00:00Z | PYUSD@Ethereum | $0.9888 | -111.9 | -156.6 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-09 00:00Z | USDe@Solana | $0.9738 | -261.7 | - | unconfirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-09 03:00Z | USDD@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 25.0h 后解除（峰值 53.7 bps） | - |
| 2026-06-09 04:00Z | USDe@Solana | $0.9982 | -18.3 | - | - | resolved | 持续 5.0h 后解除（峰值 261.7 bps） | 0.9997 |
| 2026-06-09 05:00Z | PYUSD@Ethereum | $1.0002 | 1.8 | - | - | resolved | 持续 5.0h 后解除（峰值 116.5 bps） | - |
| 2026-06-09 08:00Z | PYUSD@Ethereum | $0.9947 | -53.5 | -125.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-09 08:00Z | USDe@Solana | $0.9898 | -102.3 | -80.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-06-09 09:00Z | PYUSD@Ethereum | $1.0000 | -0.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-06-09 09:00Z | USDe@Solana | $0.9849 | -151.4 | -40.3 | likely | escalated | 预警升级为严重 | 0.9997 |
| 2026-06-09 13:00Z | PYUSD@Ethereum | $0.9946 | -53.9 | -160.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-09 13:00Z | USDe@Solana | $1.0028 | 28.3 | - | - | resolved | 持续 5.0h 后解除（峰值 179.4 bps） | 0.9997 |
| 2026-06-09 14:00Z | USDD@BSC | $0.9873 | -127.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-09 14:00Z | USDe@Solana | $0.9840 | -160.3 | -182.4 | confirmed | new-severe | 首次触发即严重（双源确认） | 0.9997 |
| 2026-06-09 15:00Z | PYUSD@Ethereum | $0.9999 | -0.5 | - | - | resolved | 持续 2.0h 后解除（峰值 55.6 bps） | - |
| 2026-06-09 15:00Z | USDD@BSC | $1.0018 | 17.9 | - | - | resolved | 持续 1.0h 后解除（峰值 127.2 bps） | - |
| 2026-06-09 16:00Z | USDG@Ethereum | $0.9987 | -12.7 | - | - | resolved | 持续 24.0h 后解除（峰值 221.8 bps） | - |
| 2026-06-09 18:00Z | USDG@Ethereum | $0.9890 | -110 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-09 22:00Z | USDS@Ethereum | $0.9947 | -52.6 | -28.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0004 |
| 2026-06-09 22:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-09 23:00Z | USDS@Ethereum | $0.9971 | -28.7 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | 1.0004 |
| 2026-06-09 23:00Z | USDT@Ethereum | $0.9971 | -28.7 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | - |
| 2026-06-09 23:00Z | USDe@Solana | $1.0025 | 25.1 | - | - | resolved | 持续 9.0h 后解除（峰值 160.3 bps） | 0.9996 |
| 2026-06-10 03:00Z | USDe@Solana | $0.9914 | -86.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-06-10 08:00Z | USDe@Solana | $0.9794 | -206 | -171.9 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-10 09:00Z | USDG@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 15.0h 后解除（峰值 135.2 bps） | - |
| 2026-06-10 10:00Z | USDG@Ethereum | $0.9931 | -68.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-10 13:00Z | USDG@Ethereum | $0.9833 | -167.3 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-06-10 14:00Z | USDe@Solana | $1.0003 | 2.8 | - | - | resolved | 持续 11.0h 后解除（峰值 264.8 bps） | 1 |
| 2026-06-10 15:00Z | USDe@Solana | $1.0059 | 59.1 | 45 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-06-10 18:00Z | USDe@Solana | $0.9808 | -192.2 | - | unconfirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-10 21:00Z | PYUSD@Ethereum | $0.9918 | -81.6 | -64.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-10 22:00Z | PYUSD@Ethereum | $1.0001 | 1.4 | - | - | resolved | 持续 1.0h 后解除（峰值 81.6 bps） | - |
| 2026-06-11 01:00Z | USDe@Solana | $1.0008 | 8.4 | - | - | resolved | 持续 10.0h 后解除（峰值 374.5 bps） | 0.9999 |
| 2026-06-11 03:00Z | USDe@Solana | $1.0057 | 56.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-06-11 04:00Z | USDe@Solana | $0.9985 | -14.7 | - | - | resolved | 持续 1.0h 后解除（峰值 56.9 bps） | 0.9999 |
| 2026-06-11 11:00Z | USDT@Arbitrum | $0.9942 | -57.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-11 11:00Z | USDe@Solana | $1.0105 | 104.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-06-11 12:00Z | USDT@Arbitrum | $0.9993 | -6.6 | - | - | resolved | 持续 1.0h 后解除（峰值 57.9 bps） | - |
| 2026-06-11 12:00Z | USDe@Solana | $0.9983 | -17.3 | - | - | resolved | 持续 1.0h 后解除（峰值 104.7 bps） | 1 |
| 2026-06-11 14:00Z | PYUSD@Ethereum | $1.0065 | 65.3 | 136.6 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-11 15:00Z | PYUSD@Ethereum | $0.9998 | -1.6 | - | - | resolved | 持续 1.0h 后解除（峰值 65.3 bps） | - |
| 2026-06-11 16:00Z | USDT@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-11 16:00Z | USDe@Solana | $0.9949 | -51.3 | -25.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-06-11 17:00Z | USDT@Ethereum | $0.9970 | -29.9 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-06-11 17:00Z | USDe@Solana | $1.0192 | 192.1 | 242.2 | confirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-06-11 19:00Z | USDS@Ethereum | $0.9945 | -55.2 | -26.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-06-11 19:00Z | USDT@Ethereum | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-11 19:00Z | USDe@Solana | $0.9997 | -2.5 | - | - | resolved | 持续 3.0h 后解除（峰值 192.1 bps） | 1.0001 |
| 2026-06-11 20:00Z | PYUSD@Ethereum | $0.9920 | -79.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-11 20:00Z | USDe@Solana | $0.9891 | -109.4 | -101.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-06-11 22:00Z | PYUSD@Ethereum | $1.0016 | 16.4 | - | - | resolved | 持续 2.0h 后解除（峰值 79.7 bps） | - |
| 2026-06-11 22:00Z | USDe@Solana | $0.9988 | -12.2 | - | - | resolved | 持续 2.0h 后解除（峰值 109.4 bps） | 1.0001 |
| 2026-06-11 23:00Z | USDS@Ethereum | $1.0020 | 20.2 | - | - | resolved | 持续 4.0h 后解除（峰值 55.2 bps） | 1.0007 |
| 2026-06-11 23:00Z | USDT@Ethereum | $1.0020 | 20.2 | - | - | resolved | 持续 4.0h 后解除（峰值 55.2 bps） | - |
| 2026-06-11 23:00Z | USDe@Solana | $0.9940 | -60.4 | -53.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-06-12 01:00Z | USDD@Ethereum | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-12 01:00Z | USDe@Solana | $1.0011 | 11.3 | - | - | resolved | 持续 2.0h 后解除（峰值 60.4 bps） | 1.0002 |
| 2026-06-12 02:00Z | USDe@Solana | $1.0079 | 78.6 | 84.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-06-12 04:00Z | USDD@Ethereum | $0.9977 | -22.5 | - | - | resolved | 持续 3.0h 后解除（峰值 50.9 bps） | - |
| 2026-06-12 11:00Z | USDe@Solana | $1.0014 | 14 | - | - | resolved | 持续 9.0h 后解除（峰值 149.3 bps） | 0.9999 |
| 2026-06-12 13:00Z | USDD@BSC | $0.9949 | -51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-12 14:00Z | USDD@BSC | $0.9978 | -21.6 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | - |
| 2026-06-12 15:00Z | USDe@Solana | $1.0078 | 78.4 | 127.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-12 18:00Z | PYUSD@Solana | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-12 19:00Z | PYUSD@Solana | $1.0027 | 26.6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-06-12 23:00Z | USDe@Solana | $0.9977 | -22.6 | - | - | resolved | 持续 8.0h 后解除（峰值 145.3 bps） | 1 |
| 2026-06-13 01:00Z | USDe@Solana | $1.0063 | 62.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-06-13 02:00Z | USDS@Ethereum | $0.9946 | -54.3 | -29.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0004 |
| 2026-06-13 02:00Z | USDT@Ethereum | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-13 03:00Z | USDS@Ethereum | $1.0012 | 11.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.3 bps） | 1.0002 |
| 2026-06-13 03:00Z | USDT@Ethereum | $1.0012 | 11.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.3 bps） | - |
| 2026-06-13 03:00Z | USDe@Solana | $0.9998 | -1.8 | - | - | resolved | 持续 2.0h 后解除（峰值 62.8 bps） | 1 |
| 2026-06-13 05:00Z | USDC@Base | $0.9945 | -55.3 | -47.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-13 07:00Z | USDe@Solana | $1.0051 | 51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-06-13 08:00Z | USDC@Base | $0.9991 | -9 | - | - | resolved | 持续 3.0h 后解除（峰值 55.3 bps） | 1.0003 |
| 2026-06-13 12:00Z | USDe@Solana | $1.0154 | 153.8 | - | unconfirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-06-13 17:00Z | PYUSD@Solana | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-13 18:00Z | PYUSD@Solana | $1.0017 | 16.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | - |
| 2026-06-13 21:00Z | USDC@Base | $0.9941 | -58.7 | -38.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-06-13 22:00Z | USDS@Ethereum | $0.9945 | -54.9 | -31.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0004 |
| 2026-06-13 22:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-13 23:00Z | USDC@Base | $1.0000 | 0.3 | - | - | resolved | 持续 2.0h 后解除（峰值 58.7 bps） | 1.0002 |
| 2026-06-14 01:00Z | USDe@Solana | $1.0009 | 9 | - | - | resolved | 持续 18.0h 后解除（峰值 346.5 bps） | 0.9999 |
| 2026-06-14 03:00Z | USDC@Base | $0.9949 | -51.5 | -49.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-06-14 04:00Z | USDS@Ethereum | $1.0005 | 5.2 | - | - | resolved | 持续 6.0h 后解除（峰值 54.9 bps） | 1.0004 |
| 2026-06-14 04:00Z | USDT@Ethereum | $1.0005 | 5.2 | - | - | resolved | 持续 6.0h 后解除（峰值 54.9 bps） | - |
| 2026-06-14 05:00Z | USDC@Base | $1.0006 | 6.2 | - | - | resolved | 持续 2.0h 后解除（峰值 53.1 bps） | 1.0002 |
| 2026-06-14 05:00Z | USDe@Solana | $0.9917 | -82.6 | -61 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-14 11:00Z | PYUSD@Solana | $0.9949 | -50.8 | -48.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-06-14 12:00Z | PYUSD@Solana | $1.0013 | 12.9 | - | - | resolved | 持续 1.0h 后解除（峰值 50.8 bps） | - |
| 2026-06-14 13:00Z | USDe@Solana | $0.9830 | -169.9 | - | unconfirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-06-14 14:00Z | USDD@Ethereum | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-14 21:00Z | USDT@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-14 22:00Z | USDT@Ethereum | $0.9971 | -28.6 | - | - | resolved | 持续 1.0h 后解除（峰值 55.0 bps） | - |
| 2026-06-15 04:00Z | USDe@Solana | $0.9983 | -16.7 | - | - | resolved | 持续 23.0h 后解除（峰值 227.7 bps） | 1.0001 |
| 2026-06-15 10:00Z | USDD@Ethereum | $0.9997 | -2.8 | - | - | resolved | 持续 20.0h 后解除（峰值 52.8 bps） | - |
| 2026-06-15 10:00Z | USDT@Arbitrum | $0.9909 | -91.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-15 10:00Z | USDe@Solana | $1.0111 | 110.5 | 59.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-15 11:00Z | USDT@Arbitrum | $0.9990 | -10.2 | - | - | resolved | 持续 1.0h 后解除（峰值 91.1 bps） | - |
| 2026-06-15 11:00Z | USDe@Solana | $1.0186 | 186.5 | 152.4 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-15 16:00Z | USDe@Solana | $1.0007 | 6.8 | - | - | resolved | 持续 6.0h 后解除（峰值 193.4 bps） | 1 |
| 2026-06-15 17:00Z | PYUSD@Ethereum | $0.9940 | -59.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-15 17:00Z | USDe@Solana | $0.9932 | -67.8 | -72.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-15 18:00Z | PYUSD@Ethereum | $1.0002 | 1.6 | - | - | resolved | 持续 1.0h 后解除（峰值 59.6 bps） | - |
| 2026-06-15 20:00Z | PYUSD@Ethereum | $0.9923 | -77.5 | -205.7 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-15 20:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-15 21:00Z | PYUSD@Ethereum | $0.9985 | -14.7 | - | - | resolved | 持续 1.0h 后解除（峰值 77.5 bps） | - |
| 2026-06-15 21:00Z | USDS@Ethereum | $0.9945 | -55.5 | -28.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-06-15 22:00Z | USDe@Solana | $0.9761 | -238.8 | -204.8 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-15 23:00Z | USDS@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 2.0h 后解除（峰值 55.5 bps） | 1.0005 |
| 2026-06-15 23:00Z | USDT@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 3.0h 后解除（峰值 55.5 bps） | - |
| 2026-06-16 00:00Z | USDS@Ethereum | $0.9945 | -54.9 | -27.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-06-16 00:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-16 03:00Z | USDS@Ethereum | $0.9992 | -7.5 | - | - | resolved | 持续 3.0h 后解除（峰值 54.9 bps） | 1.0006 |
| 2026-06-16 03:00Z | USDT@Ethereum | $0.9992 | -7.5 | - | - | resolved | 持续 3.0h 后解除（峰值 54.9 bps） | - |
| 2026-06-16 05:00Z | USDe@Solana | $1.0023 | 23.4 | - | - | resolved | 持续 12.0h 后解除（峰值 307.3 bps） | 1 |
| 2026-06-16 06:00Z | USDe@Solana | $1.0068 | 68 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-06-16 08:00Z | USDe@Solana | $1.0186 | 186 | 206.2 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-16 09:00Z | USDe@Solana | $0.9979 | -21.4 | - | - | resolved | 持续 3.0h 后解除（峰值 186.0 bps） | 1 |
| 2026-06-16 11:00Z | USDe@Solana | $0.9904 | -96.1 | -52.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-16 12:00Z | USDe@Solana | $0.9977 | -23.4 | - | - | resolved | 持续 1.0h 后解除（峰值 96.1 bps） | 1 |
| 2026-06-16 13:00Z | USDe@Solana | $0.9869 | -131 | -115.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-06-16 14:00Z | USDe@Solana | $0.9719 | -281.5 | -268.4 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-17 12:00Z | USDT@Ethereum | $1.0054 | 54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-17 14:00Z | USDe@Solana | $1.0001 | 1.3 | - | - | resolved | 持续 25.0h 后解除（峰值 419.8 bps） | 0.9999 |
| 2026-06-17 15:00Z | USDD@Ethereum | $1.0052 | 52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-17 15:00Z | USDT@Ethereum | $0.9983 | -17 | - | - | resolved | 持续 3.0h 后解除（峰值 54.3 bps） | - |
| 2026-06-17 15:00Z | USDe@Solana | $1.0179 | 178.5 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1 |
| 2026-06-17 16:00Z | PYUSD@Ethereum | $0.9917 | -83.4 | -100.3 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-17 16:00Z | USDD@Ethereum | $0.9996 | -3.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.5 bps） | - |
| 2026-06-17 17:00Z | PYUSD@Ethereum | $0.9998 | -1.9 | - | - | resolved | 持续 1.0h 后解除（峰值 83.4 bps） | - |
| 2026-06-17 19:00Z | PYUSD@Ethereum | $0.9911 | -88.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-17 22:00Z | PYUSD@Ethereum | $1.0003 | 2.8 | - | - | resolved | 持续 3.0h 后解除（峰值 88.6 bps） | - |
| 2026-06-18 00:00Z | PYUSD@Ethereum | $1.0073 | 73.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-18 00:00Z | USDe@Solana | $0.9996 | -4.3 | - | - | resolved | 持续 9.0h 后解除（峰值 252.8 bps） | 0.9998 |
| 2026-06-18 01:00Z | PYUSD@Ethereum | $1.0004 | 3.6 | - | - | resolved | 持续 1.0h 后解除（峰值 73.4 bps） | - |
| 2026-06-18 01:00Z | USDC@Base | $0.9949 | -50.9 | -48.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-06-18 02:00Z | USDC@Base | $0.9971 | -29.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | 1.0008 |
| 2026-06-18 04:00Z | USDe@Solana | $0.9803 | -196.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9999 |
| 2026-06-18 15:00Z | U@BSC | $0.9884 | -115.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-18 15:00Z | USDG@Ethereum | $0.9993 | -6.6 | - | - | resolved | 持续 197.0h 后解除（峰值 270.1 bps） | - |
| 2026-06-18 16:00Z | U@BSC | $0.9987 | -13 | - | - | resolved | 持续 1.0h 后解除（峰值 115.8 bps） | - |
| 2026-06-18 17:00Z | USD1@Ethereum | $0.9994 | -6.1 | - | - | resolved | 持续 253.0h 后解除（峰值 286.5 bps） | 1.0009 |
| 2026-06-18 17:00Z | USDG@Ethereum | $0.9935 | -65.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-18 19:00Z | USDS@Ethereum | $1.0050 | 50.1 | 35.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-06-18 19:00Z | USDT@Ethereum | $1.0050 | 50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-18 20:00Z | USDe@Solana | $1.0012 | 12 | - | - | resolved | 持续 16.0h 后解除（峰值 212.3 bps） | 1 |
| 2026-06-18 22:00Z | USDS@Ethereum | $0.9984 | -15.6 | - | - | resolved | 持续 3.0h 后解除（峰值 50.1 bps） | 1.0008 |
| 2026-06-18 22:00Z | USDT@Ethereum | $0.9984 | -15.6 | - | - | resolved | 持续 3.0h 后解除（峰值 50.1 bps） | - |
| 2026-06-19 03:00Z | USDe@Solana | $0.9888 | -112 | -124.6 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-06-19 04:00Z | USDD@Ethereum | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-19 04:00Z | USDT@Ethereum | $0.9949 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-19 05:00Z | USDT@Ethereum | $0.9993 | -7.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.5 bps） | - |
| 2026-06-19 05:00Z | USDe@Solana | $0.9847 | -153.3 | -143.2 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-19 07:00Z | USDD@Ethereum | $1.0002 | 1.6 | - | - | resolved | 持续 3.0h 后解除（峰值 51.9 bps） | - |
| 2026-06-19 10:00Z | USDG@Ethereum | $1.0007 | 6.7 | - | - | resolved | 持续 17.0h 后解除（峰值 130.9 bps） | - |
| 2026-06-19 12:00Z | USDD@Ethereum | $0.9944 | -55.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-19 20:00Z | USDD@Ethereum | $0.9988 | -12.1 | - | - | resolved | 持续 8.0h 后解除（峰值 55.5 bps） | - |
| 2026-06-19 21:00Z | USDD@BSC | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-19 22:00Z | USDD@BSC | $0.9997 | -2.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-06-19 23:00Z | USDe@Solana | $0.9997 | -2.9 | - | - | resolved | 持续 20.0h 后解除（峰值 212.7 bps） | 0.9999 |
| 2026-06-20 03:00Z | USDe@Solana | $1.0052 | 52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-06-20 05:00Z | USDe@Solana | $1.0327 | 326.6 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-20 08:00Z | USDT@Ethereum | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-20 09:00Z | USDT@Ethereum | $0.9990 | -9.7 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-06-20 14:00Z | USDC@Base | $0.9921 | -78.8 | -46.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-06-20 14:00Z | USDT@Ethereum | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-20 15:00Z | USDT@Ethereum | $1.0009 | 9.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-06-20 18:00Z | USDC@Base | $0.9973 | -26.7 | - | - | resolved | 持续 4.0h 后解除（峰值 78.8 bps） | 1.0009 |
| 2026-06-21 01:00Z | USDe@Solana | $0.9979 | -20.6 | - | - | resolved | 持续 22.0h 后解除（峰值 356.1 bps） | 1 |
| 2026-06-21 05:00Z | USDD@Ethereum | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-21 05:00Z | USDe@Solana | $0.9924 | -75.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-06-21 09:00Z | USDD@Ethereum | $1.0025 | 25.4 | - | - | resolved | 持续 4.0h 后解除（峰值 53.5 bps） | - |
| 2026-06-21 09:00Z | USDe@Solana | $0.9989 | -11 | - | - | resolved | 持续 4.0h 后解除（峰值 90.9 bps） | 0.9998 |
| 2026-06-21 10:00Z | USDe@Solana | $1.0071 | 70.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-06-21 11:00Z | USDe@Solana | $0.9973 | -26.5 | - | - | resolved | 持续 1.0h 后解除（峰值 70.7 bps） | 0.9998 |
| 2026-06-21 12:00Z | USDG@Ethereum | $0.9934 | -65.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-21 18:00Z | USDG@Ethereum | $1.0003 | 2.8 | - | - | resolved | 持续 6.0h 后解除（峰值 65.6 bps） | - |
| 2026-06-21 21:00Z | USDe@Solana | $0.9891 | -108.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-06-21 23:00Z | USDG@Ethereum | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-21 23:00Z | USDe@Solana | $0.9809 | -191.4 | -165.4 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-06-22 00:00Z | PYUSD@Ethereum | $1.0104 | 104.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-22 02:00Z | PYUSD@Ethereum | $1.0010 | 10.1 | - | - | resolved | 持续 2.0h 后解除（峰值 118.6 bps） | - |
| 2026-06-22 02:00Z | USDS@Ethereum | $0.9946 | -53.7 | -31.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-06-22 02:00Z | USDT@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-22 03:00Z | USD1@Ethereum | $0.9935 | -65.3 | -27.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0004 |
| 2026-06-22 03:00Z | USDS@Ethereum | $1.0005 | 4.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.7 bps） | 1.0008 |
| 2026-06-22 03:00Z | USDT@Ethereum | $1.0005 | 4.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.7 bps） | - |
| 2026-06-22 05:00Z | USDe@Solana | $0.9991 | -8.6 | - | - | resolved | 持续 8.0h 后解除（峰值 191.4 bps） | 0.9999 |
| 2026-06-22 07:00Z | USDe@Solana | $1.0053 | 53 | 53.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-06-22 08:00Z | USDe@Solana | $1.0013 | 12.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | 0.9998 |
| 2026-06-22 11:00Z | PYUSD@Ethereum | $1.0102 | 101.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-22 11:00Z | USDe@Solana | $1.0058 | 58.2 | 28.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-06-22 12:00Z | PYUSD@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 1.0h 后解除（峰值 101.5 bps） | - |
| 2026-06-22 14:00Z | PYUSD@Ethereum | $0.9934 | -66.4 | -37.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-06-22 18:00Z | USDS@Ethereum | $0.9948 | -52.5 | -28.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-06-22 18:00Z | USDT@Ethereum | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-22 19:00Z | USDS@Ethereum | $0.9971 | -29.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.5 bps） | 1.0007 |
| 2026-06-22 19:00Z | USDT@Ethereum | $0.9971 | -29.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.5 bps） | - |
| 2026-06-22 19:00Z | USDe@Solana | $0.9824 | -175.6 | - | unconfirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-06-22 21:00Z | PYUSD@Ethereum | $1.0021 | 21.1 | - | - | resolved | 持续 7.0h 后解除（峰值 131.9 bps） | - |
| 2026-06-22 22:00Z | PYUSD@Ethereum | $0.9929 | -70.8 | -57 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-22 23:00Z | PYUSD@Ethereum | $1.0024 | 23.8 | - | - | resolved | 持续 1.0h 后解除（峰值 70.8 bps） | - |
| 2026-06-23 02:00Z | USD1@Ethereum | $0.9986 | -13.8 | - | - | resolved | 持续 23.0h 后解除（峰值 74.7 bps） | 1.0003 |
| 2026-06-23 02:00Z | USDG@Ethereum | $1.0001 | 1.1 | - | - | resolved | 持续 27.0h 后解除（峰值 57.7 bps） | - |
| 2026-06-23 04:00Z | USDS@Ethereum | $0.9948 | -51.9 | -27.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-06-23 04:00Z | USDT@Ethereum | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-23 06:00Z | USDS@Ethereum | $0.9996 | -4.5 | - | - | resolved | 持续 2.0h 后解除（峰值 51.9 bps） | 1.0006 |
| 2026-06-23 06:00Z | USDT@Ethereum | $0.9996 | -4.5 | - | - | resolved | 持续 2.0h 后解除（峰值 51.9 bps） | - |
| 2026-06-23 07:00Z | USD1@Ethereum | $0.9893 | -107.2 | -28.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-06-23 07:00Z | USDG@Ethereum | $0.9933 | -67.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-23 08:00Z | PYUSD@Ethereum | $0.9757 | -242.5 | -47.5 | likely | new-severe | 首次触发即严重（双源大概率真） | - |
| 2026-06-23 08:00Z | USDG@Ethereum | $1.0011 | 11.1 | - | - | resolved | 持续 1.0h 后解除（峰值 67.3 bps） | - |
| 2026-06-23 09:00Z | USDG@Ethereum | $0.9940 | -59.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-23 11:00Z | PYUSD@Ethereum | $1.0025 | 24.6 | - | - | resolved | 持续 3.0h 后解除（峰值 242.5 bps） | - |
| 2026-06-24 05:00Z | PYUSD@Solana | $1.0272 | 272.4 | 308.2 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-06-24 06:00Z | PYUSD@Solana | $1.0020 | 20.3 | - | - | resolved | 持续 1.0h 后解除（峰值 272.4 bps） | - |
| 2026-06-24 08:00Z | PYUSD@Solana | $0.9942 | -57.9 | -52.3 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-24 10:00Z | PYUSD@Solana | $1.0017 | 17 | - | - | resolved | 持续 2.0h 后解除（峰值 57.9 bps） | - |
| 2026-06-24 11:00Z | USD1@Ethereum | $0.9986 | -14 | - | - | resolved | 持续 28.0h 后解除（峰值 107.2 bps） | 1.0005 |
| 2026-06-24 15:00Z | PYUSD@Ethereum | $0.9900 | -100.3 | -65.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-06-24 16:00Z | PYUSD@Ethereum | $1.0024 | 24.3 | - | - | resolved | 持续 1.0h 后解除（峰值 100.3 bps） | - |
| 2026-06-24 17:00Z | USDG@Ethereum | $1.0010 | 9.5 | - | - | resolved | 持续 32.0h 后解除（峰值 70.6 bps） | - |
| 2026-06-24 18:00Z | USDG@Ethereum | $0.9942 | -57.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-24 21:00Z | USDC@Base | $1.0051 | 51.1 | 40.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0012 |
| 2026-06-24 22:00Z | USDC@Base | $1.0002 | 1.9 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | 1.0012 |
| 2026-06-24 22:00Z | USDG@Ethereum | $0.9974 | -26 | - | - | resolved | 持续 4.0h 后解除（峰值 67.5 bps） | - |
| 2026-06-25 04:00Z | USDe@Solana | $1.0021 | 21.2 | - | - | resolved | 持续 65.0h 后解除（峰值 1162.8 bps） | 0.9997 |
| 2026-06-25 05:00Z | USDe@Solana | $1.0143 | 143.3 | 141.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-06-25 07:00Z | USDe@Solana | $1.0028 | 28.1 | - | - | resolved | 持续 2.0h 后解除（峰值 143.3 bps） | 0.9996 |
| 2026-06-25 08:00Z | USD1@Ethereum | $0.9910 | -89.6 | -26.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-06-25 09:00Z | USDT@Ethereum | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 10:00Z | USD1@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 2.0h 后解除（峰值 93.1 bps） | 1.0005 |
| 2026-06-25 10:00Z | USDT@Ethereum | $1.0019 | 18.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-06-25 10:00Z | USDe@Solana | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9996 |
| 2026-06-25 11:00Z | PYUSD@Solana | $0.9941 | -58.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 11:00Z | USDD@Ethereum | $0.9941 | -58.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 12:00Z | PYUSD@Ethereum | $1.0066 | 66.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 12:00Z | PYUSD@Solana | $0.9978 | -22.2 | - | - | resolved | 持续 1.0h 后解除（峰值 58.6 bps） | - |
| 2026-06-25 12:00Z | USDT@Arbitrum | $0.9935 | -64.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 13:00Z | U@BSC | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 13:00Z | USD1@BSC | $1.0115 | 114.5 | 39.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-25 13:00Z | USDC@Arbitrum | $1.0130 | 130.4 | 143.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0013 |
| 2026-06-25 13:00Z | USDC@BSC | $1.0127 | 127.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0013 |
| 2026-06-25 13:00Z | USDD@BSC | $0.9931 | -69.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 13:00Z | USDe@Solana | $0.9667 | -333.4 | -691.4 | confirmed | escalated | 预警升级为严重 | 0.9996 |
| 2026-06-25 14:00Z | USD1@BSC | $0.9995 | -5.3 | - | - | resolved | 持续 1.0h 后解除（峰值 114.5 bps） | 1.0003 |
| 2026-06-25 14:00Z | USDC@Arbitrum | $1.0006 | 5.6 | - | - | resolved | 持续 1.0h 后解除（峰值 130.4 bps） | 1.0012 |
| 2026-06-25 14:00Z | USDC@BSC | $1.0004 | 4.5 | - | - | resolved | 持续 1.0h 后解除（峰值 127.3 bps） | 1.0012 |
| 2026-06-25 14:00Z | USDG@Ethereum | $0.9936 | -64.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 15:00Z | USD1@Ethereum | $0.9935 | -65.4 | -27.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-25 15:00Z | USDT@Arbitrum | $1.0008 | 8.3 | - | - | resolved | 持续 3.0h 后解除（峰值 131.7 bps） | - |
| 2026-06-25 16:00Z | USD1@Ethereum | $0.9994 | -6.3 | - | - | resolved | 持续 1.0h 后解除（峰值 65.4 bps） | 1.0004 |
| 2026-06-25 16:00Z | USDG@Ethereum | $0.9982 | -18.2 | - | - | resolved | 持续 2.0h 后解除（峰值 64.2 bps） | - |
| 2026-06-25 17:00Z | PYUSD@Ethereum | $1.0020 | 20 | - | - | resolved | 持续 5.0h 后解除（峰值 96.7 bps） | - |
| 2026-06-25 17:00Z | U@BSC | $0.9985 | -15 | - | - | resolved | 持续 4.0h 后解除（峰值 54.6 bps） | - |
| 2026-06-25 18:00Z | USDG@Ethereum | $0.9941 | -59.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-25 22:00Z | USDG@Ethereum | $0.9990 | -10.2 | - | - | resolved | 持续 4.0h 后解除（峰值 59.2 bps） | - |
| 2026-06-26 01:00Z | USDe@Solana | $0.9996 | -4.4 | - | - | resolved | 持续 15.0h 后解除（峰值 481.8 bps） | 0.9996 |
| 2026-06-26 02:00Z | USD1@Ethereum | $0.9867 | -132.9 | -25.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-06-26 02:00Z | USDe@Solana | $0.9822 | -177.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9997 |
| 2026-06-26 03:00Z | USDC@Base | $0.9949 | -50.7 | -38.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0012 |
| 2026-06-26 03:00Z | USDD@Ethereum | $0.9976 | -23.6 | - | - | resolved | 持续 16.0h 后解除（峰值 58.6 bps） | - |
| 2026-06-26 03:00Z | USDT@Arbitrum | $0.9944 | -55.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-26 04:00Z | USDT@Arbitrum | $0.9996 | -3.9 | - | - | resolved | 持续 1.0h 后解除（峰值 55.7 bps） | - |
| 2026-06-26 05:00Z | USDC@Base | $1.0015 | 15.3 | - | - | resolved | 持续 2.0h 后解除（峰值 50.7 bps） | 1.0011 |
| 2026-06-26 06:00Z | USD1@Ethereum | $0.9982 | -18 | - | - | resolved | 持续 4.0h 后解除（峰值 132.9 bps） | 1.0006 |
| 2026-06-26 07:00Z | USDG@Ethereum | $0.9938 | -61.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-26 08:00Z | PYUSD@Ethereum | $0.9943 | -56.9 | -47 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-06-26 10:00Z | PYUSD@Ethereum | $1.0016 | 15.7 | - | - | resolved | 持续 2.0h 后解除（峰值 56.9 bps） | - |
| 2026-06-26 10:00Z | USDS@Ethereum | $0.9950 | -50.5 | -27.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-06-26 10:00Z | USDT@Ethereum | $0.9950 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-26 11:00Z | USDD@BSC | $1.0003 | 3.2 | - | - | resolved | 持续 22.0h 后解除（峰值 69.1 bps） | - |
| 2026-06-26 12:00Z | USDS@Ethereum | $1.0022 | 21.8 | - | - | resolved | 持续 2.0h 后解除（峰值 50.5 bps） | 1.001 |
| 2026-06-26 12:00Z | USDT@Ethereum | $1.0022 | 21.8 | - | - | resolved | 持续 2.0h 后解除（峰值 50.5 bps） | - |
| 2026-06-26 19:00Z | USD1@Ethereum | $0.9944 | -55.7 | -26.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-06-26 19:00Z | USDC@Solana | $1.0057 | 56.6 | 34.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0011 |
| 2026-06-26 20:00Z | USDC@Solana | $1.0003 | 3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 56.6 bps） | 1.0012 |
| 2026-06-26 21:00Z | USDG@Ethereum | $1.0000 | -0.3 | - | - | resolved | 持续 14.0h 后解除（峰值 61.6 bps） | - |
| 2026-06-27 02:00Z | USD1@Ethereum | $1.0015 | 15 | - | - | resolved | 持续 7.0h 后解除（峰值 66.3 bps） | 1.0005 |
| 2026-06-27 07:00Z | U@BSC | $0.9888 | -112.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 08:00Z | U@BSC | $1.0003 | 3 | - | - | resolved | 持续 1.0h 后解除（峰值 112.4 bps） | - |
| 2026-06-27 16:00Z | USDS@Ethereum | $0.9947 | -52.6 | -27 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0012 |
| 2026-06-27 16:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 18:00Z | USD1@Ethereum | $0.9924 | -75.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-06-27 18:00Z | USDS@Ethereum | $0.9975 | -24.7 | - | - | resolved | 持续 2.0h 后解除（峰值 52.6 bps） | 1.0013 |
| 2026-06-27 18:00Z | USDT@Ethereum | $0.9975 | -24.7 | - | - | resolved | 持续 2.0h 后解除（峰值 52.6 bps） | - |
| 2026-06-27 19:00Z | USDG@Ethereum | $0.9935 | -65 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 19:00Z | USDS@Ethereum | $0.9949 | -51.3 | -76.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0013 |
| 2026-06-27 19:00Z | USDT@Ethereum | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 20:00Z | USDS@Ethereum | $0.9987 | -12.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | 1.0012 |
| 2026-06-27 20:00Z | USDT@Ethereum | $0.9987 | -12.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | - |
| 2026-06-27 21:00Z | USDT@Ethereum | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 22:00Z | USDD@BSC | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-27 22:00Z | USDS@Ethereum | $1.0055 | 55.3 | 66.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0012 |
| 2026-06-28 01:00Z | USDS@Ethereum | $0.9976 | -24 | - | - | resolved | 持续 3.0h 后解除（峰值 55.3 bps） | 1.0012 |
| 2026-06-28 01:00Z | USDT@Ethereum | $0.9976 | -24 | - | - | resolved | 持续 4.0h 后解除（峰值 55.3 bps） | - |
| 2026-06-28 02:00Z | USDD@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-28 05:00Z | USD1@Ethereum | $0.9990 | -10.4 | - | - | resolved | 持续 11.0h 后解除（峰值 119.3 bps） | 1.0004 |
| 2026-06-28 07:00Z | USDD@Ethereum | $0.9987 | -12.9 | - | - | resolved | 持续 5.0h 后解除（峰值 53.0 bps） | - |
| 2026-06-28 08:00Z | PYUSD@Ethereum | $1.0095 | 95.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-28 09:00Z | PYUSD@Ethereum | $1.0023 | 22.7 | - | - | resolved | 持续 1.0h 后解除（峰值 95.3 bps） | - |
| 2026-06-28 11:00Z | USDG@Ethereum | $0.9984 | -16.3 | - | - | resolved | 持续 16.0h 后解除（峰值 65.0 bps） | - |
| 2026-06-28 12:00Z | USDe@Solana | $0.9992 | -7.6 | - | - | resolved | 持续 58.0h 后解除（峰值 475.3 bps） | 0.9995 |
| 2026-06-28 15:00Z | USDe@Solana | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-06-28 18:00Z | USDD@BSC | $1.0015 | 15.3 | - | - | resolved | 持续 20.0h 后解除（峰值 59.0 bps） | - |
| 2026-06-28 19:00Z | USDe@Solana | $0.9845 | -155.3 | -209.8 | confirmed | escalated | 预警升级为严重 | 0.9996 |
| 2026-06-28 20:00Z | U@BSC | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-28 21:00Z | U@BSC | $1.0005 | 5.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.6 bps） | - |
| 2026-06-28 23:00Z | USDS@Ethereum | $1.0054 | 54.2 | 115.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0012 |
| 2026-06-28 23:00Z | USDT@Ethereum | $1.0054 | 54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-29 00:00Z | USDS@Ethereum | $0.9997 | -3.3 | - | - | resolved | 持续 1.0h 后解除（峰值 54.2 bps） | 1.0012 |
| 2026-06-29 00:00Z | USDT@Ethereum | $0.9997 | -3.3 | - | - | resolved | 持续 1.0h 后解除（峰值 54.2 bps） | - |
| 2026-06-29 04:00Z | U@BSC | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-29 06:00Z | U@BSC | $1.0015 | 14.8 | - | - | resolved | 持续 2.0h 后解除（峰值 54.1 bps） | - |
| 2026-06-29 10:00Z | USDC@Base | $0.9947 | -53.1 | -53.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0011 |
| 2026-06-29 11:00Z | USDT@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-29 12:00Z | USD1@Ethereum | $0.9929 | -71.3 | -26.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-06-29 12:00Z | USDC@Base | $1.0023 | 22.7 | - | - | resolved | 持续 2.0h 后解除（峰值 53.1 bps） | 1.001 |
| 2026-06-29 13:00Z | USDT@Ethereum | $1.0015 | 15.3 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | - |
| 2026-06-29 14:00Z | USDT@Arbitrum | $0.9928 | -72.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-29 15:00Z | USDT@Arbitrum | $0.9977 | -23 | - | - | resolved | 持续 1.0h 后解除（峰值 72.1 bps） | - |
| 2026-06-29 17:00Z | USDC@Base | $0.9945 | -55.1 | -29.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0011 |
| 2026-06-29 18:00Z | USDC@Base | $1.0024 | 24 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | 1.0011 |
| 2026-06-29 18:00Z | USDG@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-30 02:00Z | USD1@Ethereum | $0.9978 | -22.2 | - | - | resolved | 持续 14.0h 后解除（峰值 81.8 bps） | 1.0003 |
| 2026-06-30 04:00Z | USD1@Ethereum | $0.9930 | -70.2 | -28.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-30 05:00Z | USD1@Ethereum | $0.9974 | -26.1 | - | - | resolved | 持续 1.0h 后解除（峰值 70.2 bps） | 1.0003 |
| 2026-06-30 06:00Z | USDD@BSC | $0.9948 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-30 07:00Z | USD1@Ethereum | $0.9940 | -60.3 | -26.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-30 07:00Z | USDG@Ethereum | $0.9975 | -24.8 | - | - | resolved | 持续 13.0h 后解除（峰值 60.9 bps） | - |
| 2026-06-30 09:00Z | USDG@Ethereum | $0.9943 | -56.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-30 10:00Z | USDD@BSC | $1.0002 | 1.8 | - | - | resolved | 持续 4.0h 后解除（峰值 51.5 bps） | - |
| 2026-06-30 12:00Z | USD1@Ethereum | $1.0022 | 22.3 | - | - | resolved | 持续 5.0h 后解除（峰值 92.4 bps） | 1.0003 |
| 2026-06-30 14:00Z | USD1@Ethereum | $0.9918 | -81.7 | -28.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-06-30 14:00Z | USDD@Ethereum | $0.9942 | -58.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-30 14:00Z | USDT@Solana | $0.9937 | -63 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-06-30 15:00Z | USDC@Base | $0.9950 | -50.3 | -25.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0013 |
| 2026-06-30 15:00Z | USDG@Ethereum | $0.9980 | -19.9 | - | - | resolved | 持续 6.0h 后解除（峰值 67.0 bps） | - |
| 2026-06-30 15:00Z | USDT@Solana | $1.0011 | 10.6 | - | - | resolved | 持续 1.0h 后解除（峰值 63.0 bps） | - |
| 2026-06-30 16:00Z | USDC@Base | $1.0021 | 21.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.3 bps） | 1.0011 |
| 2026-06-30 19:00Z | USDD@Ethereum | $0.9986 | -13.6 | - | - | resolved | 持续 5.0h 后解除（峰值 58.2 bps） | - |
| 2026-06-30 21:00Z | USDG@Ethereum | $0.9950 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 01:00Z | USD1@Ethereum | $1.0019 | 19.1 | - | - | resolved | 持续 11.0h 后解除（峰值 102.1 bps） | 1.0004 |
| 2026-07-01 02:00Z | USD1@Ethereum | $0.9941 | -58.7 | -27.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-01 02:00Z | USDG@Ethereum | $0.9973 | -27.5 | - | - | resolved | 持续 5.0h 后解除（峰值 50.6 bps） | - |
| 2026-07-01 03:00Z | USD1@Ethereum | $0.9985 | -14.9 | - | - | resolved | 持续 1.0h 后解除（峰值 58.7 bps） | 1.0004 |
| 2026-07-01 04:00Z | U@BSC | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 05:00Z | U@BSC | $1.0002 | 1.6 | - | - | resolved | 持续 1.0h 后解除（峰值 54.0 bps） | - |
| 2026-07-01 06:00Z | USD1@Ethereum | $0.9889 | -111.4 | -26.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-07-01 06:00Z | USDC@Base | $1.0075 | 75.2 | 25.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0011 |
| 2026-07-01 08:00Z | USDC@Base | $1.0012 | 12.3 | - | - | resolved | 持续 2.0h 后解除（峰值 75.2 bps） | 1.0009 |
| 2026-07-01 09:00Z | USD1@Ethereum | $1.0000 | 0.1 | - | - | resolved | 持续 3.0h 后解除（峰值 111.4 bps） | 1.0003 |
| 2026-07-01 14:00Z | USDG@Ethereum | $0.9941 | -59.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 15:00Z | USDS@Ethereum | $0.9948 | -51.9 | -26.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-01 15:00Z | USDT@Ethereum | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 15:00Z | USDe@Solana | $1.0022 | 21.8 | - | - | resolved | 持续 72.0h 后解除（峰值 547.5 bps） | 0.9995 |
| 2026-07-01 16:00Z | USDS@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | 1.0006 |
| 2026-07-01 16:00Z | USDT@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | - |
| 2026-07-01 16:00Z | USDe@Solana | $1.0113 | 113.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9995 |
| 2026-07-01 17:00Z | USD1@Ethereum | $0.9926 | -74.2 | -29.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-07-01 20:00Z | USDe@Solana | $0.9978 | -22.1 | - | - | resolved | 持续 4.0h 后解除（峰值 113.2 bps） | 0.9995 |
| 2026-07-01 21:00Z | USDe@Solana | $1.0165 | 164.5 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9995 |
| 2026-07-01 22:00Z | USDT@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 23:00Z | U@BSC | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-01 23:00Z | USD1@Ethereum | $0.9848 | -152.1 | - | unconfirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-07-02 00:00Z | USDG@Ethereum | $0.9974 | -25.7 | - | - | resolved | 持续 10.0h 后解除（峰值 60.7 bps） | - |
| 2026-07-02 00:00Z | USDT@Ethereum | $0.9975 | -25.4 | - | - | resolved | 持续 2.0h 后解除（峰值 55.0 bps） | - |
| 2026-07-02 00:00Z | USDe@Solana | $1.0003 | 3.2 | - | - | resolved | 持续 3.0h 后解除（峰值 199.7 bps） | 0.9995 |
| 2026-07-02 01:00Z | U@BSC | $1.0017 | 17.5 | - | - | resolved | 持续 2.0h 后解除（峰值 52.0 bps） | - |
| 2026-07-02 01:00Z | USDe@Solana | $1.0128 | 128.1 | 156.8 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-07-02 02:00Z | PYUSD@Ethereum | $1.0070 | 69.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 03:00Z | PYUSD@Ethereum | $1.0183 | 183.3 | - | unconfirmed | escalated | 预警升级为严重 | - |
| 2026-07-02 03:00Z | USD1@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 10.0h 后解除（峰值 152.1 bps） | 0.9998 |
| 2026-07-02 03:00Z | USDe@Solana | $1.0171 | 171.4 | 239.7 | confirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-07-02 04:00Z | PYUSD@Ethereum | $0.9978 | -21.9 | - | - | resolved | 持续 2.0h 后解除（峰值 183.3 bps） | - |
| 2026-07-02 04:00Z | USD1@Ethereum | $0.9894 | -106.3 | -33.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-07-02 04:00Z | USDG@Ethereum | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 05:00Z | PYUSD@Ethereum | $0.9940 | -60.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 06:00Z | PYUSD@Ethereum | $0.9974 | -25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 60.1 bps） | - |
| 2026-07-02 06:00Z | U@BSC | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 06:00Z | USDG@Ethereum | $1.0007 | 7.1 | - | - | resolved | 持续 2.0h 后解除（峰值 53.6 bps） | - |
| 2026-07-02 07:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 08:00Z | USDD@Ethereum | $1.0050 | 50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 08:00Z | USDT@Ethereum | $0.9993 | -6.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | - |
| 2026-07-02 09:00Z | U@BSC | $0.9978 | -21.7 | - | - | resolved | 持续 3.0h 后解除（峰值 53.1 bps） | - |
| 2026-07-02 10:00Z | USDD@Ethereum | $0.9984 | -16.2 | - | - | resolved | 持续 2.0h 后解除（峰值 50.1 bps） | - |
| 2026-07-02 12:00Z | USDG@Ethereum | $0.9950 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 16:00Z | USDG@Ethereum | $0.9997 | -3.2 | - | - | resolved | 持续 4.0h 后解除（峰值 73.7 bps） | - |
| 2026-07-02 17:00Z | USDG@Ethereum | $0.9936 | -63.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 19:00Z | USDD@BSC | $0.9942 | -57.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-02 20:00Z | USDG@Ethereum | $1.0012 | 12.1 | - | - | resolved | 持续 3.0h 后解除（峰值 69.3 bps） | - |
| 2026-07-02 20:00Z | USDS@Solana | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-07-02 21:00Z | USDC@Base | $0.9946 | -53.8 | -53.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-07-02 21:00Z | USDS@Solana | $1.0015 | 15 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | 1.0007 |
| 2026-07-02 22:00Z | USDC@Base | $1.0028 | 28.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | 1.0009 |
| 2026-07-02 22:00Z | USDG@Ethereum | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 08:00Z | PYUSD@Ethereum | $1.0066 | 66 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 09:00Z | PYUSD@Ethereum | $1.0014 | 14.1 | - | - | resolved | 持续 1.0h 后解除（峰值 66.0 bps） | - |
| 2026-07-03 11:00Z | USDD@BSC | $1.0022 | 21.6 | - | - | resolved | 持续 16.0h 后解除（峰值 57.6 bps） | - |
| 2026-07-03 11:00Z | USDG@Ethereum | $1.0013 | 12.9 | - | - | resolved | 持续 13.0h 后解除（峰值 65.1 bps） | - |
| 2026-07-03 12:00Z | USDG@Ethereum | $0.9943 | -56.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 14:00Z | USDD@BSC | $0.9944 | -56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 15:00Z | U@BSC | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 15:00Z | USDD@BSC | $1.0013 | 13.4 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | - |
| 2026-07-03 16:00Z | U@BSC | $0.9971 | -29.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-07-03 16:00Z | USD1@Ethereum | $1.0007 | 6.6 | - | - | resolved | 持续 36.0h 后解除（峰值 112.6 bps） | 0.9999 |
| 2026-07-03 16:00Z | USDe@Solana | $0.9985 | -15.5 | - | - | resolved | 持续 39.0h 后解除（峰值 618.1 bps） | 0.9995 |
| 2026-07-03 17:00Z | USDC@Base | $1.0053 | 52.9 | 43.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-07-03 18:00Z | USD1@Ethereum | $0.9914 | -85.6 | -31.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-07-03 18:00Z | USDe@Solana | $1.0085 | 85.1 | 68.4 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9995 |
| 2026-07-03 20:00Z | PYUSD@Ethereum | $1.0126 | 126.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 20:00Z | USDT@Arbitrum | $0.9935 | -65.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-03 20:00Z | USDe@Solana | $1.0170 | 169.8 | 188.3 | confirmed | escalated | 预警升级为严重 | 0.9994 |
| 2026-07-03 21:00Z | PYUSD@Ethereum | $0.9992 | -8.5 | - | - | resolved | 持续 1.0h 后解除（峰值 126.1 bps） | - |
| 2026-07-03 21:00Z | USDC@Base | $1.0010 | 9.5 | - | - | resolved | 持续 4.0h 后解除（峰值 52.9 bps） | 1.0008 |
| 2026-07-03 21:00Z | USDT@Arbitrum | $0.9994 | -5.7 | - | - | resolved | 持续 1.0h 后解除（峰值 65.3 bps） | - |
| 2026-07-04 07:00Z | USDG@Ethereum | $1.0017 | 17.2 | - | - | resolved | 持续 19.0h 后解除（峰值 62.1 bps） | - |
| 2026-07-04 08:00Z | PYUSD@Solana | $1.0070 | 70.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-04 08:00Z | USDG@Ethereum | $0.9941 | -59.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-04 09:00Z | PYUSD@Solana | $1.0562 | 562.5 | 9.8 | suspicious | escalated | 预警升级为严重 | - |
| 2026-07-04 09:00Z | USDG@Ethereum | $0.9995 | -5 | - | - | resolved | 持续 1.0h 后解除（峰值 59.4 bps） | - |
| 2026-07-04 10:00Z | PYUSD@Solana | $1.0006 | 5.8 | - | - | resolved | 持续 2.0h 后解除（峰值 562.5 bps） | - |
| 2026-07-04 10:00Z | USDD@BSC | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-04 10:00Z | USDG@Ethereum | $0.9938 | -61.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-04 11:00Z | USDe@Solana | $1.0017 | 17.3 | - | - | resolved | 持续 17.0h 后解除（峰值 288.5 bps） | 0.9996 |
| 2026-07-04 14:00Z | USDe@Solana | $1.0058 | 58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9996 |
| 2026-07-05 00:00Z | PYUSD@Ethereum | $0.9942 | -58.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-05 01:00Z | PYUSD@Ethereum | $1.0013 | 13.3 | - | - | resolved | 持续 1.0h 后解除（峰值 58.3 bps） | - |
| 2026-07-05 04:00Z | USDG@Ethereum | $0.9999 | -0.7 | - | - | resolved | 持续 18.0h 后解除（峰值 67.8 bps） | - |
| 2026-07-05 05:00Z | USDe@Solana | $0.9842 | -157.8 | -143.1 | confirmed | escalated | 预警升级为严重 | 0.9994 |
| 2026-07-05 13:00Z | U@BSC | $1.0055 | 55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-05 14:00Z | U@BSC | $1.0005 | 4.9 | - | - | resolved | 持续 1.0h 后解除（峰值 55.0 bps） | - |
| 2026-07-05 15:00Z | USDD@BSC | $0.9999 | -0.7 | - | - | resolved | 持续 29.0h 后解除（峰值 55.6 bps） | - |
| 2026-07-05 17:00Z | USD1@Ethereum | $0.9972 | -27.8 | - | - | resolved | 持续 47.0h 后解除（峰值 125.5 bps） | 0.9998 |
| 2026-07-05 19:00Z | USDD@BSC | $0.9898 | -102.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-05 20:00Z | USDC@Base | $0.9948 | -51.7 | -30.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-07-05 21:00Z | USDC@Base | $0.9972 | -27.6 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | 1.0007 |
| 2026-07-05 21:00Z | USDT@Arbitrum | $0.9939 | -61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-05 22:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-05 22:00Z | USDT@Arbitrum | $0.9980 | -19.7 | - | - | resolved | 持续 1.0h 后解除（峰值 61.0 bps） | - |
| 2026-07-05 22:00Z | USDe@Solana | $0.9994 | -5.9 | - | - | resolved | 持续 32.0h 后解除（峰值 219.9 bps） | 0.9995 |
| 2026-07-05 23:00Z | USDT@Ethereum | $1.0011 | 10.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | - |
| 2026-07-06 00:00Z | USDD@BSC | $0.9977 | -23.4 | - | - | resolved | 持续 5.0h 后解除（峰值 102.3 bps） | - |
| 2026-07-06 02:00Z | USDe@Solana | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-07-06 03:00Z | USD1@Ethereum | $0.9900 | -99.6 | -35.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-07-06 06:00Z | USDe@Solana | $0.9820 | -180.5 | -164.7 | confirmed | escalated | 预警升级为严重 | 0.9991 |
| 2026-07-06 09:00Z | U@BSC | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-06 09:00Z | USDG@Ethereum | $0.9939 | -61.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-06 10:00Z | PYUSD@Solana | $0.9925 | -74.7 | -74.1 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-06 11:00Z | PYUSD@Solana | $1.0025 | 25.4 | - | - | resolved | 持续 1.0h 后解除（峰值 74.7 bps） | - |
| 2026-07-06 11:00Z | U@BSC | $1.0010 | 10.4 | - | - | resolved | 持续 2.0h 后解除（峰值 51.6 bps） | - |
| 2026-07-06 16:00Z | USDe@Solana | $1.0022 | 22.5 | - | - | resolved | 持续 14.0h 后解除（峰值 257.7 bps） | 0.9994 |
| 2026-07-06 19:00Z | PYUSD@Solana | $0.9940 | -60.4 | -62.8 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-06 20:00Z | PYUSD@Solana | $0.9985 | -15 | - | - | resolved | 持续 1.0h 后解除（峰值 60.4 bps） | - |
| 2026-07-06 21:00Z | USDe@Solana | $1.0212 | 212.2 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9994 |
| 2026-07-06 22:00Z | USDT@Ethereum | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-06 23:00Z | USDT@Ethereum | $1.0005 | 4.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.6 bps） | - |
| 2026-07-07 02:00Z | USDG@Ethereum | $0.9975 | -25.3 | - | - | resolved | 持续 17.0h 后解除（峰值 62.6 bps） | - |
| 2026-07-07 02:00Z | USDT@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 02:00Z | USDe@Solana | $0.9971 | -28.9 | - | - | resolved | 持续 5.0h 后解除（峰值 212.2 bps） | 0.9995 |
| 2026-07-07 03:00Z | USDT@Ethereum | $1.0010 | 10 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-07-07 04:00Z | USDG@Ethereum | $0.9938 | -62.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 06:00Z | USDe@Solana | $1.0076 | 76.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9994 |
| 2026-07-07 07:00Z | USDG@Ethereum | $0.9987 | -13.1 | - | - | resolved | 持续 3.0h 后解除（峰值 67.3 bps） | - |
| 2026-07-07 07:00Z | USDS@Ethereum | $0.9946 | -53.6 | -25 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-07 07:00Z | USDT@Ethereum | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 09:00Z | USDS@Ethereum | $0.9978 | -22.5 | - | - | resolved | 持续 2.0h 后解除（峰值 53.6 bps） | 1.0007 |
| 2026-07-07 09:00Z | USDT@Ethereum | $0.9978 | -22.5 | - | - | resolved | 持续 2.0h 后解除（峰值 53.6 bps） | - |
| 2026-07-07 10:00Z | USD1@Ethereum | $0.9971 | -28.7 | - | - | resolved | 持续 31.0h 后解除（峰值 110.3 bps） | 0.9997 |
| 2026-07-07 10:00Z | USDS@Ethereum | $0.9946 | -54 | -26.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-07-07 10:00Z | USDT@Ethereum | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 11:00Z | USD1@Ethereum | $0.9946 | -53.9 | -33.8 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-07-07 14:00Z | USDS@Ethereum | $0.9989 | -10.7 | - | - | resolved | 持续 4.0h 后解除（峰值 55.0 bps） | 1.0009 |
| 2026-07-07 14:00Z | USDT@Ethereum | $0.9989 | -10.7 | - | - | resolved | 持续 4.0h 后解除（峰值 55.0 bps） | - |
| 2026-07-07 14:00Z | USDe@Solana | $1.0003 | 2.8 | - | - | resolved | 持续 8.0h 后解除（峰值 113.7 bps） | 0.9994 |
| 2026-07-07 15:00Z | USDe@Solana | $1.0171 | 170.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9994 |
| 2026-07-07 16:00Z | USDT@Ethereum | $0.9947 | -52.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 17:00Z | USDT@Ethereum | $0.9996 | -4.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.9 bps） | - |
| 2026-07-07 18:00Z | PYUSD@Ethereum | $0.9920 | -80.5 | -51.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-07 20:00Z | PYUSD@Ethereum | $0.9986 | -14.1 | - | - | resolved | 持续 2.0h 后解除（峰值 80.5 bps） | - |
| 2026-07-07 21:00Z | USDG@Ethereum | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-07 21:00Z | USDe@Solana | $1.0007 | 6.8 | - | - | resolved | 持续 6.0h 后解除（峰值 188.7 bps） | 0.9994 |
| 2026-07-08 00:00Z | USD1@Ethereum | $0.9985 | -15.4 | - | - | resolved | 持续 13.0h 后解除（峰值 102.1 bps） | 0.9996 |
| 2026-07-08 00:00Z | USDG@Ethereum | $0.9990 | -9.9 | - | - | resolved | 持续 3.0h 后解除（峰值 53.3 bps） | - |
| 2026-07-08 01:00Z | PYUSD@Ethereum | $0.9924 | -75.9 | -48.9 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-08 01:00Z | USDG@Ethereum | $0.9941 | -58.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 01:00Z | USDe@Solana | $0.9712 | -288.3 | -295.2 | confirmed | new-severe | 首次触发即严重（双源确认） | 0.9994 |
| 2026-07-08 02:00Z | PYUSD@Ethereum | $0.9996 | -3.8 | - | - | resolved | 持续 1.0h 后解除（峰值 75.9 bps） | - |
| 2026-07-08 03:00Z | PYUSD@Ethereum | $0.9945 | -55.1 | -54.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-08 04:00Z | PYUSD@Ethereum | $1.0030 | 29.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | - |
| 2026-07-08 04:00Z | USDG@Ethereum | $1.0011 | 11.1 | - | - | resolved | 持续 3.0h 后解除（峰值 58.6 bps） | - |
| 2026-07-08 06:00Z | USDD@Ethereum | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 08:00Z | PYUSD@Ethereum | $0.9903 | -97 | -26.5 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-08 08:00Z | USDD@Ethereum | $0.9987 | -13.1 | - | - | resolved | 持续 2.0h 后解除（峰值 51.4 bps） | - |
| 2026-07-08 09:00Z | PYUSD@Ethereum | $0.9997 | -2.9 | - | - | resolved | 持续 1.0h 后解除（峰值 97.0 bps） | - |
| 2026-07-08 09:00Z | USD1@Ethereum | $0.9940 | -60.2 | -33.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9996 |
| 2026-07-08 11:00Z | PYUSD@Ethereum | $1.0058 | 58.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 12:00Z | PYUSD@Ethereum | $0.9986 | -13.8 | - | - | resolved | 持续 1.0h 后解除（峰值 58.1 bps） | - |
| 2026-07-08 12:00Z | USDS@Ethereum | $0.9945 | -55.1 | -27.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-07-08 12:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 14:00Z | USDG@Ethereum | $0.9939 | -61.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 15:00Z | USDS@Ethereum | $0.9994 | -6.2 | - | - | resolved | 持续 3.0h 后解除（峰值 55.1 bps） | 1.0007 |
| 2026-07-08 15:00Z | USDT@Ethereum | $0.9994 | -6.2 | - | - | resolved | 持续 3.0h 后解除（峰值 55.1 bps） | - |
| 2026-07-08 16:00Z | PYUSD@Ethereum | $1.0066 | 65.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 17:00Z | USDT@Ethereum | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-08 18:00Z | PYUSD@Ethereum | $1.0028 | 28.1 | - | - | resolved | 持续 2.0h 后解除（峰值 65.9 bps） | - |
| 2026-07-08 18:00Z | USDT@Ethereum | $0.9980 | -19.8 | - | - | resolved | 持续 1.0h 后解除（峰值 54.2 bps） | - |
| 2026-07-08 21:00Z | USDG@Ethereum | $0.9972 | -28 | - | - | resolved | 持续 7.0h 后解除（峰值 61.1 bps） | - |
| 2026-07-08 23:00Z | USDC@Base | $1.0066 | 65.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-07-09 01:00Z | USDC@Base | $1.0011 | 10.7 | - | - | resolved | 持续 2.0h 后解除（峰值 65.8 bps） | 1.0006 |
| 2026-07-09 03:00Z | PYUSD@Ethereum | $0.9944 | -56.3 | -39.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-09 05:00Z | PYUSD@Ethereum | $1.0028 | 27.9 | - | - | resolved | 持续 2.0h 后解除（峰值 56.3 bps） | - |
| 2026-07-09 05:00Z | USD1@Ethereum | $0.9994 | -6.2 | - | - | resolved | 持续 20.0h 后解除（峰值 77.4 bps） | 0.9998 |
| 2026-07-09 07:00Z | USDS@Ethereum | $0.9947 | -53.4 | -45.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-09 07:00Z | USDT@Ethereum | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-09 10:00Z | USD1@Ethereum | $0.9946 | -54.4 | -68.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-07-09 10:00Z | USDD@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-09 11:00Z | USDD@BSC | $0.9941 | -58.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-09 11:00Z | USDS@Ethereum | $1.0008 | 7.9 | - | - | resolved | 持续 4.0h 后解除（峰值 66.3 bps） | 1.0006 |
| 2026-07-09 11:00Z | USDT@Ethereum | $1.0008 | 7.9 | - | - | resolved | 持续 4.0h 后解除（峰值 66.3 bps） | - |
| 2026-07-09 15:00Z | USD1@Ethereum | $0.9973 | -27.1 | - | - | resolved | 持续 5.0h 后解除（峰值 57.9 bps） | 0.9997 |
| 2026-07-09 15:00Z | USDS@Ethereum | $0.9940 | -60.2 | -45 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-09 15:00Z | USDT@Ethereum | $0.9940 | -60.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-09 17:00Z | USDD@Ethereum | $1.0026 | 26.4 | - | - | resolved | 持续 7.0h 后解除（峰值 51.8 bps） | - |
| 2026-07-09 19:00Z | USDD@Ethereum | $0.9936 | -63.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-09 23:00Z | USDS@Ethereum | $1.0016 | 15.8 | - | - | resolved | 持续 8.0h 后解除（峰值 60.2 bps） | 1.0006 |
| 2026-07-09 23:00Z | USDT@Ethereum | $1.0016 | 15.8 | - | - | resolved | 持续 8.0h 后解除（峰值 60.2 bps） | - |
| 2026-07-10 00:00Z | USDD@Ethereum | $0.9996 | -4.2 | - | - | resolved | 持续 5.0h 后解除（峰值 63.5 bps） | - |
| 2026-07-10 01:00Z | USDT@Arbitrum | $0.9885 | -114.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 02:00Z | PYUSD@Ethereum | $1.0127 | 127.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 02:00Z | USDT@Solana | $0.9944 | -55.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 03:00Z | USDT@Arbitrum | $0.9980 | -19.8 | - | - | resolved | 持续 2.0h 后解除（峰值 114.8 bps） | - |
| 2026-07-10 04:00Z | PYUSD@Ethereum | $0.9975 | -24.9 | - | - | resolved | 持续 2.0h 后解除（峰值 143.4 bps） | - |
| 2026-07-10 04:00Z | USDT@Solana | $1.0010 | 10.4 | - | - | resolved | 持续 2.0h 后解除（峰值 147.3 bps） | - |
| 2026-07-10 05:00Z | USDD@BSC | $0.9984 | -16 | - | - | resolved | 持续 18.0h 后解除（峰值 58.6 bps） | - |
| 2026-07-10 06:00Z | USDS@Ethereum | $0.9942 | -58.4 | -37.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-10 06:00Z | USDT@Ethereum | $0.9942 | -58.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 08:00Z | USDT@Solana | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 09:00Z | USDS@Ethereum | $0.9972 | -27.8 | - | - | resolved | 持续 3.0h 后解除（峰值 58.4 bps） | 1.0005 |
| 2026-07-10 09:00Z | USDT@Ethereum | $0.9972 | -27.8 | - | - | resolved | 持续 3.0h 后解除（峰值 58.4 bps） | - |
| 2026-07-10 10:00Z | USDT@Solana | $0.9995 | -4.7 | - | - | resolved | 持续 2.0h 后解除（峰值 54.3 bps） | - |
| 2026-07-10 12:00Z | USDD@BSC | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 18:00Z | USDS@Ethereum | $0.9946 | -53.6 | -53.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-07-10 18:00Z | USDT@Ethereum | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-10 19:00Z | USDS@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.6 bps） | 1.0006 |
| 2026-07-10 19:00Z | USDT@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.6 bps） | - |
| 2026-07-11 01:00Z | USDD@BSC | $0.9993 | -7.1 | - | - | resolved | 持续 13.0h 后解除（峰值 54.0 bps） | - |
| 2026-07-11 01:00Z | USDS@Ethereum | $0.9949 | -50.7 | -50.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-07-11 01:00Z | USDT@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-11 02:00Z | USDS@Ethereum | $0.9975 | -25 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | 1.0006 |
| 2026-07-11 02:00Z | USDT@Ethereum | $0.9975 | -25 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-07-11 05:00Z | USDT@Solana | $0.9938 | -62.2 | -64 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-11 08:00Z | USDT@Solana | $0.9991 | -8.6 | - | - | resolved | 持续 3.0h 后解除（峰值 68.1 bps） | - |
| 2026-07-11 10:00Z | USDe@Solana | $1.0008 | 7.9 | - | - | resolved | 持续 81.0h 后解除（峰值 613.6 bps） | 1.0006 |
| 2026-07-11 11:00Z | USDT@Solana | $0.9942 | -57.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-11 13:00Z | USDT@Solana | $1.0016 | 15.9 | - | - | resolved | 持续 2.0h 后解除（峰值 58.3 bps） | - |
| 2026-07-11 13:00Z | USDe@Solana | $1.0052 | 52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-11 14:00Z | USDT@Solana | $0.9934 | -65.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-11 14:00Z | USDT@Arbitrum | $0.9947 | -53.2 | -53.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-11 15:00Z | USDT@Solana | $0.9972 | -28.5 | - | - | resolved | 持续 1.0h 后解除（峰值 65.9 bps） | - |
| 2026-07-11 15:00Z | USDT@Arbitrum | $1.0000 | -0.3 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-07-11 16:00Z | USDe@Solana | $0.9981 | -18.6 | - | - | resolved | 持续 3.0h 后解除（峰值 63.6 bps） | 1.0007 |
| 2026-07-11 22:00Z | USDS@Ethereum | $0.9944 | -55.5 | -50.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-07-11 22:00Z | USDT@Ethereum | $0.9944 | -55.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-11 23:00Z | PYUSD@Ethereum | $0.9875 | -124.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-11 23:00Z | USDS@Ethereum | $1.0007 | 7.2 | - | - | resolved | 持续 1.0h 后解除（峰值 55.5 bps） | 1.0006 |
| 2026-07-11 23:00Z | USDT@Ethereum | $1.0007 | 7.2 | - | - | resolved | 持续 1.0h 后解除（峰值 55.5 bps） | - |
| 2026-07-12 00:00Z | PYUSD@Ethereum | $1.0004 | 3.7 | - | - | resolved | 持续 1.0h 后解除（峰值 124.6 bps） | - |
| 2026-07-12 00:00Z | USDe@Solana | $0.9706 | -293.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0006 |
| 2026-07-12 05:00Z | USDS@Ethereum | $0.9947 | -53.1 | -47.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-12 05:00Z | USDT@Ethereum | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-12 07:00Z | USDS@Ethereum | $0.9983 | -17.2 | - | - | resolved | 持续 2.0h 后解除（峰值 53.1 bps） | 1.0005 |
| 2026-07-12 07:00Z | USDT@Ethereum | $0.9983 | -17.2 | - | - | resolved | 持续 2.0h 后解除（峰值 53.1 bps） | - |
| 2026-07-12 10:00Z | USDS@Ethereum | $0.9947 | -52.6 | -47.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-12 10:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-12 10:00Z | USDT@Solana | $0.9941 | -59.2 | -25.5 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-12 11:00Z | USDS@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | 1.0005 |
| 2026-07-12 11:00Z | USDT@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.6 bps） | - |
| 2026-07-12 12:00Z | USDT@Solana | $1.0001 | 1.4 | - | - | resolved | 持续 2.0h 后解除（峰值 59.2 bps） | - |
| 2026-07-12 15:00Z | USDD@BSC | $0.9938 | -62 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-12 16:00Z | USDT@Solana | $0.9919 | -81.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-12 17:00Z | USDT@Solana | $1.0029 | 28.6 | - | - | resolved | 持续 1.0h 后解除（峰值 81.1 bps） | - |
| 2026-07-12 18:00Z | USDC@Base | $0.9950 | -50.1 | -52.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-07-12 18:00Z | USDD@BSC | $1.0007 | 7.1 | - | - | resolved | 持续 3.0h 后解除（峰值 62.0 bps） | - |
| 2026-07-12 19:00Z | USDC@Base | $0.9975 | -25.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | 1.0004 |
| 2026-07-13 02:00Z | USDe@Solana | $0.9986 | -14.3 | - | - | resolved | 持续 26.0h 后解除（峰值 293.8 bps） | 1.0003 |
| 2026-07-13 06:00Z | U@BSC | $0.9904 | -96 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-13 06:00Z | USDS@Ethereum | $0.9950 | -50.1 | -45.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-13 06:00Z | USDT@Ethereum | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-13 07:00Z | U@BSC | $0.9973 | -26.8 | - | - | resolved | 持续 1.0h 后解除（峰值 96.0 bps） | - |
| 2026-07-13 10:00Z | USDe@Solana | $0.9908 | -92.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-07-13 12:00Z | USDS@Ethereum | $1.0002 | 2.1 | - | - | resolved | 持续 6.0h 后解除（峰值 54.6 bps） | 1.0006 |
| 2026-07-13 12:00Z | USDT@Ethereum | $1.0002 | 2.1 | - | - | resolved | 持续 6.0h 后解除（峰值 54.6 bps） | - |
| 2026-07-13 13:00Z | USDe@Solana | $0.9780 | -219.6 | -204.9 | confirmed | escalated | 预警升级为严重 | 1.0004 |
| 2026-07-13 15:00Z | USDT@Ethereum | $0.9937 | -63.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-13 17:00Z | USDT@Ethereum | $1.0028 | 28.3 | - | - | resolved | 持续 2.0h 后解除（峰值 63.1 bps） | - |
| 2026-07-13 20:00Z | USDT@Solana | $0.9941 | -58.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 00:00Z | USDT@Solana | $1.0009 | 8.6 | - | - | resolved | 持续 4.0h 后解除（峰值 58.8 bps） | - |
| 2026-07-14 01:00Z | PYUSD@Ethereum | $1.0081 | 81.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 01:00Z | USDS@Ethereum | $0.9939 | -60.8 | -50.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0011 |
| 2026-07-14 01:00Z | USDT@Ethereum | $0.9939 | -60.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 02:00Z | PYUSD@Ethereum | $1.0019 | 19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 81.4 bps） | - |
| 2026-07-14 02:00Z | USDS@Ethereum | $1.0027 | 27 | - | - | resolved | 持续 1.0h 后解除（峰值 60.8 bps） | 1.001 |
| 2026-07-14 02:00Z | USDT@Ethereum | $1.0027 | 27 | - | - | resolved | 持续 1.0h 后解除（峰值 60.8 bps） | - |
| 2026-07-14 03:00Z | USDT@Solana | $0.9936 | -64.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 05:00Z | USDT@Solana | $1.0015 | 15.2 | - | - | resolved | 持续 2.0h 后解除（峰值 64.3 bps） | - |
| 2026-07-14 05:00Z | USDe@Solana | $0.9973 | -26.6 | - | - | resolved | 持续 19.0h 后解除（峰值 315.4 bps） | 1.0009 |
| 2026-07-14 06:00Z | U@BSC | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 06:00Z | USDD@Ethereum | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 07:00Z | U@BSC | $0.9972 | -28.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-07-14 07:00Z | USDT@Ethereum | $0.9943 | -57.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 07:00Z | USDT@Solana | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 08:00Z | USDT@Solana | $1.0000 | 0.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-07-14 10:00Z | PYUSD@Ethereum | $1.0052 | 51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 10:00Z | USDT@Ethereum | $0.9970 | -29.9 | - | - | resolved | 持续 3.0h 后解除（峰值 57.3 bps） | - |
| 2026-07-14 11:00Z | PYUSD@Ethereum | $0.9996 | -3.7 | - | - | resolved | 持续 1.0h 后解除（峰值 51.6 bps） | - |
| 2026-07-14 12:00Z | USDe@Solana | $1.0196 | 195.9 | 155.8 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0007 |
| 2026-07-14 14:00Z | USDe@Solana | $1.0001 | 0.9 | - | - | resolved | 持续 2.0h 后解除（峰值 195.9 bps） | 1.0007 |
| 2026-07-14 15:00Z | USDT@Solana | $0.9937 | -62.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-14 16:00Z | USD1@Ethereum | $0.9935 | -64.6 | -64.4 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-07-14 17:00Z | USDD@Ethereum | $0.9999 | -0.5 | - | - | resolved | 持续 11.0h 后解除（峰值 54.3 bps） | - |
| 2026-07-14 17:00Z | USDT@Solana | $0.9980 | -20 | - | - | resolved | 持续 2.0h 后解除（峰值 62.5 bps） | - |
| 2026-07-14 19:00Z | USD1@Ethereum | $0.9983 | -17.2 | - | - | resolved | 持续 3.0h 后解除（峰值 64.6 bps） | 0.9996 |
| 2026-07-14 20:00Z | USDe@Solana | $0.9937 | -63.2 | -39.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-14 21:00Z | USDe@Solana | $0.9980 | -19.6 | - | - | resolved | 持续 1.0h 后解除（峰值 63.2 bps） | 1.0006 |
| 2026-07-14 23:00Z | PYUSD@Ethereum | $1.0075 | 74.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 01:00Z | USDS@Ethereum | $0.9947 | -52.6 | -44 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-15 01:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 01:00Z | USDe@Solana | $0.9941 | -59.3 | -35.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-07-15 02:00Z | PYUSD@Ethereum | $0.9999 | -0.6 | - | - | resolved | 持续 3.0h 后解除（峰值 74.7 bps） | - |
| 2026-07-15 02:00Z | USDD@BSC | $0.9942 | -57.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 03:00Z | USDS@Ethereum | $0.9985 | -14.8 | - | - | resolved | 持续 2.0h 后解除（峰值 59.7 bps） | 1.0006 |
| 2026-07-15 03:00Z | USDT@Ethereum | $0.9985 | -14.8 | - | - | resolved | 持续 2.0h 后解除（峰值 59.7 bps） | - |
| 2026-07-15 04:00Z | USDe@Solana | $1.0022 | 21.6 | - | - | resolved | 持续 3.0h 后解除（峰值 59.3 bps） | 1.0004 |
| 2026-07-15 06:00Z | USDe@Solana | $1.0081 | 81.4 | 70.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-07-15 07:00Z | USDD@Ethereum | $0.9936 | -63.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 07:00Z | USDe@Solana | $0.9985 | -15.2 | - | - | resolved | 持续 1.0h 后解除（峰值 81.4 bps） | 1.0004 |
| 2026-07-15 10:00Z | USDS@Ethereum | $0.9945 | -55.3 | -46.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-15 10:00Z | USDT@Ethereum | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 11:00Z | USDS@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | 1.0006 |
| 2026-07-15 11:00Z | USDT@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-07-15 12:00Z | USDe@Ethereum | $0.9939 | -61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-07-15 12:00Z | USDe@Solana | $1.0074 | 74.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-07-15 13:00Z | USDe@Ethereum | $0.9986 | -13.6 | - | - | resolved | 持续 1.0h 后解除（峰值 61.0 bps） | 1.0005 |
| 2026-07-15 14:00Z | USDD@Ethereum | $0.9971 | -29.4 | - | - | resolved | 持续 7.0h 后解除（峰值 63.8 bps） | - |
| 2026-07-15 14:00Z | USDD@BSC | $1.0012 | 12.1 | - | - | resolved | 持续 12.0h 后解除（峰值 57.8 bps） | - |
| 2026-07-15 15:00Z | USDD@BSC | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-15 16:00Z | USDe@Solana | $0.9819 | -181.3 | - | unconfirmed | escalated | 预警升级为严重 | 1.0004 |
| 2026-07-15 20:00Z | USDD@BSC | $0.9980 | -20.2 | - | - | resolved | 持续 5.0h 后解除（峰值 54.6 bps） | - |
| 2026-07-15 21:00Z | USDS@Ethereum | $0.9946 | -53.7 | -34.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-15 21:00Z | USDT@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 00:00Z | USDS@Ethereum | $1.0010 | 10.2 | - | - | resolved | 持续 3.0h 后解除（峰值 53.7 bps） | 1.0007 |
| 2026-07-16 00:00Z | USDT@Ethereum | $1.0010 | 10.2 | - | - | resolved | 持续 3.0h 后解除（峰值 53.7 bps） | - |
| 2026-07-16 04:00Z | U@BSC | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 05:00Z | U@BSC | $1.0021 | 21.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-07-16 09:00Z | USDD@Ethereum | $0.9943 | -57.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 09:00Z | USDT@Ethereum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 11:00Z | USDT@Ethereum | $1.0017 | 16.5 | - | - | resolved | 持续 2.0h 后解除（峰值 52.7 bps） | - |
| 2026-07-16 13:00Z | PYUSD@Ethereum | $1.0051 | 51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 14:00Z | USDD@Ethereum | $1.0007 | 6.6 | - | - | resolved | 持续 5.0h 后解除（峰值 57.1 bps） | - |
| 2026-07-16 15:00Z | PYUSD@Ethereum | $0.9980 | -20 | - | - | resolved | 持续 2.0h 后解除（峰值 55.7 bps） | - |
| 2026-07-16 17:00Z | USDT@Ethereum | $0.9941 | -58.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-16 18:00Z | USDT@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 58.9 bps） | - |
| 2026-07-17 01:00Z | USDS@Ethereum | $0.9947 | -52.7 | -45.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-17 01:00Z | USDT@Ethereum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-17 01:00Z | USDe@Solana | $1.0000 | 0.3 | - | - | resolved | 持续 37.0h 后解除（峰值 398.9 bps） | 1.0005 |
| 2026-07-17 02:00Z | USDS@Ethereum | $1.0008 | 8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | 1.0006 |
| 2026-07-17 02:00Z | USDT@Ethereum | $1.0008 | 8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | - |
| 2026-07-17 02:00Z | USDe@Solana | $0.9902 | -97.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-07-17 10:00Z | PYUSD@Solana | $0.9635 | -364.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-07-17 11:00Z | PYUSD@Solana | $1.0003 | 3.5 | - | - | resolved | 持续 1.0h 后解除（峰值 364.8 bps） | - |
| 2026-07-17 11:00Z | USDT@Solana | $0.9941 | -58.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-17 12:00Z | PYUSD@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-17 12:00Z | USDT@Solana | $0.9973 | -26.7 | - | - | resolved | 持续 1.0h 后解除（峰值 58.7 bps） | - |
| 2026-07-17 13:00Z | USDe@Solana | $0.9990 | -10.3 | - | - | resolved | 持续 11.0h 后解除（峰值 148.8 bps） | 1.0004 |
| 2026-07-17 14:00Z | PYUSD@Ethereum | $1.0014 | 14.4 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | - |
| 2026-07-17 14:00Z | USDe@Solana | $1.0067 | 67.2 | 63.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-07-17 17:00Z | USDe@Solana | $1.0193 | 193.4 | 217.5 | confirmed | escalated | 预警升级为严重 | 1.0005 |
| 2026-07-18 00:00Z | USDT@Solana | $0.9926 | -74 | -47.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-18 01:00Z | USDT@Solana | $0.9996 | -4.4 | - | - | resolved | 持续 1.0h 后解除（峰值 74.0 bps） | - |
| 2026-07-18 04:00Z | USDG@Ethereum | $1.0381 | 380.7 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-07-18 05:00Z | USDG@Ethereum | $1.0002 | 2.4 | - | - | resolved | 持续 1.0h 后解除（峰值 380.7 bps） | - |
| 2026-07-18 08:00Z | PYUSD@Solana | $0.9938 | -61.9 | -29 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-18 09:00Z | PYUSD@Solana | $1.0006 | 5.9 | - | - | resolved | 持续 1.0h 后解除（峰值 61.9 bps） | - |
| 2026-07-18 18:00Z | USDC@Base | $0.9923 | -76.6 | -43.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-18 22:00Z | USDe@Solana | $0.9997 | -3.1 | - | - | resolved | 持续 32.0h 后解除（峰值 215.8 bps） | 1.0003 |
| 2026-07-19 00:00Z | USDT@Solana | $0.9932 | -67.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 01:00Z | USDD@Ethereum | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 02:00Z | USDC@Base | $0.9974 | -25.7 | - | - | resolved | 持续 8.0h 后解除（峰值 76.6 bps） | 1.0006 |
| 2026-07-19 02:00Z | USDT@Solana | $0.9980 | -19.6 | - | - | resolved | 持续 2.0h 后解除（峰值 96.3 bps） | - |
| 2026-07-19 02:00Z | USDe@Solana | $1.0102 | 102 | 110.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-07-19 03:00Z | U@BSC | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 03:00Z | USDD@Ethereum | $1.0019 | 18.6 | - | - | resolved | 持续 2.0h 后解除（峰值 50.2 bps） | - |
| 2026-07-19 03:00Z | USDT@Solana | $0.9925 | -75.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 04:00Z | USDT@Solana | $0.9994 | -6.2 | - | - | resolved | 持续 1.0h 后解除（峰值 75.4 bps） | - |
| 2026-07-19 06:00Z | U@BSC | $1.0003 | 2.8 | - | - | resolved | 持续 3.0h 后解除（峰值 51.4 bps） | - |
| 2026-07-19 09:00Z | USDS@Ethereum | $0.9944 | -56.1 | -49.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-19 09:00Z | USDT@Ethereum | $0.9944 | -56.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 12:00Z | USDS@Ethereum | $1.0024 | 24.2 | - | - | resolved | 持续 3.0h 后解除（峰值 56.1 bps） | 1.0006 |
| 2026-07-19 12:00Z | USDT@Ethereum | $1.0024 | 24.2 | - | - | resolved | 持续 3.0h 后解除（峰值 56.1 bps） | - |
| 2026-07-19 18:00Z | USDT@Solana | $0.9940 | -60.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 21:00Z | USDS@Ethereum | $0.9950 | -50.3 | -44.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-19 21:00Z | USDT@Ethereum | $0.9950 | -50.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 21:00Z | USDT@Solana | $0.9981 | -18.5 | - | - | resolved | 持续 3.0h 后解除（峰值 60.2 bps） | - |
| 2026-07-19 22:00Z | USDS@Ethereum | $1.0019 | 19.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.3 bps） | 1.0006 |
| 2026-07-19 22:00Z | USDT@Ethereum | $1.0019 | 19.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.3 bps） | - |
| 2026-07-19 22:00Z | USDT@Solana | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-19 23:00Z | USDT@Solana | $1.0005 | 5.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | - |
| 2026-07-20 00:00Z | USDe@Solana | $1.0176 | 176.4 | - | unconfirmed | escalated | 预警升级为严重 | 1.0005 |
| 2026-07-20 04:00Z | USDT@Ethereum | $0.9939 | -61.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-20 05:00Z | USDT@Ethereum | $1.0007 | 7.2 | - | - | resolved | 持续 1.0h 后解除（峰值 61.5 bps） | - |
| 2026-07-20 06:00Z | USDe@Solana | $1.0020 | 19.8 | - | - | resolved | 持续 28.0h 后解除（峰值 229.1 bps） | 1.0005 |
| 2026-07-20 08:00Z | USDe@Solana | $1.0072 | 72.1 | 81.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-07-20 10:00Z | USDD@BSC | $0.9940 | -59.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-20 11:00Z | USDe@Solana | $0.9978 | -22.2 | - | - | resolved | 持续 3.0h 后解除（峰值 148.5 bps） | 1.0006 |
| 2026-07-20 12:00Z | USDT@Ethereum | $0.9939 | -60.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-20 13:00Z | USDT@Ethereum | $1.0007 | 6.6 | - | - | resolved | 持续 1.0h 后解除（峰值 60.9 bps） | - |
| 2026-07-20 14:00Z | USDe@Solana | $0.9936 | -63.5 | -62.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0009 |
| 2026-07-20 18:00Z | USDe@Solana | $1.0175 | 174.7 | - | unconfirmed | escalated | 预警升级为严重 | 1.0008 |
| 2026-07-20 20:00Z | PYUSD@Solana | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-20 21:00Z | PYUSD@Solana | $0.9991 | -8.7 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-07-20 22:00Z | USDT@Ethereum | $0.9941 | -59.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-20 22:00Z | USDT@Solana | $0.9924 | -75.6 | -42.9 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-20 23:00Z | USDT@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 1.0h 后解除（峰值 59.3 bps） | - |
| 2026-07-21 02:00Z | USDT@Solana | $0.9977 | -23.2 | - | - | resolved | 持续 4.0h 后解除（峰值 87.5 bps） | - |
| 2026-07-21 03:00Z | USDT@Solana | $1.0054 | 54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 04:00Z | USDT@Solana | $1.0014 | 14.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | - |
| 2026-07-21 06:00Z | USDT@Solana | $1.0067 | 67.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 07:00Z | USDT@Solana | $0.9973 | -27.2 | - | - | resolved | 持续 1.0h 后解除（峰值 67.4 bps） | - |
| 2026-07-21 08:00Z | USDD@Ethereum | $0.9935 | -65.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 08:00Z | USDT@Solana | $0.9941 | -59.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 09:00Z | U@BSC | $0.9903 | -97.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 10:00Z | U@BSC | $1.0010 | 10.1 | - | - | resolved | 持续 1.0h 后解除（峰值 97.2 bps） | - |
| 2026-07-21 10:00Z | USDS@Ethereum | $0.9938 | -62 | -28.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-07-21 10:00Z | USDT@Ethereum | $0.9938 | -62 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 11:00Z | USDT@Solana | $0.9996 | -4.2 | - | - | resolved | 持续 3.0h 后解除（峰值 70.5 bps） | - |
| 2026-07-21 12:00Z | USDD@Ethereum | $0.9983 | -16.7 | - | - | resolved | 持续 4.0h 后解除（峰值 65.4 bps） | - |
| 2026-07-21 12:00Z | USDD@BSC | $0.9993 | -7.2 | - | - | resolved | 持续 26.0h 后解除（峰值 64.9 bps） | - |
| 2026-07-21 13:00Z | USDS@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 3.0h 后解除（峰值 62.0 bps） | 1.0007 |
| 2026-07-21 13:00Z | USDT@Ethereum | $0.9982 | -18.4 | - | - | resolved | 持续 3.0h 后解除（峰值 62.0 bps） | - |
| 2026-07-21 15:00Z | USDD@BSC | $0.9945 | -55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 15:00Z | USDT@Solana | $0.9910 | -89.5 | -37.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-21 16:00Z | USDT@Solana | $0.9977 | -22.9 | - | - | resolved | 持续 1.0h 后解除（峰值 89.5 bps） | - |
| 2026-07-21 19:00Z | USDT@Solana | $0.9934 | -66.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-21 21:00Z | USDT@Solana | $0.9979 | -21 | - | - | resolved | 持续 2.0h 后解除（峰值 66.4 bps） | - |
| 2026-07-21 23:00Z | USDT@Solana | $1.0064 | 64.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-22 01:00Z | USD1@Ethereum | $0.9936 | -63.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-07-22 01:00Z | USDT@Solana | $0.9974 | -26.2 | - | - | resolved | 持续 2.0h 后解除（峰值 64.3 bps） | - |
| 2026-07-22 02:00Z | USDS@Ethereum | $0.9947 | -53.2 | -47.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-07-22 02:00Z | USDT@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-22 04:00Z | PYUSD@Solana | $0.9666 | -334.2 | -300.6 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-07-22 04:00Z | USDG@Solana | $0.9949 | -51.2 | -28 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-22 04:00Z | USDS@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 2.0h 后解除（峰值 53.2 bps） | 1.0005 |
| 2026-07-22 04:00Z | USDT@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 2.0h 后解除（峰值 53.2 bps） | - |
| 2026-07-22 05:00Z | PYUSD@Solana | $0.9981 | -18.7 | - | - | resolved | 持续 1.0h 后解除（峰值 334.2 bps） | - |
| 2026-07-22 05:00Z | USDD@BSC | $0.9992 | -7.6 | - | - | resolved | 持续 14.0h 后解除（峰值 55.4 bps） | - |
| 2026-07-22 05:00Z | USDG@Solana | $0.9988 | -12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.2 bps） | - |
| 2026-07-22 05:00Z | USDT@Ethereum | $0.9944 | -56.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-22 06:00Z | USDT@Ethereum | $1.0013 | 13 | - | - | resolved | 持续 1.0h 后解除（峰值 56.1 bps） | - |
| 2026-07-22 07:00Z | USDT@Solana | $0.9935 | -65.2 | -46.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-22 08:00Z | PYUSD@Solana | $0.9901 | -99.2 | -121.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-22 08:00Z | USD1@Ethereum | $0.9977 | -22.9 | - | - | resolved | 持续 7.0h 后解除（峰值 63.7 bps） | 0.9997 |
| 2026-07-22 09:00Z | USDT@Solana | $0.9985 | -14.6 | - | - | resolved | 持续 2.0h 后解除（峰值 65.2 bps） | - |
| 2026-07-22 10:00Z | PYUSD@Solana | $0.9998 | -2 | - | - | resolved | 持续 2.0h 后解除（峰值 99.2 bps） | - |
| 2026-07-22 15:00Z | USDS@Ethereum | $0.9949 | -50.8 | -41.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-22 15:00Z | USDT@Ethereum | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-22 16:00Z | USDT@Solana | $0.9943 | -56.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-22 17:00Z | USDT@Solana | $0.9996 | -3.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.7 bps） | - |
| 2026-07-22 18:00Z | USDS@Ethereum | $0.9976 | -23.5 | - | - | resolved | 持续 3.0h 后解除（峰值 50.8 bps） | 1.0004 |
| 2026-07-22 18:00Z | USDT@Ethereum | $0.9976 | -23.5 | - | - | resolved | 持续 3.0h 后解除（峰值 50.8 bps） | - |
| 2026-07-23 00:00Z | USDe@Solana | $1.0030 | 29.9 | - | - | resolved | 持续 58.0h 后解除（峰值 266.9 bps） | 1.0007 |
| 2026-07-23 01:00Z | USDD@BSC | $0.9940 | -60 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 03:00Z | USD1@Ethereum | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-07-23 03:00Z | USDT@Solana | $0.9941 | -58.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 03:00Z | USDe@Solana | $0.9895 | -105.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-07-23 04:00Z | USDS@Ethereum | $0.9942 | -57.7 | -50.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-07-23 04:00Z | USDT@Ethereum | $0.9942 | -57.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 04:00Z | USDT@Solana | $1.0023 | 22.6 | - | - | resolved | 持续 1.0h 后解除（峰值 58.7 bps） | - |
| 2026-07-23 06:00Z | USDS@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 2.0h 后解除（峰值 57.7 bps） | 1.0004 |
| 2026-07-23 06:00Z | USDT@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 2.0h 后解除（峰值 57.7 bps） | - |
| 2026-07-23 08:00Z | PYUSD@Ethereum | $1.0052 | 52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 08:00Z | USD1@Ethereum | $0.9981 | -18.7 | - | - | resolved | 持续 5.0h 后解除（峰值 58.2 bps） | 0.9997 |
| 2026-07-23 08:00Z | USDD@BSC | $0.9977 | -23.3 | - | - | resolved | 持续 7.0h 后解除（峰值 60.0 bps） | - |
| 2026-07-23 09:00Z | USDT@Solana | $0.9941 | -59 | -83.3 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-07-23 10:00Z | PYUSD@Ethereum | $1.0016 | 16.1 | - | - | resolved | 持续 2.0h 后解除（峰值 52.5 bps） | - |
| 2026-07-23 11:00Z | USDT@Solana | $1.0023 | 23.3 | - | - | resolved | 持续 2.0h 后解除（峰值 59.0 bps） | - |
| 2026-07-23 12:00Z | USDD@BSC | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 13:00Z | USDe@Solana | $0.9817 | -182.7 | -175.7 | confirmed | escalated | 预警升级为严重 | 1.0006 |
| 2026-07-23 16:00Z | USDD@BSC | $0.9971 | -29.4 | - | - | resolved | 持续 4.0h 后解除（峰值 52.5 bps） | - |
| 2026-07-23 17:00Z | USDT@Solana | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 18:00Z | USDT@Solana | $0.9992 | -8.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.3 bps） | - |
| 2026-07-23 20:00Z | PYUSD@Ethereum | $1.0062 | 61.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 21:00Z | PYUSD@Ethereum | $0.9991 | -9 | - | - | resolved | 持续 1.0h 后解除（峰值 61.6 bps） | - |
| 2026-07-23 21:00Z | USDC@Arbitrum | $0.9945 | -55 | -55 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-07-23 22:00Z | PYUSD@Solana | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-23 22:00Z | USD1@Ethereum | $0.9943 | -56.6 | -25.3 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-07-23 22:00Z | USDC@Arbitrum | $0.9997 | -3.5 | - | - | resolved | 持续 1.0h 后解除（峰值 55.0 bps） | 1.0007 |
| 2026-07-24 01:00Z | PYUSD@Solana | $1.0006 | 5.6 | - | - | resolved | 持续 3.0h 后解除（峰值 53.2 bps） | - |
| 2026-07-24 01:00Z | USD1@Ethereum | $0.9988 | -11.8 | - | - | resolved | 持续 3.0h 后解除（峰值 56.6 bps） | 0.9996 |
| 2026-07-24 02:00Z | USDS@Ethereum | $0.9942 | -58 | -42.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-24 02:00Z | USDT@Ethereum | $0.9942 | -58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-24 03:00Z | USDS@Ethereum | $0.9985 | -14.5 | - | - | resolved | 持续 1.0h 后解除（峰值 58.0 bps） | 1.0007 |
| 2026-07-24 03:00Z | USDT@Ethereum | $0.9985 | -14.5 | - | - | resolved | 持续 1.0h 后解除（峰值 58.0 bps） | - |
| 2026-07-24 08:00Z | PYUSD@Ethereum | $0.9942 | -58.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-24 08:00Z | USDS@Ethereum | $0.9945 | -54.9 | -49 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-07-24 08:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-24 09:00Z | PYUSD@Ethereum | $1.0012 | 12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 58.1 bps） | - |
| 2026-07-24 10:00Z | U@BSC | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-24 10:00Z | USDD@BSC | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-24 12:00Z | USDS@Ethereum | $0.9997 | -3.2 | - | - | resolved | 持续 4.0h 后解除（峰值 54.9 bps） | 1.0006 |
| 2026-07-24 12:00Z | USDT@Ethereum | $0.9997 | -3.2 | - | - | resolved | 持续 4.0h 后解除（峰值 54.9 bps） | - |
| 2026-07-24 13:00Z | U@BSC | $0.9982 | -18.3 | - | - | resolved | 持续 3.0h 后解除（峰值 52.4 bps） | - |
| 2026-07-24 13:00Z | USDD@BSC | $1.0018 | 18 | - | - | resolved | 持续 3.0h 后解除（峰值 50.6 bps） | - |
| 2026-07-24 21:00Z | USDS@Ethereum | $0.9944 | -56 | -36.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-07-24 21:00Z | USDT@Ethereum | $0.9944 | -56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-25 04:00Z | USDD@BSC | $0.9936 | -64.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-25 06:00Z | USDS@Ethereum | $0.9996 | -4.4 | - | - | resolved | 持续 9.0h 后解除（峰值 56.0 bps） | 1.0008 |
| 2026-07-25 06:00Z | USDT@Ethereum | $0.9996 | -4.4 | - | - | resolved | 持续 9.0h 后解除（峰值 56.0 bps） | - |
| 2026-07-25 09:00Z | USDD@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-25 13:00Z | USDD@BSC | $1.0030 | 29.9 | - | - | resolved | 持续 9.0h 后解除（峰值 64.1 bps） | - |
| 2026-07-25 21:00Z | USD1@Ethereum | $0.9950 | -50.1 | -32.7 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-07-26 00:00Z | USDD@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 15.0h 后解除（峰值 50.7 bps） | - |
| 2026-07-26 03:00Z | U@BSC | $0.9949 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-26 04:00Z | U@BSC | $1.0016 | 16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 51.5 bps） | - |
| 2026-07-26 08:00Z | USDD@Ethereum | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-26 15:00Z | USDD@Ethereum | $0.9979 | -20.6 | - | - | resolved | 持续 7.0h 后解除（峰值 50.8 bps） | - |
| 2026-07-26 15:00Z | USDe@Solana | $1.0000 | 0.4 | - | - | resolved | 持续 84.0h 后解除（峰值 599.8 bps） | 1.0009 |
| 2026-07-26 16:00Z | PYUSD@Solana | $0.9926 | -73.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-26 16:00Z | USDS@Ethereum | $0.9937 | -62.7 | -33.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-07-26 16:00Z | USDT@Ethereum | $0.9937 | -62.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-26 17:00Z | PYUSD@Solana | $1.0001 | 1.3 | - | - | resolved | 持续 1.0h 后解除（峰值 73.8 bps） | - |
| 2026-07-26 20:00Z | PYUSD@Solana | $0.9926 | -74.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-26 21:00Z | PYUSD@Solana | $1.0013 | 13.1 | - | - | resolved | 持续 1.0h 后解除（峰值 74.1 bps） | - |
| 2026-07-26 21:00Z | USDS@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 5.0h 后解除（峰值 62.7 bps） | 1.0009 |
| 2026-07-26 21:00Z | USDT@Ethereum | $0.9980 | -19.6 | - | - | resolved | 持续 5.0h 后解除（峰值 62.7 bps） | - |
| 2026-07-26 22:00Z | USDe@Solana | $1.0153 | 153.2 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0007 |
| 2026-07-27 04:00Z | USDe@Solana | $1.0019 | 19.3 | - | - | resolved | 持续 6.0h 后解除（峰值 225.5 bps） | 1.0009 |
| 2026-07-27 05:00Z | USD1@Ethereum | $0.9979 | -21.3 | - | - | resolved | 持续 32.0h 后解除（峰值 50.1 bps） | 0.9998 |
| 2026-07-27 06:00Z | USDe@Solana | $1.0053 | 52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-27 07:00Z | USDD@BSC | $0.9944 | -56.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-27 07:00Z | USDe@Solana | $1.0028 | 28.1 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | 1.0008 |
| 2026-07-27 11:00Z | USDC@Base | $0.9948 | -51.7 | -56.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-07-27 11:00Z | USDD@BSC | $1.0020 | 19.9 | - | - | resolved | 持续 4.0h 后解除（峰值 56.1 bps） | - |
| 2026-07-27 11:00Z | USDS@Ethereum | $0.9939 | -60.8 | -51 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0009 |
| 2026-07-27 11:00Z | USDT@Ethereum | $0.9939 | -60.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-27 12:00Z | USDS@Ethereum | $0.9985 | -14.7 | - | - | resolved | 持续 1.0h 后解除（峰值 60.8 bps） | 1.001 |
| 2026-07-27 12:00Z | USDT@Ethereum | $0.9985 | -14.7 | - | - | resolved | 持续 1.0h 后解除（峰值 60.8 bps） | - |
| 2026-07-27 13:00Z | USDC@Base | $1.0020 | 19.7 | - | - | resolved | 持续 2.0h 后解除（峰值 53.6 bps） | 1.001 |
| 2026-07-27 13:00Z | USDe@Solana | $1.0128 | 128.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-27 17:00Z | USDD@Ethereum | $0.9944 | -56.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-27 20:00Z | USDS@Ethereum | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-07-27 20:00Z | USDT@Ethereum | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-27 20:00Z | USDe@Solana | $0.9970 | -30 | - | - | resolved | 持续 7.0h 后解除（峰值 128.2 bps） | 1.0008 |
| 2026-07-27 21:00Z | USDD@Ethereum | $0.9994 | -6 | - | - | resolved | 持续 4.0h 后解除（峰值 56.1 bps） | - |
| 2026-07-27 21:00Z | USDe@Solana | $0.9929 | -71.2 | -64.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-07-27 22:00Z | PYUSD@Ethereum | $0.9929 | -70.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-27 22:00Z | USDS@Ethereum | $1.0001 | 1.5 | - | - | resolved | 持续 2.0h 后解除（峰值 58.9 bps） | 1.001 |
| 2026-07-27 22:00Z | USDT@Ethereum | $1.0001 | 1.5 | - | - | resolved | 持续 2.0h 后解除（峰值 58.9 bps） | - |
| 2026-07-27 22:00Z | USDe@Solana | $0.9774 | -226.3 | - | unconfirmed | escalated | 预警升级为严重 | 1.0008 |
| 2026-07-27 23:00Z | PYUSD@Ethereum | $0.9991 | -8.7 | - | - | resolved | 持续 1.0h 后解除（峰值 70.8 bps） | - |
| 2026-07-28 04:00Z | USDD@BSC | $0.9946 | -54.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-28 06:00Z | USDD@Ethereum | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-28 09:00Z | USDS@Ethereum | $0.9934 | -66.3 | -42.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-07-28 09:00Z | USDT@Ethereum | $0.9934 | -66.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-28 10:00Z | USDS@Ethereum | $1.0023 | 22.8 | - | - | resolved | 持续 1.0h 后解除（峰值 66.3 bps） | 1.0009 |
| 2026-07-28 10:00Z | USDT@Ethereum | $1.0023 | 22.8 | - | - | resolved | 持续 1.0h 后解除（峰值 66.3 bps） | - |
| 2026-07-28 10:00Z | USDe@Solana | $0.9998 | -2.4 | - | - | resolved | 持续 13.0h 后解除（峰值 392.7 bps） | 1.001 |
| 2026-07-28 13:00Z | USDD@Ethereum | $0.9977 | -23 | - | - | resolved | 持续 7.0h 后解除（峰值 52.8 bps） | - |
| 2026-07-28 13:00Z | USDe@Solana | $0.9910 | -90 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-28 14:00Z | USDD@BSC | $1.0028 | 28 | - | - | resolved | 持续 10.0h 后解除（峰值 54.4 bps） | - |
| 2026-07-28 14:00Z | USDe@Solana | $1.0007 | 7 | - | - | resolved | 持续 1.0h 后解除（峰值 90.0 bps） | 1.0009 |
| 2026-07-28 17:00Z | USDe@Solana | $0.9914 | -86.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-07-28 19:00Z | USDe@Solana | $0.9973 | -27.5 | - | - | resolved | 持续 2.0h 后解除（峰值 86.5 bps） | 1.0007 |
| 2026-07-28 20:00Z | USDe@Solana | $0.9942 | -57.9 | -58 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-07-28 22:00Z | PYUSD@Solana | $1.0053 | 53.1 | 43.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-07-28 22:00Z | USDD@Ethereum | $0.9935 | -64.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-28 22:00Z | USDT@Ethereum | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-28 23:00Z | PYUSD@Solana | $0.9979 | -21.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | - |
| 2026-07-28 23:00Z | USDT@Ethereum | $0.9979 | -20.8 | - | - | resolved | 持续 1.0h 后解除（峰值 55.6 bps） | - |
| 2026-07-28 23:00Z | USDe@Solana | $1.0021 | 21.5 | - | - | resolved | 持续 3.0h 后解除（峰值 57.9 bps） | 1.0007 |
| 2026-07-29 01:00Z | USDe@Solana | $0.9942 | -58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-29 03:00Z | USDD@BSC | $0.9940 | -59.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-29 03:00Z | USDS@Ethereum | $0.9930 | -69.7 | -50 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-07-29 03:00Z | USDT@Ethereum | $0.9930 | -69.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-29 05:00Z | USDD@BSC | $1.0029 | 28.9 | - | - | resolved | 持续 2.0h 后解除（峰值 59.7 bps） | - |
| 2026-07-29 05:00Z | USDS@Ethereum | $0.9976 | -23.9 | - | - | resolved | 持续 2.0h 后解除（峰值 69.7 bps） | 1.0011 |
| 2026-07-29 05:00Z | USDT@Ethereum | $0.9976 | -23.9 | - | - | resolved | 持续 2.0h 后解除（峰值 69.7 bps） | - |
| 2026-07-29 08:00Z | USDe@Solana | $0.9972 | -28 | - | - | resolved | 持续 7.0h 后解除（峰值 121.5 bps） | 1.0007 |
| 2026-07-29 09:00Z | USDD@Ethereum | $0.9971 | -28.6 | - | - | resolved | 持续 11.0h 后解除（峰值 70.8 bps） | - |
| 2026-07-29 12:00Z | USDS@Ethereum | $0.9936 | -64.1 | -49.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0012 |
| 2026-07-29 12:00Z | USDT@Ethereum | $0.9936 | -64.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-29 12:00Z | USDe@Solana | $0.9937 | -62.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-07-29 17:00Z | USDS@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 5.0h 后解除（峰值 64.1 bps） | 1.001 |
| 2026-07-29 17:00Z | USDT@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 5.0h 后解除（峰值 64.1 bps） | - |
| 2026-07-29 19:00Z | USDe@Solana | $0.9843 | -156.8 | - | unconfirmed | escalated | 预警升级为严重 | 1.0007 |
| 2026-07-29 20:00Z | USDD@Ethereum | $0.9935 | -65.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-29 20:00Z | USDT@Ethereum | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-29 21:00Z | USDT@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | - |
| 2026-07-30 02:00Z | USDS@Ethereum | $0.9940 | -59.5 | -46.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-07-30 02:00Z | USDT@Ethereum | $0.9940 | -59.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-30 02:00Z | USDe@Solana | $0.9986 | -14.3 | - | - | resolved | 持续 14.0h 后解除（峰值 215.1 bps） | 1.0007 |
| 2026-07-30 03:00Z | USDD@BSC | $0.9941 | -59.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-30 04:00Z | USDS@Ethereum | $0.9987 | -13 | - | - | resolved | 持续 2.0h 后解除（峰值 59.5 bps） | 1.001 |
| 2026-07-30 04:00Z | USDT@Ethereum | $0.9987 | -13 | - | - | resolved | 持续 2.0h 后解除（峰值 59.5 bps） | - |
| 2026-07-30 05:00Z | USDS@Ethereum | $0.9933 | -67.2 | -35.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0011 |
| 2026-07-30 05:00Z | USDT@Ethereum | $0.9933 | -67.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-30 05:00Z | USDe@Solana | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-30 06:00Z | USDS@Ethereum | $0.9991 | -8.8 | - | - | resolved | 持续 1.0h 后解除（峰值 67.2 bps） | 1.001 |
| 2026-07-30 06:00Z | USDT@Ethereum | $0.9991 | -8.8 | - | - | resolved | 持续 1.0h 后解除（峰值 67.2 bps） | - |
| 2026-07-30 08:00Z | USDD@BSC | $1.0026 | 26.4 | - | - | resolved | 持续 5.0h 后解除（峰值 59.4 bps） | - |
| 2026-07-30 09:00Z | USDe@Solana | $1.0007 | 6.6 | - | - | resolved | 持续 4.0h 后解除（峰值 101.2 bps） | 1.0009 |
| 2026-07-30 11:00Z | PYUSD@Solana | $1.0156 | 155.9 | 59.2 | confirmed | new-severe | 首次触发即严重（双源确认） | - |
| 2026-07-30 12:00Z | PYUSD@Solana | $1.0019 | 18.6 | - | - | resolved | 持续 1.0h 后解除（峰值 155.9 bps） | - |
| 2026-07-30 14:00Z | USDS@Ethereum | $0.9944 | -56.3 | -50 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0011 |
| 2026-07-30 14:00Z | USDT@Ethereum | $0.9944 | -56.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-30 15:00Z | USDe@Solana | $1.0055 | 54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-30 19:00Z | USDS@Ethereum | $1.0022 | 22.2 | - | - | resolved | 持续 5.0h 后解除（峰值 63.9 bps） | 1.001 |
| 2026-07-30 19:00Z | USDT@Ethereum | $1.0022 | 22.2 | - | - | resolved | 持续 5.0h 后解除（峰值 63.9 bps） | - |
| 2026-07-30 21:00Z | USD1@Ethereum | $0.9949 | -51 | -46.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-07-30 23:00Z | USDS@Ethereum | $0.9940 | -59.6 | -61.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0011 |
| 2026-07-30 23:00Z | USDT@Ethereum | $0.9940 | -59.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 00:00Z | USD1@Ethereum | $0.9998 | -1.9 | - | - | resolved | 持续 3.0h 后解除（峰值 51.0 bps） | 1 |
| 2026-07-31 01:00Z | USDe@Solana | $1.0030 | 29.8 | - | - | resolved | 持续 10.0h 后解除（峰值 73.3 bps） | 1.0008 |
| 2026-07-31 02:00Z | USDD@Ethereum | $0.9994 | -5.8 | - | - | resolved | 持续 30.0h 后解除（峰值 65.1 bps） | - |
| 2026-07-31 03:00Z | USDS@Ethereum | $0.9982 | -17.8 | - | - | resolved | 持续 4.0h 后解除（峰值 65.5 bps） | 1.0011 |
| 2026-07-31 03:00Z | USDT@Ethereum | $0.9982 | -17.8 | - | - | resolved | 持续 4.0h 后解除（峰值 65.5 bps） | - |
| 2026-07-31 05:00Z | USDe@Solana | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-07-31 11:00Z | USDT@Ethereum | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 13:00Z | USDT@Ethereum | $1.0004 | 3.6 | - | - | resolved | 持续 2.0h 后解除（峰值 54.8 bps） | - |
| 2026-07-31 15:00Z | U@BSC | $0.9949 | -51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 16:00Z | U@BSC | $1.0006 | 6.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | - |
| 2026-07-31 19:00Z | USDD@BSC | $0.9949 | -51 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 19:00Z | USDS@Ethereum | $0.9945 | -54.6 | -45.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-07-31 19:00Z | USDT@Ethereum | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 19:00Z | USDe@Solana | $0.9849 | -151.1 | -157.5 | confirmed | escalated | 预警升级为严重 | 1.0008 |
| 2026-07-31 20:00Z | USDS@Ethereum | $0.9997 | -3.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | 1.0011 |
| 2026-07-31 20:00Z | USDT@Ethereum | $0.9997 | -3.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | - |
| 2026-07-31 21:00Z | USDS@Ethereum | $0.9938 | -62.2 | -54.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.001 |
| 2026-07-31 21:00Z | USDT@Ethereum | $0.9938 | -62.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-07-31 23:00Z | U@BSC | $0.9948 | -51.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-01 00:00Z | USDS@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 3.0h 后解除（峰值 62.2 bps） | 1.001 |
| 2026-08-01 00:00Z | USDT@Ethereum | $0.9978 | -22 | - | - | resolved | 持续 3.0h 后解除（峰值 62.2 bps） | - |
| 2026-08-01 04:00Z | USDD@BSC | $1.0010 | 10.2 | - | - | resolved | 持续 9.0h 后解除（峰值 51.0 bps） | - |
| 2026-08-01 07:00Z | U@BSC | $1.0004 | 3.8 | - | - | resolved | 持续 8.0h 后解除（峰值 53.1 bps） | - |
| 2026-08-01 11:00Z | U@BSC | $0.9949 | -51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-01 12:00Z | U@BSC | $0.9995 | -5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | - |
| 2026-08-01 18:00Z | USDC@Base | $1.0055 | 55.3 | 50.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-01 21:00Z | USDC@Base | $0.9979 | -20.5 | - | - | resolved | 持续 3.0h 后解除（峰值 55.3 bps） | 1.0008 |
| 2026-08-02 02:00Z | USDe@Solana | $1.0013 | 12.6 | - | - | resolved | 持续 45.0h 后解除（峰值 411.2 bps） | 1.0009 |
| 2026-08-02 03:00Z | USDD@Ethereum | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-02 04:00Z | U@BSC | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-02 06:00Z | U@BSC | $1.0002 | 1.6 | - | - | resolved | 持续 2.0h 后解除（峰值 50.1 bps） | - |
| 2026-08-02 06:00Z | USDD@Ethereum | $1.0016 | 16.5 | - | - | resolved | 持续 3.0h 后解除（峰值 50.9 bps） | - |
| 2026-08-02 08:00Z | USDT@Ethereum | $0.9942 | -57.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-02 09:00Z | U@BSC | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-02 09:00Z | USDT@Ethereum | $0.9977 | -23.3 | - | - | resolved | 持续 1.0h 后解除（峰值 57.8 bps） | - |
| 2026-08-02 10:00Z | U@BSC | $1.0012 | 12 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | - |
| 2026-08-02 12:00Z | USDe@Solana | $0.9940 | -60.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-08-02 17:00Z | USDD@BSC | $0.9943 | -56.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-02 19:00Z | USDe@Solana | $1.0026 | 25.8 | - | - | resolved | 持续 7.0h 后解除（峰值 84.0 bps） | 1.0006 |
| 2026-08-02 21:00Z | USDe@Solana | $1.0088 | 88.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-08-02 22:00Z | USDT@Ethereum | $0.9934 | -66.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 00:00Z | USDT@Ethereum | $0.9997 | -2.6 | - | - | resolved | 持续 2.0h 后解除（峰值 66.1 bps） | - |
| 2026-08-03 00:00Z | USDe@Solana | $0.9984 | -15.6 | - | - | resolved | 持续 3.0h 后解除（峰值 88.3 bps） | 1.0007 |
| 2026-08-03 01:00Z | USDD@BSC | $1.0005 | 5.2 | - | - | resolved | 持续 8.0h 后解除（峰值 56.6 bps） | - |
| 2026-08-03 01:00Z | USDS@Ethereum | $0.9935 | -65.2 | -56.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-08-03 01:00Z | USDT@Ethereum | $0.9935 | -65.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 02:00Z | U@BSC | $0.9950 | -50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 03:00Z | U@BSC | $1.0029 | 28.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.0 bps） | - |
| 2026-08-03 03:00Z | USDS@Ethereum | $1.0024 | 24.5 | - | - | resolved | 持续 2.0h 后解除（峰值 65.2 bps） | 1.0011 |
| 2026-08-03 03:00Z | USDT@Ethereum | $1.0024 | 24.5 | - | - | resolved | 持续 2.0h 后解除（峰值 65.2 bps） | - |
| 2026-08-03 05:00Z | USDe@Solana | $0.9907 | -93.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-08-03 08:00Z | USDe@Solana | $0.9844 | -156.1 | -168.4 | confirmed | escalated | 预警升级为严重 | 1.0008 |
| 2026-08-03 10:00Z | USDT@Ethereum | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 11:00Z | U@BSC | $0.9947 | -52.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 11:00Z | USDD@BSC | $0.9933 | -67 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 11:00Z | USDS@Ethereum | $0.9937 | -63.4 | -57.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.001 |
| 2026-08-03 14:00Z | USDS@Ethereum | $0.9973 | -27.5 | - | - | resolved | 持续 3.0h 后解除（峰值 64.6 bps） | 1.001 |
| 2026-08-03 14:00Z | USDT@Ethereum | $0.9973 | -27.5 | - | - | resolved | 持续 4.0h 后解除（峰值 64.6 bps） | - |
| 2026-08-03 15:00Z | USDe@Solana | $1.0025 | 24.7 | - | - | resolved | 持续 10.0h 后解除（峰值 169.5 bps） | 1.0009 |
| 2026-08-03 18:00Z | U@BSC | $0.9981 | -18.8 | - | - | resolved | 持续 7.0h 后解除（峰值 52.9 bps） | - |
| 2026-08-03 18:00Z | USDD@BSC | $0.9991 | -9 | - | - | resolved | 持续 7.0h 后解除（峰值 67.0 bps） | - |
| 2026-08-03 20:00Z | USDS@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-08-03 20:00Z | USDT@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-03 22:00Z | USDS@Ethereum | $1.0021 | 20.7 | - | - | resolved | 持续 2.0h 后解除（峰值 58.5 bps） | 1.0006 |
| 2026-08-03 22:00Z | USDT@Ethereum | $1.0021 | 20.7 | - | - | resolved | 持续 2.0h 后解除（峰值 58.5 bps） | - |
| 2026-08-03 23:00Z | USDe@Solana | $0.9925 | -75.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-04 00:00Z | USDT@Ethereum | $0.9940 | -59.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 01:00Z | USDT@Ethereum | $0.9986 | -13.8 | - | - | resolved | 持续 1.0h 后解除（峰值 59.9 bps） | - |
| 2026-08-04 02:00Z | USDe@Solana | $0.9977 | -23.4 | - | - | resolved | 持续 3.0h 后解除（峰值 138.9 bps） | 1.0008 |
| 2026-08-04 05:00Z | USDC@Base | $0.9946 | -54.2 | -48.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-04 05:00Z | USDS@Ethereum | $0.9939 | -61 | -53.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-08-04 05:00Z | USDT@Ethereum | $0.9939 | -61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 06:00Z | USDe@Solana | $0.9941 | -59.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-04 07:00Z | USDS@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 2.0h 后解除（峰值 61.0 bps） | 1.0007 |
| 2026-08-04 07:00Z | USDT@Ethereum | $0.9986 | -13.7 | - | - | resolved | 持续 2.0h 后解除（峰值 61.0 bps） | - |
| 2026-08-04 08:00Z | USDS@Ethereum | $0.9947 | -53.1 | -46 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-08-04 08:00Z | USDT@Ethereum | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 09:00Z | USDS@Ethereum | $1.0013 | 13 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | 1.0006 |
| 2026-08-04 09:00Z | USDT@Ethereum | $1.0013 | 13 | - | - | resolved | 持续 1.0h 后解除（峰值 53.1 bps） | - |
| 2026-08-04 11:00Z | USDC@Base | $0.9991 | -9.3 | - | - | resolved | 持续 6.0h 后解除（峰值 59.6 bps） | 1.0008 |
| 2026-08-04 12:00Z | USDe@Solana | $0.9976 | -23.6 | - | - | resolved | 持续 6.0h 后解除（峰值 138.1 bps） | 1.0007 |
| 2026-08-04 13:00Z | U@BSC | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 14:00Z | U@BSC | $0.9973 | -27.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.4 bps） | - |
| 2026-08-04 15:00Z | USDe@Solana | $0.9929 | -71.3 | -46 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-08-04 16:00Z | USDe@Solana | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 71.3 bps） | 1.0008 |
| 2026-08-04 17:00Z | USDS@Ethereum | $0.9946 | -53.9 | -49 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-04 17:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 18:00Z | U@BSC | $0.9950 | -50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-04 18:00Z | USD1@Ethereum | $1.0059 | 59.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-08-04 19:00Z | USDS@Ethereum | $0.9974 | -26.3 | - | - | resolved | 持续 2.0h 后解除（峰值 53.9 bps） | 1.0006 |
| 2026-08-04 19:00Z | USDT@Ethereum | $0.9974 | -26.3 | - | - | resolved | 持续 2.0h 后解除（峰值 53.9 bps） | - |
| 2026-08-04 21:00Z | U@BSC | $0.9984 | -15.7 | - | - | resolved | 持续 3.0h 后解除（峰值 53.9 bps） | - |
| 2026-08-05 00:00Z | USD1@Ethereum | $1.0006 | 5.6 | - | - | resolved | 持续 6.0h 后解除（峰值 59.2 bps） | 1.0001 |
| 2026-08-05 00:00Z | USDe@Solana | $0.9902 | -97.7 | -50 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-08-05 01:00Z | USDe@Solana | $0.9990 | -10 | - | - | resolved | 持续 1.0h 后解除（峰值 97.7 bps） | 1.0008 |
| 2026-08-05 03:00Z | USDS@Ethereum | $0.9950 | -50.2 | -43.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-08-05 03:00Z | USDT@Ethereum | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 04:00Z | USDe@Solana | $0.9937 | -63.1 | -41.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-08-05 05:00Z | USDe@Solana | $1.0006 | 6.1 | - | - | resolved | 持续 1.0h 后解除（峰值 63.1 bps） | 1.0008 |
| 2026-08-05 06:00Z | USDS@Ethereum | $1.0009 | 9.2 | - | - | resolved | 持续 3.0h 后解除（峰值 53.3 bps） | 1.0006 |
| 2026-08-05 06:00Z | USDT@Ethereum | $1.0009 | 9.2 | - | - | resolved | 持续 3.0h 后解除（峰值 53.3 bps） | - |
| 2026-08-05 07:00Z | U@BSC | $0.9943 | -56.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 09:00Z | U@BSC | $0.9996 | -3.6 | - | - | resolved | 持续 2.0h 后解除（峰值 56.7 bps） | - |
| 2026-08-05 10:00Z | U@BSC | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 12:00Z | USDD@BSC | $0.9942 | -58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 13:00Z | U@BSC | $0.9990 | -9.7 | - | - | resolved | 持续 3.0h 后解除（峰值 53.1 bps） | - |
| 2026-08-05 13:00Z | USDe@Solana | $0.9950 | -50.3 | -37.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-08-05 14:00Z | USDD@BSC | $0.9970 | -29.8 | - | - | resolved | 持续 2.0h 后解除（峰值 58.0 bps） | - |
| 2026-08-05 14:00Z | USDe@Solana | $0.9987 | -13.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.3 bps） | 1.0006 |
| 2026-08-05 16:00Z | U@BSC | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 17:00Z | U@BSC | $0.9981 | -19.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-08-05 18:00Z | USDe@Solana | $1.0082 | 81.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-08-05 21:00Z | USDS@Ethereum | $0.9945 | -54.8 | -51 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-05 21:00Z | USDT@Ethereum | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-05 21:00Z | USDe@Solana | $1.0002 | 1.6 | - | - | resolved | 持续 3.0h 后解除（峰值 81.6 bps） | 1.0007 |
| 2026-08-06 00:00Z | USDS@Ethereum | $1.0028 | 27.8 | - | - | resolved | 持续 3.0h 后解除（峰值 55.6 bps） | 1.0007 |
| 2026-08-06 00:00Z | USDT@Ethereum | $1.0028 | 27.8 | - | - | resolved | 持续 3.0h 后解除（峰值 55.6 bps） | - |
| 2026-08-06 02:00Z | USDD@Ethereum | $0.9934 | -65.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 02:00Z | USDe@Solana | $0.9924 | -76.4 | -72.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-08-06 04:00Z | U@BSC | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 05:00Z | USDe@Solana | $1.0002 | 1.8 | - | - | resolved | 持续 3.0h 后解除（峰值 86.7 bps） | 1.0006 |
| 2026-08-06 07:00Z | USDS@Ethereum | $0.9946 | -54.1 | -55.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-08-06 07:00Z | USDT@Ethereum | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 08:00Z | U@BSC | $0.9976 | -23.7 | - | - | resolved | 持续 4.0h 后解除（峰值 52.0 bps） | - |
| 2026-08-06 08:00Z | USDS@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.1 bps） | 1.0008 |
| 2026-08-06 08:00Z | USDT@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.1 bps） | - |
| 2026-08-06 09:00Z | USDD@Ethereum | $0.9974 | -26 | - | - | resolved | 持续 7.0h 后解除（峰值 65.7 bps） | - |
| 2026-08-06 09:00Z | USDS@Ethereum | $0.9943 | -57.5 | -47.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-06 09:00Z | USDT@Ethereum | $0.9943 | -57.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 10:00Z | PYUSD@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 10:00Z | U@BSC | $0.9946 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 10:00Z | USDe@Solana | $0.9921 | -79 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-06 11:00Z | PYUSD@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-08-06 11:00Z | U@BSC | $1.0004 | 4.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-08-06 11:00Z | USDS@Ethereum | $0.9979 | -21.4 | - | - | resolved | 持续 2.0h 后解除（峰值 67.2 bps） | 1.0008 |
| 2026-08-06 11:00Z | USDT@Ethereum | $0.9979 | -21.4 | - | - | resolved | 持续 2.0h 后解除（峰值 67.2 bps） | - |
| 2026-08-06 13:00Z | U@BSC | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 15:00Z | U@BSC | $0.9999 | -0.8 | - | - | resolved | 持续 2.0h 后解除（峰值 53.4 bps） | - |
| 2026-08-06 18:00Z | U@BSC | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 18:00Z | USDe@Solana | $0.9845 | -155.3 | - | unconfirmed | escalated | 预警升级为严重 | 1.0007 |
| 2026-08-06 19:00Z | U@BSC | $1.0010 | 10 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-08-06 20:00Z | USDS@Ethereum | $0.9947 | -52.6 | -46.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-06 20:00Z | USDT@Ethereum | $0.9947 | -52.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-06 22:00Z | USDS@Ethereum | $1.0004 | 3.8 | - | - | resolved | 持续 2.0h 后解除（峰值 55.3 bps） | 1.0008 |
| 2026-08-06 22:00Z | USDT@Ethereum | $1.0004 | 3.8 | - | - | resolved | 持续 2.0h 后解除（峰值 55.3 bps） | - |
| 2026-08-07 04:00Z | U@BSC | $0.9947 | -53.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 04:00Z | USDS@Ethereum | $0.9942 | -58.5 | -57.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-07 04:00Z | USDT@Ethereum | $0.9942 | -58.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 05:00Z | USDS@Ethereum | $0.9972 | -27.7 | - | - | resolved | 持续 1.0h 后解除（峰值 58.5 bps） | 1.0007 |
| 2026-08-07 05:00Z | USDT@Ethereum | $0.9972 | -27.7 | - | - | resolved | 持续 1.0h 后解除（峰值 58.5 bps） | - |
| 2026-08-07 07:00Z | U@BSC | $1.0000 | -0.3 | - | - | resolved | 持续 3.0h 后解除（峰值 53.5 bps） | - |
| 2026-08-07 08:00Z | U@BSC | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 09:00Z | U@BSC | $0.9997 | -2.9 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | - |
| 2026-08-07 11:00Z | U@BSC | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 12:00Z | U@BSC | $1.0028 | 28.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-08-07 13:00Z | USDD@BSC | $0.9946 | -54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 13:00Z | USDe@Solana | $1.0022 | 22.4 | - | - | resolved | 持续 27.0h 后解除（峰值 215.5 bps） | 1.0006 |
| 2026-08-07 14:00Z | USDe@Solana | $0.9950 | -50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-08-07 15:00Z | U@BSC | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 15:00Z | USDe@Solana | $0.9993 | -7.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.0 bps） | 1.0006 |
| 2026-08-07 16:00Z | U@BSC | $0.9997 | -3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.3 bps） | - |
| 2026-08-07 17:00Z | USDe@Solana | $0.9875 | -124.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-08-07 18:00Z | USDS@Ethereum | $0.9943 | -57.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-08-07 18:00Z | USDT@Ethereum | $0.9943 | -57.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-07 19:00Z | USDS@Ethereum | $0.9982 | -18.3 | - | - | resolved | 持续 1.0h 后解除（峰值 57.1 bps） | 1.0005 |
| 2026-08-07 19:00Z | USDT@Ethereum | $0.9982 | -18.3 | - | - | resolved | 持续 1.0h 后解除（峰值 57.1 bps） | - |
| 2026-08-07 20:00Z | USDe@Solana | $0.9974 | -26.4 | - | - | resolved | 持续 3.0h 后解除（峰值 124.7 bps） | 1.0005 |
| 2026-08-07 21:00Z | USDe@Solana | $0.9945 | -55.1 | -49.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-08 01:00Z | PYUSD@Solana | $0.9765 | -235.2 | -38.2 | likely | new-severe | 首次触发即严重（双源大概率真） | - |
| 2026-08-08 01:00Z | USDD@BSC | $0.9997 | -3.5 | - | - | resolved | 持续 12.0h 后解除（峰值 54.5 bps） | - |
| 2026-08-08 03:00Z | PYUSD@Solana | $0.9981 | -19.4 | - | - | resolved | 持续 2.0h 后解除（峰值 235.2 bps） | - |
| 2026-08-08 03:00Z | USDe@Solana | $1.0018 | 18.1 | - | - | resolved | 持续 6.0h 后解除（峰值 71.3 bps） | 1.0005 |
| 2026-08-08 06:00Z | U@BSC | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-08 07:00Z | U@BSC | $0.9995 | -4.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.4 bps） | - |
| 2026-08-08 11:00Z | U@BSC | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-08 11:00Z | USDe@Solana | $1.0095 | 94.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-08-08 12:00Z | U@BSC | $0.9987 | -12.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.0 bps） | - |
| 2026-08-08 14:00Z | U@BSC | $1.0122 | 122 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-08 14:00Z | USD1@BSC | $1.0093 | 92.9 | 131.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-08-08 14:00Z | USDC@BSC | $1.0093 | 92.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-08-08 14:00Z | USDT@BSC | $1.0065 | 64.7 | 87.1 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-08-08 14:00Z | USDe@Solana | $1.0225 | 224.5 | - | unconfirmed | escalated | 预警升级为严重 | 1.0005 |
| 2026-08-08 15:00Z | U@BSC | $1.0010 | 10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 122.0 bps） | - |
| 2026-08-08 15:00Z | USD1@BSC | $0.9998 | -2.1 | - | - | resolved | 持续 1.0h 后解除（峰值 92.9 bps） | 1.0003 |
| 2026-08-08 15:00Z | USDC@BSC | $0.9996 | -4 | - | - | resolved | 持续 1.0h 后解除（峰值 92.7 bps） | 1.0006 |
| 2026-08-08 15:00Z | USDT@BSC | $1.0000 | -0.3 | - | - | resolved | 持续 1.0h 后解除（峰值 64.7 bps） | - |
| 2026-08-09 01:00Z | USDS@Solana | $0.9950 | -50.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-08-09 03:00Z | U@BSC | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 03:00Z | USDS@Solana | $1.0010 | 9.8 | - | - | resolved | 持续 2.0h 后解除（峰值 50.3 bps） | 1.0006 |
| 2026-08-09 04:00Z | USDS@Ethereum | $0.9944 | -55.8 | -48.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-09 04:00Z | USDT@Ethereum | $0.9944 | -55.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 06:00Z | U@BSC | $0.9973 | -27.1 | - | - | resolved | 持续 3.0h 后解除（峰值 52.8 bps） | - |
| 2026-08-09 07:00Z | USDS@Ethereum | $0.9971 | -29.1 | - | - | resolved | 持续 3.0h 后解除（峰值 55.8 bps） | 1.0006 |
| 2026-08-09 07:00Z | USDT@Ethereum | $0.9971 | -29.1 | - | - | resolved | 持续 3.0h 后解除（峰值 55.8 bps） | - |
| 2026-08-09 08:00Z | USDC@Base | $0.9946 | -53.7 | -45.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-09 08:00Z | USDD@Ethereum | $0.9939 | -60.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 08:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 10:00Z | USDT@Ethereum | $0.9971 | -28.5 | - | - | resolved | 持续 2.0h 后解除（峰值 55.1 bps） | - |
| 2026-08-09 13:00Z | USDD@Ethereum | $0.9973 | -27.1 | - | - | resolved | 持续 5.0h 后解除（峰值 60.8 bps） | - |
| 2026-08-09 16:00Z | USDC@Base | $0.9982 | -18.4 | - | - | resolved | 持续 8.0h 后解除（峰值 53.7 bps） | 1.0007 |
| 2026-08-09 20:00Z | USDS@Ethereum | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-08-09 20:00Z | USDT@Ethereum | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 21:00Z | USDS@Ethereum | $1.0028 | 27.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.3 bps） | 1.0006 |
| 2026-08-09 21:00Z | USDT@Ethereum | $1.0028 | 27.9 | - | - | resolved | 持续 1.0h 后解除（峰值 53.3 bps） | - |
| 2026-08-09 23:00Z | U@BSC | $0.9949 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-09 23:00Z | USDS@Ethereum | $0.9942 | -58.2 | -50.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0006 |
| 2026-08-09 23:00Z | USDT@Ethereum | $0.9942 | -58.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-10 01:00Z | USDT@Arbitrum | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-10 02:00Z | USDT@Arbitrum | $0.9998 | -2 | - | - | resolved | 持续 1.0h 后解除（峰值 55.2 bps） | - |
| 2026-08-10 04:00Z | U@BSC | $1.0000 | -0.3 | - | - | resolved | 持续 5.0h 后解除（峰值 51.9 bps） | - |
| 2026-08-10 05:00Z | U@BSC | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-10 05:00Z | USDS@Ethereum | $0.9987 | -13.5 | - | - | resolved | 持续 6.0h 后解除（峰值 58.2 bps） | 1.0006 |
| 2026-08-10 05:00Z | USDT@Ethereum | $0.9987 | -13.5 | - | - | resolved | 持续 6.0h 后解除（峰值 58.2 bps） | - |
| 2026-08-10 06:00Z | U@BSC | $1.0002 | 1.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-08-10 10:00Z | USDS@Ethereum | $0.9943 | -57.3 | -55 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0005 |
| 2026-08-10 10:00Z | USDT@Ethereum | $0.9943 | -57.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-10 12:00Z | USDS@Ethereum | $1.0007 | 6.7 | - | - | resolved | 持续 2.0h 后解除（峰值 57.3 bps） | 1.0005 |
| 2026-08-10 12:00Z | USDT@Ethereum | $1.0007 | 6.7 | - | - | resolved | 持续 2.0h 后解除（峰值 57.3 bps） | - |
| 2026-08-10 13:00Z | USDT@Ethereum | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-10 14:00Z | USDS@Ethereum | $0.9942 | -58.2 | -41.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-10 15:00Z | USDS@Ethereum | $1.0023 | 23.3 | - | - | resolved | 持续 1.0h 后解除（峰值 58.2 bps） | 1.0007 |
| 2026-08-10 15:00Z | USDT@Ethereum | $1.0023 | 23.3 | - | - | resolved | 持续 2.0h 后解除（峰值 58.2 bps） | - |
| 2026-08-10 23:00Z | USDS@Ethereum | $0.9946 | -53.8 | -44.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-08-10 23:00Z | USDT@Ethereum | $0.9946 | -53.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-11 00:00Z | USDS@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | 1.0007 |
| 2026-08-11 00:00Z | USDT@Ethereum | $1.0012 | 11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | - |
| 2026-08-11 06:00Z | U@BSC | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-11 08:00Z | U@BSC | $1.0011 | 11.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.1 bps） | - |
| 2026-08-11 12:00Z | U@BSC | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-11 14:00Z | U@BSC | $1.0022 | 21.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.4 bps） | - |
| 2026-08-11 14:00Z | USDD@BSC | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 02:00Z | U@BSC | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 02:00Z | USDe@Solana | $0.9999 | -0.6 | - | - | resolved | 持续 87.0h 后解除（峰值 382.7 bps） | 1.0008 |
| 2026-08-12 04:00Z | U@BSC | $0.9973 | -26.6 | - | - | resolved | 持续 2.0h 后解除（峰值 54.2 bps） | - |
| 2026-08-12 04:00Z | USDD@BSC | $1.0027 | 26.9 | - | - | resolved | 持续 14.0h 后解除（峰值 51.3 bps） | - |
| 2026-08-12 06:00Z | U@BSC | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 08:00Z | U@BSC | $0.9998 | -2.4 | - | - | resolved | 持续 2.0h 后解除（峰值 50.8 bps） | - |
| 2026-08-12 10:00Z | U@BSC | $0.9946 | -54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 11:00Z | USDe@Solana | $1.0061 | 60.9 | 34.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-08-12 13:00Z | U@BSC | $1.0014 | 14.3 | - | - | resolved | 持续 3.0h 后解除（峰值 54.5 bps） | - |
| 2026-08-12 13:00Z | USDT@Ethereum | $0.9945 | -54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 14:00Z | USDT@Ethereum | $0.9996 | -3.7 | - | - | resolved | 持续 1.0h 后解除（峰值 54.5 bps） | - |
| 2026-08-12 17:00Z | USDD@Ethereum | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 17:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 18:00Z | USDC@Base | $0.9949 | -51.3 | -53.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0009 |
| 2026-08-12 18:00Z | USDS@Ethereum | $0.9936 | -63.9 | -54.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0009 |
| 2026-08-12 19:00Z | USDC@Base | $1.0013 | 13 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | 1.0009 |
| 2026-08-12 20:00Z | U@BSC | $0.9948 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-12 20:00Z | USDS@Ethereum | $0.9978 | -21.7 | - | - | resolved | 持续 2.0h 后解除（峰值 63.9 bps） | 1.0009 |
| 2026-08-12 20:00Z | USDT@Ethereum | $0.9978 | -21.7 | - | - | resolved | 持续 3.0h 后解除（峰值 63.9 bps） | - |
| 2026-08-12 22:00Z | U@BSC | $0.9994 | -6.3 | - | - | resolved | 持续 2.0h 后解除（峰值 52.5 bps） | - |
| 2026-08-12 22:00Z | USDS@Ethereum | $0.9941 | -58.9 | -34.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-12 22:00Z | USDT@Ethereum | $0.9941 | -58.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-13 01:00Z | USDS@Ethereum | $1.0013 | 12.6 | - | - | resolved | 持续 3.0h 后解除（峰值 58.9 bps） | 1.0008 |
| 2026-08-13 01:00Z | USDT@Ethereum | $1.0013 | 12.6 | - | - | resolved | 持续 3.0h 后解除（峰值 58.9 bps） | - |
| 2026-08-13 03:00Z | USDD@Ethereum | $0.9979 | -21 | - | - | resolved | 持续 10.0h 后解除（峰值 57.4 bps） | - |
| 2026-08-13 06:00Z | USDe@Solana | $0.9981 | -19.2 | - | - | resolved | 持续 19.0h 后解除（峰值 149.0 bps） | 1.0008 |
| 2026-08-13 09:00Z | USDe@Solana | $0.9901 | -99.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0007 |
| 2026-08-13 10:00Z | USDS@Ethereum | $0.9939 | -60.7 | -48.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-13 10:00Z | USDT@Ethereum | $0.9939 | -60.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-13 11:00Z | U@BSC | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-13 11:00Z | USD1@Ethereum | $0.9934 | -66.2 | -45.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-08-13 11:00Z | USDD@BSC | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-13 12:00Z | U@BSC | $0.9990 | -9.6 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | - |
| 2026-08-13 12:00Z | USDS@Ethereum | $0.9985 | -15.1 | - | - | resolved | 持续 2.0h 后解除（峰值 60.7 bps） | 1.0009 |
| 2026-08-13 12:00Z | USDT@Ethereum | $0.9985 | -15.1 | - | - | resolved | 持续 2.0h 后解除（峰值 60.7 bps） | - |
| 2026-08-13 13:00Z | USDD@BSC | $1.0008 | 7.7 | - | - | resolved | 持续 2.0h 后解除（峰值 52.1 bps） | - |
| 2026-08-13 14:00Z | USDe@Solana | $1.0007 | 6.8 | - | - | resolved | 持续 5.0h 后解除（峰值 124.5 bps） | 1.0008 |
| 2026-08-13 15:00Z | USDS@Ethereum | $0.9948 | -51.7 | -50.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-13 15:00Z | USDT@Ethereum | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-13 16:00Z | USDS@Ethereum | $0.9974 | -26.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | 1.0008 |
| 2026-08-13 16:00Z | USDT@Ethereum | $0.9974 | -26.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.7 bps） | - |
| 2026-08-13 16:00Z | USDe@Solana | $0.9860 | -139.8 | -103.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-13 17:00Z | USD1@Ethereum | $0.9982 | -17.7 | - | - | resolved | 持续 6.0h 后解除（峰值 66.2 bps） | 1 |
| 2026-08-13 22:00Z | USDT@Solana | $0.9944 | -56.4 | -31.6 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-13 23:00Z | USDT@Solana | $0.9993 | -6.6 | - | - | resolved | 持续 1.0h 后解除（峰值 56.4 bps） | - |
| 2026-08-14 03:00Z | USDS@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-14 03:00Z | USDT@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 06:00Z | USDD@Ethereum | $0.9933 | -67.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 06:00Z | USDS@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 3.0h 后解除（峰值 55.5 bps） | 1.0009 |
| 2026-08-14 06:00Z | USDT@Ethereum | $0.9995 | -4.6 | - | - | resolved | 持续 3.0h 后解除（峰值 55.5 bps） | - |
| 2026-08-14 07:00Z | U@BSC | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 08:00Z | U@BSC | $1.0023 | 23.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-08-14 10:00Z | USDD@Ethereum | $1.0017 | 17.2 | - | - | resolved | 持续 4.0h 后解除（峰值 67.1 bps） | - |
| 2026-08-14 12:00Z | USDD@BSC | $0.9943 | -57.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 13:00Z | U@BSC | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 13:00Z | USDS@Ethereum | $0.9936 | -64 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0011 |
| 2026-08-14 13:00Z | USDT@Ethereum | $0.9936 | -64 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 13:00Z | USDe@Solana | $0.9817 | -183.1 | - | unconfirmed | escalated | 预警升级为严重 | 1.0009 |
| 2026-08-14 15:00Z | U@BSC | $1.0025 | 25.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.0 bps） | - |
| 2026-08-14 15:00Z | USDS@Ethereum | $0.9979 | -20.7 | - | - | resolved | 持续 2.0h 后解除（峰值 64.0 bps） | 1.0008 |
| 2026-08-14 15:00Z | USDT@Ethereum | $0.9979 | -20.7 | - | - | resolved | 持续 2.0h 后解除（峰值 64.0 bps） | - |
| 2026-08-14 17:00Z | U@BSC | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 18:00Z | U@BSC | $0.9975 | -25.1 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | - |
| 2026-08-14 18:00Z | USD1@Ethereum | $0.9941 | -59 | -59.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-08-14 18:00Z | USDT@Ethereum | $0.9937 | -63.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 19:00Z | USDD@BSC | $1.0003 | 2.6 | - | - | resolved | 持续 7.0h 后解除（峰值 57.3 bps） | - |
| 2026-08-14 19:00Z | USDT@Ethereum | $0.9971 | -29.4 | - | - | resolved | 持续 1.0h 后解除（峰值 63.1 bps） | - |
| 2026-08-14 22:00Z | U@BSC | $0.9949 | -51.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-14 22:00Z | USD1@Ethereum | $1.0021 | 20.9 | - | - | resolved | 持续 4.0h 后解除（峰值 59.0 bps） | 1.0001 |
| 2026-08-14 23:00Z | U@BSC | $0.9988 | -12.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | - |
| 2026-08-15 01:00Z | USDe@Solana | $0.9991 | -8.6 | - | - | resolved | 持续 33.0h 后解除（峰值 222.7 bps） | 1.001 |
| 2026-08-15 03:00Z | USDC@Solana | $1.0051 | 51.3 | 51.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0009 |
| 2026-08-15 04:00Z | USDC@Solana | $0.9988 | -11.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.3 bps） | 1.0009 |
| 2026-08-15 08:00Z | U@BSC | $0.9947 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-15 09:00Z | USDC@Base | $0.9944 | -56 | -27.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-08-15 09:00Z | USDD@Ethereum | $0.9938 | -62.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-15 13:00Z | U@BSC | $0.9998 | -2.1 | - | - | resolved | 持续 5.0h 后解除（峰值 52.5 bps） | - |
| 2026-08-15 14:00Z | USDC@Base | $0.9977 | -22.8 | - | - | resolved | 持续 5.0h 后解除（峰值 56.0 bps） | 1.0009 |
| 2026-08-15 17:00Z | U@BSC | $0.9950 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-15 17:00Z | USDD@BSC | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-15 18:00Z | USDG@Solana | $0.9949 | -51.1 | -39.9 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-15 19:00Z | U@BSC | $1.0008 | 8.1 | - | - | resolved | 持续 2.0h 后解除（峰值 57.3 bps） | - |
| 2026-08-15 19:00Z | USDG@Solana | $1.0027 | 26.8 | - | - | resolved | 持续 1.0h 后解除（峰值 51.1 bps） | - |
| 2026-08-15 20:00Z | USDD@Ethereum | $0.9973 | -26.6 | - | - | resolved | 持续 11.0h 后解除（峰值 62.5 bps） | - |
| 2026-08-15 21:00Z | U@BSC | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-15 22:00Z | U@BSC | $0.9993 | -7.3 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | - |
| 2026-08-15 23:00Z | U@BSC | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-16 01:00Z | U@BSC | $1.0005 | 4.8 | - | - | resolved | 持续 2.0h 后解除（峰值 55.3 bps） | - |
| 2026-08-16 08:00Z | USDD@BSC | $1.0000 | -0.2 | - | - | resolved | 持续 15.0h 后解除（峰值 59.7 bps） | - |
| 2026-08-16 11:00Z | U@BSC | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-16 13:00Z | U@BSC | $1.0027 | 27.3 | - | - | resolved | 持续 2.0h 后解除（峰值 53.3 bps） | - |
| 2026-08-16 13:00Z | USDD@BSC | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-16 14:00Z | USDD@BSC | $1.0004 | 4.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | - |
| 2026-08-16 18:00Z | U@BSC | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-16 19:00Z | U@BSC | $1.0012 | 12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-08-16 20:00Z | USDS@Ethereum | $0.9938 | -62.3 | -36.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-08-16 20:00Z | USDT@Ethereum | $0.9938 | -62.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-16 21:00Z | USDC@Base | $1.0051 | 50.9 | 26.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0009 |
| 2026-08-16 21:00Z | USDS@Ethereum | $1.0020 | 20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 62.3 bps） | 1.0009 |
| 2026-08-16 21:00Z | USDT@Ethereum | $1.0020 | 20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 62.3 bps） | - |
| 2026-08-16 21:00Z | USDe@Solana | $0.9850 | -150.3 | -131.2 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0009 |
| 2026-08-16 22:00Z | USDC@Base | $1.0029 | 28.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | 1.0009 |
| 2026-08-17 02:00Z | USDe@Solana | $1.0001 | 0.7 | - | - | resolved | 持续 5.0h 后解除（峰值 150.3 bps） | 1.0008 |
| 2026-08-17 07:00Z | USDS@Ethereum | $0.9935 | -65.3 | -55.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-08-17 07:00Z | USDT@Ethereum | $0.9935 | -65.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 08:00Z | USDD@BSC | $0.9946 | -54 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 09:00Z | USDS@Ethereum | $1.0004 | 4 | - | - | resolved | 持续 2.0h 后解除（峰值 65.3 bps） | 1.0008 |
| 2026-08-17 09:00Z | USDT@Ethereum | $1.0004 | 4 | - | - | resolved | 持续 2.0h 后解除（峰值 65.3 bps） | - |
| 2026-08-17 10:00Z | U@BSC | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 11:00Z | PYUSD@Solana | $1.0155 | 154.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-08-17 11:00Z | U@BSC | $1.0014 | 14 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | - |
| 2026-08-17 11:00Z | USDD@BSC | $0.9998 | -1.8 | - | - | resolved | 持续 3.0h 后解除（峰值 54.0 bps） | - |
| 2026-08-17 11:00Z | USDG@Solana | $1.0058 | 58.3 | 25.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-17 12:00Z | U@BSC | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 12:00Z | USDG@Solana | $0.9976 | -23.5 | - | - | resolved | 持续 1.0h 后解除（峰值 58.3 bps） | - |
| 2026-08-17 12:00Z | USDT@Ethereum | $0.9942 | -58.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 13:00Z | PYUSD@Solana | $1.0013 | 13.5 | - | - | resolved | 持续 2.0h 后解除（峰值 154.8 bps） | - |
| 2026-08-17 13:00Z | U@BSC | $1.0019 | 19.3 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-08-17 14:00Z | USDT@Ethereum | $0.9983 | -17.3 | - | - | resolved | 持续 2.0h 后解除（峰值 58.4 bps） | - |
| 2026-08-17 15:00Z | PYUSD@Solana | $1.0098 | 97.8 | 77.4 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-08-17 16:00Z | USDS@Ethereum | $0.9948 | -52.4 | -44.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.001 |
| 2026-08-17 16:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-17 17:00Z | PYUSD@Solana | $0.9978 | -22.3 | - | - | resolved | 持续 2.0h 后解除（峰值 97.8 bps） | - |
| 2026-08-17 18:00Z | USDS@Ethereum | $1.0022 | 21.9 | - | - | resolved | 持续 2.0h 后解除（峰值 52.4 bps） | 1.0008 |
| 2026-08-17 18:00Z | USDT@Ethereum | $1.0022 | 21.9 | - | - | resolved | 持续 2.0h 后解除（峰值 52.4 bps） | - |
| 2026-08-17 20:00Z | USDS@Ethereum | $0.9946 | -54.2 | -40.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-17 20:00Z | USDT@Ethereum | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 00:00Z | USD1@Ethereum | $0.9944 | -56 | -53.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-08-18 00:00Z | USDS@Ethereum | $1.0002 | 1.5 | - | - | resolved | 持续 4.0h 后解除（峰值 60.7 bps） | 1.0008 |
| 2026-08-18 00:00Z | USDT@Ethereum | $1.0002 | 1.5 | - | - | resolved | 持续 4.0h 后解除（峰值 60.7 bps） | - |
| 2026-08-18 00:00Z | USDe@Solana | $1.0109 | 108.6 | 79.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.001 |
| 2026-08-18 01:00Z | USD1@Ethereum | $0.9998 | -2 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | 0.9998 |
| 2026-08-18 01:00Z | USDe@Solana | $1.0024 | 24.1 | - | - | resolved | 持续 1.0h 后解除（峰值 108.6 bps） | 1.001 |
| 2026-08-18 02:00Z | PYUSD@Ethereum | $0.9925 | -74.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 02:00Z | USDD@BSC | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 02:00Z | USDe@Solana | $0.9947 | -52.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-08-18 03:00Z | PYUSD@Ethereum | $1.0008 | 7.6 | - | - | resolved | 持续 1.0h 后解除（峰值 74.8 bps） | - |
| 2026-08-18 03:00Z | USDD@BSC | $1.0000 | 0.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | - |
| 2026-08-18 03:00Z | USDe@Solana | $0.9992 | -7.7 | - | - | resolved | 持续 1.0h 后解除（峰值 52.5 bps） | 1.0008 |
| 2026-08-18 05:00Z | U@BSC | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 07:00Z | U@BSC | $0.9996 | -4.3 | - | - | resolved | 持续 2.0h 后解除（峰值 56.5 bps） | - |
| 2026-08-18 07:00Z | USDS@Ethereum | $0.9946 | -53.7 | -40.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0008 |
| 2026-08-18 07:00Z | USDT@Ethereum | $0.9946 | -53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 12:00Z | USDe@Solana | $1.0053 | 53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-18 13:00Z | USDD@Ethereum | $0.9938 | -61.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 14:00Z | USDe@Solana | $1.0181 | 181.2 | 178.9 | confirmed | escalated | 预警升级为严重 | 1.0008 |
| 2026-08-18 15:00Z | USDS@Ethereum | $0.9977 | -23.3 | - | - | resolved | 持续 8.0h 后解除（峰值 61.1 bps） | 1.0009 |
| 2026-08-18 15:00Z | USDT@Ethereum | $0.9977 | -23.3 | - | - | resolved | 持续 8.0h 后解除（峰值 61.1 bps） | - |
| 2026-08-18 16:00Z | U@BSC | $0.9950 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 17:00Z | USDD@BSC | $0.9945 | -55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 17:00Z | USDT@Ethereum | $0.9943 | -57 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-18 18:00Z | U@BSC | $0.9997 | -2.5 | - | - | resolved | 持续 2.0h 后解除（峰值 50.5 bps） | - |
| 2026-08-18 18:00Z | USDe@Solana | $1.0030 | 29.5 | - | - | resolved | 持续 6.0h 后解除（峰值 181.2 bps） | 1.0008 |
| 2026-08-18 19:00Z | USDS@Ethereum | $0.9945 | -54.9 | -42.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-18 23:00Z | USDS@Ethereum | $0.9971 | -29.1 | - | - | resolved | 持续 4.0h 后解除（峰值 64.1 bps） | 1.0007 |
| 2026-08-18 23:00Z | USDT@Ethereum | $0.9971 | -29.1 | - | - | resolved | 持续 6.0h 后解除（峰值 64.1 bps） | - |
| 2026-08-19 01:00Z | USDe@Solana | $0.9912 | -87.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0008 |
| 2026-08-19 02:00Z | U@BSC | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-19 02:00Z | USDC@Base | $0.9947 | -53.3 | -54.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0007 |
| 2026-08-19 05:00Z | U@BSC | $0.9999 | -1.1 | - | - | resolved | 持续 3.0h 后解除（峰值 53.2 bps） | - |
| 2026-08-19 05:00Z | USDe@Solana | $0.9971 | -28.7 | - | - | resolved | 持续 4.0h 后解除（峰值 87.6 bps） | 1.0005 |
| 2026-08-19 07:00Z | U@BSC | $0.9948 | -52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-19 08:00Z | U@BSC | $0.9997 | -2.7 | - | - | resolved | 持续 1.0h 后解除（峰值 52.2 bps） | - |
| 2026-08-19 11:00Z | USDe@Solana | $1.0063 | 62.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-08-19 12:00Z | U@BSC | $0.9949 | -51.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-19 12:00Z | USDD@BSC | $0.9997 | -3.1 | - | - | resolved | 持续 19.0h 后解除（峰值 55.4 bps） | - |
| 2026-08-19 13:00Z | U@BSC | $1.0002 | 2.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.2 bps） | - |
| 2026-08-19 13:00Z | USDC@Base | $0.9981 | -19.2 | - | - | resolved | 持续 11.0h 后解除（峰值 53.3 bps） | 1.0007 |
| 2026-08-19 14:00Z | USDe@Solana | $1.0244 | 244.1 | - | unconfirmed | escalated | 预警升级为严重 | 1.0006 |
| 2026-08-19 20:00Z | USDC@Arbitrum | $1.0155 | 155 | 125.9 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0001 |
| 2026-08-19 21:00Z | USDC@Arbitrum | $0.9984 | -15.8 | - | - | resolved | 持续 1.0h 后解除（峰值 155.0 bps） | 1.0003 |
| 2026-08-20 00:00Z | USDe@Solana | $1.0010 | 9.7 | - | - | resolved | 持续 13.0h 后解除（峰值 413.5 bps） | 1.0003 |
| 2026-08-20 03:00Z | USDe@Solana | $0.9937 | -62.6 | -54.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-08-20 05:00Z | USDS@Ethereum | $0.9942 | -58.2 | -44.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-20 05:00Z | USDT@Ethereum | $0.9942 | -58.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 05:00Z | USDe@Solana | $0.9988 | -12.4 | - | - | resolved | 持续 2.0h 后解除（峰值 62.6 bps） | 1.0004 |
| 2026-08-20 07:00Z | USDe@Solana | $1.0135 | 134.7 | 108.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-08-20 08:00Z | PYUSD@Ethereum | $0.9942 | -57.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 08:00Z | U@BSC | $0.9940 | -59.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 08:00Z | USDe@Solana | $1.0027 | 27.2 | - | - | resolved | 持续 1.0h 后解除（峰值 134.7 bps） | 1.0003 |
| 2026-08-20 09:00Z | PYUSD@Ethereum | $0.9973 | -26.9 | - | - | resolved | 持续 1.0h 后解除（峰值 57.9 bps） | - |
| 2026-08-20 09:00Z | U@BSC | $1.0028 | 27.7 | - | - | resolved | 持续 1.0h 后解除（峰值 59.5 bps） | - |
| 2026-08-20 09:00Z | USDD@Ethereum | $1.0019 | 19 | - | - | resolved | 持续 44.0h 后解除（峰值 62.7 bps） | - |
| 2026-08-20 10:00Z | USDD@Ethereum | $0.9949 | -50.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 10:00Z | USDS@Ethereum | $1.0014 | 14 | - | - | resolved | 持续 5.0h 后解除（峰值 58.2 bps） | 1.0007 |
| 2026-08-20 10:00Z | USDT@Ethereum | $1.0014 | 14 | - | - | resolved | 持续 5.0h 后解除（峰值 58.2 bps） | - |
| 2026-08-20 11:00Z | USDS@Ethereum | $0.9943 | -56.8 | -38.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0006 |
| 2026-08-20 11:00Z | USDT@Ethereum | $0.9943 | -56.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 12:00Z | USDS@Ethereum | $0.9979 | -20.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.8 bps） | 1.0006 |
| 2026-08-20 12:00Z | USDT@Ethereum | $0.9979 | -20.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.8 bps） | - |
| 2026-08-20 12:00Z | USDe@Solana | $0.9920 | -80 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0006 |
| 2026-08-20 13:00Z | USDD@BSC | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-20 15:00Z | USDe@Solana | $0.9996 | -3.9 | - | - | resolved | 持续 3.0h 后解除（峰值 82.4 bps） | 1.0006 |
| 2026-08-20 16:00Z | USDD@BSC | $0.9978 | -22.2 | - | - | resolved | 持续 3.0h 后解除（峰值 55.0 bps） | - |
| 2026-08-20 17:00Z | USDe@Solana | $1.0054 | 54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-08-20 19:00Z | USDe@Solana | $0.9993 | -6.6 | - | - | resolved | 持续 2.0h 后解除（峰值 70.0 bps） | 1.0003 |
| 2026-08-21 00:00Z | USDD@Ethereum | $1.0015 | 14.7 | - | - | resolved | 持续 14.0h 后解除（峰值 50.7 bps） | - |
| 2026-08-21 01:00Z | USDe@Solana | $1.0129 | 129.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-08-21 03:00Z | USDe@Solana | $1.0025 | 25.2 | - | - | resolved | 持续 2.0h 后解除（峰值 129.3 bps） | 1.0002 |
| 2026-08-21 05:00Z | USDe@Solana | $1.0143 | 142.7 | 72.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-08-21 08:00Z | U@BSC | $1.0095 | 95.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 08:00Z | USD1@BSC | $0.9909 | -91 | -34.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-08-21 08:00Z | USDC@Arbitrum | $0.9870 | -129.9 | -115.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-08-21 08:00Z | USDC@BSC | $0.9886 | -114.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-08-21 08:00Z | USDD@BSC | $0.9950 | -50.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 08:00Z | USDT@Arbitrum | $0.9901 | -99.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 08:00Z | USDe@Solana | $1.0204 | 204.2 | 87.9 | confirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-08-21 09:00Z | PYUSD@Ethereum | $0.9852 | -147.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 09:00Z | USD1@BSC | $0.9986 | -14.5 | - | - | resolved | 持续 1.0h 后解除（峰值 91.0 bps） | 0.9998 |
| 2026-08-21 09:00Z | USDC@Base | $1.0058 | 58.4 | 52.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-08-21 09:00Z | USDC@Arbitrum | $0.9984 | -15.8 | - | - | resolved | 持续 1.0h 后解除（峰值 129.9 bps） | 1.0002 |
| 2026-08-21 09:00Z | USDC@BSC | $0.9989 | -10.7 | - | - | resolved | 持续 1.0h 后解除（峰值 114.2 bps） | 1.0002 |
| 2026-08-21 10:00Z | PYUSD@Ethereum | $1.0021 | 20.9 | - | - | resolved | 持续 1.0h 后解除（峰值 147.7 bps） | - |
| 2026-08-21 10:00Z | U@BSC | $0.9993 | -7.2 | - | - | resolved | 持续 2.0h 后解除（峰值 95.1 bps） | - |
| 2026-08-21 10:00Z | USDC@Base | $1.0024 | 23.6 | - | - | resolved | 持续 1.0h 后解除（峰值 58.4 bps） | 1.0002 |
| 2026-08-21 10:00Z | USDD@BSC | $0.9977 | -22.6 | - | - | resolved | 持续 2.0h 后解除（峰值 50.3 bps） | - |
| 2026-08-21 10:00Z | USDT@Arbitrum | $0.9973 | -26.6 | - | - | resolved | 持续 2.0h 后解除（峰值 99.2 bps） | - |
| 2026-08-21 11:00Z | USDC@Base | $1.0051 | 50.6 | 35.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-08-21 12:00Z | USDS@Ethereum | $0.9950 | -50.4 | -46.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-08-21 12:00Z | USDT@Ethereum | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 12:00Z | USDe@Solana | $0.9984 | -16.1 | - | - | resolved | 持续 7.0h 后解除（峰值 204.2 bps） | 1.0001 |
| 2026-08-21 13:00Z | PYUSD@Ethereum | $0.9928 | -71.9 | -27.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-21 13:00Z | USDC@Base | $1.0028 | 28.3 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | 1.0003 |
| 2026-08-21 13:00Z | USDS@Ethereum | $1.0006 | 6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | 1.0003 |
| 2026-08-21 13:00Z | USDT@Ethereum | $1.0006 | 6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-08-21 14:00Z | PYUSD@Ethereum | $0.9987 | -12.9 | - | - | resolved | 持续 1.0h 后解除（峰值 71.9 bps） | - |
| 2026-08-21 14:00Z | USDe@Solana | $1.0065 | 65.2 | 27.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-08-21 15:00Z | U@BSC | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-21 16:00Z | U@BSC | $0.9976 | -24.1 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-08-21 21:00Z | USDT@Arbitrum | $0.9945 | -54.9 | -39.4 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-21 21:00Z | USDe@Solana | $1.0298 | 298.3 | - | unconfirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-08-21 22:00Z | USDT@Arbitrum | $1.0019 | 19.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-08-22 00:00Z | USDe@Solana | $1.0006 | 6 | - | - | resolved | 持续 10.0h 后解除（峰值 298.3 bps） | 1.0002 |
| 2026-08-22 01:00Z | USDC@Base | $1.0056 | 55.7 | 64.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-08-22 01:00Z | USDC@Arbitrum | $1.0058 | 58 | 39 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-08-22 01:00Z | USDD@Ethereum | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-22 02:00Z | USDC@Base | $0.9990 | -10.4 | - | - | resolved | 持续 1.0h 后解除（峰值 55.7 bps） | 1.0002 |
| 2026-08-22 02:00Z | USDC@Arbitrum | $0.9989 | -11.1 | - | - | resolved | 持续 1.0h 后解除（峰值 58.0 bps） | 1.0002 |
| 2026-08-22 02:00Z | USDD@Ethereum | $1.0020 | 20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | - |
| 2026-08-22 02:00Z | USDT@Ethereum | $1.0051 | 50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-22 02:00Z | USDe@Solana | $1.0223 | 223.4 | 189.9 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-08-22 03:00Z | USDT@Ethereum | $0.9977 | -23.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-08-22 05:00Z | USDD@BSC | $1.0181 | 181 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-08-22 10:00Z | USDD@BSC | $0.9985 | -15.1 | - | - | resolved | 持续 5.0h 后解除（峰值 181.0 bps） | - |
| 2026-08-22 11:00Z | USDe@Solana | $0.9974 | -26.2 | - | - | resolved | 持续 9.0h 后解除（峰值 579.9 bps） | 1 |
| 2026-08-22 12:00Z | USDe@Solana | $1.0101 | 101.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-08-22 13:00Z | USDe@Solana | $1.0012 | 11.9 | - | - | resolved | 持续 1.0h 后解除（峰值 101.3 bps） | 1 |
| 2026-08-22 15:00Z | U@BSC | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-22 15:00Z | USDe@Solana | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-08-22 16:00Z | U@BSC | $0.9991 | -8.6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-08-22 19:00Z | PYUSD@Ethereum | $1.0066 | 65.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-22 20:00Z | PYUSD@Ethereum | $0.9998 | -2.3 | - | - | resolved | 持续 1.0h 后解除（峰值 65.5 bps） | - |
| 2026-08-22 20:00Z | USDD@BSC | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-22 21:00Z | USDD@BSC | $1.0014 | 14 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | - |
| 2026-08-23 00:00Z | USDT@Ethereum | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-23 00:00Z | USDe@Solana | $1.0353 | 352.6 | 303.7 | confirmed | escalated | 预警升级为严重 | 1 |
| 2026-08-23 01:00Z | USDS@Ethereum | $0.9941 | -59.2 | -34.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-08-23 03:00Z | USDS@Ethereum | $1.0028 | 28.4 | - | - | resolved | 持续 2.0h 后解除（峰值 59.2 bps） | 1.0004 |
| 2026-08-23 03:00Z | USDT@Ethereum | $1.0028 | 28.4 | - | - | resolved | 持续 3.0h 后解除（峰值 59.2 bps） | - |
| 2026-08-23 04:00Z | PYUSD@Ethereum | $0.9863 | -137 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-23 05:00Z | PYUSD@Ethereum | $1.0013 | 12.6 | - | - | resolved | 持续 1.0h 后解除（峰值 137.0 bps） | - |
| 2026-08-23 06:00Z | U@BSC | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-23 07:00Z | U@BSC | $1.0006 | 6.3 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-08-23 10:00Z | U@BSC | $0.9948 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-23 11:00Z | U@BSC | $0.9973 | -27 | - | - | resolved | 持续 1.0h 后解除（峰值 51.5 bps） | - |
| 2026-08-23 15:00Z | USDe@Solana | $0.9977 | -23.4 | - | - | resolved | 持续 24.0h 后解除（峰值 404.2 bps） | 0.9999 |
| 2026-08-23 21:00Z | USDe@Solana | $1.0126 | 125.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-08-23 22:00Z | USDS@Ethereum | $0.9946 | -53.9 | -45 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-08-23 22:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-23 22:00Z | USDe@Solana | $1.0003 | 3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 125.6 bps） | 0.9999 |
| 2026-08-23 23:00Z | USDS@Ethereum | $0.9992 | -7.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | 1 |
| 2026-08-23 23:00Z | USDT@Ethereum | $0.9992 | -7.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | - |
| 2026-08-24 03:00Z | U@BSC | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-24 03:00Z | USDS@Ethereum | $0.9948 | -52.1 | -49.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-08-24 03:00Z | USDT@Ethereum | $0.9948 | -52.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-24 03:00Z | USDe@Solana | $0.9925 | -74.6 | -63.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-08-24 05:00Z | U@BSC | $0.9980 | -20.1 | - | - | resolved | 持续 2.0h 后解除（峰值 50.1 bps） | - |
| 2026-08-24 05:00Z | USDS@Ethereum | $0.9976 | -23.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.1 bps） | 0.9998 |
| 2026-08-24 05:00Z | USDT@Ethereum | $0.9976 | -23.6 | - | - | resolved | 持续 2.0h 后解除（峰值 52.1 bps） | - |
| 2026-08-24 05:00Z | USDe@Solana | $0.9976 | -24.2 | - | - | resolved | 持续 2.0h 后解除（峰值 77.1 bps） | 0.9998 |
| 2026-08-24 11:00Z | USDe@Solana | $1.0166 | 166.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 0.9998 |
| 2026-08-24 12:00Z | USDS@Solana | $0.9947 | -53.2 | -46.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-08-24 13:00Z | USDS@Solana | $0.9992 | -7.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | 1.0002 |
| 2026-08-24 15:00Z | USDS@Ethereum | $0.9939 | -61.3 | -46.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-08-24 15:00Z | USDT@Ethereum | $0.9939 | -61.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-24 16:00Z | USDe@Solana | $0.9988 | -12.3 | - | - | resolved | 持续 5.0h 后解除（峰值 239.5 bps） | 0.9997 |
| 2026-08-24 17:00Z | USDS@Ethereum | $0.9984 | -15.8 | - | - | resolved | 持续 2.0h 后解除（峰值 61.3 bps） | 1 |
| 2026-08-24 17:00Z | USDT@Ethereum | $0.9984 | -15.8 | - | - | resolved | 持续 2.0h 后解除（峰值 61.3 bps） | - |
| 2026-08-24 17:00Z | USDe@Solana | $0.9855 | -144.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-08-24 19:00Z | USDe@Solana | $0.9976 | -23.8 | - | - | resolved | 持续 2.0h 后解除（峰值 144.5 bps） | 0.9998 |
| 2026-08-24 21:00Z | USDe@Solana | $1.0068 | 68.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-08-24 22:00Z | USDT@Ethereum | $0.9949 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-24 23:00Z | USDT@Ethereum | $0.9974 | -26.1 | - | - | resolved | 持续 1.0h 后解除（峰值 50.5 bps） | - |
| 2026-08-25 00:00Z | USDe@Solana | $1.0025 | 24.9 | - | - | resolved | 持续 3.0h 后解除（峰值 141.1 bps） | 0.9997 |
| 2026-08-25 01:00Z | USDe@Solana | $0.9899 | -101.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-08-25 02:00Z | USDe@Solana | $1.0011 | 11.4 | - | - | resolved | 持续 1.0h 后解除（峰值 101.2 bps） | 0.9997 |
| 2026-08-25 06:00Z | USDT@Ethereum | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-25 07:00Z | USDT@Ethereum | $0.9988 | -11.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-08-25 07:00Z | USDe@Solana | $0.9819 | -181.2 | -28.4 | likely | new-severe | 首次触发即严重（双源大概率真） | 1 |
| 2026-08-25 21:00Z | USDT@Ethereum | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-25 22:00Z | USDT@Ethereum | $0.9995 | -5.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | - |
| 2026-08-26 03:00Z | USDe@Solana | $1.0001 | 0.9 | - | - | resolved | 持续 20.0h 后解除（峰值 386.8 bps） | 0.9999 |
| 2026-08-26 06:00Z | USDe@Solana | $0.9914 | -86.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-08-26 10:00Z | USDe@Solana | $1.0020 | 20.4 | - | - | resolved | 持续 4.0h 后解除（峰值 99.3 bps） | 0.9998 |
| 2026-08-26 12:00Z | USDT@Arbitrum | $1.0077 | 77 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-26 13:00Z | USDT@Arbitrum | $0.9982 | -18.1 | - | - | resolved | 持续 1.0h 后解除（峰值 77.0 bps） | - |
| 2026-08-26 14:00Z | USDe@Solana | $0.9912 | -88.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-08-26 17:00Z | USDe@Solana | $1.0015 | 14.8 | - | - | resolved | 持续 3.0h 后解除（峰值 88.3 bps） | 0.9997 |
| 2026-08-26 22:00Z | USDC@Base | $0.9945 | -54.7 | -31.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-08-26 22:00Z | USDe@Solana | $1.0108 | 107.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-08-26 23:00Z | USDC@Base | $0.9982 | -18.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.7 bps） | 1 |
| 2026-08-26 23:00Z | USDe@Solana | $1.0333 | 333.4 | - | unconfirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-08-27 03:00Z | PYUSD@Solana | $1.0102 | 101.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-27 04:00Z | PYUSD@Solana | $1.0011 | 11.1 | - | - | resolved | 持续 1.0h 后解除（峰值 101.9 bps） | - |
| 2026-08-27 04:00Z | USDT@Ethereum | $0.9948 | -52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-27 05:00Z | USDT@Ethereum | $0.9984 | -15.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.2 bps） | - |
| 2026-08-27 10:00Z | PYUSD@Solana | $1.0050 | 50.2 | 40.6 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-08-27 10:00Z | USDe@Solana | $1.0019 | 19.3 | - | - | resolved | 持续 12.0h 后解除（峰值 386.7 bps） | 1 |
| 2026-08-27 11:00Z | PYUSD@Solana | $1.0020 | 20.1 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | - |
| 2026-08-27 12:00Z | USDe@Solana | $1.0102 | 102 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-08-27 13:00Z | USDe@Solana | $1.0236 | 236.1 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-08-28 00:00Z | USDT@Ethereum | $1.0055 | 55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-28 01:00Z | USDT@Ethereum | $1.0012 | 12.1 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-08-28 08:00Z | USDS@Ethereum | $0.9942 | -58 | -53.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-08-28 08:00Z | USDT@Ethereum | $0.9942 | -58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-28 10:00Z | USDC@Solana | $0.9948 | -51.9 | -26.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-08-28 10:00Z | USDS@Ethereum | $0.9988 | -11.6 | - | - | resolved | 持续 2.0h 后解除（峰值 58.0 bps） | 0.9996 |
| 2026-08-28 10:00Z | USDT@Ethereum | $0.9988 | -11.6 | - | - | resolved | 持续 2.0h 后解除（峰值 58.0 bps） | - |
| 2026-08-28 11:00Z | USDC@Solana | $0.9990 | -10.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | 0.9999 |
| 2026-08-28 14:00Z | USDD@Ethereum | $1.0076 | 76.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-28 15:00Z | USDS@Ethereum | $0.9909 | -91.1 | -48.1 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-08-28 15:00Z | USDT@Ethereum | $0.9909 | -91.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-28 16:00Z | USDS@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 91.1 bps） | 0.9997 |
| 2026-08-28 16:00Z | USDT@Ethereum | $0.9980 | -20.2 | - | - | resolved | 持续 1.0h 后解除（峰值 91.1 bps） | - |
| 2026-08-28 19:00Z | USDD@Ethereum | $0.9985 | -15.3 | - | - | resolved | 持续 5.0h 后解除（峰值 76.3 bps） | - |
| 2026-08-28 22:00Z | PYUSD@Ethereum | $1.0079 | 78.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-28 22:00Z | USDe@Solana | $0.9980 | -20.3 | - | - | resolved | 持续 34.0h 后解除（峰值 537.7 bps） | 0.9999 |
| 2026-08-28 23:00Z | PYUSD@Ethereum | $0.9998 | -1.8 | - | - | resolved | 持续 1.0h 后解除（峰值 78.8 bps） | - |
| 2026-08-29 03:00Z | USDD@Ethereum | $0.9950 | -50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-29 06:00Z | U@BSC | $0.9946 | -53.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-29 06:00Z | USDe@Solana | $0.9946 | -53.8 | -94.1 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-08-29 07:00Z | U@BSC | $1.0000 | 0.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | - |
| 2026-08-29 08:00Z | USDD@Ethereum | $1.0019 | 19.5 | - | - | resolved | 持续 5.0h 后解除（峰值 50.0 bps） | - |
| 2026-08-29 13:00Z | USDe@Solana | $0.9978 | -21.5 | - | - | resolved | 持续 7.0h 后解除（峰值 142.7 bps） | 1.0001 |
| 2026-08-30 01:00Z | USD1@Ethereum | $0.9948 | -52.2 | -46.7 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-08-30 01:00Z | USDS@Ethereum | $0.9949 | -50.5 | -50.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-08-30 01:00Z | USDT@Ethereum | $0.9949 | -50.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-30 02:00Z | PYUSD@Solana | $1.0193 | 192.8 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-08-30 03:00Z | PYUSD@Solana | $1.0000 | -0.2 | - | - | resolved | 持续 1.0h 后解除（峰值 192.8 bps） | - |
| 2026-08-30 04:00Z | USDS@Ethereum | $1.0003 | 3.4 | - | - | resolved | 持续 3.0h 后解除（峰值 50.5 bps） | 0.9998 |
| 2026-08-30 04:00Z | USDT@Ethereum | $1.0003 | 3.4 | - | - | resolved | 持续 3.0h 后解除（峰值 50.5 bps） | - |
| 2026-08-30 09:00Z | USD1@Ethereum | $1.0018 | 18.3 | - | - | resolved | 持续 8.0h 后解除（峰值 52.2 bps） | 0.9997 |
| 2026-08-30 09:00Z | USDS@Ethereum | $0.9947 | -53 | -48.5 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-08-30 09:00Z | USDT@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-30 11:00Z | USDS@Ethereum | $1.0025 | 25.4 | - | - | resolved | 持续 2.0h 后解除（峰值 53.0 bps） | 1.0001 |
| 2026-08-30 11:00Z | USDT@Ethereum | $1.0025 | 25.4 | - | - | resolved | 持续 2.0h 后解除（峰值 53.0 bps） | - |
| 2026-08-30 11:00Z | USDe@Solana | $0.9944 | -56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-08-30 12:00Z | USDe@Solana | $1.0010 | 9.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | 1.0002 |
| 2026-08-30 13:00Z | USDe@Solana | $1.0095 | 95.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-08-30 16:00Z | USDe@Solana | $0.9980 | -20.5 | - | - | resolved | 持续 3.0h 后解除（峰值 95.4 bps） | 1.0001 |
| 2026-08-30 17:00Z | USDe@Solana | $0.9866 | -133.9 | -132.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-08-30 20:00Z | USDe@Solana | $0.9841 | -159.4 | -109.4 | confirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-08-30 22:00Z | USDe@Solana | $0.9979 | -20.9 | - | - | resolved | 持续 5.0h 后解除（峰值 159.4 bps） | 1.0002 |
| 2026-08-30 23:00Z | USDe@Solana | $0.9699 | -300.9 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0001 |
| 2026-08-31 00:00Z | USDe@Solana | $1.0001 | 1.4 | - | - | resolved | 持续 1.0h 后解除（峰值 300.9 bps） | 1.0002 |
| 2026-08-31 04:00Z | USDe@Solana | $0.9869 | -131.2 | -108.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-08-31 08:00Z | USDe@Solana | $0.9985 | -15.1 | - | - | resolved | 持续 4.0h 后解除（峰值 131.2 bps） | 1.0002 |
| 2026-08-31 11:00Z | U@BSC | $0.9948 | -51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-31 11:00Z | USDS@Ethereum | $0.9945 | -54.8 | -26.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-08-31 11:00Z | USDT@Ethereum | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-31 12:00Z | U@BSC | $1.0003 | 2.9 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | - |
| 2026-08-31 12:00Z | USDS@Ethereum | $1.0009 | 9.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | 0.9999 |
| 2026-08-31 12:00Z | USDT@Ethereum | $1.0009 | 9.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | - |
| 2026-08-31 12:00Z | USDe@Solana | $0.9934 | -66.1 | -68.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-08-31 15:00Z | USDe@Solana | $0.9989 | -10.5 | - | - | resolved | 持续 3.0h 后解除（峰值 78.3 bps） | 1.0001 |
| 2026-08-31 20:00Z | USDe@Solana | $0.9887 | -113 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-08-31 22:00Z | U@BSC | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-31 22:00Z | USDT@Ethereum | $0.9945 | -54.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-08-31 23:00Z | U@BSC | $1.0017 | 17.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | - |
| 2026-08-31 23:00Z | USDT@Ethereum | $1.0014 | 13.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | - |
| 2026-09-01 01:00Z | U@BSC | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-01 01:00Z | USDe@Solana | $1.0010 | 10.2 | - | - | resolved | 持续 5.0h 后解除（峰值 139.9 bps） | 1.0001 |
| 2026-09-01 02:00Z | U@BSC | $1.0014 | 13.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-09-01 03:00Z | PYUSD@Ethereum | $1.0052 | 51.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-01 04:00Z | PYUSD@Ethereum | $0.9998 | -2.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.9 bps） | - |
| 2026-09-01 06:00Z | USDS@Ethereum | $0.9946 | -54.2 | -51.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-01 06:00Z | USDT@Ethereum | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-01 08:00Z | RLUSD@Ethereum | $0.9911 | -89.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-01 08:00Z | USDS@Ethereum | $1.0016 | 15.6 | - | - | resolved | 持续 2.0h 后解除（峰值 54.2 bps） | 1 |
| 2026-09-01 08:00Z | USDT@Ethereum | $1.0016 | 15.6 | - | - | resolved | 持续 2.0h 后解除（峰值 54.2 bps） | - |
| 2026-09-01 08:00Z | USDe@Solana | $0.9925 | -75.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-09-01 11:00Z | USDD@Ethereum | $0.9942 | -58.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-01 13:00Z | USDe@Solana | $0.9980 | -19.7 | - | - | resolved | 持续 5.0h 后解除（峰值 145.0 bps） | 0.9999 |
| 2026-09-01 14:00Z | RLUSD@Ethereum | $0.9990 | -10.1 | - | - | resolved | 持续 6.0h 后解除（峰值 89.2 bps） | 1.0004 |
| 2026-09-01 14:00Z | USDD@Ethereum | $0.9976 | -24 | - | - | resolved | 持续 3.0h 后解除（峰值 58.1 bps） | - |
| 2026-09-01 16:00Z | USDe@Solana | $0.9887 | -112.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-01 17:00Z | U@BSC | $0.9948 | -52 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-01 18:00Z | U@BSC | $0.9983 | -16.6 | - | - | resolved | 持续 1.0h 后解除（峰值 52.0 bps） | - |
| 2026-09-01 18:00Z | USDe@Solana | $0.9670 | -330.3 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-09-02 00:00Z | PYUSD@Ethereum | $0.9945 | -55 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 00:00Z | USDS@Ethereum | $0.9945 | -55.1 | -45.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-09-02 00:00Z | USDT@Ethereum | $0.9945 | -55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 02:00Z | PYUSD@Ethereum | $1.0002 | 1.6 | - | - | resolved | 持续 2.0h 后解除（峰值 55.0 bps） | - |
| 2026-09-02 05:00Z | USDS@Ethereum | $0.9991 | -8.8 | - | - | resolved | 持续 5.0h 后解除（峰值 55.1 bps） | 1.0003 |
| 2026-09-02 05:00Z | USDT@Ethereum | $0.9991 | -8.8 | - | - | resolved | 持续 5.0h 后解除（峰值 55.1 bps） | - |
| 2026-09-02 07:00Z | U@BSC | $0.9949 | -50.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 07:00Z | USDe@Solana | $1.0002 | 2.2 | - | - | resolved | 持续 15.0h 后解除（峰值 330.3 bps） | 1 |
| 2026-09-02 08:00Z | U@BSC | $0.9997 | -3.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.8 bps） | - |
| 2026-09-02 08:00Z | USDe@Solana | $0.9896 | -103.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-09-02 09:00Z | USDe@Solana | $1.0000 | -0.5 | - | - | resolved | 持续 1.0h 后解除（峰值 103.7 bps） | 0.9999 |
| 2026-09-02 12:00Z | USDS@Ethereum | $0.9944 | -55.6 | -49.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-02 12:00Z | USDT@Ethereum | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 13:00Z | USDS@Ethereum | $1.0006 | 5.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.6 bps） | 1.0003 |
| 2026-09-02 13:00Z | USDT@Ethereum | $1.0006 | 5.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.6 bps） | - |
| 2026-09-02 14:00Z | USDT@Ethereum | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 16:00Z | USDT@Ethereum | $1.0003 | 2.9 | - | - | resolved | 持续 2.0h 后解除（峰值 52.3 bps） | - |
| 2026-09-02 20:00Z | USDe@Solana | $1.0073 | 72.9 | 56.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-02 22:00Z | USDS@Ethereum | $0.9939 | -61.1 | -58.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-02 22:00Z | USDT@Ethereum | $0.9939 | -61.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-02 22:00Z | USDe@Solana | $1.0015 | 14.9 | - | - | resolved | 持续 2.0h 后解除（峰值 72.9 bps） | 1 |
| 2026-09-02 23:00Z | USDS@Ethereum | $0.9987 | -13 | - | - | resolved | 持续 1.0h 后解除（峰值 61.1 bps） | 1.0003 |
| 2026-09-02 23:00Z | USDT@Ethereum | $0.9987 | -13 | - | - | resolved | 持续 1.0h 后解除（峰值 61.1 bps） | - |
| 2026-09-02 23:00Z | USDe@Solana | $1.0067 | 66.8 | 96.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-03 00:00Z | USDS@Ethereum | $0.9946 | -54.1 | -54 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-03 00:00Z | USDT@Ethereum | $0.9946 | -54.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-03 01:00Z | USDS@Ethereum | $0.9974 | -25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.1 bps） | 1.0003 |
| 2026-09-03 01:00Z | USDT@Ethereum | $0.9974 | -25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 54.1 bps） | - |
| 2026-09-03 05:00Z | RLUSD@Ethereum | $0.9948 | -51.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-03 06:00Z | USDe@Solana | $1.0174 | 174.5 | 154.3 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-09-03 08:00Z | U@BSC | $0.9949 | -50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-03 08:00Z | USDe@Solana | $1.0019 | 19.3 | - | - | resolved | 持续 9.0h 后解除（峰值 174.5 bps） | 0.9999 |
| 2026-09-03 09:00Z | U@BSC | $1.0005 | 5.4 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | - |
| 2026-09-03 09:00Z | USDS@Ethereum | $0.9940 | -59.8 | -56.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-03 09:00Z | USDT@Ethereum | $0.9940 | -59.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-03 11:00Z | RLUSD@Ethereum | $1.0000 | 0.4 | - | - | resolved | 持续 6.0h 后解除（峰值 67.4 bps） | 1.0005 |
| 2026-09-03 11:00Z | USDS@Ethereum | $0.9981 | -19.1 | - | - | resolved | 持续 2.0h 后解除（峰值 59.8 bps） | 1.0001 |
| 2026-09-03 11:00Z | USDT@Ethereum | $0.9981 | -19.1 | - | - | resolved | 持续 2.0h 后解除（峰值 59.8 bps） | - |
| 2026-09-03 14:00Z | USDT@Solana | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-03 15:00Z | USD1@BSC | $0.9944 | -56.3 | -37.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-09-03 15:00Z | USDT@Solana | $0.9994 | -6.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.6 bps） | - |
| 2026-09-03 16:00Z | USD1@BSC | $1.0003 | 3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 56.3 bps） | 0.9997 |
| 2026-09-03 16:00Z | USDC@Base | $0.9940 | -59.6 | -40 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-03 17:00Z | USDC@Base | $0.9977 | -23.2 | - | - | resolved | 持续 1.0h 后解除（峰值 59.6 bps） | 0.9999 |
| 2026-09-03 20:00Z | USDS@Ethereum | $0.9949 | -51.1 | -44 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-03 20:00Z | USDT@Ethereum | $0.9949 | -51.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-03 22:00Z | USDS@Ethereum | $0.9972 | -28 | - | - | resolved | 持续 2.0h 后解除（峰值 51.1 bps） | 1 |
| 2026-09-03 22:00Z | USDT@Ethereum | $0.9972 | -28 | - | - | resolved | 持续 2.0h 后解除（峰值 51.1 bps） | - |
| 2026-09-03 23:00Z | USDe@Solana | $0.9871 | -128.6 | -171.6 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-04 00:00Z | USDe@Solana | $0.9807 | -192.7 | -152.9 | confirmed | escalated | 预警升级为严重 | 0.9998 |
| 2026-09-04 04:00Z | USDT@Ethereum | $0.9943 | -57 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-04 05:00Z | USDT@Ethereum | $1.0020 | 19.9 | - | - | resolved | 持续 1.0h 后解除（峰值 57.0 bps） | - |
| 2026-09-04 12:00Z | RLUSD@Ethereum | $0.9728 | -271.8 | -42.4 | likely | new-severe | 首次触发即严重（双源大概率真） | 1 |
| 2026-09-04 13:00Z | RLUSD@Ethereum | $1.0021 | 20.5 | - | - | resolved | 持续 1.0h 后解除（峰值 271.8 bps） | 1.0002 |
| 2026-09-04 13:00Z | USDe@Solana | $1.0002 | 2.2 | - | - | resolved | 持续 14.0h 后解除（峰值 417.8 bps） | 1 |
| 2026-09-04 14:00Z | USDe@Solana | $0.9916 | -84.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-04 15:00Z | USDe@Solana | $0.9986 | -13.6 | - | - | resolved | 持续 1.0h 后解除（峰值 84.2 bps） | 0.9999 |
| 2026-09-04 17:00Z | U@BSC | $0.9944 | -56 | -25.4 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-04 18:00Z | USDe@Solana | $0.9942 | -57.6 | -47.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-04 19:00Z | U@BSC | $1.0007 | 7.5 | - | - | resolved | 持续 2.0h 后解除（峰值 56.0 bps） | - |
| 2026-09-04 19:00Z | USDe@Solana | $0.9998 | -2.4 | - | - | resolved | 持续 1.0h 后解除（峰值 57.6 bps） | 1 |
| 2026-09-04 20:00Z | USDe@Solana | $0.9911 | -89.2 | -69.7 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-05 02:00Z | USDe@Solana | $1.0017 | 17.5 | - | - | resolved | 持续 6.0h 后解除（峰值 89.2 bps） | 0.9997 |
| 2026-09-05 07:00Z | USDe@Solana | $1.0061 | 61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-09-05 13:00Z | USDe@Solana | $1.0000 | 0.4 | - | - | resolved | 持续 6.0h 后解除（峰值 81.7 bps） | 0.9998 |
| 2026-09-05 17:00Z | USDe@Solana | $1.0096 | 96.2 | 74.4 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-09-05 23:00Z | USD1@Ethereum | $0.9948 | -52.2 | -46.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9997 |
| 2026-09-05 23:00Z | USDe@Solana | $1.0023 | 23.1 | - | - | resolved | 持续 6.0h 后解除（峰值 96.2 bps） | 0.9999 |
| 2026-09-06 01:00Z | PYUSD@Ethereum | $1.0070 | 70.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-06 01:00Z | USDe@Solana | $1.0071 | 71.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-09-06 02:00Z | PYUSD@Ethereum | $1.0003 | 2.9 | - | - | resolved | 持续 1.0h 后解除（峰值 70.4 bps） | - |
| 2026-09-06 06:00Z | USDe@Solana | $0.9994 | -5.6 | - | - | resolved | 持续 5.0h 后解除（峰值 93.6 bps） | 0.9999 |
| 2026-09-06 07:00Z | USD1@Ethereum | $0.9978 | -22.5 | - | - | resolved | 持续 8.0h 后解除（峰值 52.2 bps） | 0.9997 |
| 2026-09-06 19:00Z | USDe@Solana | $0.9943 | -57.5 | -60.3 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-06 20:00Z | USDe@Solana | $1.0013 | 12.6 | - | - | resolved | 持续 1.0h 后解除（峰值 57.5 bps） | 0.9999 |
| 2026-09-07 02:00Z | RLUSD@Ethereum | $1.0103 | 103.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-07 02:00Z | USDT@Arbitrum | $0.9946 | -53.8 | -42.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-07 03:00Z | RLUSD@Ethereum | $0.9993 | -7.4 | - | - | resolved | 持续 1.0h 后解除（峰值 103.4 bps） | 1.0001 |
| 2026-09-07 03:00Z | USDT@Arbitrum | $1.0001 | 1.4 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | - |
| 2026-09-07 03:00Z | USDe@Solana | $0.9851 | -149.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9998 |
| 2026-09-07 06:00Z | U@BSC | $0.9945 | -54.8 | -31.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-07 07:00Z | RLUSD@Ethereum | $0.9913 | -86.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-07 07:00Z | U@BSC | $0.9975 | -25.2 | - | - | resolved | 持续 1.0h 后解除（峰值 54.8 bps） | - |
| 2026-09-07 08:00Z | RLUSD@Ethereum | $1.0012 | 12.5 | - | - | resolved | 持续 1.0h 后解除（峰值 86.6 bps） | 1.0001 |
| 2026-09-07 09:00Z | USDe@Solana | $0.9980 | -19.9 | - | - | resolved | 持续 6.0h 后解除（峰值 149.3 bps） | 0.9999 |
| 2026-09-07 14:00Z | USD1@Ethereum | $0.9895 | -105.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-07 15:00Z | USDe@Solana | $0.9928 | -72.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-07 16:00Z | USDe@Solana | $0.9994 | -5.9 | - | - | resolved | 持续 1.0h 后解除（峰值 72.1 bps） | 1 |
| 2026-09-07 17:00Z | USDe@Solana | $1.0098 | 97.6 | 40.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-07 18:00Z | USDe@Solana | $0.9998 | -1.7 | - | - | resolved | 持续 1.0h 后解除（峰值 97.6 bps） | 1 |
| 2026-09-07 21:00Z | USD1@Ethereum | $0.9979 | -20.9 | - | - | resolved | 持续 7.0h 后解除（峰值 105.2 bps） | 0.9999 |
| 2026-09-07 22:00Z | U@BSC | $0.9935 | -65 | -62.1 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-08 00:00Z | U@BSC | $1.0006 | 6.2 | - | - | resolved | 持续 2.0h 后解除（峰值 65.0 bps） | - |
| 2026-09-08 02:00Z | USDG@Solana | $1.0051 | 51.5 | 25.7 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-08 02:00Z | USDS@Ethereum | $0.9942 | -57.6 | -58.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-08 02:00Z | USDT@Ethereum | $0.9942 | -57.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-08 03:00Z | USDG@Solana | $1.0007 | 7.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.5 bps） | - |
| 2026-09-08 03:00Z | USDe@Solana | $0.9930 | -69.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-09-08 08:00Z | USDe@Solana | $1.0009 | 8.7 | - | - | resolved | 持续 5.0h 后解除（峰值 107.3 bps） | 1.0001 |
| 2026-09-08 09:00Z | USDS@Ethereum | $0.9981 | -19 | - | - | resolved | 持续 7.0h 后解除（峰值 59.2 bps） | 1 |
| 2026-09-08 09:00Z | USDT@Ethereum | $0.9981 | -19 | - | - | resolved | 持续 7.0h 后解除（峰值 59.2 bps） | - |
| 2026-09-08 09:00Z | USDe@Solana | $0.9946 | -53.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-08 10:00Z | USDS@Ethereum | $0.9940 | -60.4 | -59.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-08 10:00Z | USDT@Ethereum | $0.9940 | -60.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-08 10:00Z | USDe@Solana | $0.9982 | -17.6 | - | - | resolved | 持续 1.0h 后解除（峰值 53.6 bps） | 1.0001 |
| 2026-09-08 13:00Z | USDS@Ethereum | $0.9974 | -26.2 | - | - | resolved | 持续 3.0h 后解除（峰值 60.4 bps） | 1.0001 |
| 2026-09-08 13:00Z | USDT@Ethereum | $0.9974 | -26.2 | - | - | resolved | 持续 3.0h 后解除（峰值 60.4 bps） | - |
| 2026-09-08 13:00Z | USDe@Solana | $0.9938 | -62.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-08 14:00Z | PYUSD@Solana | $1.0053 | 53 | 101.7 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-08 15:00Z | PYUSD@Solana | $1.0000 | 0.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.0 bps） | - |
| 2026-09-08 17:00Z | U@BSC | $0.9927 | -72.5 | -43.8 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-08 17:00Z | USDe@Solana | $1.0009 | 8.6 | - | - | resolved | 持续 4.0h 后解除（峰值 65.7 bps） | 0.9999 |
| 2026-09-08 19:00Z | U@BSC | $1.0005 | 4.9 | - | - | resolved | 持续 2.0h 后解除（峰值 72.5 bps） | - |
| 2026-09-08 19:00Z | USDe@Solana | $0.9939 | -61 | -89.6 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-09 04:00Z | USDe@Solana | $0.9990 | -9.5 | - | - | resolved | 持续 9.0h 后解除（峰值 103.5 bps） | 1.0001 |
| 2026-09-09 05:00Z | RLUSD@Ethereum | $1.0051 | 50.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-09 06:00Z | RLUSD@Ethereum | $0.9989 | -11.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.9 bps） | 1.0003 |
| 2026-09-09 07:00Z | USDD@Ethereum | $0.9944 | -55.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-09 07:00Z | USDS@Ethereum | $0.9945 | -54.9 | -56.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-09 07:00Z | USDT@Ethereum | $0.9945 | -54.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-09 08:00Z | USDD@Ethereum | $0.9991 | -8.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.5 bps） | - |
| 2026-09-09 08:00Z | USDS@Ethereum | $0.9987 | -12.8 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | 1.0001 |
| 2026-09-09 08:00Z | USDT@Ethereum | $0.9987 | -12.8 | - | - | resolved | 持续 1.0h 后解除（峰值 54.9 bps） | - |
| 2026-09-09 09:00Z | RLUSD@Ethereum | $0.9917 | -83.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-09 09:00Z | USDe@Solana | $0.9836 | -163.6 | -136.4 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-09-09 12:00Z | U@BSC | $0.9946 | -53.5 | -27.2 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-09 13:00Z | U@BSC | $1.0011 | 10.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | - |
| 2026-09-09 15:00Z | USDD@Ethereum | $0.9946 | -54.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-09 17:00Z | RLUSD@Ethereum | $1.0020 | 20.2 | - | - | resolved | 持续 8.0h 后解除（峰值 112.3 bps） | 1.0003 |
| 2026-09-09 20:00Z | USDS@Solana | $1.0052 | 52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-09 21:00Z | USDS@Ethereum | $0.9948 | -51.5 | -48 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-09-09 21:00Z | USDS@Solana | $1.0023 | 22.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | 1.0001 |
| 2026-09-09 21:00Z | USDT@Ethereum | $0.9948 | -51.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-09 23:00Z | USDS@Ethereum | $0.9993 | -6.9 | - | - | resolved | 持续 2.0h 后解除（峰值 51.5 bps） | 1.0001 |
| 2026-09-09 23:00Z | USDT@Ethereum | $0.9993 | -6.9 | - | - | resolved | 持续 2.0h 后解除（峰值 51.5 bps） | - |
| 2026-09-10 02:00Z | PYUSD@Ethereum | $1.0073 | 72.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-10 02:00Z | RLUSD@Ethereum | $1.0055 | 54.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-10 03:00Z | PYUSD@Ethereum | $0.9989 | -11 | - | - | resolved | 持续 1.0h 后解除（峰值 72.9 bps） | - |
| 2026-09-10 04:00Z | USDe@Solana | $1.0024 | 23.6 | - | - | resolved | 持续 19.0h 后解除（峰值 163.6 bps） | 1.0001 |
| 2026-09-10 07:00Z | USDe@Solana | $0.9949 | -51 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-10 08:00Z | RLUSD@Ethereum | $1.0022 | 21.9 | - | - | resolved | 持续 6.0h 后解除（峰值 64.6 bps） | 1.0004 |
| 2026-09-10 08:00Z | USDe@Solana | $1.0002 | 2.4 | - | - | resolved | 持续 1.0h 后解除（峰值 51.0 bps） | 1 |
| 2026-09-10 11:00Z | USDD@Ethereum | $1.0013 | 13.2 | - | - | resolved | 持续 20.0h 后解除（峰值 54.2 bps） | - |
| 2026-09-10 16:00Z | USDe@Solana | $0.9876 | -124 | -100.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-10 17:00Z | RLUSD@Ethereum | $1.0113 | 113.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-10 19:00Z | RLUSD@Ethereum | $1.0028 | 28 | - | - | resolved | 持续 2.0h 后解除（峰值 113.5 bps） | 1.0004 |
| 2026-09-10 20:00Z | PYUSD@Solana | $1.0052 | 52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-10 21:00Z | PYUSD@Solana | $1.0002 | 2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.2 bps） | - |
| 2026-09-10 21:00Z | USDS@Ethereum | $0.9949 | -50.6 | -50.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-10 21:00Z | USDT@Ethereum | $0.9949 | -50.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-10 21:00Z | USDe@Solana | $1.0027 | 26.9 | - | - | resolved | 持续 5.0h 后解除（峰值 124.0 bps） | 1.0002 |
| 2026-09-10 22:00Z | USDS@Ethereum | $1.0004 | 3.6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | 1.0001 |
| 2026-09-10 22:00Z | USDT@Ethereum | $1.0004 | 3.6 | - | - | resolved | 持续 1.0h 后解除（峰值 50.6 bps） | - |
| 2026-09-10 23:00Z | USDS@Ethereum | $0.9948 | -51.8 | -47.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-10 23:00Z | USDT@Ethereum | $0.9948 | -51.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-10 23:00Z | USDe@Solana | $0.9935 | -65 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-11 00:00Z | USDS@Ethereum | $0.9991 | -8.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | 1.0002 |
| 2026-09-11 00:00Z | USDT@Ethereum | $0.9991 | -8.5 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | - |
| 2026-09-11 01:00Z | USDe@Solana | $1.0020 | 19.7 | - | - | resolved | 持续 2.0h 后解除（峰值 90.0 bps） | 1.0002 |
| 2026-09-11 02:00Z | USDe@Solana | $1.0054 | 53.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-11 05:00Z | RLUSD@Ethereum | $1.0057 | 57.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-11 06:00Z | RLUSD@Ethereum | $1.0010 | 10.2 | - | - | resolved | 持续 1.0h 后解除（峰值 57.2 bps） | 1.0003 |
| 2026-09-11 06:00Z | U@BSC | $0.9949 | -50.6 | -26.9 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-11 08:00Z | U@BSC | $1.0004 | 3.7 | - | - | resolved | 持续 2.0h 后解除（峰值 50.6 bps） | - |
| 2026-09-11 10:00Z | USD1@Ethereum | $0.9946 | -54.1 | -44.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-11 10:00Z | USDS@Ethereum | $0.9946 | -54.3 | -51.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-11 10:00Z | USDT@Ethereum | $0.9946 | -54.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-11 11:00Z | USDe@Solana | $0.9971 | -28.9 | - | - | resolved | 持续 9.0h 后解除（峰值 60.8 bps） | 1 |
| 2026-09-11 12:00Z | USDS@Ethereum | $0.9974 | -26.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.3 bps） | 1.0002 |
| 2026-09-11 12:00Z | USDT@Ethereum | $0.9974 | -26.1 | - | - | resolved | 持续 2.0h 后解除（峰值 54.3 bps） | - |
| 2026-09-11 13:00Z | RLUSD@Ethereum | $1.0144 | 143.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-11 13:00Z | USDC@Base | $1.0152 | 152.3 | 26 | likely | new-severe | 首次触发即严重（双源大概率真） | 1.0003 |
| 2026-09-11 13:00Z | USDT@Arbitrum | $1.0067 | 66.9 | 124.2 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-11 14:00Z | RLUSD@Ethereum | $1.0405 | 404.5 | -5.9 | suspicious | escalated | 预警升级为严重 | 1.0003 |
| 2026-09-11 14:00Z | USDC@Base | $0.9982 | -18.2 | - | - | resolved | 持续 1.0h 后解除（峰值 152.3 bps） | 1.0002 |
| 2026-09-11 14:00Z | USDT@Arbitrum | $1.0009 | 8.7 | - | - | resolved | 持续 1.0h 后解除（峰值 66.9 bps） | - |
| 2026-09-11 14:00Z | USDe@Solana | $0.9864 | -135.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-11 15:00Z | USD1@Ethereum | $0.9982 | -17.7 | - | - | resolved | 持续 5.0h 后解除（峰值 54.1 bps） | 1 |
| 2026-09-11 17:00Z | USDS@Solana | $0.9948 | -51.8 | -51.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-11 18:00Z | USDS@Ethereum | $0.9943 | -56.5 | -48.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-09-11 18:00Z | USDS@Solana | $0.9998 | -1.9 | - | - | resolved | 持续 1.0h 后解除（峰值 51.8 bps） | 1.0001 |
| 2026-09-11 18:00Z | USDT@Ethereum | $0.9943 | -56.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-11 18:00Z | USDe@Solana | $1.0012 | 12.3 | - | - | resolved | 持续 4.0h 后解除（峰值 135.8 bps） | 1.0001 |
| 2026-09-11 19:00Z | USDe@Solana | $1.0100 | 100 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-11 21:00Z | RLUSD@Ethereum | $0.9972 | -28.2 | - | - | resolved | 持续 8.0h 后解除（峰值 404.5 bps） | 1.0001 |
| 2026-09-11 21:00Z | USDS@Ethereum | $1.0001 | 0.9 | - | - | resolved | 持续 3.0h 后解除（峰值 56.5 bps） | 1.0001 |
| 2026-09-11 21:00Z | USDT@Ethereum | $1.0001 | 0.9 | - | - | resolved | 持续 3.0h 后解除（峰值 56.5 bps） | - |
| 2026-09-12 02:00Z | USDe@Solana | $1.0023 | 23 | - | - | resolved | 持续 7.0h 后解除（峰值 100.0 bps） | 1.0001 |
| 2026-09-12 04:00Z | USDe@Solana | $0.9947 | -52.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-12 07:00Z | USDe@Solana | $0.9994 | -6.3 | - | - | resolved | 持续 3.0h 后解除（峰值 75.0 bps） | 1.0001 |
| 2026-09-12 16:00Z | USDS@Ethereum | $0.9949 | -51.4 | -52.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-12 16:00Z | USDT@Ethereum | $0.9949 | -51.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-12 18:00Z | U@BSC | $0.9947 | -52.8 | -48 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-12 19:00Z | U@BSC | $0.9999 | -0.5 | - | - | resolved | 持续 1.0h 后解除（峰值 52.8 bps） | - |
| 2026-09-12 19:00Z | USDS@Ethereum | $1.0014 | 14 | - | - | resolved | 持续 3.0h 后解除（峰值 58.5 bps） | 1 |
| 2026-09-12 19:00Z | USDT@Ethereum | $1.0014 | 14 | - | - | resolved | 持续 3.0h 后解除（峰值 58.5 bps） | - |
| 2026-09-12 19:00Z | USDe@Solana | $0.9938 | -62.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-13 03:00Z | USDe@Solana | $0.9991 | -9.3 | - | - | resolved | 持续 8.0h 后解除（峰值 62.3 bps） | 1.0001 |
| 2026-09-13 08:00Z | USDe@Solana | $0.9863 | -136.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-13 09:00Z | USDe@Solana | $1.0014 | 14.1 | - | - | resolved | 持续 1.0h 后解除（峰值 136.9 bps） | 1.0001 |
| 2026-09-13 22:00Z | RLUSD@Ethereum | $0.9849 | -151.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0005 |
| 2026-09-13 22:00Z | USDS@Ethereum | $0.9943 | -57.1 | -51.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-13 22:00Z | USDT@Ethereum | $0.9943 | -57.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-13 22:00Z | USDe@Solana | $0.9787 | -213.4 | -113.9 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0001 |
| 2026-09-13 23:00Z | USDe@Solana | $0.9993 | -7.2 | - | - | resolved | 持续 1.0h 后解除（峰值 213.4 bps） | 1 |
| 2026-09-14 00:00Z | RLUSD@Ethereum | $1.0000 | -0.1 | - | - | resolved | 持续 2.0h 后解除（峰值 151.4 bps） | 1.0005 |
| 2026-09-14 00:00Z | USDS@Ethereum | $0.9995 | -5.5 | - | - | resolved | 持续 2.0h 后解除（峰值 57.1 bps） | 1.0001 |
| 2026-09-14 00:00Z | USDT@Ethereum | $0.9995 | -5.5 | - | - | resolved | 持续 2.0h 后解除（峰值 57.1 bps） | - |
| 2026-09-14 02:00Z | USDe@Solana | $1.0097 | 97.4 | 102.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-14 03:00Z | USDe@Solana | $0.9973 | -27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 97.4 bps） | 1.0001 |
| 2026-09-14 07:00Z | USDC@Solana | $0.9753 | -247.1 | -26.7 | likely | new-severe | 首次触发即严重（双源大概率真） | 1.0004 |
| 2026-09-14 08:00Z | USDC@Solana | $1.0000 | 0 | - | - | resolved | 持续 1.0h 后解除（峰值 247.1 bps） | 1.0004 |
| 2026-09-14 08:00Z | USDS@Ethereum | $0.9948 | -52.4 | -51.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-14 08:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-14 09:00Z | USDS@Ethereum | $0.9982 | -17.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | 1.0001 |
| 2026-09-14 09:00Z | USDT@Ethereum | $0.9982 | -17.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | - |
| 2026-09-14 14:00Z | RLUSD@Ethereum | $0.9939 | -61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-14 14:00Z | USDe@Solana | $1.0056 | 56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-14 15:00Z | USDe@Solana | $1.0015 | 15.1 | - | - | resolved | 持续 1.0h 后解除（峰值 56.0 bps） | 1 |
| 2026-09-14 16:00Z | USDe@Solana | $1.0129 | 129.5 | 69.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-14 17:00Z | USDe@Solana | $1.0026 | 25.9 | - | - | resolved | 持续 1.0h 后解除（峰值 129.5 bps） | 1 |
| 2026-09-14 18:00Z | RLUSD@Ethereum | $1.0018 | 17.6 | - | - | resolved | 持续 4.0h 后解除（峰值 61.0 bps） | 1.0001 |
| 2026-09-14 22:00Z | USDe@Solana | $0.9862 | -137.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-14 23:00Z | USDT@Ethereum | $0.9948 | -52.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-14 23:00Z | USDe@Solana | $0.9820 | -179.7 | - | unconfirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-15 00:00Z | USDT@Ethereum | $1.0029 | 28.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | - |
| 2026-09-15 02:00Z | USDe@Solana | $0.9989 | -11 | - | - | resolved | 持续 4.0h 后解除（峰值 179.7 bps） | 1 |
| 2026-09-15 03:00Z | USDe@Solana | $0.9905 | -95.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-15 05:00Z | USDe@Solana | $0.9836 | -164.3 | - | unconfirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-15 08:00Z | USDC@Base | $0.9943 | -56.7 | -27.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-09-15 13:00Z | USDC@Base | $1.0013 | 13.4 | - | - | resolved | 持续 5.0h 后解除（峰值 56.7 bps） | 1.0004 |
| 2026-09-15 13:00Z | USDT@Ethereum | $1.0050 | 50 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-15 14:00Z | USDT@Ethereum | $0.9970 | -29.8 | - | - | resolved | 持续 1.0h 后解除（峰值 50.0 bps） | - |
| 2026-09-15 15:00Z | USDe@Solana | $0.9993 | -6.7 | - | - | resolved | 持续 12.0h 后解除（峰值 190.9 bps） | 1.0001 |
| 2026-09-15 17:00Z | USDe@Solana | $1.0098 | 98.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-09-15 18:00Z | USDD@BSC | $0.9940 | -60.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-15 18:00Z | USDG@Solana | $0.9949 | -50.7 | -41 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-15 18:00Z | USDT@Ethereum | $0.9821 | -179.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-09-15 18:00Z | USDe@Solana | $0.9666 | -334 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-09-15 19:00Z | PYUSD@Ethereum | $1.0135 | 135.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-15 19:00Z | USDG@Solana | $1.0001 | 1.1 | - | - | resolved | 持续 1.0h 后解除（峰值 50.7 bps） | - |
| 2026-09-15 19:00Z | USDT@Ethereum | $0.9987 | -12.8 | - | - | resolved | 持续 1.0h 后解除（峰值 179.3 bps） | - |
| 2026-09-15 20:00Z | PYUSD@Ethereum | $1.0024 | 24.5 | - | - | resolved | 持续 1.0h 后解除（峰值 135.2 bps） | - |
| 2026-09-15 20:00Z | USDD@BSC | $0.9982 | -17.8 | - | - | resolved | 持续 2.0h 后解除（峰值 60.4 bps） | - |
| 2026-09-15 23:00Z | USDS@Ethereum | $0.9942 | -57.7 | -50.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-15 23:00Z | USDT@Ethereum | $0.9942 | -57.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-16 01:00Z | USDS@Ethereum | $0.9995 | -4.9 | - | - | resolved | 持续 2.0h 后解除（峰值 57.7 bps） | 1 |
| 2026-09-16 01:00Z | USDT@Ethereum | $0.9995 | -4.9 | - | - | resolved | 持续 2.0h 后解除（峰值 57.7 bps） | - |
| 2026-09-16 02:00Z | USDe@Solana | $0.9994 | -6.3 | - | - | resolved | 持续 9.0h 后解除（峰值 334.0 bps） | 0.9999 |
| 2026-09-16 03:00Z | PYUSD@Ethereum | $1.0071 | 71.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-16 03:00Z | USDD@BSC | $0.9920 | -80.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-16 03:00Z | USDS@Ethereum | $0.9949 | -51 | -42.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0001 |
| 2026-09-16 03:00Z | USDT@Ethereum | $0.9949 | -51 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-16 04:00Z | USDS@Ethereum | $1.0026 | 26.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.0 bps） | 1 |
| 2026-09-16 04:00Z | USDT@Ethereum | $1.0026 | 26.3 | - | - | resolved | 持续 1.0h 后解除（峰值 51.0 bps） | - |
| 2026-09-16 05:00Z | PYUSD@Ethereum | $1.0002 | 2 | - | - | resolved | 持续 2.0h 后解除（峰值 71.2 bps） | - |
| 2026-09-16 12:00Z | USDC@Base | $0.9947 | -53.5 | -52.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0008 |
| 2026-09-16 12:00Z | USDS@Ethereum | $0.9945 | -54.7 | -40.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-16 12:00Z | USDT@Ethereum | $0.9945 | -54.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-16 13:00Z | USDC@Base | $1.0022 | 22.5 | - | - | resolved | 持续 1.0h 后解除（峰值 53.5 bps） | 1.0007 |
| 2026-09-16 15:00Z | USDD@BSC | $1.0027 | 27.5 | - | - | resolved | 持续 12.0h 后解除（峰值 80.1 bps） | - |
| 2026-09-16 17:00Z | USDS@Ethereum | $0.9985 | -14.6 | - | - | resolved | 持续 5.0h 后解除（峰值 54.7 bps） | 1 |
| 2026-09-16 17:00Z | USDT@Ethereum | $0.9985 | -14.6 | - | - | resolved | 持续 5.0h 后解除（峰值 54.7 bps） | - |
| 2026-09-16 17:00Z | USDe@Solana | $0.9878 | -121.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-16 19:00Z | USDe@Solana | $0.9997 | -2.6 | - | - | resolved | 持续 2.0h 后解除（峰值 121.6 bps） | 1 |
| 2026-09-16 22:00Z | USDe@Solana | $0.9943 | -57.4 | -124.3 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-16 23:00Z | USDe@Solana | $1.0006 | 6.4 | - | - | resolved | 持续 1.0h 后解除（峰值 57.4 bps） | 1.0004 |
| 2026-09-17 00:00Z | USDe@Solana | $1.0094 | 94.4 | 63.8 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-09-17 01:00Z | USDS@Ethereum | $0.9941 | -59 | -42.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-17 01:00Z | USDT@Ethereum | $0.9941 | -59 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-17 02:00Z | USDS@Ethereum | $0.9976 | -23.8 | - | - | resolved | 持续 1.0h 后解除（峰值 59.0 bps） | 1.0002 |
| 2026-09-17 02:00Z | USDT@Ethereum | $0.9976 | -23.8 | - | - | resolved | 持续 1.0h 后解除（峰值 59.0 bps） | - |
| 2026-09-17 02:00Z | USDe@Solana | $1.0010 | 9.6 | - | - | resolved | 持续 2.0h 后解除（峰值 94.4 bps） | 1.0004 |
| 2026-09-17 05:00Z | USDe@Solana | $1.0244 | 243.6 | 245.1 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0006 |
| 2026-09-17 07:00Z | USDS@Ethereum | $0.9947 | -52.7 | -44.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-17 07:00Z | USDT@Ethereum | $0.9947 | -52.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-17 08:00Z | USDS@Ethereum | $0.9972 | -27.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | 1.0003 |
| 2026-09-17 08:00Z | USDT@Ethereum | $0.9972 | -27.9 | - | - | resolved | 持续 1.0h 后解除（峰值 52.7 bps） | - |
| 2026-09-17 09:00Z | USDS@Ethereum | $0.9948 | -52.4 | -45.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-17 09:00Z | USDT@Ethereum | $0.9948 | -52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-17 12:00Z | USDS@Ethereum | $0.9998 | -2.3 | - | - | resolved | 持续 3.0h 后解除（峰值 52.4 bps） | 1.0005 |
| 2026-09-17 12:00Z | USDT@Ethereum | $0.9998 | -2.3 | - | - | resolved | 持续 3.0h 后解除（峰值 52.4 bps） | - |
| 2026-09-17 14:00Z | USDe@Solana | $0.9992 | -8.2 | - | - | resolved | 持续 9.0h 后解除（峰值 363.2 bps） | 1.0006 |
| 2026-09-17 16:00Z | RLUSD@Ethereum | $1.0094 | 93.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-09-17 18:00Z | USDS@Ethereum | $0.9945 | -54.7 | -47.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-09-17 18:00Z | USDT@Ethereum | $0.9945 | -54.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-17 19:00Z | USDS@Ethereum | $1.0014 | 14.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.7 bps） | 1.0005 |
| 2026-09-17 19:00Z | USDT@Ethereum | $1.0014 | 14.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.7 bps） | - |
| 2026-09-17 20:00Z | RLUSD@Ethereum | $1.0012 | 11.6 | - | - | resolved | 持续 4.0h 后解除（峰值 93.7 bps） | 1.0008 |
| 2026-09-17 21:00Z | USDS@Ethereum | $0.9945 | -55.3 | -48.8 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-09-17 21:00Z | USDT@Ethereum | $0.9945 | -55.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-17 22:00Z | USDS@Ethereum | $1.0017 | 16.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | 1.0005 |
| 2026-09-17 22:00Z | USDT@Ethereum | $1.0017 | 16.7 | - | - | resolved | 持续 1.0h 后解除（峰值 55.3 bps） | - |
| 2026-09-18 01:00Z | USDe@Solana | $1.0116 | 115.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-09-18 03:00Z | USDe@Solana | $1.0328 | 328 | - | unconfirmed | escalated | 预警升级为严重 | 1.0002 |
| 2026-09-18 06:00Z | USDC@Solana | $0.9950 | -50.5 | -25.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0007 |
| 2026-09-18 07:00Z | USDC@Solana | $1.0000 | 0 | - | - | resolved | 持续 1.0h 后解除（峰值 50.5 bps） | 1.0007 |
| 2026-09-18 09:00Z | RLUSD@Ethereum | $1.0098 | 97.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0009 |
| 2026-09-18 10:00Z | USDe@Solana | $1.0015 | 14.8 | - | - | resolved | 持续 9.0h 后解除（峰值 328.0 bps） | 1.0004 |
| 2026-09-18 11:00Z | RLUSD@Ethereum | $1.0010 | 10.5 | - | - | resolved | 持续 2.0h 后解除（峰值 115.3 bps） | 1.0009 |
| 2026-09-18 13:00Z | USD1@Ethereum | $0.9935 | -65.3 | -69.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-18 16:00Z | USDe@Solana | $1.0109 | 109 | 104.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0004 |
| 2026-09-18 18:00Z | USDe@Solana | $1.0162 | 162 | 182.5 | confirmed | escalated | 预警升级为严重 | 1.0003 |
| 2026-09-18 21:00Z | USDS@Ethereum | $0.9945 | -54.6 | -54.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-18 21:00Z | USDT@Ethereum | $0.9945 | -54.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-18 22:00Z | USDD@Ethereum | $0.9944 | -56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-18 23:00Z | USDD@BSC | $0.9945 | -55.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-19 00:00Z | USDS@Ethereum | $0.9991 | -8.5 | - | - | resolved | 持续 3.0h 后解除（峰值 56.3 bps） | 1.0003 |
| 2026-09-19 00:00Z | USDT@Ethereum | $0.9991 | -8.5 | - | - | resolved | 持续 3.0h 后解除（峰值 56.3 bps） | - |
| 2026-09-19 01:00Z | USDD@BSC | $1.0028 | 28.5 | - | - | resolved | 持续 2.0h 后解除（峰值 55.2 bps） | - |
| 2026-09-19 01:00Z | USDe@Solana | $0.9997 | -3.2 | - | - | resolved | 持续 9.0h 后解除（峰值 265.4 bps） | 1.0001 |
| 2026-09-19 05:00Z | PYUSD@Solana | $1.0057 | 57.1 | 105.1 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-19 05:00Z | USDe@Solana | $0.9893 | -107.5 | -127.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-19 06:00Z | PYUSD@Solana | $1.0000 | 0.1 | - | - | resolved | 持续 1.0h 后解除（峰值 57.1 bps） | - |
| 2026-09-19 06:00Z | USDe@Solana | $0.9972 | -27.9 | - | - | resolved | 持续 1.0h 后解除（峰值 107.5 bps） | 1.0002 |
| 2026-09-19 10:00Z | USDD@Ethereum | $0.9990 | -10 | - | - | resolved | 持续 12.0h 后解除（峰值 56.0 bps） | - |
| 2026-09-19 18:00Z | USDS@Ethereum | $0.9947 | -53.2 | -40.7 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-19 18:00Z | USDT@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-19 19:00Z | USDS@Ethereum | $1.0021 | 20.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | 1.0003 |
| 2026-09-19 19:00Z | USDT@Ethereum | $1.0021 | 20.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.2 bps） | - |
| 2026-09-19 21:00Z | RLUSD@Ethereum | $0.9947 | -53.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-19 21:00Z | USD1@Ethereum | $0.9982 | -17.8 | - | - | resolved | 持续 32.0h 后解除（峰值 91.4 bps） | 0.9998 |
| 2026-09-19 21:00Z | USDe@Solana | $0.9867 | -132.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-19 23:00Z | RLUSD@Ethereum | $1.0004 | 4.2 | - | - | resolved | 持续 2.0h 后解除（峰值 67.9 bps） | 1.0003 |
| 2026-09-19 23:00Z | USDC@Solana | $1.0050 | 50.2 | 26.6 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-20 00:00Z | USDC@Solana | $0.9975 | -25.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | 1.0002 |
| 2026-09-20 02:00Z | USDe@Solana | $0.9620 | -380.1 | -158.5 | confirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-20 04:00Z | PYUSD@Solana | $1.0050 | 50.1 | 64.3 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-20 05:00Z | PYUSD@Solana | $0.9975 | -25.1 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-09-20 06:00Z | USDD@Ethereum | $0.9667 | -333.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | - |
| 2026-09-20 13:00Z | USDe@Solana | $0.9996 | -3.8 | - | - | resolved | 持续 16.0h 后解除（峰值 380.1 bps） | 1.0002 |
| 2026-09-20 15:00Z | USDD@Ethereum | $0.9984 | -16 | - | - | resolved | 持续 9.0h 后解除（峰值 333.1 bps） | - |
| 2026-09-20 16:00Z | PYUSD@Solana | $1.0050 | 50.2 | 203 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-20 17:00Z | PYUSD@Solana | $1.0000 | 0 | - | - | resolved | 持续 1.0h 后解除（峰值 50.2 bps） | - |
| 2026-09-20 17:00Z | USDS@Ethereum | $0.9948 | -52.2 | -46 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-20 17:00Z | USDT@Ethereum | $0.9948 | -52.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-20 19:00Z | USDS@Ethereum | $0.9974 | -26.4 | - | - | resolved | 持续 2.0h 后解除（峰值 52.2 bps） | 1.0002 |
| 2026-09-20 19:00Z | USDT@Ethereum | $0.9974 | -26.4 | - | - | resolved | 持续 2.0h 后解除（峰值 52.2 bps） | - |
| 2026-09-20 21:00Z | USDe@Solana | $0.9927 | -73.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-20 23:00Z | USDS@Solana | $1.0050 | 50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-21 00:00Z | USDS@Solana | $1.0019 | 18.9 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | 1.0002 |
| 2026-09-21 01:00Z | USDe@Solana | $0.9807 | -193.3 | 97.5 | suspicious | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-21 08:00Z | RLUSD@Ethereum | $1.0151 | 151.3 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0002 |
| 2026-09-21 12:00Z | USDe@Solana | $1.0012 | 11.9 | - | - | resolved | 持续 15.0h 后解除（峰值 306.5 bps） | 1.0001 |
| 2026-09-21 16:00Z | USDe@Solana | $0.9900 | -99.7 | -75.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-21 18:00Z | PYUSD@Solana | $1.0052 | 52.3 | 52.5 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-21 18:00Z | RLUSD@Ethereum | $1.0010 | 9.6 | - | - | resolved | 持续 10.0h 后解除（峰值 379.6 bps） | 1 |
| 2026-09-21 19:00Z | PYUSD@Solana | $0.9980 | -20.4 | - | - | resolved | 持续 1.0h 后解除（峰值 52.3 bps） | - |
| 2026-09-21 20:00Z | USDe@Solana | $0.9984 | -15.7 | - | - | resolved | 持续 4.0h 后解除（峰值 140.4 bps） | 0.9997 |
| 2026-09-21 21:00Z | USDe@Solana | $1.0077 | 77.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9996 |
| 2026-09-21 22:00Z | USDe@Solana | $0.9994 | -5.7 | - | - | resolved | 持续 1.0h 后解除（峰值 77.3 bps） | 0.9998 |
| 2026-09-22 03:00Z | USDe@Solana | $0.9950 | -50.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-22 08:00Z | USDe@Solana | $1.0022 | 22.3 | - | - | resolved | 持续 5.0h 后解除（峰值 89.5 bps） | 0.9998 |
| 2026-09-22 14:00Z | USDD@Ethereum | $0.9943 | -56.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-22 15:00Z | USDS@Solana | $1.0050 | 50.1 | 26.9 | likely | new-warn | 首次触发预警（双源大概率真） | 1 |
| 2026-09-22 17:00Z | USDS@Solana | $1.0026 | 25.8 | - | - | resolved | 持续 2.0h 后解除（峰值 50.1 bps） | 1 |
| 2026-09-22 17:00Z | USDe@Solana | $1.0096 | 96.5 | 82 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-22 22:00Z | USDe@Solana | $1.0161 | 161.1 | - | unconfirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-09-23 00:00Z | USD1@Ethereum | $0.9945 | -54.6 | -51.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9996 |
| 2026-09-23 01:00Z | USD1@Ethereum | $0.9975 | -25.1 | - | - | resolved | 持续 1.0h 后解除（峰值 54.6 bps） | 0.9996 |
| 2026-09-23 02:00Z | USDe@Solana | $0.9999 | -0.6 | - | - | resolved | 持续 9.0h 后解除（峰值 181.5 bps） | 0.9999 |
| 2026-09-23 03:00Z | USDD@Ethereum | $0.9977 | -23.3 | - | - | resolved | 持续 13.0h 后解除（峰值 56.8 bps） | - |
| 2026-09-23 04:00Z | USDe@Solana | $1.0078 | 78.5 | 49.7 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-09-23 05:00Z | USDS@Ethereum | $0.9943 | -57.5 | -54.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-23 05:00Z | USDT@Ethereum | $0.9943 | -57.5 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-23 06:00Z | USDe@Solana | $0.9981 | -19 | - | - | resolved | 持续 2.0h 后解除（峰值 78.5 bps） | 1 |
| 2026-09-23 07:00Z | USDS@Ethereum | $0.9975 | -25.4 | - | - | resolved | 持续 2.0h 后解除（峰值 57.5 bps） | 1.0001 |
| 2026-09-23 07:00Z | USDT@Ethereum | $0.9975 | -25.4 | - | - | resolved | 持续 2.0h 后解除（峰值 57.5 bps） | - |
| 2026-09-23 08:00Z | USDe@Solana | $0.9877 | -122.9 | -78.4 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-23 09:00Z | PYUSD@Solana | $0.9950 | -50.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-23 09:00Z | USDe@Solana | $1.0003 | 3.1 | - | - | resolved | 持续 1.0h 后解除（峰值 122.9 bps） | 1.0001 |
| 2026-09-23 10:00Z | PYUSD@Solana | $1.0025 | 25.5 | - | - | resolved | 持续 1.0h 后解除（峰值 50.1 bps） | - |
| 2026-09-23 13:00Z | USDe@Solana | $0.9945 | -54.6 | -54.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-23 14:00Z | USDe@Solana | $0.9724 | -275.9 | - | unconfirmed | escalated | 预警升级为严重 | 1 |
| 2026-09-23 17:00Z | USDe@Solana | $0.9987 | -12.7 | - | - | resolved | 持续 4.0h 后解除（峰值 275.9 bps） | 0.9997 |
| 2026-09-23 20:00Z | U@BSC | $0.9948 | -52 | -48.5 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-23 21:00Z | U@BSC | $1.0010 | 9.8 | - | - | resolved | 持续 1.0h 后解除（峰值 52.0 bps） | - |
| 2026-09-23 21:00Z | USDS@Ethereum | $1.0050 | 50.3 | 50.5 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-23 21:00Z | USDT@Ethereum | $1.0050 | 50.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-23 22:00Z | RLUSD@Ethereum | $1.0058 | 57.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-23 23:00Z | USDD@Ethereum | $0.9941 | -59.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-23 23:00Z | USDS@Ethereum | $1.0017 | 16.7 | - | - | resolved | 持续 2.0h 后解除（峰值 50.3 bps） | 0.9999 |
| 2026-09-23 23:00Z | USDT@Ethereum | $1.0017 | 16.7 | - | - | resolved | 持续 2.0h 后解除（峰值 50.3 bps） | - |
| 2026-09-24 00:00Z | RLUSD@Ethereum | $0.9996 | -4.4 | - | - | resolved | 持续 2.0h 后解除（峰值 57.7 bps） | 1.0002 |
| 2026-09-24 00:00Z | USDe@Solana | $1.0066 | 65.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9997 |
| 2026-09-24 01:00Z | USDS@Ethereum | $0.9946 | -53.9 | -54.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-24 01:00Z | USDT@Ethereum | $0.9946 | -53.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-24 02:00Z | USDS@Ethereum | $0.9989 | -10.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | 1 |
| 2026-09-24 02:00Z | USDT@Ethereum | $0.9989 | -10.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.9 bps） | - |
| 2026-09-24 02:00Z | USDe@Solana | $1.0030 | 29.6 | - | - | resolved | 持续 2.0h 后解除（峰值 65.9 bps） | 0.9997 |
| 2026-09-24 05:00Z | USDe@Solana | $1.0102 | 102.4 | 75.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9997 |
| 2026-09-24 08:00Z | USDe@Solana | $0.9999 | -0.7 | - | - | resolved | 持续 3.0h 后解除（峰值 102.4 bps） | 0.9998 |
| 2026-09-24 09:00Z | USDD@Ethereum | $0.9977 | -23.4 | - | - | resolved | 持续 10.0h 后解除（峰值 59.3 bps） | - |
| 2026-09-24 09:00Z | USDe@Solana | $0.9869 | -130.5 | -91.8 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-24 10:00Z | USDe@Solana | $0.9973 | -27.3 | - | - | resolved | 持续 1.0h 后解除（峰值 130.5 bps） | 1 |
| 2026-09-24 11:00Z | USDe@Solana | $0.9944 | -56.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-24 12:00Z | USDe@Solana | $0.9985 | -14.9 | - | - | resolved | 持续 1.0h 后解除（峰值 56.2 bps） | 1.0001 |
| 2026-09-24 13:00Z | USDC@Base | $0.9948 | -52.3 | -34.4 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-24 13:00Z | USDe@Solana | $1.0162 | 162.2 | 115.7 | confirmed | new-severe | 首次触发即严重（双源确认） | 1.0003 |
| 2026-09-24 14:00Z | PYUSD@Ethereum | $0.9940 | -59.5 | -30.4 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-24 15:00Z | PYUSD@Ethereum | $1.0026 | 26.1 | - | - | resolved | 持续 1.0h 后解除（峰值 59.5 bps） | - |
| 2026-09-24 16:00Z | RLUSD@Ethereum | $1.0158 | 158.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0005 |
| 2026-09-24 16:00Z | USDC@Base | $0.9993 | -7.2 | - | - | resolved | 持续 3.0h 后解除（峰值 52.3 bps） | 1.0003 |
| 2026-09-24 18:00Z | USDe@Solana | $0.9980 | -20.2 | - | - | resolved | 持续 5.0h 后解除（峰值 162.2 bps） | 1.0001 |
| 2026-09-24 20:00Z | USDe@Solana | $0.9941 | -59.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0001 |
| 2026-09-24 21:00Z | RLUSD@Ethereum | $1.0015 | 14.7 | - | - | resolved | 持续 5.0h 后解除（峰值 186.9 bps） | 1.0004 |
| 2026-09-24 21:00Z | USDe@Solana | $0.9988 | -12.4 | - | - | resolved | 持续 1.0h 后解除（峰值 59.4 bps） | 1.0002 |
| 2026-09-24 22:00Z | USDe@Solana | $0.9939 | -61.2 | -62 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-24 23:00Z | USDe@Solana | $0.9988 | -12.2 | - | - | resolved | 持续 1.0h 后解除（峰值 61.2 bps） | 1.0002 |
| 2026-09-25 03:00Z | USDe@Solana | $0.9921 | -78.9 | -104.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-25 07:00Z | USDe@Solana | $0.9848 | -152.3 | -139.8 | confirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-25 08:00Z | USDe@Solana | $0.9979 | -20.9 | - | - | resolved | 持续 5.0h 后解除（峰值 152.3 bps） | 1.0002 |
| 2026-09-25 09:00Z | PYUSD@Ethereum | $1.0089 | 88.7 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-25 10:00Z | PYUSD@Ethereum | $0.9992 | -8 | - | - | resolved | 持续 1.0h 后解除（峰值 88.7 bps） | - |
| 2026-09-25 11:00Z | USDe@Solana | $1.0150 | 150.4 | 183.6 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-09-25 14:00Z | USDe@Solana | $1.0014 | 14.1 | - | - | resolved | 持续 3.0h 后解除（峰值 150.4 bps） | 1.0001 |
| 2026-09-25 16:00Z | USDS@Ethereum | $0.9947 | -53 | -51.4 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9999 |
| 2026-09-25 16:00Z | USDT@Ethereum | $0.9947 | -53 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-25 16:00Z | USDe@Solana | $1.0163 | 162.6 | 129.4 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-09-25 20:00Z | USDS@Ethereum | $1.0000 | -0.2 | - | - | resolved | 持续 4.0h 后解除（峰值 53.0 bps） | 0.9999 |
| 2026-09-25 20:00Z | USDT@Ethereum | $1.0000 | -0.2 | - | - | resolved | 持续 4.0h 后解除（峰值 53.0 bps） | - |
| 2026-09-26 03:00Z | U@BSC | $0.9949 | -51 | -25.6 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-26 05:00Z | U@BSC | $1.0000 | -0.4 | - | - | resolved | 持续 2.0h 后解除（峰值 51.0 bps） | - |
| 2026-09-26 05:00Z | USDe@Solana | $0.9993 | -7.1 | - | - | resolved | 持续 13.0h 后解除（峰值 226.2 bps） | 1.0001 |
| 2026-09-26 09:00Z | USDe@Solana | $0.9899 | -100.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-26 16:00Z | USDe@Solana | $1.0022 | 21.6 | - | - | resolved | 持续 7.0h 后解除（峰值 103.0 bps） | 1 |
| 2026-09-26 20:00Z | U@BSC | $0.9950 | -50.4 | -34.5 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-26 20:00Z | USDe@Solana | $0.9904 | -95.8 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1 |
| 2026-09-26 21:00Z | USDe@Solana | $0.9993 | -6.9 | - | - | resolved | 持续 1.0h 后解除（峰值 95.8 bps） | 0.9999 |
| 2026-09-26 22:00Z | U@BSC | $0.9990 | -9.8 | - | - | resolved | 持续 2.0h 后解除（峰值 50.4 bps） | - |
| 2026-09-26 23:00Z | USD1@Ethereum | $1.0054 | 54 | 53.9 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9998 |
| 2026-09-26 23:00Z | USDT@Ethereum | $1.0056 | 56 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-27 00:00Z | USD1@Ethereum | $0.9976 | -24.5 | - | - | resolved | 持续 1.0h 后解除（峰值 54.0 bps） | 0.9998 |
| 2026-09-27 01:00Z | USDT@Ethereum | $0.9989 | -10.7 | - | - | resolved | 持续 2.0h 后解除（峰值 56.0 bps） | - |
| 2026-09-27 03:00Z | USDD@BSC | $0.9947 | -53.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-27 04:00Z | USDC@Base | $0.9946 | -53.8 | -38.1 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-27 05:00Z | USDC@Base | $1.0015 | 14.7 | - | - | resolved | 持续 1.0h 后解除（峰值 53.8 bps） | 1.0002 |
| 2026-09-27 07:00Z | USDD@BSC | $0.9973 | -26.7 | - | - | resolved | 持续 4.0h 后解除（峰值 53.1 bps） | - |
| 2026-09-27 08:00Z | USDe@Solana | $1.0310 | 310.4 | 286.6 | confirmed | new-severe | 首次触发即严重（双源确认） | 1 |
| 2026-09-27 10:00Z | USD1@Ethereum | $0.9950 | -50 | -26 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9998 |
| 2026-09-27 10:00Z | USDS@Ethereum | $0.9947 | -53.4 | -52.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-09-27 10:00Z | USDT@Ethereum | $0.9947 | -53.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-27 10:00Z | USDe@Solana | $0.9992 | -7.6 | - | - | resolved | 持续 2.0h 后解除（峰值 310.4 bps） | 1.0001 |
| 2026-09-27 11:00Z | USDS@Ethereum | $1.0016 | 16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.4 bps） | 1 |
| 2026-09-27 11:00Z | USDT@Ethereum | $1.0016 | 16.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.4 bps） | - |
| 2026-09-27 12:00Z | USD1@Ethereum | $0.9975 | -25 | - | - | resolved | 持续 2.0h 后解除（峰值 50.0 bps） | 0.9997 |
| 2026-09-27 13:00Z | USDD@BSC | $0.9950 | -50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-27 13:00Z | USDe@Solana | $0.9895 | -105.3 | -73.7 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-09-27 14:00Z | USDe@Solana | $0.9798 | -202 | -193.1 | confirmed | escalated | 预警升级为严重 | 1.0001 |
| 2026-09-28 01:00Z | RLUSD@Ethereum | $0.9942 | -58 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0002 |
| 2026-09-28 03:00Z | USDe@Solana | $0.9995 | -4.9 | - | - | resolved | 持续 14.0h 后解除（峰值 202.0 bps） | 1 |
| 2026-09-28 05:00Z | USDe@Solana | $0.9856 | -144.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-09-28 07:00Z | RLUSD@Ethereum | $1.0002 | 1.6 | - | - | resolved | 持续 6.0h 后解除（峰值 104.2 bps） | 1.0005 |
| 2026-09-28 07:00Z | USDS@Solana | $1.0050 | 50.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-09-28 08:00Z | USDS@Solana | $0.9975 | -25.3 | - | - | resolved | 持续 1.0h 后解除（峰值 50.4 bps） | 0.9999 |
| 2026-09-28 10:00Z | USDD@BSC | $0.9985 | -15.3 | - | - | resolved | 持续 21.0h 后解除（峰值 50.4 bps） | - |
| 2026-09-28 10:00Z | USDe@Solana | $1.0004 | 3.6 | - | - | resolved | 持续 5.0h 后解除（峰值 144.3 bps） | 1.0002 |
| 2026-09-28 12:00Z | USDe@Solana | $1.0138 | 137.9 | 167.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-28 13:00Z | USDD@BSC | $0.9944 | -55.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-28 13:00Z | USDe@Solana | $1.0194 | 194.3 | 124.7 | confirmed | escalated | 预警升级为严重 | 1.0003 |
| 2026-09-28 16:00Z | USDD@BSC | $1.0006 | 5.9 | - | - | resolved | 持续 3.0h 后解除（峰值 55.6 bps） | - |
| 2026-09-28 16:00Z | USDe@Solana | $1.0007 | 7.1 | - | - | resolved | 持续 4.0h 后解除（峰值 194.3 bps） | 1.0003 |
| 2026-09-28 17:00Z | USDT@Ethereum | $0.9945 | -55.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-28 19:00Z | USDT@Ethereum | $0.9977 | -23.1 | - | - | resolved | 持续 2.0h 后解除（峰值 55.4 bps） | - |
| 2026-09-28 19:00Z | USDe@Solana | $0.9948 | -51.9 | -94.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-28 21:00Z | U@BSC | $0.9950 | -50.2 | -48.1 | likely | new-warn | 首次触发预警（双源大概率真） | - |
| 2026-09-28 23:00Z | U@BSC | $0.9992 | -8.2 | - | - | resolved | 持续 2.0h 后解除（峰值 50.2 bps） | - |
| 2026-09-29 02:00Z | USDe@Solana | $1.0003 | 3.4 | - | - | resolved | 持续 7.0h 后解除（峰值 97.2 bps） | 1.0003 |
| 2026-09-29 03:00Z | USDe@Solana | $1.0088 | 87.6 | 100.9 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-29 04:00Z | USDe@Solana | $1.0004 | 4.3 | - | - | resolved | 持续 1.0h 后解除（峰值 87.6 bps） | 1.0002 |
| 2026-09-29 08:00Z | U@BSC | $0.9948 | -51.7 | -50.9 | confirmed | new-warn | 首次触发预警（双源确认） | - |
| 2026-09-29 10:00Z | U@BSC | $1.0009 | 8.7 | - | - | resolved | 持续 2.0h 后解除（峰值 51.7 bps） | - |
| 2026-09-29 11:00Z | PYUSD@Ethereum | $1.0052 | 52.4 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-29 12:00Z | PYUSD@Ethereum | $0.9997 | -3.2 | - | - | resolved | 持续 1.0h 后解除（峰值 52.4 bps） | - |
| 2026-09-29 13:00Z | USDe@Solana | $1.0052 | 52.1 | 41.3 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0002 |
| 2026-09-29 14:00Z | USDS@Ethereum | $1.0055 | 55.1 | 49.6 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9995 |
| 2026-09-29 14:00Z | USDT@Ethereum | $1.0055 | 55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-29 14:00Z | USDe@Solana | $1.0015 | 15.1 | - | - | resolved | 持续 1.0h 后解除（峰值 52.1 bps） | 1.0002 |
| 2026-09-29 15:00Z | USDe@Solana | $0.9823 | -177.4 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0003 |
| 2026-09-29 16:00Z | USDS@Ethereum | $1.0010 | 9.7 | - | - | resolved | 持续 2.0h 后解除（峰值 55.1 bps） | 0.9996 |
| 2026-09-29 16:00Z | USDT@Ethereum | $1.0010 | 9.7 | - | - | resolved | 持续 2.0h 后解除（峰值 55.1 bps） | - |
| 2026-09-29 18:00Z | RLUSD@Ethereum | $0.9820 | -180.1 | - | unconfirmed | new-severe | 首次触发即严重（单源，无第二池） | 1.0005 |
| 2026-09-29 20:00Z | USDe@Solana | $1.0020 | 20.1 | - | - | resolved | 持续 5.0h 后解除（峰值 185.2 bps） | 1.0003 |
| 2026-09-29 21:00Z | USDS@Ethereum | $0.9940 | -59.9 | -57.2 | confirmed | new-warn | 首次触发预警（双源确认） | 0.9995 |
| 2026-09-29 21:00Z | USDT@Ethereum | $0.9940 | -59.9 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-09-29 22:00Z | RLUSD@Ethereum | $0.9997 | -3.4 | - | - | resolved | 持续 4.0h 后解除（峰值 180.1 bps） | 1.0005 |
| 2026-09-29 22:00Z | USDS@Ethereum | $1.0028 | 27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 59.9 bps） | 0.9995 |
| 2026-09-29 22:00Z | USDT@Ethereum | $1.0028 | 27.5 | - | - | resolved | 持续 1.0h 后解除（峰值 59.9 bps） | - |
| 2026-09-30 06:00Z | USDe@Solana | $0.9932 | -68.2 | -56.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-09-30 12:00Z | USDe@Solana | $1.0283 | 283.2 | 289.3 | confirmed | escalated | 预警升级为严重 | 1.0003 |
| 2026-09-30 14:00Z | USDe@Solana | $0.9984 | -16.3 | - | - | resolved | 持续 8.0h 后解除（峰值 283.2 bps） | 1.0002 |
| 2026-09-30 16:00Z | USDe@Solana | $1.0109 | 109.3 | 120.6 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-30 18:00Z | RLUSD@Ethereum | $0.9887 | -113.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0005 |
| 2026-09-30 18:00Z | USDe@Solana | $0.9980 | -20.4 | - | - | resolved | 持续 2.0h 后解除（峰值 109.3 bps） | 1.0003 |
| 2026-09-30 19:00Z | USDS@Solana | $1.0051 | 50.8 | 34.4 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-09-30 19:00Z | USDe@Solana | $0.9889 | -110.6 | -85.2 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0003 |
| 2026-09-30 20:00Z | RLUSD@Ethereum | $1.0027 | 27.1 | - | - | resolved | 持续 2.0h 后解除（峰值 113.3 bps） | 1.0007 |
| 2026-09-30 20:00Z | USDS@Solana | $1.0025 | 25.2 | - | - | resolved | 持续 1.0h 后解除（峰值 50.8 bps） | 0.9999 |
| 2026-09-30 21:00Z | USDe@Solana | $0.9994 | -5.7 | - | - | resolved | 持续 2.0h 后解除（峰值 110.6 bps） | 1.0002 |
| 2026-10-01 04:00Z | USDe@Solana | $1.0059 | 59.5 | 28.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-10-01 08:00Z | USDC@Base | $1.0054 | 54.4 | 33.2 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0005 |
| 2026-10-01 08:00Z | USDe@Solana | $1.0011 | 11 | - | - | resolved | 持续 4.0h 后解除（峰值 147.1 bps） | 1.0003 |
| 2026-10-01 09:00Z | PYUSD@Ethereum | $1.0061 | 61 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-10-01 09:00Z | USDC@Base | $0.9988 | -12.4 | - | - | resolved | 持续 1.0h 后解除（峰值 54.4 bps） | 1.0005 |
| 2026-10-01 09:00Z | USDe@Solana | $1.0056 | 55.7 | 36.5 | likely | new-warn | 首次触发预警（双源大概率真） | 1.0003 |
| 2026-10-01 11:00Z | PYUSD@Ethereum | $1.0006 | 5.8 | - | - | resolved | 持续 2.0h 后解除（峰值 61.0 bps） | - |
| 2026-10-01 11:00Z | USDe@Solana | $1.0028 | 27.7 | - | - | resolved | 持续 2.0h 后解除（峰值 55.7 bps） | 1.0004 |
| 2026-10-01 18:00Z | USDS@Ethereum | $0.9947 | -53.3 | -51.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0002 |
| 2026-10-01 18:00Z | USDT@Ethereum | $0.9947 | -53.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-10-01 18:00Z | USDe@Solana | $1.0142 | 141.6 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0003 |
| 2026-10-01 19:00Z | USDS@Ethereum | $1.0019 | 19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.3 bps） | 1.0001 |
| 2026-10-01 19:00Z | USDT@Ethereum | $1.0019 | 19.2 | - | - | resolved | 持续 1.0h 后解除（峰值 53.3 bps） | - |
| 2026-10-01 19:00Z | USDe@Solana | $0.9989 | -11.1 | - | - | resolved | 持续 1.0h 后解除（峰值 141.6 bps） | 1.0004 |
| 2026-10-01 21:00Z | USDe@Solana | $0.9933 | -67.2 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 0.9999 |
| 2026-10-01 23:00Z | USDS@Ethereum | $1.0055 | 55.1 | 58.5 | confirmed | new-warn | 首次触发预警（双源确认） | 1.0001 |
| 2026-10-01 23:00Z | USDT@Ethereum | $1.0055 | 55.1 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | - |
| 2026-10-02 00:00Z | USDS@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | 1.0001 |
| 2026-10-02 00:00Z | USDT@Ethereum | $0.9989 | -10.8 | - | - | resolved | 持续 1.0h 后解除（峰值 55.1 bps） | - |
| 2026-10-02 03:00Z | USDe@Solana | $1.0025 | 24.7 | - | - | resolved | 持续 6.0h 后解除（峰值 67.2 bps） | 1.0001 |
| 2026-10-02 07:00Z | USDe@Solana | $0.9910 | -89.5 | -110.1 | confirmed | new-warn | 首次触发预警（双源确认） | 1 |
| 2026-10-02 08:00Z | RLUSD@Ethereum | $1.0128 | 128.3 | - | unconfirmed | new-warn | 首次触发预警（单源，无第二池） | 1.0004 |
| 2026-10-02 08:00Z | USDe@Solana | $0.9998 | -2.5 | - | - | resolved | 持续 1.0h 后解除（峰值 89.5 bps） | 1 |
| 2026-10-02 10:00Z | RLUSD@Ethereum | $0.9991 | -9 | - | - | resolved | 持续 2.0h 后解除（峰值 128.3 bps） | 1.0003 |
| 2026-10-02 14:00Z | USDe@Solana | $0.9895 | -105 | -26.2 | likely | new-warn | 首次触发预警（双源大概率真） | 0.9999 |
| 2026-10-02 15:00Z | USDe@Solana | $0.9840 | -160.3 | -128.7 | confirmed | escalated | 预警升级为严重 | 0.9999 |
| 2026-10-02 22:00Z | USDe@Solana | $0.9696 | -304 | - | - | open-at-end | 截至期末仍未解除（峰值 323.0 bps） | 0.9998 |

### 被拦截的疑似坏点

| 时间(UTC) | 链腿 | 主池偏离(bps) | 副池偏离(bps) | 说明 |
|---|---|---|---|---|
| 2026-04-03 05:00Z | PYUSD@Ethereum | 53.2 | -95.3 | 主池 53.2bps 但副池 -95.3bps → 疑似坏点，已拦截 |
| 2026-04-03 10:00Z | USDC@Base | -51.6 | 31.6 | 主池 -51.6bps 但副池 31.6bps → 疑似坏点，已拦截 |
| 2026-04-04 19:00Z | USDC@Base | -56.8 | 2.3 | 主池 -56.8bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-04-04 19:00Z | PYUSD@Ethereum | 61.3 | -72.7 | 主池 61.3bps 但副池 -72.7bps → 疑似坏点，已拦截 |
| 2026-04-05 14:00Z | PYUSD@Ethereum | 70.1 | -93.3 | 主池 70.1bps 但副池 -93.3bps → 疑似坏点，已拦截 |
| 2026-04-05 23:00Z | USDC@Base | -50.7 | 21.7 | 主池 -50.7bps 但副池 21.7bps → 疑似坏点，已拦截 |
| 2026-04-06 12:00Z | USDG@Solana | -113.4 | 18.9 | 主池 -113.4bps 但副池 18.9bps → 疑似坏点，已拦截 |
| 2026-04-07 05:00Z | USDC@Base | -57.6 | 1.5 | 主池 -57.6bps 但副池 1.5bps → 疑似坏点，已拦截 |
| 2026-04-07 09:00Z | PYUSD@Ethereum | 53.7 | -56.7 | 主池 53.7bps 但副池 -56.7bps → 疑似坏点，已拦截 |
| 2026-04-07 16:00Z | PYUSD@Ethereum | 56.9 | -73 | 主池 56.9bps 但副池 -73.0bps → 疑似坏点，已拦截 |
| 2026-04-07 22:00Z | USDC@Ethereum | -84.2 | -4.8 | 主池 -84.2bps 但副池 -4.8bps → 疑似坏点，已拦截 |
| 2026-04-08 09:00Z | USDC@Base | -53.5 | 14.8 | 主池 -53.5bps 但副池 14.8bps → 疑似坏点，已拦截 |
| 2026-04-08 13:00Z | USDG@Solana | 694.6 | 2.3 | 主池 694.6bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-04-08 17:00Z | USDG@Solana | -119.2 | -5.9 | 主池 -119.2bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-04-09 01:00Z | USDG@Solana | 182 | -20.8 | 主池 182.0bps 但副池 -20.8bps → 疑似坏点，已拦截 |
| 2026-04-09 06:00Z | USDC@Base | -50.9 | -19.8 | 主池 -50.9bps 但副池 -19.8bps → 疑似坏点，已拦截 |
| 2026-04-09 09:00Z | USDC@Base | 50.7 | -8.4 | 主池 50.7bps 但副池 -8.4bps → 疑似坏点，已拦截 |
| 2026-04-09 12:00Z | USDG@Solana | 405.9 | -18 | 主池 405.9bps 但副池 -18.0bps → 疑似坏点，已拦截 |
| 2026-04-10 00:00Z | USDG@Solana | 51.6 | -5.9 | 主池 51.6bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-04-10 01:00Z | PYUSD@Ethereum | 64 | -22.8 | 主池 64.0bps 但副池 -22.8bps → 疑似坏点，已拦截 |
| 2026-04-10 07:00Z | USDS@Ethereum | -51.5 | 28.9 | 主池 -51.5bps 但副池 28.9bps → 疑似坏点，已拦截 |
| 2026-04-10 08:00Z | USDG@Solana | -220.6 | -2 | 主池 -220.6bps 但副池 -2.0bps → 疑似坏点，已拦截 |
| 2026-04-10 14:00Z | PYUSD@Ethereum | 151 | -106.8 | 主池 151.0bps 但副池 -106.8bps → 疑似坏点，已拦截 |
| 2026-04-11 02:00Z | USDG@Solana | 193.7 | -3.8 | 主池 193.7bps 但副池 -3.8bps → 疑似坏点，已拦截 |
| 2026-04-11 06:00Z | USDG@Solana | -237.7 | -7.3 | 主池 -237.7bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-04-11 14:00Z | USDG@Solana | 165.5 | -20.1 | 主池 165.5bps 但副池 -20.1bps → 疑似坏点，已拦截 |
| 2026-04-11 16:00Z | USDC@Base | -77.7 | -18.8 | 主池 -77.7bps 但副池 -18.8bps → 疑似坏点，已拦截 |
| 2026-04-12 09:00Z | USDG@Solana | 219.3 | 17.3 | 主池 219.3bps 但副池 17.3bps → 疑似坏点，已拦截 |
| 2026-04-12 12:00Z | USDC@Base | 53.4 | -34.2 | 主池 53.4bps 但副池 -34.2bps → 疑似坏点，已拦截 |
| 2026-04-12 17:00Z | USDS@Ethereum | 54.5 | 1.1 | 主池 54.5bps 但副池 1.1bps → 疑似坏点，已拦截 |
| 2026-04-12 20:00Z | PYUSD@Ethereum | 66.1 | -101.7 | 主池 66.1bps 但副池 -101.7bps → 疑似坏点，已拦截 |
| 2026-04-13 02:00Z | USDS@Ethereum | -55.1 | 36.5 | 主池 -55.1bps 但副池 36.5bps → 疑似坏点，已拦截 |
| 2026-04-13 13:00Z | PYUSD@Ethereum | 84.8 | -99.3 | 主池 84.8bps 但副池 -99.3bps → 疑似坏点，已拦截 |
| 2026-04-13 14:00Z | PYUSD@Ethereum | 53.4 | -89.7 | 主池 53.4bps 但副池 -89.7bps → 疑似坏点，已拦截 |
| 2026-04-13 16:00Z | PYUSD@Ethereum | 77.9 | -66.9 | 主池 77.9bps 但副池 -66.9bps → 疑似坏点，已拦截 |
| 2026-04-13 18:00Z | USDC@Base | 53.2 | -13.7 | 主池 53.2bps 但副池 -13.7bps → 疑似坏点，已拦截 |
| 2026-04-13 22:00Z | PYUSD@Ethereum | 179 | 5.5 | 主池 179.0bps 但副池 5.5bps → 疑似坏点，已拦截 |
| 2026-04-13 23:00Z | USDC@Base | -53.5 | 26.9 | 主池 -53.5bps 但副池 26.9bps → 疑似坏点，已拦截 |
| 2026-04-13 23:00Z | PYUSD@Ethereum | 113.1 | 19.8 | 主池 113.1bps 但副池 19.8bps → 疑似坏点，已拦截 |
| 2026-04-14 15:00Z | USDS@Ethereum | -55.8 | 3.6 | 主池 -55.8bps 但副池 3.6bps → 疑似坏点，已拦截 |
| 2026-04-15 02:00Z | PYUSD@Ethereum | -64.1 | 16.6 | 主池 -64.1bps 但副池 16.6bps → 疑似坏点，已拦截 |
| 2026-04-15 09:00Z | USD1@Ethereum | -90.4 | 22.5 | 主池 -90.4bps 但副池 22.5bps → 疑似坏点，已拦截 |
| 2026-04-15 11:00Z | USDG@Solana | 65.8 | -9.2 | 主池 65.8bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-04-15 14:00Z | USDG@Solana | -296.8 | -2.6 | 主池 -296.8bps 但副池 -2.6bps → 疑似坏点，已拦截 |
| 2026-04-15 21:00Z | USDG@Solana | 350.2 | -8 | 主池 350.2bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-04-16 06:00Z | USDT@BSC | 52.2 | 4.3 | 主池 52.2bps 但副池 4.3bps → 疑似坏点，已拦截 |
| 2026-04-16 06:00Z | USDG@Solana | -470.2 | -22.8 | 主池 -470.2bps 但副池 -22.8bps → 疑似坏点，已拦截 |
| 2026-04-16 14:00Z | PYUSD@Ethereum | 62.5 | -74.4 | 主池 62.5bps 但副池 -74.4bps → 疑似坏点，已拦截 |
| 2026-04-16 15:00Z | PYUSD@Ethereum | 191.6 | 6.1 | 主池 191.6bps 但副池 6.1bps → 疑似坏点，已拦截 |
| 2026-04-16 19:00Z | PYUSD@Ethereum | 75.5 | -22.3 | 主池 75.5bps 但副池 -22.3bps → 疑似坏点，已拦截 |
| 2026-04-17 04:00Z | USDG@Solana | 236.6 | 5.5 | 主池 236.6bps 但副池 5.5bps → 疑似坏点，已拦截 |
| 2026-04-17 10:00Z | USDS@Solana | 55.6 | -15.8 | 主池 55.6bps 但副池 -15.8bps → 疑似坏点，已拦截 |
| 2026-04-17 14:00Z | USDS@Solana | 54.7 | -5.1 | 主池 54.7bps 但副池 -5.1bps → 疑似坏点，已拦截 |
| 2026-04-17 16:00Z | USD1@Ethereum | -81.5 | 30.4 | 主池 -81.5bps 但副池 30.4bps → 疑似坏点，已拦截 |
| 2026-04-18 14:00Z | USDC@Base | 51 | 24.2 | 主池 51.0bps 但副池 24.2bps → 疑似坏点，已拦截 |
| 2026-04-18 20:00Z | USDG@Solana | 132.7 | 23 | 主池 132.7bps 但副池 23.0bps → 疑似坏点，已拦截 |
| 2026-04-19 07:00Z | USDC@Base | 50.6 | -11.7 | 主池 50.6bps 但副池 -11.7bps → 疑似坏点，已拦截 |
| 2026-04-19 21:00Z | USDC@Base | 52.5 | -8 | 主池 52.5bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-04-20 08:00Z | USDC@Base | -54 | 11.3 | 主池 -54.0bps 但副池 11.3bps → 疑似坏点，已拦截 |
| 2026-04-20 10:00Z | USDC@Base | -51.7 | 8.7 | 主池 -51.7bps 但副池 8.7bps → 疑似坏点，已拦截 |
| 2026-04-21 00:00Z | USDT@BSC | 51.2 | 2.4 | 主池 51.2bps 但副池 2.4bps → 疑似坏点，已拦截 |
| 2026-04-21 00:00Z | USDG@Solana | 66.7 | 7.4 | 主池 66.7bps 但副池 7.4bps → 疑似坏点，已拦截 |
| 2026-04-21 15:00Z | USDC@Base | -53.1 | 45.3 | 主池 -53.1bps 但副池 45.3bps → 疑似坏点，已拦截 |
| 2026-04-22 02:00Z | PYUSD@Ethereum | 70.4 | -65.6 | 主池 70.4bps 但副池 -65.6bps → 疑似坏点，已拦截 |
| 2026-04-22 04:00Z | USD1@Ethereum | -93.3 | 29.9 | 主池 -93.3bps 但副池 29.9bps → 疑似坏点，已拦截 |
| 2026-04-22 05:00Z | PYUSD@Ethereum | 51.6 | -94.2 | 主池 51.6bps 但副池 -94.2bps → 疑似坏点，已拦截 |
| 2026-04-22 11:00Z | USDS@Ethereum | 52.6 | -23.3 | 主池 52.6bps 但副池 -23.3bps → 疑似坏点，已拦截 |
| 2026-04-22 13:00Z | USDS@Solana | -51.1 | -15.9 | 主池 -51.1bps 但副池 -15.9bps → 疑似坏点，已拦截 |
| 2026-04-23 01:00Z | PYUSD@Ethereum | -58 | -24.9 | 主池 -58.0bps 但副池 -24.9bps → 疑似坏点，已拦截 |
| 2026-04-23 11:00Z | USDG@Solana | -199.2 | -11.2 | 主池 -199.2bps 但副池 -11.2bps → 疑似坏点，已拦截 |
| 2026-04-23 13:00Z | USDG@Solana | 65.5 | 0.3 | 主池 65.5bps 但副池 0.3bps → 疑似坏点，已拦截 |
| 2026-04-23 14:00Z | USDG@Solana | -107.8 | -7.2 | 主池 -107.8bps 但副池 -7.2bps → 疑似坏点，已拦截 |
| 2026-04-24 02:00Z | USDG@Solana | 137.9 | 9.8 | 主池 137.9bps 但副池 9.8bps → 疑似坏点，已拦截 |
| 2026-04-24 04:00Z | USD1@Ethereum | -59.8 | 28.2 | 主池 -59.8bps 但副池 28.2bps → 疑似坏点，已拦截 |
| 2026-04-24 05:00Z | USDG@Solana | 208 | -7.1 | 主池 208.0bps 但副池 -7.1bps → 疑似坏点，已拦截 |
| 2026-04-24 12:00Z | PYUSD@Ethereum | 66.9 | -39.1 | 主池 66.9bps 但副池 -39.1bps → 疑似坏点，已拦截 |
| 2026-04-24 14:00Z | USDG@Solana | -240.1 | 3 | 主池 -240.1bps 但副池 3.0bps → 疑似坏点，已拦截 |
| 2026-04-24 19:00Z | USDT@BSC | 55.9 | 9.9 | 主池 55.9bps 但副池 9.9bps → 疑似坏点，已拦截 |
| 2026-04-24 20:00Z | USDT@BSC | 53.6 | 3.9 | 主池 53.6bps 但副池 3.9bps → 疑似坏点，已拦截 |
| 2026-04-25 00:00Z | USDG@Solana | -70.2 | -22.7 | 主池 -70.2bps 但副池 -22.7bps → 疑似坏点，已拦截 |
| 2026-04-25 01:00Z | USDG@Solana | -280.2 | -24.8 | 主池 -280.2bps 但副池 -24.8bps → 疑似坏点，已拦截 |
| 2026-04-25 04:00Z | USDT@BSC | 50.4 | 0.5 | 主池 50.4bps 但副池 0.5bps → 疑似坏点，已拦截 |
| 2026-04-25 12:00Z | USDG@Solana | -101.7 | -6.1 | 主池 -101.7bps 但副池 -6.1bps → 疑似坏点，已拦截 |
| 2026-04-25 13:00Z | USD1@Ethereum | -70.9 | 29.9 | 主池 -70.9bps 但副池 29.9bps → 疑似坏点，已拦截 |
| 2026-04-25 16:00Z | USD1@Ethereum | -82.1 | 29.1 | 主池 -82.1bps 但副池 29.1bps → 疑似坏点，已拦截 |
| 2026-04-26 11:00Z | USDG@Solana | 166.4 | 4.7 | 主池 166.4bps 但副池 4.7bps → 疑似坏点，已拦截 |
| 2026-04-26 13:00Z | USDT@BSC | 50.8 | 1.5 | 主池 50.8bps 但副池 1.5bps → 疑似坏点，已拦截 |
| 2026-04-26 15:00Z | USDG@Solana | -66.3 | -24.9 | 主池 -66.3bps 但副池 -24.9bps → 疑似坏点，已拦截 |
| 2026-04-26 17:00Z | USDT@BSC | 50.1 | 0.8 | 主池 50.1bps 但副池 0.8bps → 疑似坏点，已拦截 |
| 2026-04-26 18:00Z | PYUSD@Ethereum | 70.4 | -76.5 | 主池 70.4bps 但副池 -76.5bps → 疑似坏点，已拦截 |
| 2026-04-27 00:00Z | PYUSD@Ethereum | 81.9 | -84.3 | 主池 81.9bps 但副池 -84.3bps → 疑似坏点，已拦截 |
| 2026-04-27 09:00Z | USDG@Solana | 145.9 | -6 | 主池 145.9bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-04-27 15:00Z | PYUSD@Ethereum | -101.6 | 1.3 | 主池 -101.6bps 但副池 1.3bps → 疑似坏点，已拦截 |
| 2026-04-27 16:00Z | USD1@Ethereum | -122.6 | 32.9 | 主池 -122.6bps 但副池 32.9bps → 疑似坏点，已拦截 |
| 2026-04-28 09:00Z | USDG@Solana | -56.9 | -17.1 | 主池 -56.9bps 但副池 -17.1bps → 疑似坏点，已拦截 |
| 2026-04-28 13:00Z | PYUSD@Ethereum | -63.1 | -7.8 | 主池 -63.1bps 但副池 -7.8bps → 疑似坏点，已拦截 |
| 2026-04-29 08:00Z | USDG@Solana | 178.4 | 10.9 | 主池 178.4bps 但副池 10.9bps → 疑似坏点，已拦截 |
| 2026-04-29 15:00Z | USD1@Ethereum | -94.7 | 28.2 | 主池 -94.7bps 但副池 28.2bps → 疑似坏点，已拦截 |
| 2026-04-29 18:00Z | PYUSD@Ethereum | -188.3 | 9.4 | 主池 -188.3bps 但副池 9.4bps → 疑似坏点，已拦截 |
| 2026-04-29 19:00Z | USD1@Ethereum | -97 | 26 | 主池 -97.0bps 但副池 26.0bps → 疑似坏点，已拦截 |
| 2026-04-29 22:00Z | USD1@Ethereum | 50.1 | -27.9 | 主池 50.1bps 但副池 -27.9bps → 疑似坏点，已拦截 |
| 2026-04-30 00:00Z | USDS@Ethereum | 53.3 | -29.4 | 主池 53.3bps 但副池 -29.4bps → 疑似坏点，已拦截 |
| 2026-04-30 00:00Z | USDS@Solana | -52.9 | 24.2 | 主池 -52.9bps 但副池 24.2bps → 疑似坏点，已拦截 |
| 2026-04-30 01:00Z | USDG@Solana | 626.3 | -1.9 | 主池 626.3bps 但副池 -1.9bps → 疑似坏点，已拦截 |
| 2026-04-30 15:00Z | USD1@Ethereum | -51.7 | 24.1 | 主池 -51.7bps 但副池 24.1bps → 疑似坏点，已拦截 |
| 2026-04-30 23:00Z | USDT@BSC | -51.7 | -2.5 | 主池 -51.7bps 但副池 -2.5bps → 疑似坏点，已拦截 |
| 2026-05-01 03:00Z | PYUSD@Ethereum | 86.2 | -40.6 | 主池 86.2bps 但副池 -40.6bps → 疑似坏点，已拦截 |
| 2026-05-01 05:00Z | USD1@Ethereum | -72.6 | 30.4 | 主池 -72.6bps 但副池 30.4bps → 疑似坏点，已拦截 |
| 2026-05-01 15:00Z | USDC@Ethereum | -77.5 | 4.3 | 主池 -77.5bps 但副池 4.3bps → 疑似坏点，已拦截 |
| 2026-05-01 20:00Z | USDC@Base | 50.8 | 20.5 | 主池 50.8bps 但副池 20.5bps → 疑似坏点，已拦截 |
| 2026-05-01 21:00Z | USDG@Solana | -77.2 | -2.6 | 主池 -77.2bps 但副池 -2.6bps → 疑似坏点，已拦截 |
| 2026-05-02 01:00Z | USDC@Base | 52.9 | -9.5 | 主池 52.9bps 但副池 -9.5bps → 疑似坏点，已拦截 |
| 2026-05-02 01:00Z | USDS@Ethereum | 53.8 | -19.1 | 主池 53.8bps 但副池 -19.1bps → 疑似坏点，已拦截 |
| 2026-05-02 01:00Z | USD1@Ethereum | -69.7 | 33.2 | 主池 -69.7bps 但副池 33.2bps → 疑似坏点，已拦截 |
| 2026-05-02 01:00Z | USDG@Solana | -95.6 | -21.6 | 主池 -95.6bps 但副池 -21.6bps → 疑似坏点，已拦截 |
| 2026-05-02 21:00Z | PYUSD@Ethereum | 100.9 | -74.1 | 主池 100.9bps 但副池 -74.1bps → 疑似坏点，已拦截 |
| 2026-05-02 21:00Z | USDG@Solana | 852.7 | 22.4 | 主池 852.7bps 但副池 22.4bps → 疑似坏点，已拦截 |
| 2026-05-03 01:00Z | USDS@Ethereum | -55.4 | 22.2 | 主池 -55.4bps 但副池 22.2bps → 疑似坏点，已拦截 |
| 2026-05-03 02:00Z | USDG@Solana | 483.9 | 17.8 | 主池 483.9bps 但副池 17.8bps → 疑似坏点，已拦截 |
| 2026-05-03 03:00Z | USDG@Solana | 314.6 | 10.9 | 主池 314.6bps 但副池 10.9bps → 疑似坏点，已拦截 |
| 2026-05-03 04:00Z | USDG@Solana | -53.4 | 7.2 | 主池 -53.4bps 但副池 7.2bps → 疑似坏点，已拦截 |
| 2026-05-03 14:00Z | USDG@Solana | 99.7 | -14.7 | 主池 99.7bps 但副池 -14.7bps → 疑似坏点，已拦截 |
| 2026-05-03 22:00Z | PYUSD@Ethereum | 74.2 | -63.4 | 主池 74.2bps 但副池 -63.4bps → 疑似坏点，已拦截 |
| 2026-05-04 01:00Z | PYUSD@Ethereum | 74.7 | -66.1 | 主池 74.7bps 但副池 -66.1bps → 疑似坏点，已拦截 |
| 2026-05-04 03:00Z | USDC@Base | -50.6 | 4.4 | 主池 -50.6bps 但副池 4.4bps → 疑似坏点，已拦截 |
| 2026-05-04 07:00Z | USDT@BSC | -98.9 | -0.4 | 主池 -98.9bps 但副池 -0.4bps → 疑似坏点，已拦截 |
| 2026-05-04 13:00Z | PYUSD@Ethereum | 60.4 | -71 | 主池 60.4bps 但副池 -71.0bps → 疑似坏点，已拦截 |
| 2026-05-04 13:00Z | USDG@Solana | -141.6 | -16.6 | 主池 -141.6bps 但副池 -16.6bps → 疑似坏点，已拦截 |
| 2026-05-04 14:00Z | PYUSD@Ethereum | 91.5 | -49.4 | 主池 91.5bps 但副池 -49.4bps → 疑似坏点，已拦截 |
| 2026-05-04 16:00Z | USDC@Ethereum | 62.8 | -5.7 | 主池 62.8bps 但副池 -5.7bps → 疑似坏点，已拦截 |
| 2026-05-04 19:00Z | USDS@Ethereum | -54.6 | 29.9 | 主池 -54.6bps 但副池 29.9bps → 疑似坏点，已拦截 |
| 2026-05-04 21:00Z | USDC@Base | 55.2 | -5.9 | 主池 55.2bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-05-04 23:00Z | USDC@Base | -56.4 | 5.4 | 主池 -56.4bps 但副池 5.4bps → 疑似坏点，已拦截 |
| 2026-05-05 07:00Z | USDC@Base | 54.9 | -23 | 主池 54.9bps 但副池 -23.0bps → 疑似坏点，已拦截 |
| 2026-05-05 07:00Z | USDG@Solana | 140 | -9 | 主池 140.0bps 但副池 -9.0bps → 疑似坏点，已拦截 |
| 2026-05-05 12:00Z | USDS@Ethereum | 53.5 | -30.4 | 主池 53.5bps 但副池 -30.4bps → 疑似坏点，已拦截 |
| 2026-05-05 18:00Z | USDS@Ethereum | 51.2 | -35 | 主池 51.2bps 但副池 -35.0bps → 疑似坏点，已拦截 |
| 2026-05-06 02:00Z | USDC@Base | -50.8 | 23 | 主池 -50.8bps 但副池 23.0bps → 疑似坏点，已拦截 |
| 2026-05-06 06:00Z | USDG@Solana | 103.8 | -25 | 主池 103.8bps 但副池 -25.0bps → 疑似坏点，已拦截 |
| 2026-05-06 13:00Z | USDC@Base | -52.9 | 12.2 | 主池 -52.9bps 但副池 12.2bps → 疑似坏点，已拦截 |
| 2026-05-06 13:00Z | USD1@Ethereum | -61.8 | 26.8 | 主池 -61.8bps 但副池 26.8bps → 疑似坏点，已拦截 |
| 2026-05-06 13:00Z | USDG@Solana | -223.8 | -15.9 | 主池 -223.8bps 但副池 -15.9bps → 疑似坏点，已拦截 |
| 2026-05-06 23:00Z | USDC@Base | 51 | -5 | 主池 51.0bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-05-07 07:00Z | PYUSD@Ethereum | 84.6 | -107 | 主池 84.6bps 但副池 -107.0bps → 疑似坏点，已拦截 |
| 2026-05-07 16:00Z | USDe@Solana | -76.4 | -19.7 | 主池 -76.4bps 但副池 -19.7bps → 疑似坏点，已拦截 |
| 2026-05-08 02:00Z | USDT@Solana | 50.5 | -5.9 | 主池 50.5bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-05-08 11:00Z | USDC@Base | 54.7 | -8 | 主池 54.7bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-05-08 11:00Z | USDS@Ethereum | 50.4 | -30.5 | 主池 50.4bps 但副池 -30.5bps → 疑似坏点，已拦截 |
| 2026-05-08 12:00Z | USDC@Base | -56 | 15.8 | 主池 -56.0bps 但副池 15.8bps → 疑似坏点，已拦截 |
| 2026-05-08 17:00Z | USDS@Ethereum | -52.5 | 27.8 | 主池 -52.5bps 但副池 27.8bps → 疑似坏点，已拦截 |
| 2026-05-08 17:00Z | PYUSD@Ethereum | 52.4 | -116 | 主池 52.4bps 但副池 -116.0bps → 疑似坏点，已拦截 |
| 2026-05-08 18:00Z | USDG@Solana | 743.8 | 8.4 | 主池 743.8bps 但副池 8.4bps → 疑似坏点，已拦截 |
| 2026-05-08 21:00Z | USDe@Solana | -55.4 | -18.9 | 主池 -55.4bps 但副池 -18.9bps → 疑似坏点，已拦截 |
| 2026-05-09 00:00Z | USDG@Solana | 345.8 | -0.1 | 主池 345.8bps 但副池 -0.1bps → 疑似坏点，已拦截 |
| 2026-05-09 01:00Z | USDS@Ethereum | 51.8 | -31.1 | 主池 51.8bps 但副池 -31.1bps → 疑似坏点，已拦截 |
| 2026-05-09 15:00Z | USDS@Ethereum | 54.2 | -30.9 | 主池 54.2bps 但副池 -30.9bps → 疑似坏点，已拦截 |
| 2026-05-09 18:00Z | PYUSD@Ethereum | 59.9 | -50.4 | 主池 59.9bps 但副池 -50.4bps → 疑似坏点，已拦截 |
| 2026-05-10 00:00Z | USDS@Ethereum | -54.9 | 34 | 主池 -54.9bps 但副池 34.0bps → 疑似坏点，已拦截 |
| 2026-05-10 10:00Z | USDG@Solana | -69.7 | -11.1 | 主池 -69.7bps 但副池 -11.1bps → 疑似坏点，已拦截 |
| 2026-05-10 23:00Z | USDS@Ethereum | -51.6 | -10.8 | 主池 -51.6bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-05-11 00:00Z | USDG@Solana | -70.8 | -15.9 | 主池 -70.8bps 但副池 -15.9bps → 疑似坏点，已拦截 |
| 2026-05-11 05:00Z | USDS@Ethereum | -54.6 | 35.1 | 主池 -54.6bps 但副池 35.1bps → 疑似坏点，已拦截 |
| 2026-05-11 16:00Z | USDC@Base | 50.8 | -27.3 | 主池 50.8bps 但副池 -27.3bps → 疑似坏点，已拦截 |
| 2026-05-11 17:00Z | USDe@Solana | -75.9 | 4.5 | 主池 -75.9bps 但副池 4.5bps → 疑似坏点，已拦截 |
| 2026-05-11 19:00Z | USDe@Solana | 53.4 | 12.7 | 主池 53.4bps 但副池 12.7bps → 疑似坏点，已拦截 |
| 2026-05-12 09:00Z | USDC@Base | 54.2 | -17.2 | 主池 54.2bps 但副池 -17.2bps → 疑似坏点，已拦截 |
| 2026-05-12 18:00Z | USDC@Base | 50.8 | -3.9 | 主池 50.8bps 但副池 -3.9bps → 疑似坏点，已拦截 |
| 2026-05-12 23:00Z | USDS@Ethereum | -52.2 | 29.3 | 主池 -52.2bps 但副池 29.3bps → 疑似坏点，已拦截 |
| 2026-05-13 11:00Z | USDG@Solana | 80.5 | -1.9 | 主池 80.5bps 但副池 -1.9bps → 疑似坏点，已拦截 |
| 2026-05-13 20:00Z | USDS@Ethereum | 53.2 | -26.1 | 主池 53.2bps 但副池 -26.1bps → 疑似坏点，已拦截 |
| 2026-05-13 21:00Z | USDT@BSC | -128.6 | -0.8 | 主池 -128.6bps 但副池 -0.8bps → 疑似坏点，已拦截 |
| 2026-05-14 02:00Z | USDT@BSC | -51.9 | -7.3 | 主池 -51.9bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-05-15 07:00Z | USDT@BSC | -50.1 | -2.3 | 主池 -50.1bps 但副池 -2.3bps → 疑似坏点，已拦截 |
| 2026-05-15 15:00Z | USDS@Ethereum | 53.7 | -27.9 | 主池 53.7bps 但副池 -27.9bps → 疑似坏点，已拦截 |
| 2026-05-16 16:00Z | USDS@Ethereum | -54.5 | 32.8 | 主池 -54.5bps 但副池 32.8bps → 疑似坏点，已拦截 |
| 2026-05-17 08:00Z | USDT@BSC | -51.9 | -3.7 | 主池 -51.9bps 但副池 -3.7bps → 疑似坏点，已拦截 |
| 2026-05-17 23:00Z | USDG@Solana | -64.8 | -14.8 | 主池 -64.8bps 但副池 -14.8bps → 疑似坏点，已拦截 |
| 2026-05-18 19:00Z | PYUSD@Ethereum | 71.4 | -127.8 | 主池 71.4bps 但副池 -127.8bps → 疑似坏点，已拦截 |
| 2026-05-18 22:00Z | USD1@Ethereum | -88.7 | 31.4 | 主池 -88.7bps 但副池 31.4bps → 疑似坏点，已拦截 |
| 2026-05-18 23:00Z | USDC@Base | -57.9 | 6.7 | 主池 -57.9bps 但副池 6.7bps → 疑似坏点，已拦截 |
| 2026-05-19 02:00Z | USDT@BSC | -55.2 | -8.7 | 主池 -55.2bps 但副池 -8.7bps → 疑似坏点，已拦截 |
| 2026-05-19 14:00Z | USDS@Ethereum | 54.8 | -49.2 | 主池 54.8bps 但副池 -49.2bps → 疑似坏点，已拦截 |
| 2026-05-20 06:00Z | USDS@Ethereum | 55.2 | -29.4 | 主池 55.2bps 但副池 -29.4bps → 疑似坏点，已拦截 |
| 2026-05-20 13:00Z | USDT@BSC | -50.4 | -12.4 | 主池 -50.4bps 但副池 -12.4bps → 疑似坏点，已拦截 |
| 2026-05-20 15:00Z | USDS@Solana | 98.1 | -19.2 | 主池 98.1bps 但副池 -19.2bps → 疑似坏点，已拦截 |
| 2026-05-20 18:00Z | USDC@Base | -52.9 | 5.6 | 主池 -52.9bps 但副池 5.6bps → 疑似坏点，已拦截 |
| 2026-05-20 21:00Z | USDe@Solana | -57.2 | -24.8 | 主池 -57.2bps 但副池 -24.8bps → 疑似坏点，已拦截 |
| 2026-05-20 22:00Z | USDe@Solana | -60.9 | -24.8 | 主池 -60.9bps 但副池 -24.8bps → 疑似坏点，已拦截 |
| 2026-05-21 01:00Z | USDS@Ethereum | -54.2 | 82.2 | 主池 -54.2bps 但副池 82.2bps → 疑似坏点，已拦截 |
| 2026-05-21 05:00Z | USDS@Ethereum | -50 | 13.6 | 主池 -50.0bps 但副池 13.6bps → 疑似坏点，已拦截 |
| 2026-05-21 06:00Z | USD1@Ethereum | -50.6 | -21.5 | 主池 -50.6bps 但副池 -21.5bps → 疑似坏点，已拦截 |
| 2026-05-21 09:00Z | USDS@Ethereum | -54.9 | 34.8 | 主池 -54.9bps 但副池 34.8bps → 疑似坏点，已拦截 |
| 2026-05-21 10:00Z | USDT@BSC | -51.8 | -7.3 | 主池 -51.8bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-05-21 10:00Z | USDe@Solana | -90.6 | -18.2 | 主池 -90.6bps 但副池 -18.2bps → 疑似坏点，已拦截 |
| 2026-05-21 11:00Z | USD1@Ethereum | -102.3 | 35.5 | 主池 -102.3bps 但副池 35.5bps → 疑似坏点，已拦截 |
| 2026-05-21 12:00Z | USD1@Ethereum | -109.4 | 37.2 | 主池 -109.4bps 但副池 37.2bps → 疑似坏点，已拦截 |
| 2026-05-21 14:00Z | PYUSD@Ethereum | 59.1 | -66.4 | 主池 59.1bps 但副池 -66.4bps → 疑似坏点，已拦截 |
| 2026-05-21 15:00Z | PYUSD@Ethereum | 72.3 | -94.8 | 主池 72.3bps 但副池 -94.8bps → 疑似坏点，已拦截 |
| 2026-05-21 16:00Z | USD1@Ethereum | -122.6 | 40.3 | 主池 -122.6bps 但副池 40.3bps → 疑似坏点，已拦截 |
| 2026-05-21 18:00Z | USD1@Ethereum | -59.7 | 36.7 | 主池 -59.7bps 但副池 36.7bps → 疑似坏点，已拦截 |
| 2026-05-22 03:00Z | USD1@Ethereum | -70.1 | 36 | 主池 -70.1bps 但副池 36.0bps → 疑似坏点，已拦截 |
| 2026-05-22 05:00Z | USDT@BSC | -55.8 | -12 | 主池 -55.8bps 但副池 -12.0bps → 疑似坏点，已拦截 |
| 2026-05-22 07:00Z | USD1@Ethereum | -67.5 | -24.1 | 主池 -67.5bps 但副池 -24.1bps → 疑似坏点，已拦截 |
| 2026-05-22 12:00Z | USD1@Ethereum | -71.5 | 37.8 | 主池 -71.5bps 但副池 37.8bps → 疑似坏点，已拦截 |
| 2026-05-22 13:00Z | USD1@Ethereum | -98 | -22.7 | 主池 -98.0bps 但副池 -22.7bps → 疑似坏点，已拦截 |
| 2026-05-22 14:00Z | USD1@Ethereum | -93 | -25 | 主池 -93.0bps 但副池 -25.0bps → 疑似坏点，已拦截 |
| 2026-05-22 19:00Z | USD1@Ethereum | -103.8 | 36.7 | 主池 -103.8bps 但副池 36.7bps → 疑似坏点，已拦截 |
| 2026-05-22 20:00Z | USD1@Ethereum | -122.4 | -25 | 主池 -122.4bps 但副池 -25.0bps → 疑似坏点，已拦截 |
| 2026-05-22 21:00Z | USDS@Ethereum | 54.5 | -23 | 主池 54.5bps 但副池 -23.0bps → 疑似坏点，已拦截 |
| 2026-05-23 01:00Z | USDS@Ethereum | 54.9 | -23.9 | 主池 54.9bps 但副池 -23.9bps → 疑似坏点，已拦截 |
| 2026-05-23 04:00Z | USDT@BSC | -57.4 | -11.9 | 主池 -57.4bps 但副池 -11.9bps → 疑似坏点，已拦截 |
| 2026-05-23 06:00Z | USD1@Ethereum | -122.3 | 34 | 主池 -122.3bps 但副池 34.0bps → 疑似坏点，已拦截 |
| 2026-05-23 07:00Z | USDT@BSC | -50.7 | -7.2 | 主池 -50.7bps 但副池 -7.2bps → 疑似坏点，已拦截 |
| 2026-05-23 07:00Z | USDC@Base | 69.4 | 5.5 | 主池 69.4bps 但副池 5.5bps → 疑似坏点，已拦截 |
| 2026-05-23 09:00Z | USDT@BSC | -50.2 | -2.3 | 主池 -50.2bps 但副池 -2.3bps → 疑似坏点，已拦截 |
| 2026-05-23 10:00Z | USDT@BSC | -53.5 | -12 | 主池 -53.5bps 但副池 -12.0bps → 疑似坏点，已拦截 |
| 2026-05-23 10:00Z | USDS@Ethereum | 50.1 | -29.3 | 主池 50.1bps 但副池 -29.3bps → 疑似坏点，已拦截 |
| 2026-05-23 11:00Z | USDT@BSC | -52.5 | -10.2 | 主池 -52.5bps 但副池 -10.2bps → 疑似坏点，已拦截 |
| 2026-05-23 13:00Z | PYUSD@Ethereum | 73.7 | -117.5 | 主池 73.7bps 但副池 -117.5bps → 疑似坏点，已拦截 |
| 2026-05-23 22:00Z | USDC@Base | 52.3 | -7.5 | 主池 52.3bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-05-24 01:00Z | USDT@BSC | -53 | -16.5 | 主池 -53.0bps 但副池 -16.5bps → 疑似坏点，已拦截 |
| 2026-05-24 04:00Z | USDT@BSC | -51.3 | -10.3 | 主池 -51.3bps 但副池 -10.3bps → 疑似坏点，已拦截 |
| 2026-05-24 04:00Z | USD1@Ethereum | -56.8 | 31.1 | 主池 -56.8bps 但副池 31.1bps → 疑似坏点，已拦截 |
| 2026-05-24 13:00Z | USDT@BSC | -51.6 | -16.5 | 主池 -51.6bps 但副池 -16.5bps → 疑似坏点，已拦截 |
| 2026-05-24 15:00Z | USDT@BSC | -59.3 | -11.4 | 主池 -59.3bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-05-25 00:00Z | USDT@BSC | -51.9 | -15.8 | 主池 -51.9bps 但副池 -15.8bps → 疑似坏点，已拦截 |
| 2026-05-25 01:00Z | USDT@BSC | -52.5 | -2.8 | 主池 -52.5bps 但副池 -2.8bps → 疑似坏点，已拦截 |
| 2026-05-25 03:00Z | USDT@BSC | -51.8 | -9.6 | 主池 -51.8bps 但副池 -9.6bps → 疑似坏点，已拦截 |
| 2026-05-25 08:00Z | USDT@BSC | -53.2 | -12.1 | 主池 -53.2bps 但副池 -12.1bps → 疑似坏点，已拦截 |
| 2026-05-25 09:00Z | USDT@BSC | -55.4 | -8.5 | 主池 -55.4bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-05-25 16:00Z | USDT@BSC | -50.4 | -2.5 | 主池 -50.4bps 但副池 -2.5bps → 疑似坏点，已拦截 |
| 2026-05-25 22:00Z | USDT@BSC | -50 | -1.4 | 主池 -50.0bps 但副池 -1.4bps → 疑似坏点，已拦截 |
| 2026-05-26 05:00Z | USDT@BSC | -52.7 | -14.8 | 主池 -52.7bps 但副池 -14.8bps → 疑似坏点，已拦截 |
| 2026-05-26 06:00Z | USDT@BSC | -56.7 | -9.4 | 主池 -56.7bps 但副池 -9.4bps → 疑似坏点，已拦截 |
| 2026-05-26 06:00Z | USD1@Ethereum | -66.2 | 24.4 | 主池 -66.2bps 但副池 24.4bps → 疑似坏点，已拦截 |
| 2026-05-26 11:00Z | USDC@Base | -57.7 | 8.7 | 主池 -57.7bps 但副池 8.7bps → 疑似坏点，已拦截 |
| 2026-05-26 13:00Z | USDT@BSC | -56.5 | -11.3 | 主池 -56.5bps 但副池 -11.3bps → 疑似坏点，已拦截 |
| 2026-05-26 17:00Z | PYUSD@Ethereum | 61.6 | 13.8 | 主池 61.6bps 但副池 13.8bps → 疑似坏点，已拦截 |
| 2026-05-26 19:00Z | USDC@Base | -51 | -15.9 | 主池 -51.0bps 但副池 -15.9bps → 疑似坏点，已拦截 |
| 2026-05-26 20:00Z | USDS@Ethereum | 54.2 | -21.5 | 主池 54.2bps 但副池 -21.5bps → 疑似坏点，已拦截 |
| 2026-05-26 22:00Z | USDT@BSC | -50.1 | -15.5 | 主池 -50.1bps 但副池 -15.5bps → 疑似坏点，已拦截 |
| 2026-05-26 23:00Z | USDT@BSC | -58 | -8.9 | 主池 -58.0bps 但副池 -8.9bps → 疑似坏点，已拦截 |
| 2026-05-27 05:00Z | USDT@BSC | -54 | -11.4 | 主池 -54.0bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-05-27 05:00Z | USDC@Base | 51.1 | -7.5 | 主池 51.1bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-05-27 09:00Z | USDC@Base | -53.3 | -2.1 | 主池 -53.3bps 但副池 -2.1bps → 疑似坏点，已拦截 |
| 2026-05-27 12:00Z | USDT@BSC | -54.3 | -7.8 | 主池 -54.3bps 但副池 -7.8bps → 疑似坏点，已拦截 |
| 2026-05-27 12:00Z | USDS@Ethereum | -50.6 | 29.7 | 主池 -50.6bps 但副池 29.7bps → 疑似坏点，已拦截 |
| 2026-05-27 19:00Z | USDT@BSC | -58.3 | -16.1 | 主池 -58.3bps 但副池 -16.1bps → 疑似坏点，已拦截 |
| 2026-05-27 20:00Z | USDT@BSC | -53.7 | -14.3 | 主池 -53.7bps 但副池 -14.3bps → 疑似坏点，已拦截 |
| 2026-05-28 00:00Z | USDC@Solana | -50.4 | -11.5 | 主池 -50.4bps 但副池 -11.5bps → 疑似坏点，已拦截 |
| 2026-05-28 06:00Z | USDS@Ethereum | 53.2 | 23.8 | 主池 53.2bps 但副池 23.8bps → 疑似坏点，已拦截 |
| 2026-05-28 06:00Z | PYUSD@Ethereum | 61.1 | -65.1 | 主池 61.1bps 但副池 -65.1bps → 疑似坏点，已拦截 |
| 2026-05-28 10:00Z | USDT@BSC | -52.3 | -10.3 | 主池 -52.3bps 但副池 -10.3bps → 疑似坏点，已拦截 |
| 2026-05-28 10:00Z | PYUSD@Ethereum | 60.8 | -117.3 | 主池 60.8bps 但副池 -117.3bps → 疑似坏点，已拦截 |
| 2026-05-28 11:00Z | USDT@BSC | -63 | -17.2 | 主池 -63.0bps 但副池 -17.2bps → 疑似坏点，已拦截 |
| 2026-05-28 13:00Z | USDT@BSC | -51.4 | -15.2 | 主池 -51.4bps 但副池 -15.2bps → 疑似坏点，已拦截 |
| 2026-05-28 15:00Z | USDT@BSC | -54.2 | -18.8 | 主池 -54.2bps 但副池 -18.8bps → 疑似坏点，已拦截 |
| 2026-05-28 15:00Z | USDG@Solana | -128.7 | 0.8 | 主池 -128.7bps 但副池 0.8bps → 疑似坏点，已拦截 |
| 2026-05-28 17:00Z | PYUSD@Ethereum | 62.3 | -109.2 | 主池 62.3bps 但副池 -109.2bps → 疑似坏点，已拦截 |
| 2026-05-28 19:00Z | USDC@Base | -50.4 | 2.4 | 主池 -50.4bps 但副池 2.4bps → 疑似坏点，已拦截 |
| 2026-05-28 22:00Z | USDT@BSC | -55.5 | -13.3 | 主池 -55.5bps 但副池 -13.3bps → 疑似坏点，已拦截 |
| 2026-05-28 22:00Z | USDS@Ethereum | -53 | 34.1 | 主池 -53.0bps 但副池 34.1bps → 疑似坏点，已拦截 |
| 2026-05-29 00:00Z | USDT@BSC | -53.5 | -12 | 主池 -53.5bps 但副池 -12.0bps → 疑似坏点，已拦截 |
| 2026-05-29 06:00Z | USDT@BSC | -52.6 | -16.1 | 主池 -52.6bps 但副池 -16.1bps → 疑似坏点，已拦截 |
| 2026-05-29 07:00Z | USDT@BSC | -50.8 | -9.1 | 主池 -50.8bps 但副池 -9.1bps → 疑似坏点，已拦截 |
| 2026-05-29 11:00Z | USDT@BSC | -53.4 | -17.7 | 主池 -53.4bps 但副池 -17.7bps → 疑似坏点，已拦截 |
| 2026-05-29 16:00Z | USDT@BSC | -51.4 | -21.8 | 主池 -51.4bps 但副池 -21.8bps → 疑似坏点，已拦截 |
| 2026-05-30 19:00Z | USDT@Solana | -57 | -13.7 | 主池 -57.0bps 但副池 -13.7bps → 疑似坏点，已拦截 |
| 2026-05-30 19:00Z | USDG@Solana | 231.4 | 2.4 | 主池 231.4bps 但副池 2.4bps → 疑似坏点，已拦截 |
| 2026-05-31 08:00Z | USDG@Solana | 72.9 | -22.4 | 主池 72.9bps 但副池 -22.4bps → 疑似坏点，已拦截 |
| 2026-05-31 13:00Z | USDT@BSC | -62.1 | -15.4 | 主池 -62.1bps 但副池 -15.4bps → 疑似坏点，已拦截 |
| 2026-05-31 20:00Z | USDT@BSC | -53.7 | -13.5 | 主池 -53.7bps 但副池 -13.5bps → 疑似坏点，已拦截 |
| 2026-05-31 22:00Z | USDT@BSC | -50.1 | -2.3 | 主池 -50.1bps 但副池 -2.3bps → 疑似坏点，已拦截 |
| 2026-06-01 00:00Z | USDT@BSC | -50.1 | -0.2 | 主池 -50.1bps 但副池 -0.2bps → 疑似坏点，已拦截 |
| 2026-06-01 00:00Z | PYUSD@Ethereum | 69.8 | -93.5 | 主池 69.8bps 但副池 -93.5bps → 疑似坏点，已拦截 |
| 2026-06-01 01:00Z | USDT@BSC | -50.3 | -3.4 | 主池 -50.3bps 但副池 -3.4bps → 疑似坏点，已拦截 |
| 2026-06-01 02:00Z | PYUSD@Ethereum | 76.3 | -79.8 | 主池 76.3bps 但副池 -79.8bps → 疑似坏点，已拦截 |
| 2026-06-01 14:00Z | USDS@Ethereum | -51.2 | -22.6 | 主池 -51.2bps 但副池 -22.6bps → 疑似坏点，已拦截 |
| 2026-06-01 15:00Z | USDG@Solana | 50.8 | 12.1 | 主池 50.8bps 但副池 12.1bps → 疑似坏点，已拦截 |
| 2026-06-01 20:00Z | USDT@BSC | -55.3 | -19 | 主池 -55.3bps 但副池 -19.0bps → 疑似坏点，已拦截 |
| 2026-06-01 21:00Z | USDT@BSC | -51 | -6.9 | 主池 -51.0bps 但副池 -6.9bps → 疑似坏点，已拦截 |
| 2026-06-01 21:00Z | USDC@Base | -50.5 | 4.9 | 主池 -50.5bps 但副池 4.9bps → 疑似坏点，已拦截 |
| 2026-06-01 21:00Z | USDG@Solana | -119.2 | -10.7 | 主池 -119.2bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-06-02 00:00Z | USDT@BSC | -57.4 | -12.7 | 主池 -57.4bps 但副池 -12.7bps → 疑似坏点，已拦截 |
| 2026-06-02 00:00Z | USDG@Solana | -67.2 | -8.3 | 主池 -67.2bps 但副池 -8.3bps → 疑似坏点，已拦截 |
| 2026-06-02 03:00Z | USDT@BSC | -51.5 | -15 | 主池 -51.5bps 但副池 -15.0bps → 疑似坏点，已拦截 |
| 2026-06-02 03:00Z | USDS@Ethereum | 54.3 | -24.3 | 主池 54.3bps 但副池 -24.3bps → 疑似坏点，已拦截 |
| 2026-06-02 04:00Z | USDT@BSC | -51.3 | -12 | 主池 -51.3bps 但副池 -12.0bps → 疑似坏点，已拦截 |
| 2026-06-02 07:00Z | USDT@BSC | -54.8 | -9.2 | 主池 -54.8bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-06-02 08:00Z | USDS@Ethereum | -51.1 | -24.6 | 主池 -51.1bps 但副池 -24.6bps → 疑似坏点，已拦截 |
| 2026-06-02 16:00Z | USD1@Ethereum | -131.9 | 24.7 | 主池 -131.9bps 但副池 24.7bps → 疑似坏点，已拦截 |
| 2026-06-02 19:00Z | PYUSD@Ethereum | 61.6 | -102.8 | 主池 61.6bps 但副池 -102.8bps → 疑似坏点，已拦截 |
| 2026-06-02 21:00Z | USDT@BSC | -51 | -11.1 | 主池 -51.0bps 但副池 -11.1bps → 疑似坏点，已拦截 |
| 2026-06-02 22:00Z | PYUSD@Ethereum | -99 | 2.8 | 主池 -99.0bps 但副池 2.8bps → 疑似坏点，已拦截 |
| 2026-06-03 10:00Z | PYUSD@Ethereum | 66.8 | -161.5 | 主池 66.8bps 但副池 -161.5bps → 疑似坏点，已拦截 |
| 2026-06-03 18:00Z | USDS@Ethereum | 51.2 | -23.4 | 主池 51.2bps 但副池 -23.4bps → 疑似坏点，已拦截 |
| 2026-06-03 19:00Z | USDT@BSC | -59.6 | -15.3 | 主池 -59.6bps 但副池 -15.3bps → 疑似坏点，已拦截 |
| 2026-06-03 19:00Z | USDC@Base | 53.8 | 20.4 | 主池 53.8bps 但副池 20.4bps → 疑似坏点，已拦截 |
| 2026-06-03 23:00Z | USDT@BSC | -54.1 | -9.9 | 主池 -54.1bps 但副池 -9.9bps → 疑似坏点，已拦截 |
| 2026-06-04 02:00Z | USDC@Base | 51.2 | -11.4 | 主池 51.2bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-06-04 02:00Z | USDS@Ethereum | -52.8 | -8 | 主池 -52.8bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-06-04 03:00Z | PYUSD@Ethereum | 157.6 | -239.7 | 主池 157.6bps 但副池 -239.7bps → 疑似坏点，已拦截 |
| 2026-06-04 05:00Z | USDS@Ethereum | -51.6 | -24.7 | 主池 -51.6bps 但副池 -24.7bps → 疑似坏点，已拦截 |
| 2026-06-04 15:00Z | USDC@Base | -50.3 | 37.8 | 主池 -50.3bps 但副池 37.8bps → 疑似坏点，已拦截 |
| 2026-06-04 17:00Z | USDe@Solana | -59.4 | -24 | 主池 -59.4bps 但副池 -24.0bps → 疑似坏点，已拦截 |
| 2026-06-04 23:00Z | USDT@BSC | -60.3 | -15 | 主池 -60.3bps 但副池 -15.0bps → 疑似坏点，已拦截 |
| 2026-06-05 03:00Z | USDT@BSC | -52.2 | -12.2 | 主池 -52.2bps 但副池 -12.2bps → 疑似坏点，已拦截 |
| 2026-06-05 03:00Z | PYUSD@Ethereum | 63.4 | -92.6 | 主池 63.4bps 但副池 -92.6bps → 疑似坏点，已拦截 |
| 2026-06-05 04:00Z | USDT@BSC | -56.5 | -22.8 | 主池 -56.5bps 但副池 -22.8bps → 疑似坏点，已拦截 |
| 2026-06-05 05:00Z | USDC@Ethereum | 67.5 | 12.7 | 主池 67.5bps 但副池 12.7bps → 疑似坏点，已拦截 |
| 2026-06-05 09:00Z | USDT@BSC | -50.5 | -10 | 主池 -50.5bps 但副池 -10.0bps → 疑似坏点，已拦截 |
| 2026-06-05 14:00Z | USDT@BSC | -62.7 | -9.3 | 主池 -62.7bps 但副池 -9.3bps → 疑似坏点，已拦截 |
| 2026-06-05 18:00Z | PYUSD@Solana | 51.8 | -41.9 | 主池 51.8bps 但副池 -41.9bps → 疑似坏点，已拦截 |
| 2026-06-05 18:00Z | USDG@Solana | 57 | 5.1 | 主池 57.0bps 但副池 5.1bps → 疑似坏点，已拦截 |
| 2026-06-05 19:00Z | USDC@Ethereum | -85.3 | 13.5 | 主池 -85.3bps 但副池 13.5bps → 疑似坏点，已拦截 |
| 2026-06-05 19:00Z | PYUSD@Ethereum | 144.7 | -60.8 | 主池 144.7bps 但副池 -60.8bps → 疑似坏点，已拦截 |
| 2026-06-05 23:00Z | PYUSD@Ethereum | 68.3 | -78.5 | 主池 68.3bps 但副池 -78.5bps → 疑似坏点，已拦截 |
| 2026-06-06 05:00Z | PYUSD@Solana | -131.5 | 19.3 | 主池 -131.5bps 但副池 19.3bps → 疑似坏点，已拦截 |
| 2026-06-06 11:00Z | USDT@BSC | -52.3 | -4.6 | 主池 -52.3bps 但副池 -4.6bps → 疑似坏点，已拦截 |
| 2026-06-07 06:00Z | USDC@Base | -51.8 | 2.2 | 主池 -51.8bps 但副池 2.2bps → 疑似坏点，已拦截 |
| 2026-06-07 08:00Z | USDT@BSC | -54.1 | -4.7 | 主池 -54.1bps 但副池 -4.7bps → 疑似坏点，已拦截 |
| 2026-06-07 14:00Z | PYUSD@Ethereum | 79.8 | -232.5 | 主池 79.8bps 但副池 -232.5bps → 疑似坏点，已拦截 |
| 2026-06-07 22:00Z | PYUSD@Ethereum | 63.9 | -205 | 主池 63.9bps 但副池 -205.0bps → 疑似坏点，已拦截 |
| 2026-06-08 00:00Z | USDC@Solana | 54.1 | -4 | 主池 54.1bps 但副池 -4.0bps → 疑似坏点，已拦截 |
| 2026-06-08 08:00Z | USDC@Base | -51.8 | 19.4 | 主池 -51.8bps 但副池 19.4bps → 疑似坏点，已拦截 |
| 2026-06-08 10:00Z | PYUSD@Solana | 211.6 | 0.7 | 主池 211.6bps 但副池 0.7bps → 疑似坏点，已拦截 |
| 2026-06-08 11:00Z | USDS@Ethereum | -53.2 | 32.5 | 主池 -53.2bps 但副池 32.5bps → 疑似坏点，已拦截 |
| 2026-06-08 11:00Z | USDe@Solana | 115.3 | 10.5 | 主池 115.3bps 但副池 10.5bps → 疑似坏点，已拦截 |
| 2026-06-09 01:00Z | PYUSD@Solana | -140.1 | -11.3 | 主池 -140.1bps 但副池 -11.3bps → 疑似坏点，已拦截 |
| 2026-06-09 06:00Z | USDC@Base | -55.8 | 3.1 | 主池 -55.8bps 但副池 3.1bps → 疑似坏点，已拦截 |
| 2026-06-09 07:00Z | USDe@Solana | -54.5 | 9.8 | 主池 -54.5bps 但副池 9.8bps → 疑似坏点，已拦截 |
| 2026-06-09 13:00Z | PYUSD@Solana | 63.4 | -17.3 | 主池 63.4bps 但副池 -17.3bps → 疑似坏点，已拦截 |
| 2026-06-09 17:00Z | USDT@BSC | -113.2 | -4.1 | 主池 -113.2bps 但副池 -4.1bps → 疑似坏点，已拦截 |
| 2026-06-10 00:00Z | PYUSD@Solana | -126.8 | -17.2 | 主池 -126.8bps 但副池 -17.2bps → 疑似坏点，已拦截 |
| 2026-06-10 01:00Z | PYUSD@Ethereum | 53.5 | -89.1 | 主池 53.5bps 但副池 -89.1bps → 疑似坏点，已拦截 |
| 2026-06-10 02:00Z | USDe@Solana | -53.9 | -19.9 | 主池 -53.9bps 但副池 -19.9bps → 疑似坏点，已拦截 |
| 2026-06-10 08:00Z | USDC@Base | -51.4 | 15.3 | 主池 -51.4bps 但副池 15.3bps → 疑似坏点，已拦截 |
| 2026-06-10 10:00Z | PYUSD@Ethereum | 65 | -74.3 | 主池 65.0bps 但副池 -74.3bps → 疑似坏点，已拦截 |
| 2026-06-10 12:00Z | PYUSD@Ethereum | 73.8 | -67.2 | 主池 73.8bps 但副池 -67.2bps → 疑似坏点，已拦截 |
| 2026-06-10 15:00Z | USDT@Arbitrum | -55.3 | -12.3 | 主池 -55.3bps 但副池 -12.3bps → 疑似坏点，已拦截 |
| 2026-06-10 15:00Z | USDC@Base | -60.9 | -15.8 | 主池 -60.9bps 但副池 -15.8bps → 疑似坏点，已拦截 |
| 2026-06-10 17:00Z | PYUSD@Ethereum | -53.2 | 162.9 | 主池 -53.2bps 但副池 162.9bps → 疑似坏点，已拦截 |
| 2026-06-10 23:00Z | PYUSD@Solana | -50.8 | -20.7 | 主池 -50.8bps 但副池 -20.7bps → 疑似坏点，已拦截 |
| 2026-06-11 03:00Z | PYUSD@Ethereum | 54 | -137.7 | 主池 54.0bps 但副池 -137.7bps → 疑似坏点，已拦截 |
| 2026-06-11 16:00Z | USDT@BSC | -54.3 | -12.8 | 主池 -54.3bps 但副池 -12.8bps → 疑似坏点，已拦截 |
| 2026-06-11 16:00Z | USDS@Ethereum | -50.7 | -24 | 主池 -50.7bps 但副池 -24.0bps → 疑似坏点，已拦截 |
| 2026-06-11 17:00Z | USDC@Base | -54.9 | 34.8 | 主池 -54.9bps 但副池 34.8bps → 疑似坏点，已拦截 |
| 2026-06-12 03:00Z | USDT@BSC | -55.8 | -10.4 | 主池 -55.8bps 但副池 -10.4bps → 疑似坏点，已拦截 |
| 2026-06-12 14:00Z | USDe@Solana | 149.2 | -0.9 | 主池 149.2bps 但副池 -0.9bps → 疑似坏点，已拦截 |
| 2026-06-13 11:00Z | USDG@Solana | 89.3 | -13.7 | 主池 89.3bps 但副池 -13.7bps → 疑似坏点，已拦截 |
| 2026-06-14 13:00Z | USDC@Base | -50.6 | 4.2 | 主池 -50.6bps 但副池 4.2bps → 疑似坏点，已拦截 |
| 2026-06-14 19:00Z | USDT@BSC | -50.7 | -7.3 | 主池 -50.7bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-06-14 21:00Z | USDS@Ethereum | -55 | -10.4 | 主池 -55.0bps 但副池 -10.4bps → 疑似坏点，已拦截 |
| 2026-06-15 05:00Z | USDC@Base | -52.9 | 32 | 主池 -52.9bps 但副池 32.0bps → 疑似坏点，已拦截 |
| 2026-06-15 10:00Z | PYUSD@Ethereum | 80.6 | -233.2 | 主池 80.6bps 但副池 -233.2bps → 疑似坏点，已拦截 |
| 2026-06-15 11:00Z | PYUSD@Ethereum | 176.1 | -244.8 | 主池 176.1bps 但副池 -244.8bps → 疑似坏点，已拦截 |
| 2026-06-15 13:00Z | PYUSD@Ethereum | 68.6 | -253.5 | 主池 68.6bps 但副池 -253.5bps → 疑似坏点，已拦截 |
| 2026-06-15 15:00Z | PYUSD@Ethereum | 100.2 | -272.2 | 主池 100.2bps 但副池 -272.2bps → 疑似坏点，已拦截 |
| 2026-06-15 19:00Z | USDC@Base | 56.2 | -42.5 | 主池 56.2bps 但副池 -42.5bps → 疑似坏点，已拦截 |
| 2026-06-15 20:00Z | USDT@BSC | -51.7 | -6 | 主池 -51.7bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-06-15 20:00Z | USDS@Ethereum | -52.4 | 31.5 | 主池 -52.4bps 但副池 31.5bps → 疑似坏点，已拦截 |
| 2026-06-15 23:00Z | PYUSD@Ethereum | 54.9 | -134.6 | 主池 54.9bps 但副池 -134.6bps → 疑似坏点，已拦截 |
| 2026-06-16 04:00Z | USDC@Base | -54.4 | 14.6 | 主池 -54.4bps 但副池 14.6bps → 疑似坏点，已拦截 |
| 2026-06-16 06:00Z | PYUSD@Ethereum | 53.3 | -62.1 | 主池 53.3bps 但副池 -62.1bps → 疑似坏点，已拦截 |
| 2026-06-16 16:00Z | USDT@BSC | -51.4 | -6.4 | 主池 -51.4bps 但副池 -6.4bps → 疑似坏点，已拦截 |
| 2026-06-16 23:00Z | USDT@BSC | -56.5 | -11.4 | 主池 -56.5bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-06-17 03:00Z | USDT@BSC | -56.3 | -12.6 | 主池 -56.3bps 但副池 -12.6bps → 疑似坏点，已拦截 |
| 2026-06-17 12:00Z | USDS@Ethereum | 54.3 | -23.9 | 主池 54.3bps 但副池 -23.9bps → 疑似坏点，已拦截 |
| 2026-06-17 13:00Z | USDS@Ethereum | -51.9 | -14.8 | 主池 -51.9bps 但副池 -14.8bps → 疑似坏点，已拦截 |
| 2026-06-17 14:00Z | PYUSD@Ethereum | 64.5 | -37 | 主池 64.5bps 但副池 -37.0bps → 疑似坏点，已拦截 |
| 2026-06-17 16:00Z | USDC@Base | -54.3 | 14.4 | 主池 -54.3bps 但副池 14.4bps → 疑似坏点，已拦截 |
| 2026-06-17 18:00Z | PYUSD@Ethereum | 67.4 | -100.4 | 主池 67.4bps 但副池 -100.4bps → 疑似坏点，已拦截 |
| 2026-06-18 15:00Z | PYUSD@Ethereum | -201.8 | 24.5 | 主池 -201.8bps 但副池 24.5bps → 疑似坏点，已拦截 |
| 2026-06-18 18:00Z | USDT@BSC | -51.7 | -10.7 | 主池 -51.7bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-06-18 20:00Z | USD1@Ethereum | -146.9 | -20.4 | 主池 -146.9bps 但副池 -20.4bps → 疑似坏点，已拦截 |
| 2026-06-19 00:00Z | PYUSD@Solana | 79.9 | -9.8 | 主池 79.9bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-06-19 02:00Z | USDC@Base | -51.2 | 2.4 | 主池 -51.2bps 但副池 2.4bps → 疑似坏点，已拦截 |
| 2026-06-19 04:00Z | USDS@Ethereum | -50.5 | -24.6 | 主池 -50.5bps 但副池 -24.6bps → 疑似坏点，已拦截 |
| 2026-06-19 06:00Z | USDC@Base | 52.5 | -16.6 | 主池 52.5bps 但副池 -16.6bps → 疑似坏点，已拦截 |
| 2026-06-19 09:00Z | USDC@Base | -50.5 | 12.8 | 主池 -50.5bps 但副池 12.8bps → 疑似坏点，已拦截 |
| 2026-06-19 10:00Z | USD1@Ethereum | -78.3 | -23.3 | 主池 -78.3bps 但副池 -23.3bps → 疑似坏点，已拦截 |
| 2026-06-19 11:00Z | USDT@BSC | -100.5 | -13.5 | 主池 -100.5bps 但副池 -13.5bps → 疑似坏点，已拦截 |
| 2026-06-19 13:00Z | PYUSD@Ethereum | 68.5 | -41.5 | 主池 68.5bps 但副池 -41.5bps → 疑似坏点，已拦截 |
| 2026-06-19 14:00Z | PYUSD@Ethereum | 62.8 | -12.9 | 主池 62.8bps 但副池 -12.9bps → 疑似坏点，已拦截 |
| 2026-06-19 16:00Z | USD1@Ethereum | -68.5 | -22.2 | 主池 -68.5bps 但副池 -22.2bps → 疑似坏点，已拦截 |
| 2026-06-20 00:00Z | USDT@BSC | -51.4 | -4.3 | 主池 -51.4bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-06-20 05:00Z | PYUSD@Ethereum | 111.1 | -36.4 | 主池 111.1bps 但副池 -36.4bps → 疑似坏点，已拦截 |
| 2026-06-20 07:00Z | USDT@BSC | -50.3 | -15.3 | 主池 -50.3bps 但副池 -15.3bps → 疑似坏点，已拦截 |
| 2026-06-20 08:00Z | USDT@BSC | -57.2 | -8.2 | 主池 -57.2bps 但副池 -8.2bps → 疑似坏点，已拦截 |
| 2026-06-20 08:00Z | USDS@Ethereum | -50.1 | 42.5 | 主池 -50.1bps 但副池 42.5bps → 疑似坏点，已拦截 |
| 2026-06-20 14:00Z | USDS@Ethereum | -50.1 | 125.6 | 主池 -50.1bps 但副池 125.6bps → 疑似坏点，已拦截 |
| 2026-06-21 02:00Z | USDC@Base | -51.5 | 10.2 | 主池 -51.5bps 但副池 10.2bps → 疑似坏点，已拦截 |
| 2026-06-21 10:00Z | USDG@Solana | -52.5 | 16.8 | 主池 -52.5bps 但副池 16.8bps → 疑似坏点，已拦截 |
| 2026-06-21 20:00Z | USDe@Solana | -70.4 | 4.4 | 主池 -70.4bps 但副池 4.4bps → 疑似坏点，已拦截 |
| 2026-06-22 02:00Z | USD1@Ethereum | -94.9 | -21.5 | 主池 -94.9bps 但副池 -21.5bps → 疑似坏点，已拦截 |
| 2026-06-22 11:00Z | PYUSD@Solana | 82.3 | 14.7 | 主池 82.3bps 但副池 14.7bps → 疑似坏点，已拦截 |
| 2026-06-22 12:00Z | PYUSD@Solana | -50.8 | -17.3 | 主池 -50.8bps 但副池 -17.3bps → 疑似坏点，已拦截 |
| 2026-06-22 15:00Z | USDT@BSC | -53.7 | -11.4 | 主池 -53.7bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-06-22 18:00Z | USDT@BSC | -53.8 | -7.8 | 主池 -53.8bps 但副池 -7.8bps → 疑似坏点，已拦截 |
| 2026-06-23 00:00Z | USDC@Base | -51 | -14.4 | 主池 -51.0bps 但副池 -14.4bps → 疑似坏点，已拦截 |
| 2026-06-23 04:00Z | USDT@BSC | -50.8 | -1.5 | 主池 -50.8bps 但副池 -1.5bps → 疑似坏点，已拦截 |
| 2026-06-23 04:00Z | USDC@Base | -56.2 | 3.7 | 主池 -56.2bps 但副池 3.7bps → 疑似坏点，已拦截 |
| 2026-06-23 05:00Z | USDT@BSC | -54.1 | -13.8 | 主池 -54.1bps 但副池 -13.8bps → 疑似坏点，已拦截 |
| 2026-06-23 09:00Z | USDT@BSC | -58.8 | -13 | 主池 -58.8bps 但副池 -13.0bps → 疑似坏点，已拦截 |
| 2026-06-24 02:00Z | USDT@BSC | -55 | -8.8 | 主池 -55.0bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-06-24 06:00Z | USDT@BSC | -57.7 | -13.3 | 主池 -57.7bps 但副池 -13.3bps → 疑似坏点，已拦截 |
| 2026-06-24 08:00Z | USDC@Base | -54.8 | 25.3 | 主池 -54.8bps 但副池 25.3bps → 疑似坏点，已拦截 |
| 2026-06-24 08:00Z | USDG@Solana | 66.7 | 7.2 | 主池 66.7bps 但副池 7.2bps → 疑似坏点，已拦截 |
| 2026-06-24 09:00Z | USDC@Base | -51.4 | 26.3 | 主池 -51.4bps 但副池 26.3bps → 疑似坏点，已拦截 |
| 2026-06-24 12:00Z | PYUSD@Ethereum | 113.2 | -37.3 | 主池 113.2bps 但副池 -37.3bps → 疑似坏点，已拦截 |
| 2026-06-24 18:00Z | USD1@Ethereum | -119.5 | 27.2 | 主池 -119.5bps 但副池 27.2bps → 疑似坏点，已拦截 |
| 2026-06-24 19:00Z | PYUSD@Ethereum | 69.6 | -46.8 | 主池 69.6bps 但副池 -46.8bps → 疑似坏点，已拦截 |
| 2026-06-25 09:00Z | USDT@BSC | -59.8 | -15.4 | 主池 -59.8bps 但副池 -15.4bps → 疑似坏点，已拦截 |
| 2026-06-25 09:00Z | USDC@Base | -53.1 | 2.6 | 主池 -53.1bps 但副池 2.6bps → 疑似坏点，已拦截 |
| 2026-06-25 09:00Z | USDS@Ethereum | -52.8 | 33.8 | 主池 -52.8bps 但副池 33.8bps → 疑似坏点，已拦截 |
| 2026-06-25 10:00Z | USDT@BSC | -52.8 | -9.8 | 主池 -52.8bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-06-25 11:00Z | USDT@BSC | -51.6 | -15.7 | 主池 -51.6bps 但副池 -15.7bps → 疑似坏点，已拦截 |
| 2026-06-25 13:00Z | USDC@Ethereum | 50.5 | 18.7 | 主池 50.5bps 但副池 18.7bps → 疑似坏点，已拦截 |
| 2026-06-25 13:00Z | USDC@Base | -102 | 17 | 主池 -102.0bps 但副池 17.0bps → 疑似坏点，已拦截 |
| 2026-06-25 21:00Z | PYUSD@Ethereum | 121.2 | -43.6 | 主池 121.2bps 但副池 -43.6bps → 疑似坏点，已拦截 |
| 2026-06-25 22:00Z | PYUSD@Ethereum | 119.2 | -17.4 | 主池 119.2bps 但副池 -17.4bps → 疑似坏点，已拦截 |
| 2026-06-25 23:00Z | USD1@Ethereum | -56 | -24.8 | 主池 -56.0bps 但副池 -24.8bps → 疑似坏点，已拦截 |
| 2026-06-26 01:00Z | USDC@Base | -109.7 | 19.3 | 主池 -109.7bps 但副池 19.3bps → 疑似坏点，已拦截 |
| 2026-06-26 03:00Z | PYUSD@Ethereum | 150.1 | 11.1 | 主池 150.1bps 但副池 11.1bps → 疑似坏点，已拦截 |
| 2026-06-26 06:00Z | PYUSD@Ethereum | 79.6 | -40 | 主池 79.6bps 但副池 -40.0bps → 疑似坏点，已拦截 |
| 2026-06-26 07:00Z | USD1@Ethereum | -64.7 | -21.3 | 主池 -64.7bps 但副池 -21.3bps → 疑似坏点，已拦截 |
| 2026-06-26 09:00Z | USDT@BSC | -51.3 | -14.1 | 主池 -51.3bps 但副池 -14.1bps → 疑似坏点，已拦截 |
| 2026-06-26 12:00Z | USD1@Ethereum | -74.2 | 35.3 | 主池 -74.2bps 但副池 35.3bps → 疑似坏点，已拦截 |
| 2026-06-26 13:00Z | USD1@Ethereum | -99.8 | -23.4 | 主池 -99.8bps 但副池 -23.4bps → 疑似坏点，已拦截 |
| 2026-06-26 13:00Z | PYUSD@Ethereum | 227.3 | -55.2 | 主池 227.3bps 但副池 -55.2bps → 疑似坏点，已拦截 |
| 2026-06-26 16:00Z | USDC@Base | -50.8 | 7.8 | 主池 -50.8bps 但副池 7.8bps → 疑似坏点，已拦截 |
| 2026-06-26 16:00Z | PYUSD@Ethereum | 65.6 | -33.9 | 主池 65.6bps 但副池 -33.9bps → 疑似坏点，已拦截 |
| 2026-06-26 18:00Z | USDT@BSC | -56.3 | -14.5 | 主池 -56.3bps 但副池 -14.5bps → 疑似坏点，已拦截 |
| 2026-06-26 18:00Z | USD1@Ethereum | -69.8 | 30.7 | 主池 -69.8bps 但副池 30.7bps → 疑似坏点，已拦截 |
| 2026-06-27 11:00Z | USDT@BSC | -52 | -16.6 | 主池 -52.0bps 但副池 -16.6bps → 疑似坏点，已拦截 |
| 2026-06-27 11:00Z | USDG@Solana | -159.9 | -6.7 | 主池 -159.9bps 但副池 -6.7bps → 疑似坏点，已拦截 |
| 2026-06-27 18:00Z | USDT@BSC | -56.6 | -12 | 主池 -56.6bps 但副池 -12.0bps → 疑似坏点，已拦截 |
| 2026-06-27 21:00Z | USDS@Ethereum | -50.1 | -24.9 | 主池 -50.1bps 但副池 -24.9bps → 疑似坏点，已拦截 |
| 2026-06-28 04:00Z | USDT@BSC | -50.8 | -15.4 | 主池 -50.8bps 但副池 -15.4bps → 疑似坏点，已拦截 |
| 2026-06-28 12:00Z | PYUSD@Ethereum | 51.2 | -13.2 | 主池 51.2bps 但副池 -13.2bps → 疑似坏点，已拦截 |
| 2026-06-28 14:00Z | USDT@BSC | -52.1 | -9.2 | 主池 -52.1bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-06-28 15:00Z | USDT@BSC | -50.8 | -15.6 | 主池 -50.8bps 但副池 -15.6bps → 疑似坏点，已拦截 |
| 2026-06-28 16:00Z | USD1@Ethereum | -102.3 | 33.8 | 主池 -102.3bps 但副池 33.8bps → 疑似坏点，已拦截 |
| 2026-06-28 20:00Z | USDT@BSC | -57.3 | -17.7 | 主池 -57.3bps 但副池 -17.7bps → 疑似坏点，已拦截 |
| 2026-06-29 03:00Z | USDT@BSC | -123.2 | -24.8 | 主池 -123.2bps 但副池 -24.8bps → 疑似坏点，已拦截 |
| 2026-06-29 04:00Z | USDT@BSC | -60.1 | -16.7 | 主池 -60.1bps 但副池 -16.7bps → 疑似坏点，已拦截 |
| 2026-06-29 10:00Z | USDT@BSC | -54.4 | -11.5 | 主池 -54.4bps 但副池 -11.5bps → 疑似坏点，已拦截 |
| 2026-06-29 11:00Z | USDS@Ethereum | -50.6 | -21.2 | 主池 -50.6bps 但副池 -21.2bps → 疑似坏点，已拦截 |
| 2026-06-29 13:00Z | PYUSD@Ethereum | -59 | -4.2 | 主池 -59.0bps 但副池 -4.2bps → 疑似坏点，已拦截 |
| 2026-06-29 15:00Z | PYUSD@Ethereum | 92.9 | -23.2 | 主池 92.9bps 但副池 -23.2bps → 疑似坏点，已拦截 |
| 2026-06-29 20:00Z | USDT@BSC | -60.1 | -13.6 | 主池 -60.1bps 但副池 -13.6bps → 疑似坏点，已拦截 |
| 2026-06-29 23:00Z | USDT@BSC | -58.1 | -16.4 | 主池 -58.1bps 但副池 -16.4bps → 疑似坏点，已拦截 |
| 2026-06-30 00:00Z | USDC@Base | -52.8 | 4.3 | 主池 -52.8bps 但副池 4.3bps → 疑似坏点，已拦截 |
| 2026-06-30 07:00Z | USDT@BSC | -61.3 | -17.3 | 主池 -61.3bps 但副池 -17.3bps → 疑似坏点，已拦截 |
| 2026-06-30 08:00Z | USDC@Base | -55.5 | 4.4 | 主池 -55.5bps 但副池 4.4bps → 疑似坏点，已拦截 |
| 2026-06-30 11:00Z | USDT@BSC | -59.5 | -23.6 | 主池 -59.5bps 但副池 -23.6bps → 疑似坏点，已拦截 |
| 2026-06-30 12:00Z | USDT@BSC | -52.7 | -7.4 | 主池 -52.7bps 但副池 -7.4bps → 疑似坏点，已拦截 |
| 2026-06-30 14:00Z | USDT@BSC | -56.2 | -17.7 | 主池 -56.2bps 但副池 -17.7bps → 疑似坏点，已拦截 |
| 2026-06-30 14:00Z | PYUSD@Solana | 107.3 | -33.5 | 主池 107.3bps 但副池 -33.5bps → 疑似坏点，已拦截 |
| 2026-06-30 15:00Z | PYUSD@Ethereum | 57.6 | 21.5 | 主池 57.6bps 但副池 21.5bps → 疑似坏点，已拦截 |
| 2026-06-30 17:00Z | USDT@BSC | -61.9 | -11.7 | 主池 -61.9bps 但副池 -11.7bps → 疑似坏点，已拦截 |
| 2026-07-01 01:00Z | PYUSD@Ethereum | 59.4 | -13.7 | 主池 59.4bps 但副池 -13.7bps → 疑似坏点，已拦截 |
| 2026-07-01 03:00Z | PYUSD@Ethereum | 98.9 | -27.2 | 主池 98.9bps 但副池 -27.2bps → 疑似坏点，已拦截 |
| 2026-07-01 10:00Z | USDT@BSC | -56.9 | -11.1 | 主池 -56.9bps 但副池 -11.1bps → 疑似坏点，已拦截 |
| 2026-07-01 10:00Z | PYUSD@Solana | 89.5 | -31.2 | 主池 89.5bps 但副池 -31.2bps → 疑似坏点，已拦截 |
| 2026-07-01 11:00Z | USDT@BSC | -53.3 | -14.3 | 主池 -53.3bps 但副池 -14.3bps → 疑似坏点，已拦截 |
| 2026-07-01 13:00Z | PYUSD@Ethereum | 121.9 | -22.8 | 主池 121.9bps 但副池 -22.8bps → 疑似坏点，已拦截 |
| 2026-07-01 19:00Z | USDT@BSC | -53.2 | -15.4 | 主池 -53.2bps 但副池 -15.4bps → 疑似坏点，已拦截 |
| 2026-07-01 22:00Z | USDS@Ethereum | -55 | 14 | 主池 -55.0bps 但副池 14.0bps → 疑似坏点，已拦截 |
| 2026-07-02 01:00Z | PYUSD@Ethereum | 60.1 | -16.3 | 主池 60.1bps 但副池 -16.3bps → 疑似坏点，已拦截 |
| 2026-07-02 04:00Z | USDC@Base | -57.7 | 2.1 | 主池 -57.7bps 但副池 2.1bps → 疑似坏点，已拦截 |
| 2026-07-02 04:00Z | USDG@Solana | -166.4 | -15.5 | 主池 -166.4bps 但副池 -15.5bps → 疑似坏点，已拦截 |
| 2026-07-02 05:00Z | USDC@Base | -54.1 | -4 | 主池 -54.1bps 但副池 -4.0bps → 疑似坏点，已拦截 |
| 2026-07-02 07:00Z | USDT@BSC | -56.8 | -11.3 | 主池 -56.8bps 但副池 -11.3bps → 疑似坏点，已拦截 |
| 2026-07-02 07:00Z | USDS@Ethereum | -53.9 | -22.5 | 主池 -53.9bps 但副池 -22.5bps → 疑似坏点，已拦截 |
| 2026-07-02 13:00Z | USDT@BSC | -53.4 | -13.4 | 主池 -53.4bps 但副池 -13.4bps → 疑似坏点，已拦截 |
| 2026-07-02 13:00Z | PYUSD@Ethereum | 124.9 | -35.8 | 主池 124.9bps 但副池 -35.8bps → 疑似坏点，已拦截 |
| 2026-07-02 19:00Z | USDT@BSC | -53 | -6 | 主池 -53.0bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-07-03 06:00Z | USDT@BSC | -50.4 | -7.5 | 主池 -50.4bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-07-03 08:00Z | USDT@BSC | -132.2 | -15.6 | 主池 -132.2bps 但副池 -15.6bps → 疑似坏点，已拦截 |
| 2026-07-03 08:00Z | USDC@Base | -52.9 | 3.7 | 主池 -52.9bps 但副池 3.7bps → 疑似坏点，已拦截 |
| 2026-07-03 09:00Z | PYUSD@Solana | -75.8 | 11.4 | 主池 -75.8bps 但副池 11.4bps → 疑似坏点，已拦截 |
| 2026-07-03 13:00Z | PYUSD@Ethereum | 94.8 | 1.3 | 主池 94.8bps 但副池 1.3bps → 疑似坏点，已拦截 |
| 2026-07-03 14:00Z | PYUSD@Ethereum | 53.2 | -45.4 | 主池 53.2bps 但副池 -45.4bps → 疑似坏点，已拦截 |
| 2026-07-04 01:00Z | USDC@Base | -53.8 | 0.6 | 主池 -53.8bps 但副池 0.6bps → 疑似坏点，已拦截 |
| 2026-07-04 02:00Z | PYUSD@Solana | -115.3 | 3.9 | 主池 -115.3bps 但副池 3.9bps → 疑似坏点，已拦截 |
| 2026-07-04 17:00Z | PYUSD@Ethereum | 87 | 5.4 | 主池 87.0bps 但副池 5.4bps → 疑似坏点，已拦截 |
| 2026-07-05 06:00Z | USDT@BSC | -53.7 | -3.7 | 主池 -53.7bps 但副池 -3.7bps → 疑似坏点，已拦截 |
| 2026-07-05 08:00Z | USDT@BSC | -56 | -8.5 | 主池 -56.0bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-07-05 09:00Z | USDT@BSC | -57.8 | -8.7 | 主池 -57.8bps 但副池 -8.7bps → 疑似坏点，已拦截 |
| 2026-07-05 16:00Z | USDT@BSC | -60.2 | -5 | 主池 -60.2bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-07-05 22:00Z | USDC@Base | -52.1 | 3.7 | 主池 -52.1bps 但副池 3.7bps → 疑似坏点，已拦截 |
| 2026-07-05 22:00Z | USDS@Ethereum | -53.9 | 32.7 | 主池 -53.9bps 但副池 32.7bps → 疑似坏点，已拦截 |
| 2026-07-06 00:00Z | PYUSD@Ethereum | 57.9 | -31.6 | 主池 57.9bps 但副池 -31.6bps → 疑似坏点，已拦截 |
| 2026-07-06 01:00Z | USDT@BSC | -56.8 | -7.8 | 主池 -56.8bps 但副池 -7.8bps → 疑似坏点，已拦截 |
| 2026-07-06 02:00Z | USDT@BSC | -54.3 | -18.1 | 主池 -54.3bps 但副池 -18.1bps → 疑似坏点，已拦截 |
| 2026-07-06 02:00Z | USDC@Base | -50.8 | 8.5 | 主池 -50.8bps 但副池 8.5bps → 疑似坏点，已拦截 |
| 2026-07-06 04:00Z | USDT@BSC | -53.6 | -7.3 | 主池 -53.6bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-07-06 06:00Z | USDT@BSC | -55.4 | -8.5 | 主池 -55.4bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-07-06 08:00Z | USDT@BSC | -52.2 | -13.9 | 主池 -52.2bps 但副池 -13.9bps → 疑似坏点，已拦截 |
| 2026-07-06 10:00Z | USDT@BSC | -53.9 | -8.7 | 主池 -53.9bps 但副池 -8.7bps → 疑似坏点，已拦截 |
| 2026-07-06 15:00Z | PYUSD@Ethereum | 69.5 | -32.8 | 主池 69.5bps 但副池 -32.8bps → 疑似坏点，已拦截 |
| 2026-07-06 17:00Z | USDC@Base | -54.7 | 14.8 | 主池 -54.7bps 但副池 14.8bps → 疑似坏点，已拦截 |
| 2026-07-06 21:00Z | PYUSD@Ethereum | 131.8 | -60 | 主池 131.8bps 但副池 -60.0bps → 疑似坏点，已拦截 |
| 2026-07-06 22:00Z | USDS@Ethereum | -53.6 | 33.4 | 主池 -53.6bps 但副池 33.4bps → 疑似坏点，已拦截 |
| 2026-07-07 02:00Z | USDT@BSC | -53.3 | -10 | 主池 -53.3bps 但副池 -10.0bps → 疑似坏点，已拦截 |
| 2026-07-07 02:00Z | USDS@Ethereum | -50.6 | 29.8 | 主池 -50.6bps 但副池 29.8bps → 疑似坏点，已拦截 |
| 2026-07-07 04:00Z | USDe@Solana | -104.8 | 11.1 | 主池 -104.8bps 但副池 11.1bps → 疑似坏点，已拦截 |
| 2026-07-07 06:00Z | PYUSD@Ethereum | 60.3 | -47.2 | 主池 60.3bps 但副池 -47.2bps → 疑似坏点，已拦截 |
| 2026-07-07 09:00Z | USDT@BSC | -51.2 | -8.6 | 主池 -51.2bps 但副池 -8.6bps → 疑似坏点，已拦截 |
| 2026-07-07 12:00Z | USDC@Base | -56.7 | -9.3 | 主池 -56.7bps 但副池 -9.3bps → 疑似坏点，已拦截 |
| 2026-07-07 14:00Z | PYUSD@Ethereum | 52.9 | -20.9 | 主池 52.9bps 但副池 -20.9bps → 疑似坏点，已拦截 |
| 2026-07-07 16:00Z | USDS@Ethereum | -52.9 | -23.6 | 主池 -52.9bps 但副池 -23.6bps → 疑似坏点，已拦截 |
| 2026-07-07 18:00Z | USDT@BSC | -50.5 | -3.1 | 主池 -50.5bps 但副池 -3.1bps → 疑似坏点，已拦截 |
| 2026-07-07 21:00Z | USDC@Base | -51.2 | 1.7 | 主池 -51.2bps 但副池 1.7bps → 疑似坏点，已拦截 |
| 2026-07-08 04:00Z | USDC@Base | -52.7 | 22.3 | 主池 -52.7bps 但副池 22.3bps → 疑似坏点，已拦截 |
| 2026-07-08 06:00Z | USDT@BSC | -55 | -8 | 主池 -55.0bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-07-08 06:00Z | USDC@Base | -52.6 | 25.5 | 主池 -52.6bps 但副池 25.5bps → 疑似坏点，已拦截 |
| 2026-07-08 12:00Z | USDT@BSC | -51.8 | -6 | 主池 -51.8bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-07-08 17:00Z | USDS@Ethereum | -54.2 | 31.9 | 主池 -54.2bps 但副池 31.9bps → 疑似坏点，已拦截 |
| 2026-07-09 01:00Z | USDT@BSC | -52.3 | -8.8 | 主池 -52.3bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-07-09 02:00Z | USDT@BSC | -55 | -9.2 | 主池 -55.0bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-07-09 19:00Z | USDT@BSC | -54.9 | -6.8 | 主池 -54.9bps 但副池 -6.8bps → 疑似坏点，已拦截 |
| 2026-07-09 20:00Z | USDT@BSC | -51.5 | -10.7 | 主池 -51.5bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-07-10 03:00Z | USDG@Solana | 81.6 | -6.2 | 主池 81.6bps 但副池 -6.2bps → 疑似坏点，已拦截 |
| 2026-07-10 11:00Z | USDT@BSC | -50.1 | -10.4 | 主池 -50.1bps 但副池 -10.4bps → 疑似坏点，已拦截 |
| 2026-07-10 12:00Z | USDC@Base | -50.7 | 0.6 | 主池 -50.7bps 但副池 0.6bps → 疑似坏点，已拦截 |
| 2026-07-10 18:00Z | USDT@BSC | -50.7 | -9.3 | 主池 -50.7bps 但副池 -9.3bps → 疑似坏点，已拦截 |
| 2026-07-10 23:00Z | USDT@BSC | -51.4 | -5.9 | 主池 -51.4bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-07-11 01:00Z | USDT@BSC | -53.1 | -4.6 | 主池 -53.1bps 但副池 -4.6bps → 疑似坏点，已拦截 |
| 2026-07-11 03:00Z | USDC@Base | 55.1 | -19.5 | 主池 55.1bps 但副池 -19.5bps → 疑似坏点，已拦截 |
| 2026-07-11 07:00Z | USDT@BSC | -52.5 | -7.3 | 主池 -52.5bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-07-11 09:00Z | USDT@BSC | -56.2 | -8.3 | 主池 -56.2bps 但副池 -8.3bps → 疑似坏点，已拦截 |
| 2026-07-11 10:00Z | USDT@Solana | -56.3 | 4.1 | 主池 -56.3bps 但副池 4.1bps → 疑似坏点，已拦截 |
| 2026-07-12 01:00Z | USDC@Base | 53 | -12.4 | 主池 53.0bps 但副池 -12.4bps → 疑似坏点，已拦截 |
| 2026-07-12 06:00Z | PYUSD@Ethereum | -62.1 | 4.3 | 主池 -62.1bps 但副池 4.3bps → 疑似坏点，已拦截 |
| 2026-07-12 20:00Z | USDT@BSC | -53.2 | -8.3 | 主池 -53.2bps 但副池 -8.3bps → 疑似坏点，已拦截 |
| 2026-07-12 22:00Z | PYUSD@Ethereum | -86.1 | -9.1 | 主池 -86.1bps 但副池 -9.1bps → 疑似坏点，已拦截 |
| 2026-07-13 00:00Z | PYUSD@Ethereum | 100.3 | -8.5 | 主池 100.3bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-07-13 01:00Z | PYUSD@Ethereum | -66.8 | 1.5 | 主池 -66.8bps 但副池 1.5bps → 疑似坏点，已拦截 |
| 2026-07-13 05:00Z | USDC@Base | 141.3 | -21 | 主池 141.3bps 但副池 -21.0bps → 疑似坏点，已拦截 |
| 2026-07-13 13:00Z | USDT@Solana | 72.1 | 12.5 | 主池 72.1bps 但副池 12.5bps → 疑似坏点，已拦截 |
| 2026-07-13 15:00Z | USDS@Ethereum | -63.1 | 7 | 主池 -63.1bps 但副池 7.0bps → 疑似坏点，已拦截 |
| 2026-07-14 07:00Z | USDS@Ethereum | -57.3 | 7.9 | 主池 -57.3bps 但副池 7.9bps → 疑似坏点，已拦截 |
| 2026-07-14 11:00Z | USDT@BSC | -54.3 | -16.9 | 主池 -54.3bps 但副池 -16.9bps → 疑似坏点，已拦截 |
| 2026-07-14 12:00Z | PYUSD@Ethereum | 258 | 8 | 主池 258.0bps 但副池 8.0bps → 疑似坏点，已拦截 |
| 2026-07-14 22:00Z | USDT@Arbitrum | -52.5 | -6 | 主池 -52.5bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-07-14 22:00Z | USDe@Solana | 50.3 | 1 | 主池 50.3bps 但副池 1.0bps → 疑似坏点，已拦截 |
| 2026-07-15 01:00Z | USDT@BSC | -52.4 | -6.9 | 主池 -52.4bps 但副池 -6.9bps → 疑似坏点，已拦截 |
| 2026-07-15 12:00Z | USDC@Ethereum | -58.9 | 0.9 | 主池 -58.9bps 但副池 0.9bps → 疑似坏点，已拦截 |
| 2026-07-15 12:00Z | PYUSD@Ethereum | 163.6 | 0.7 | 主池 163.6bps 但副池 0.7bps → 疑似坏点，已拦截 |
| 2026-07-15 16:00Z | PYUSD@Ethereum | -54.6 | -5.3 | 主池 -54.6bps 但副池 -5.3bps → 疑似坏点，已拦截 |
| 2026-07-15 18:00Z | USD1@Ethereum | -55.2 | -7.5 | 主池 -55.2bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-07-16 00:00Z | USDC@Base | -50.2 | 1.6 | 主池 -50.2bps 但副池 1.6bps → 疑似坏点，已拦截 |
| 2026-07-16 07:00Z | USD1@Ethereum | -76.2 | 6.3 | 主池 -76.2bps 但副池 6.3bps → 疑似坏点，已拦截 |
| 2026-07-16 08:00Z | PYUSD@Ethereum | -55 | 4.4 | 主池 -55.0bps 但副池 4.4bps → 疑似坏点，已拦截 |
| 2026-07-16 09:00Z | USDS@Ethereum | -52.7 | 13 | 主池 -52.7bps 但副池 13.0bps → 疑似坏点，已拦截 |
| 2026-07-16 10:00Z | USDT@BSC | -50.4 | -11.2 | 主池 -50.4bps 但副池 -11.2bps → 疑似坏点，已拦截 |
| 2026-07-16 15:00Z | PYUSD@Solana | -159.9 | 69.1 | 主池 -159.9bps 但副池 69.1bps → 疑似坏点，已拦截 |
| 2026-07-16 17:00Z | USDS@Ethereum | -58.9 | -23.6 | 主池 -58.9bps 但副池 -23.6bps → 疑似坏点，已拦截 |
| 2026-07-16 22:00Z | USDT@BSC | -53.1 | -5.5 | 主池 -53.1bps 但副池 -5.5bps → 疑似坏点，已拦截 |
| 2026-07-17 00:00Z | USDT@Solana | -51.1 | 0.5 | 主池 -51.1bps 但副池 0.5bps → 疑似坏点，已拦截 |
| 2026-07-17 04:00Z | USDC@Base | -51.1 | 26.9 | 主池 -51.1bps 但副池 26.9bps → 疑似坏点，已拦截 |
| 2026-07-17 07:00Z | USDT@BSC | -53.4 | -5.9 | 主池 -53.4bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-07-17 08:00Z | USDC@Base | -53.5 | -16.1 | 主池 -53.5bps 但副池 -16.1bps → 疑似坏点，已拦截 |
| 2026-07-17 09:00Z | USDT@BSC | -55.8 | -10.2 | 主池 -55.8bps 但副池 -10.2bps → 疑似坏点，已拦截 |
| 2026-07-17 10:00Z | USDC@Base | 52.5 | 0.7 | 主池 52.5bps 但副池 0.7bps → 疑似坏点，已拦截 |
| 2026-07-17 12:00Z | USDT@BSC | -54.9 | -7.4 | 主池 -54.9bps 但副池 -7.4bps → 疑似坏点，已拦截 |
| 2026-07-17 12:00Z | USDC@Base | -54 | 3.8 | 主池 -54.0bps 但副池 3.8bps → 疑似坏点，已拦截 |
| 2026-07-17 14:00Z | USDS@Solana | -51.4 | -21.9 | 主池 -51.4bps 但副池 -21.9bps → 疑似坏点，已拦截 |
| 2026-07-17 18:00Z | PYUSD@Ethereum | 57.1 | 10 | 主池 57.1bps 但副池 10.0bps → 疑似坏点，已拦截 |
| 2026-07-17 20:00Z | USDT@BSC | -51.7 | -2 | 主池 -51.7bps 但副池 -2.0bps → 疑似坏点，已拦截 |
| 2026-07-18 01:00Z | USDT@BSC | -51.7 | -5.4 | 主池 -51.7bps 但副池 -5.4bps → 疑似坏点，已拦截 |
| 2026-07-18 18:00Z | USDe@Ethereum | -50.2 | 2.3 | 主池 -50.2bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-07-18 19:00Z | USDT@BSC | -50.9 | -6.6 | 主池 -50.9bps 但副池 -6.6bps → 疑似坏点，已拦截 |
| 2026-07-19 01:00Z | PYUSD@Solana | -56.5 | -6.5 | 主池 -56.5bps 但副池 -6.5bps → 疑似坏点，已拦截 |
| 2026-07-19 02:00Z | USDT@BSC | -53.2 | -8.2 | 主池 -53.2bps 但副池 -8.2bps → 疑似坏点，已拦截 |
| 2026-07-19 02:00Z | PYUSD@Solana | 617 | -20.6 | 主池 617.0bps 但副池 -20.6bps → 疑似坏点，已拦截 |
| 2026-07-19 03:00Z | USDT@BSC | -57 | -9.7 | 主池 -57.0bps 但副池 -9.7bps → 疑似坏点，已拦截 |
| 2026-07-19 06:00Z | USDT@BSC | -53.1 | -7.6 | 主池 -53.1bps 但副池 -7.6bps → 疑似坏点，已拦截 |
| 2026-07-19 06:00Z | PYUSD@Solana | 242.3 | 18.3 | 主池 242.3bps 但副池 18.3bps → 疑似坏点，已拦截 |
| 2026-07-19 10:00Z | USD1@Ethereum | -53.6 | -22.5 | 主池 -53.6bps 但副池 -22.5bps → 疑似坏点，已拦截 |
| 2026-07-19 11:00Z | USDT@Solana | 60.7 | 22 | 主池 60.7bps 但副池 22.0bps → 疑似坏点，已拦截 |
| 2026-07-19 12:00Z | USDT@BSC | -55.6 | -10.7 | 主池 -55.6bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-07-20 00:00Z | USDT@Solana | -57 | 5.8 | 主池 -57.0bps 但副池 5.8bps → 疑似坏点，已拦截 |
| 2026-07-20 01:00Z | USDT@BSC | -50.7 | -11.6 | 主池 -50.7bps 但副池 -11.6bps → 疑似坏点，已拦截 |
| 2026-07-20 01:00Z | PYUSD@Ethereum | -60.7 | -0.7 | 主池 -60.7bps 但副池 -0.7bps → 疑似坏点，已拦截 |
| 2026-07-20 01:00Z | PYUSD@Solana | 51.1 | -1.4 | 主池 51.1bps 但副池 -1.4bps → 疑似坏点，已拦截 |
| 2026-07-20 02:00Z | USDT@BSC | -54.5 | -7.3 | 主池 -54.5bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-07-20 03:00Z | USDT@BSC | -53.8 | -16.6 | 主池 -53.8bps 但副池 -16.6bps → 疑似坏点，已拦截 |
| 2026-07-20 04:00Z | USDS@Ethereum | -61.5 | 8.2 | 主池 -61.5bps 但副池 8.2bps → 疑似坏点，已拦截 |
| 2026-07-20 04:00Z | PYUSD@Solana | -233.6 | -20.9 | 主池 -233.6bps 但副池 -20.9bps → 疑似坏点，已拦截 |
| 2026-07-20 11:00Z | USDT@Solana | -79.2 | -5.2 | 主池 -79.2bps 但副池 -5.2bps → 疑似坏点，已拦截 |
| 2026-07-20 12:00Z | USDS@Ethereum | -60.9 | 2.2 | 主池 -60.9bps 但副池 2.2bps → 疑似坏点，已拦截 |
| 2026-07-20 13:00Z | USD1@Ethereum | -58.5 | 6.1 | 主池 -58.5bps 但副池 6.1bps → 疑似坏点，已拦截 |
| 2026-07-20 22:00Z | USDS@Ethereum | -59.3 | -0.3 | 主池 -59.3bps 但副池 -0.3bps → 疑似坏点，已拦截 |
| 2026-07-21 01:00Z | USDT@BSC | -54.6 | -8.5 | 主池 -54.6bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-07-21 11:00Z | USDG@Solana | -79.5 | 9.9 | 主池 -79.5bps 但副池 9.9bps → 疑似坏点，已拦截 |
| 2026-07-21 12:00Z | USDT@BSC | -55.9 | -7.5 | 主池 -55.9bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-07-21 14:00Z | USDT@Solana | -55.3 | 11.1 | 主池 -55.3bps 但副池 11.1bps → 疑似坏点，已拦截 |
| 2026-07-22 00:00Z | USDT@BSC | -52.2 | -6.1 | 主池 -52.2bps 但副池 -6.1bps → 疑似坏点，已拦截 |
| 2026-07-22 00:00Z | USDC@Base | 51.7 | -25.8 | 主池 51.7bps 但副池 -25.8bps → 疑似坏点，已拦截 |
| 2026-07-22 05:00Z | USDS@Ethereum | -56.1 | 8.5 | 主池 -56.1bps 但副池 8.5bps → 疑似坏点，已拦截 |
| 2026-07-22 10:00Z | USDT@Solana | -73.4 | -1.4 | 主池 -73.4bps 但副池 -1.4bps → 疑似坏点，已拦截 |
| 2026-07-22 13:00Z | USDT@Solana | -62.2 | -7.7 | 主池 -62.2bps 但副池 -7.7bps → 疑似坏点，已拦截 |
| 2026-07-22 14:00Z | USDC@Base | -55.1 | 31.4 | 主池 -55.1bps 但副池 31.4bps → 疑似坏点，已拦截 |
| 2026-07-22 23:00Z | PYUSD@Solana | -69.8 | 18.8 | 主池 -69.8bps 但副池 18.8bps → 疑似坏点，已拦截 |
| 2026-07-23 01:00Z | PYUSD@Solana | -57.8 | -3.1 | 主池 -57.8bps 但副池 -3.1bps → 疑似坏点，已拦截 |
| 2026-07-23 03:00Z | USDC@Base | -54.8 | -0.6 | 主池 -54.8bps 但副池 -0.6bps → 疑似坏点，已拦截 |
| 2026-07-23 04:00Z | USDT@BSC | -53.4 | -9.5 | 主池 -53.4bps 但副池 -9.5bps → 疑似坏点，已拦截 |
| 2026-07-23 08:00Z | USDT@Solana | -58.1 | 10.2 | 主池 -58.1bps 但副池 10.2bps → 疑似坏点，已拦截 |
| 2026-07-23 09:00Z | USDG@Solana | 119.2 | -5.7 | 主池 119.2bps 但副池 -5.7bps → 疑似坏点，已拦截 |
| 2026-07-23 10:00Z | USDG@Solana | 171.1 | 2.8 | 主池 171.1bps 但副池 2.8bps → 疑似坏点，已拦截 |
| 2026-07-23 11:00Z | USDT@BSC | -52.5 | -8.4 | 主池 -52.5bps 但副池 -8.4bps → 疑似坏点，已拦截 |
| 2026-07-23 12:00Z | PYUSD@Ethereum | -100.4 | 2.5 | 主池 -100.4bps 但副池 2.5bps → 疑似坏点，已拦截 |
| 2026-07-23 15:00Z | USDT@Solana | -92.5 | 12.7 | 主池 -92.5bps 但副池 12.7bps → 疑似坏点，已拦截 |
| 2026-07-23 17:00Z | USDT@BSC | -50.4 | -3.2 | 主池 -50.4bps 但副池 -3.2bps → 疑似坏点，已拦截 |
| 2026-07-23 20:00Z | USDC@Solana | 50.5 | 17 | 主池 50.5bps 但副池 17.0bps → 疑似坏点，已拦截 |
| 2026-07-24 02:00Z | USDC@Base | -53.2 | 7 | 主池 -53.2bps 但副池 7.0bps → 疑似坏点，已拦截 |
| 2026-07-24 07:00Z | USDG@Solana | -76.2 | -7.3 | 主池 -76.2bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-07-24 08:00Z | USDG@Solana | -51.7 | -1 | 主池 -51.7bps 但副池 -1.0bps → 疑似坏点，已拦截 |
| 2026-07-24 09:00Z | USDG@Solana | -112.6 | 26.2 | 主池 -112.6bps 但副池 26.2bps → 疑似坏点，已拦截 |
| 2026-07-24 10:00Z | USDT@BSC | -56.2 | -11 | 主池 -56.2bps 但副池 -11.0bps → 疑似坏点，已拦截 |
| 2026-07-24 11:00Z | USDC@Solana | -53 | -17.6 | 主池 -53.0bps 但副池 -17.6bps → 疑似坏点，已拦截 |
| 2026-07-24 13:00Z | PYUSD@Solana | 93.1 | 23.9 | 主池 93.1bps 但副池 23.9bps → 疑似坏点，已拦截 |
| 2026-07-24 14:00Z | USDT@Solana | -51.5 | 14.6 | 主池 -51.5bps 但副池 14.6bps → 疑似坏点，已拦截 |
| 2026-07-24 16:00Z | USDC@Base | -100.9 | -0.1 | 主池 -100.9bps 但副池 -0.1bps → 疑似坏点，已拦截 |
| 2026-07-24 21:00Z | USDT@BSC | -55.4 | -8.1 | 主池 -55.4bps 但副池 -8.1bps → 疑似坏点，已拦截 |
| 2026-07-25 05:00Z | USDG@Solana | -199.7 | 6.1 | 主池 -199.7bps 但副池 6.1bps → 疑似坏点，已拦截 |
| 2026-07-25 08:00Z | USDC@Base | -51.1 | -13.4 | 主池 -51.1bps 但副池 -13.4bps → 疑似坏点，已拦截 |
| 2026-07-25 12:00Z | USDT@Solana | -52.1 | -20.1 | 主池 -52.1bps 但副池 -20.1bps → 疑似坏点，已拦截 |
| 2026-07-25 19:00Z | USDC@Base | 54.7 | -1.8 | 主池 54.7bps 但副池 -1.8bps → 疑似坏点，已拦截 |
| 2026-07-25 21:00Z | PYUSD@Solana | 216.9 | -39 | 主池 216.9bps 但副池 -39.0bps → 疑似坏点，已拦截 |
| 2026-07-26 02:00Z | PYUSD@Solana | -243 | 32.2 | 主池 -243.0bps 但副池 32.2bps → 疑似坏点，已拦截 |
| 2026-07-26 02:00Z | USDG@Solana | -548.4 | 22.1 | 主池 -548.4bps 但副池 22.1bps → 疑似坏点，已拦截 |
| 2026-07-26 03:00Z | USDT@BSC | -57.7 | -11.1 | 主池 -57.7bps 但副池 -11.1bps → 疑似坏点，已拦截 |
| 2026-07-26 03:00Z | USDC@Base | 50.2 | -12.7 | 主池 50.2bps 但副池 -12.7bps → 疑似坏点，已拦截 |
| 2026-07-26 05:00Z | USDe@Ethereum | -72.6 | -0.1 | 主池 -72.6bps 但副池 -0.1bps → 疑似坏点，已拦截 |
| 2026-07-26 06:00Z | PYUSD@Solana | -106.2 | 1.5 | 主池 -106.2bps 但副池 1.5bps → 疑似坏点，已拦截 |
| 2026-07-26 11:00Z | USDT@BSC | -55.9 | -9.8 | 主池 -55.9bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-07-26 15:00Z | PYUSD@Ethereum | 86.1 | -6 | 主池 86.1bps 但副池 -6.0bps → 疑似坏点，已拦截 |
| 2026-07-26 17:00Z | USDT@BSC | -50.7 | -11.1 | 主池 -50.7bps 但副池 -11.1bps → 疑似坏点，已拦截 |
| 2026-07-27 00:00Z | USDT@BSC | -54.1 | -11.4 | 主池 -54.1bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-07-27 06:00Z | USDT@BSC | -53.1 | -9.5 | 主池 -53.1bps 但副池 -9.5bps → 疑似坏点，已拦截 |
| 2026-07-27 06:00Z | USDC@Base | -64.3 | -24.5 | 主池 -64.3bps 但副池 -24.5bps → 疑似坏点，已拦截 |
| 2026-07-27 12:00Z | PYUSD@Solana | -151.3 | 51.8 | 主池 -151.3bps 但副池 51.8bps → 疑似坏点，已拦截 |
| 2026-07-27 15:00Z | USDT@BSC | -51.7 | -10.8 | 主池 -51.7bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-07-28 03:00Z | PYUSD@Solana | 167.2 | -5.8 | 主池 167.2bps 但副池 -5.8bps → 疑似坏点，已拦截 |
| 2026-07-28 04:00Z | USDT@BSC | -51.2 | -7.3 | 主池 -51.2bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-07-28 10:00Z | PYUSD@Solana | -62.6 | 3.6 | 主池 -62.6bps 但副池 3.6bps → 疑似坏点，已拦截 |
| 2026-07-28 15:00Z | PYUSD@Ethereum | 158.2 | 2.2 | 主池 158.2bps 但副池 2.2bps → 疑似坏点，已拦截 |
| 2026-07-28 22:00Z | USDS@Ethereum | -55.6 | 3.6 | 主池 -55.6bps 但副池 3.6bps → 疑似坏点，已拦截 |
| 2026-07-29 01:00Z | USDT@BSC | -54.4 | -9.9 | 主池 -54.4bps 但副池 -9.9bps → 疑似坏点，已拦截 |
| 2026-07-29 03:00Z | USDT@BSC | -59.3 | -17.5 | 主池 -59.3bps 但副池 -17.5bps → 疑似坏点，已拦截 |
| 2026-07-29 07:00Z | PYUSD@Solana | -144.5 | -5.3 | 主池 -144.5bps 但副池 -5.3bps → 疑似坏点，已拦截 |
| 2026-07-29 09:00Z | PYUSD@Solana | -94.3 | 8 | 主池 -94.3bps 但副池 8.0bps → 疑似坏点，已拦截 |
| 2026-07-29 10:00Z | USDT@BSC | -54.9 | -16 | 主池 -54.9bps 但副池 -16.0bps → 疑似坏点，已拦截 |
| 2026-07-29 15:00Z | USDC@Base | -50.4 | 2.7 | 主池 -50.4bps 但副池 2.7bps → 疑似坏点，已拦截 |
| 2026-07-29 19:00Z | PYUSD@Ethereum | -58.4 | -8.8 | 主池 -58.4bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-07-29 20:00Z | USDS@Ethereum | -52.1 | -20.2 | 主池 -52.1bps 但副池 -20.2bps → 疑似坏点，已拦截 |
| 2026-07-29 22:00Z | PYUSD@Ethereum | 82.1 | -4.4 | 主池 82.1bps 但副池 -4.4bps → 疑似坏点，已拦截 |
| 2026-07-30 03:00Z | PYUSD@Solana | 62.2 | -49.9 | 主池 62.2bps 但副池 -49.9bps → 疑似坏点，已拦截 |
| 2026-07-30 23:00Z | USDT@BSC | -51.9 | -2.6 | 主池 -51.9bps 但副池 -2.6bps → 疑似坏点，已拦截 |
| 2026-07-31 00:00Z | PYUSD@Solana | 159.6 | 24.2 | 主池 159.6bps 但副池 24.2bps → 疑似坏点，已拦截 |
| 2026-07-31 01:00Z | PYUSD@Ethereum | -58 | -9 | 主池 -58.0bps 但副池 -9.0bps → 疑似坏点，已拦截 |
| 2026-07-31 11:00Z | USDS@Ethereum | -54.8 | -18.3 | 主池 -54.8bps 但副池 -18.3bps → 疑似坏点，已拦截 |
| 2026-07-31 13:00Z | PYUSD@Ethereum | -81.8 | -0.8 | 主池 -81.8bps 但副池 -0.8bps → 疑似坏点，已拦截 |
| 2026-07-31 23:00Z | USDT@BSC | -54.6 | -9 | 主池 -54.6bps 但副池 -9.0bps → 疑似坏点，已拦截 |
| 2026-08-01 00:00Z | USDT@BSC | -57.4 | -13.3 | 主池 -57.4bps 但副池 -13.3bps → 疑似坏点，已拦截 |
| 2026-08-01 02:00Z | USDT@BSC | -60.1 | -11 | 主池 -60.1bps 但副池 -11.0bps → 疑似坏点，已拦截 |
| 2026-08-01 05:00Z | USDT@BSC | -58.7 | -10.9 | 主池 -58.7bps 但副池 -10.9bps → 疑似坏点，已拦截 |
| 2026-08-01 12:00Z | USDT@BSC | -56.5 | -11.6 | 主池 -56.5bps 但副池 -11.6bps → 疑似坏点，已拦截 |
| 2026-08-01 15:00Z | USDT@BSC | -52.5 | -8.9 | 主池 -52.5bps 但副池 -8.9bps → 疑似坏点，已拦截 |
| 2026-08-01 22:00Z | USDT@BSC | -57.7 | -13.6 | 主池 -57.7bps 但副池 -13.6bps → 疑似坏点，已拦截 |
| 2026-08-01 23:00Z | USDT@BSC | -54.8 | -8.2 | 主池 -54.8bps 但副池 -8.2bps → 疑似坏点，已拦截 |
| 2026-08-02 04:00Z | USDT@BSC | -54.2 | -9.4 | 主池 -54.2bps 但副池 -9.4bps → 疑似坏点，已拦截 |
| 2026-08-02 06:00Z | USDT@BSC | -54.7 | -11.3 | 主池 -54.7bps 但副池 -11.3bps → 疑似坏点，已拦截 |
| 2026-08-02 08:00Z | USDT@BSC | -54.8 | -8.6 | 主池 -54.8bps 但副池 -8.6bps → 疑似坏点，已拦截 |
| 2026-08-02 08:00Z | USDS@Ethereum | -57.8 | 5.5 | 主池 -57.8bps 但副池 5.5bps → 疑似坏点，已拦截 |
| 2026-08-02 13:00Z | USDT@BSC | -56.3 | -8.6 | 主池 -56.3bps 但副池 -8.6bps → 疑似坏点，已拦截 |
| 2026-08-02 15:00Z | USDT@BSC | -55.4 | -10.9 | 主池 -55.4bps 但副池 -10.9bps → 疑似坏点，已拦截 |
| 2026-08-02 18:00Z | PYUSD@Ethereum | 53.2 | -8.3 | 主池 53.2bps 但副池 -8.3bps → 疑似坏点，已拦截 |
| 2026-08-02 22:00Z | USDS@Ethereum | -66.1 | 13.4 | 主池 -66.1bps 但副池 13.4bps → 疑似坏点，已拦截 |
| 2026-08-03 01:00Z | USDC@Base | -54.9 | 3.6 | 主池 -54.9bps 但副池 3.6bps → 疑似坏点，已拦截 |
| 2026-08-03 02:00Z | USDT@BSC | -57.8 | -16.8 | 主池 -57.8bps 但副池 -16.8bps → 疑似坏点，已拦截 |
| 2026-08-03 04:00Z | USDT@BSC | -51.3 | -8.8 | 主池 -51.3bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-08-03 10:00Z | USDT@BSC | -52.3 | -13.5 | 主池 -52.3bps 但副池 -13.5bps → 疑似坏点，已拦截 |
| 2026-08-03 10:00Z | USDS@Ethereum | -51.7 | 23.7 | 主池 -51.7bps 但副池 23.7bps → 疑似坏点，已拦截 |
| 2026-08-03 12:00Z | USDT@BSC | -61.3 | -12.4 | 主池 -61.3bps 但副池 -12.4bps → 疑似坏点，已拦截 |
| 2026-08-03 17:00Z | USDT@BSC | -55.4 | -10.8 | 主池 -55.4bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-08-04 00:00Z | USDS@Ethereum | -59.9 | -0.3 | 主池 -59.9bps 但副池 -0.3bps → 疑似坏点，已拦截 |
| 2026-08-04 01:00Z | PYUSD@Ethereum | 52.8 | 3.5 | 主池 52.8bps 但副池 3.5bps → 疑似坏点，已拦截 |
| 2026-08-04 03:00Z | USDe@Solana | -60.2 | -24.9 | 主池 -60.2bps 但副池 -24.9bps → 疑似坏点，已拦截 |
| 2026-08-04 23:00Z | USDC@Base | -57.1 | -6.1 | 主池 -57.1bps 但副池 -6.1bps → 疑似坏点，已拦截 |
| 2026-08-05 03:00Z | USDC@Base | -55.2 | 11 | 主池 -55.2bps 但副池 11.0bps → 疑似坏点，已拦截 |
| 2026-08-05 04:00Z | USDC@Base | -51.1 | 10.7 | 主池 -51.1bps 但副池 10.7bps → 疑似坏点，已拦截 |
| 2026-08-05 06:00Z | USDT@BSC | -53.9 | -9.2 | 主池 -53.9bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-08-05 07:00Z | USDT@BSC | -58.3 | -16.7 | 主池 -58.3bps 但副池 -16.7bps → 疑似坏点，已拦截 |
| 2026-08-05 08:00Z | USDT@BSC | -54.1 | -5.1 | 主池 -54.1bps 但副池 -5.1bps → 疑似坏点，已拦截 |
| 2026-08-05 11:00Z | USDT@BSC | -59.5 | -8.3 | 主池 -59.5bps 但副池 -8.3bps → 疑似坏点，已拦截 |
| 2026-08-05 11:00Z | USDC@Base | 84.5 | -37.5 | 主池 84.5bps 但副池 -37.5bps → 疑似坏点，已拦截 |
| 2026-08-05 13:00Z | USDT@BSC | -58.8 | -13.4 | 主池 -58.8bps 但副池 -13.4bps → 疑似坏点，已拦截 |
| 2026-08-06 06:00Z | USDT@BSC | -57.3 | -13 | 主池 -57.3bps 但副池 -13.0bps → 疑似坏点，已拦截 |
| 2026-08-06 07:00Z | USDT@BSC | -52.7 | -7.1 | 主池 -52.7bps 但副池 -7.1bps → 疑似坏点，已拦截 |
| 2026-08-06 10:00Z | USDT@BSC | -58.6 | -10.9 | 主池 -58.6bps 但副池 -10.9bps → 疑似坏点，已拦截 |
| 2026-08-06 13:00Z | USDT@BSC | -53.2 | -7.7 | 主池 -53.2bps 但副池 -7.7bps → 疑似坏点，已拦截 |
| 2026-08-06 13:00Z | PYUSD@Ethereum | 62.1 | 2.7 | 主池 62.1bps 但副池 2.7bps → 疑似坏点，已拦截 |
| 2026-08-06 15:00Z | USDT@BSC | -50.9 | -1.8 | 主池 -50.9bps 但副池 -1.8bps → 疑似坏点，已拦截 |
| 2026-08-06 16:00Z | USDT@BSC | -61.1 | -14.7 | 主池 -61.1bps 但副池 -14.7bps → 疑似坏点，已拦截 |
| 2026-08-07 04:00Z | USDT@BSC | -61.2 | -17.5 | 主池 -61.2bps 但副池 -17.5bps → 疑似坏点，已拦截 |
| 2026-08-07 06:00Z | USDT@BSC | -54.9 | -11.6 | 主池 -54.9bps 但副池 -11.6bps → 疑似坏点，已拦截 |
| 2026-08-07 11:00Z | USDC@Base | 53.2 | -24.4 | 主池 53.2bps 但副池 -24.4bps → 疑似坏点，已拦截 |
| 2026-08-07 16:00Z | USDT@BSC | -53.7 | -5.6 | 主池 -53.7bps 但副池 -5.6bps → 疑似坏点，已拦截 |
| 2026-08-07 19:00Z | USDT@BSC | -52.8 | -8.4 | 主池 -52.8bps 但副池 -8.4bps → 疑似坏点，已拦截 |
| 2026-08-08 00:00Z | USDT@BSC | -52.4 | -7.7 | 主池 -52.4bps 但副池 -7.7bps → 疑似坏点，已拦截 |
| 2026-08-08 03:00Z | USDT@BSC | -53.8 | -5.9 | 主池 -53.8bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-08-08 11:00Z | USDC@Solana | -72.8 | 6.1 | 主池 -72.8bps 但副池 6.1bps → 疑似坏点，已拦截 |
| 2026-08-09 02:00Z | USDT@BSC | -53 | -9.8 | 主池 -53.0bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-08-09 03:00Z | USDC@Base | -51.3 | 6.3 | 主池 -51.3bps 但副池 6.3bps → 疑似坏点，已拦截 |
| 2026-08-09 04:00Z | USDC@Base | -54.6 | 10.4 | 主池 -54.6bps 但副池 10.4bps → 疑似坏点，已拦截 |
| 2026-08-09 08:00Z | USDS@Ethereum | -55.1 | -13.6 | 主池 -55.1bps 但副池 -13.6bps → 疑似坏点，已拦截 |
| 2026-08-09 11:00Z | USDT@BSC | -50.6 | -5.8 | 主池 -50.6bps 但副池 -5.8bps → 疑似坏点，已拦截 |
| 2026-08-09 14:00Z | USDT@BSC | -51.9 | -8.2 | 主池 -51.9bps 但副池 -8.2bps → 疑似坏点，已拦截 |
| 2026-08-09 19:00Z | USDT@BSC | -53.4 | -4.5 | 主池 -53.4bps 但副池 -4.5bps → 疑似坏点，已拦截 |
| 2026-08-10 09:00Z | PYUSD@Ethereum | -51.7 | -6.9 | 主池 -51.7bps 但副池 -6.9bps → 疑似坏点，已拦截 |
| 2026-08-10 13:00Z | USDS@Ethereum | -52 | 10.3 | 主池 -52.0bps 但副池 10.3bps → 疑似坏点，已拦截 |
| 2026-08-10 13:00Z | PYUSD@Ethereum | -53.7 | 0.8 | 主池 -53.7bps 但副池 0.8bps → 疑似坏点，已拦截 |
| 2026-08-10 19:00Z | USDT@BSC | -58.1 | -12.5 | 主池 -58.1bps 但副池 -12.5bps → 疑似坏点，已拦截 |
| 2026-08-10 23:00Z | PYUSD@Solana | -59.6 | -6.3 | 主池 -59.6bps 但副池 -6.3bps → 疑似坏点，已拦截 |
| 2026-08-11 14:00Z | USDC@Base | 53.9 | 5.8 | 主池 53.9bps 但副池 5.8bps → 疑似坏点，已拦截 |
| 2026-08-12 02:00Z | USDT@BSC | -56.7 | -17.2 | 主池 -56.7bps 但副池 -17.2bps → 疑似坏点，已拦截 |
| 2026-08-12 08:00Z | USDG@Solana | -51.6 | 14 | 主池 -51.6bps 但副池 14.0bps → 疑似坏点，已拦截 |
| 2026-08-12 09:00Z | PYUSD@Ethereum | 76.6 | -3.8 | 主池 76.6bps 但副池 -3.8bps → 疑似坏点，已拦截 |
| 2026-08-12 10:00Z | USDT@BSC | -56.9 | -10 | 主池 -56.9bps 但副池 -10.0bps → 疑似坏点，已拦截 |
| 2026-08-12 13:00Z | USDS@Ethereum | -54.5 | 4.3 | 主池 -54.5bps 但副池 4.3bps → 疑似坏点，已拦截 |
| 2026-08-12 14:00Z | USDT@BSC | -50.4 | -8.5 | 主池 -50.4bps 但副池 -8.5bps → 疑似坏点，已拦截 |
| 2026-08-12 17:00Z | USDS@Ethereum | -52.4 | 8.5 | 主池 -52.4bps 但副池 8.5bps → 疑似坏点，已拦截 |
| 2026-08-12 20:00Z | USDG@Solana | -63.3 | 8.3 | 主池 -63.3bps 但副池 8.3bps → 疑似坏点，已拦截 |
| 2026-08-13 03:00Z | USDC@Base | 51.1 | 0.3 | 主池 51.1bps 但副池 0.3bps → 疑似坏点，已拦截 |
| 2026-08-13 11:00Z | USDT@BSC | -51.2 | -10.2 | 主池 -51.2bps 但副池 -10.2bps → 疑似坏点，已拦截 |
| 2026-08-13 13:00Z | USDT@BSC | -52.8 | -10.8 | 主池 -52.8bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-08-13 16:00Z | PYUSD@Solana | -54.2 | 5.1 | 主池 -54.2bps 但副池 5.1bps → 疑似坏点，已拦截 |
| 2026-08-14 05:00Z | USDT@BSC | -50.1 | -3.6 | 主池 -50.1bps 但副池 -3.6bps → 疑似坏点，已拦截 |
| 2026-08-14 12:00Z | USDT@BSC | -56.2 | -13.5 | 主池 -56.2bps 但副池 -13.5bps → 疑似坏点，已拦截 |
| 2026-08-14 18:00Z | USDS@Ethereum | -63.1 | 11.1 | 主池 -63.1bps 但副池 11.1bps → 疑似坏点，已拦截 |
| 2026-08-14 19:00Z | USDT@Solana | -56.7 | -7.8 | 主池 -56.7bps 但副池 -7.8bps → 疑似坏点，已拦截 |
| 2026-08-15 00:00Z | USDC@Arbitrum | 57.1 | -6.2 | 主池 57.1bps 但副池 -6.2bps → 疑似坏点，已拦截 |
| 2026-08-15 01:00Z | USDT@Solana | -56.4 | -5.5 | 主池 -56.4bps 但副池 -5.5bps → 疑似坏点，已拦截 |
| 2026-08-15 04:00Z | USDT@BSC | -53.4 | -11.4 | 主池 -53.4bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-08-15 05:00Z | USDT@BSC | -55.2 | -12.5 | 主池 -55.2bps 但副池 -12.5bps → 疑似坏点，已拦截 |
| 2026-08-15 07:00Z | USDT@BSC | -50.5 | -15.6 | 主池 -50.5bps 但副池 -15.6bps → 疑似坏点，已拦截 |
| 2026-08-15 13:00Z | USDC@Ethereum | 93.5 | 4.8 | 主池 93.5bps 但副池 4.8bps → 疑似坏点，已拦截 |
| 2026-08-15 18:00Z | USDT@BSC | -59.7 | -10.5 | 主池 -59.7bps 但副池 -10.5bps → 疑似坏点，已拦截 |
| 2026-08-15 19:00Z | USDT@BSC | -58.8 | -12.6 | 主池 -58.8bps 但副池 -12.6bps → 疑似坏点，已拦截 |
| 2026-08-15 21:00Z | USDT@BSC | -54.4 | -10.3 | 主池 -54.4bps 但副池 -10.3bps → 疑似坏点，已拦截 |
| 2026-08-15 22:00Z | USDT@BSC | -60.9 | -11.8 | 主池 -60.9bps 但副池 -11.8bps → 疑似坏点，已拦截 |
| 2026-08-15 23:00Z | USDT@BSC | -56.6 | -10.8 | 主池 -56.6bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-08-16 03:00Z | USDC@Solana | -74.6 | -15.4 | 主池 -74.6bps 但副池 -15.4bps → 疑似坏点，已拦截 |
| 2026-08-16 05:00Z | USDT@BSC | -51 | -10.4 | 主池 -51.0bps 但副池 -10.4bps → 疑似坏点，已拦截 |
| 2026-08-16 11:00Z | USDT@BSC | -56.1 | -10.6 | 主池 -56.1bps 但副池 -10.6bps → 疑似坏点，已拦截 |
| 2026-08-16 18:00Z | USDT@BSC | -57.3 | -9.9 | 主池 -57.3bps 但副池 -9.9bps → 疑似坏点，已拦截 |
| 2026-08-16 20:00Z | USDT@BSC | -51.6 | -15.5 | 主池 -51.6bps 但副池 -15.5bps → 疑似坏点，已拦截 |
| 2026-08-17 01:00Z | USDT@BSC | -53 | -6.8 | 主池 -53.0bps 但副池 -6.8bps → 疑似坏点，已拦截 |
| 2026-08-17 02:00Z | USDS@Solana | -51.5 | -5.1 | 主池 -51.5bps 但副池 -5.1bps → 疑似坏点，已拦截 |
| 2026-08-17 03:00Z | USDT@Solana | -53.1 | -17.8 | 主池 -53.1bps 但副池 -17.8bps → 疑似坏点，已拦截 |
| 2026-08-17 06:00Z | USDT@BSC | -53.2 | -8.2 | 主池 -53.2bps 但副池 -8.2bps → 疑似坏点，已拦截 |
| 2026-08-17 07:00Z | USDT@BSC | -59 | -10.5 | 主池 -59.0bps 但副池 -10.5bps → 疑似坏点，已拦截 |
| 2026-08-17 12:00Z | USDT@BSC | -59.2 | -11.7 | 主池 -59.2bps 但副池 -11.7bps → 疑似坏点，已拦截 |
| 2026-08-17 12:00Z | USDS@Ethereum | -58.4 | 16.2 | 主池 -58.4bps 但副池 16.2bps → 疑似坏点，已拦截 |
| 2026-08-17 14:00Z | USDT@BSC | -54.7 | -20.2 | 主池 -54.7bps 但副池 -20.2bps → 疑似坏点，已拦截 |
| 2026-08-17 15:00Z | USDT@BSC | -57.6 | -8.1 | 主池 -57.6bps 但副池 -8.1bps → 疑似坏点，已拦截 |
| 2026-08-17 17:00Z | USDT@BSC | -51.4 | -9.3 | 主池 -51.4bps 但副池 -9.3bps → 疑似坏点，已拦截 |
| 2026-08-17 18:00Z | USDT@BSC | -59.9 | -9.8 | 主池 -59.9bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-08-18 01:00Z | PYUSD@Solana | 70.3 | -54.3 | 主池 70.3bps 但副池 -54.3bps → 疑似坏点，已拦截 |
| 2026-08-18 03:00Z | USD1@Ethereum | -58.4 | -2.4 | 主池 -58.4bps 但副池 -2.4bps → 疑似坏点，已拦截 |
| 2026-08-18 04:00Z | USDT@BSC | -56.3 | -12.3 | 主池 -56.3bps 但副池 -12.3bps → 疑似坏点，已拦截 |
| 2026-08-18 05:00Z | USDT@BSC | -51.9 | -13.4 | 主池 -51.9bps 但副池 -13.4bps → 疑似坏点，已拦截 |
| 2026-08-18 06:00Z | USDT@BSC | -59 | -11.4 | 主池 -59.0bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-08-18 08:00Z | USDT@BSC | -55.3 | -7.4 | 主池 -55.3bps 但副池 -7.4bps → 疑似坏点，已拦截 |
| 2026-08-18 13:00Z | USDT@BSC | -57.6 | -10.9 | 主池 -57.6bps 但副池 -10.9bps → 疑似坏点，已拦截 |
| 2026-08-18 15:00Z | USDT@BSC | -53.7 | -8.8 | 主池 -53.7bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-08-18 16:00Z | USDT@BSC | -54.5 | -7.5 | 主池 -54.5bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-08-18 17:00Z | USDS@Ethereum | -57 | 15.3 | 主池 -57.0bps 但副池 15.3bps → 疑似坏点，已拦截 |
| 2026-08-18 18:00Z | USDT@BSC | -52.8 | -7.9 | 主池 -52.8bps 但副池 -7.9bps → 疑似坏点，已拦截 |
| 2026-08-18 18:00Z | USDC@Base | -54.3 | 33 | 主池 -54.3bps 但副池 33.0bps → 疑似坏点，已拦截 |
| 2026-08-19 00:00Z | USDG@Solana | 64.6 | 10.5 | 主池 64.6bps 但副池 10.5bps → 疑似坏点，已拦截 |
| 2026-08-19 05:00Z | USDT@BSC | -52.6 | -9.7 | 主池 -52.6bps 但副池 -9.7bps → 疑似坏点，已拦截 |
| 2026-08-19 06:00Z | USDT@Solana | -53.6 | -21.1 | 主池 -53.6bps 但副池 -21.1bps → 疑似坏点，已拦截 |
| 2026-08-19 06:00Z | USDT@BSC | -50.5 | -13.2 | 主池 -50.5bps 但副池 -13.2bps → 疑似坏点，已拦截 |
| 2026-08-19 07:00Z | USDT@BSC | -52.5 | -7 | 主池 -52.5bps 但副池 -7.0bps → 疑似坏点，已拦截 |
| 2026-08-19 08:00Z | USDT@BSC | -54.3 | -7.6 | 主池 -54.3bps 但副池 -7.6bps → 疑似坏点，已拦截 |
| 2026-08-19 09:00Z | USDT@BSC | -54.5 | -8.6 | 主池 -54.5bps 但副池 -8.6bps → 疑似坏点，已拦截 |
| 2026-08-19 10:00Z | USDT@BSC | -55.2 | -9.5 | 主池 -55.2bps 但副池 -9.5bps → 疑似坏点，已拦截 |
| 2026-08-19 14:00Z | USDe@Ethereum | -66.1 | -10.8 | 主池 -66.1bps 但副池 -10.8bps → 疑似坏点，已拦截 |
| 2026-08-19 15:00Z | USDe@Ethereum | -123 | -4 | 主池 -123.0bps 但副池 -4.0bps → 疑似坏点，已拦截 |
| 2026-08-19 15:00Z | USD1@Ethereum | -92.7 | 22.8 | 主池 -92.7bps 但副池 22.8bps → 疑似坏点，已拦截 |
| 2026-08-19 16:00Z | USDC@Solana | 50.9 | 21.3 | 主池 50.9bps 但副池 21.3bps → 疑似坏点，已拦截 |
| 2026-08-19 20:00Z | USDT@Arbitrum | 125.5 | -176.7 | 主池 125.5bps 但副池 -176.7bps → 疑似坏点，已拦截 |
| 2026-08-19 20:00Z | USDC@Base | 125.7 | -45.9 | 主池 125.7bps 但副池 -45.9bps → 疑似坏点，已拦截 |
| 2026-08-19 20:00Z | PYUSD@Ethereum | 356.8 | 6.9 | 主池 356.8bps 但副池 6.9bps → 疑似坏点，已拦截 |
| 2026-08-19 21:00Z | USD1@Ethereum | 233.8 | -18.9 | 主池 233.8bps 但副池 -18.9bps → 疑似坏点，已拦截 |
| 2026-08-19 21:00Z | PYUSD@Ethereum | -89.7 | -21.3 | 主池 -89.7bps 但副池 -21.3bps → 疑似坏点，已拦截 |
| 2026-08-19 22:00Z | USDC@Base | 51.7 | 6.6 | 主池 51.7bps 但副池 6.6bps → 疑似坏点，已拦截 |
| 2026-08-19 22:00Z | USDG@Solana | -52.6 | -24.1 | 主池 -52.6bps 但副池 -24.1bps → 疑似坏点，已拦截 |
| 2026-08-20 01:00Z | USDC@Base | 53.5 | 2.3 | 主池 53.5bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-08-20 06:00Z | PYUSD@Ethereum | 105.3 | 9.3 | 主池 105.3bps 但副池 9.3bps → 疑似坏点，已拦截 |
| 2026-08-20 07:00Z | USDC@Base | -52.3 | 17.7 | 主池 -52.3bps 但副池 17.7bps → 疑似坏点，已拦截 |
| 2026-08-20 08:00Z | PYUSD@Solana | 82.3 | 10.6 | 主池 82.3bps 但副池 10.6bps → 疑似坏点，已拦截 |
| 2026-08-20 10:00Z | USDT@BSC | -55.7 | -14.6 | 主池 -55.7bps 但副池 -14.6bps → 疑似坏点，已拦截 |
| 2026-08-20 10:00Z | USDC@Base | -56.2 | 5 | 主池 -56.2bps 但副池 5.0bps → 疑似坏点，已拦截 |
| 2026-08-20 12:00Z | USDT@Solana | -51 | 1.7 | 主池 -51.0bps 但副池 1.7bps → 疑似坏点，已拦截 |
| 2026-08-20 15:00Z | USD1@Ethereum | 55.2 | 11.2 | 主池 55.2bps 但副池 11.2bps → 疑似坏点，已拦截 |
| 2026-08-20 19:00Z | PYUSD@Ethereum | 51.8 | 1.4 | 主池 51.8bps 但副池 1.4bps → 疑似坏点，已拦截 |
| 2026-08-20 23:00Z | USDT@BSC | -51 | -1 | 主池 -51.0bps 但副池 -1.0bps → 疑似坏点，已拦截 |
| 2026-08-21 02:00Z | USDT@BSC | -51.6 | -6.2 | 主池 -51.6bps 但副池 -6.2bps → 疑似坏点，已拦截 |
| 2026-08-21 08:00Z | USDC@Base | -118.2 | 92.2 | 主池 -118.2bps 但副池 92.2bps → 疑似坏点，已拦截 |
| 2026-08-21 18:00Z | PYUSD@Solana | -56 | -2.7 | 主池 -56.0bps 但副池 -2.7bps → 疑似坏点，已拦截 |
| 2026-08-21 21:00Z | PYUSD@Ethereum | 99.6 | -3.6 | 主池 99.6bps 但副池 -3.6bps → 疑似坏点，已拦截 |
| 2026-08-21 23:00Z | USDS@Solana | 51.2 | 2.9 | 主池 51.2bps 但副池 2.9bps → 疑似坏点，已拦截 |
| 2026-08-22 02:00Z | USDS@Ethereum | 50.6 | -2.5 | 主池 50.6bps 但副池 -2.5bps → 疑似坏点，已拦截 |
| 2026-08-22 02:00Z | USD1@Ethereum | -56.8 | -10.7 | 主池 -56.8bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-08-22 05:00Z | USD1@Ethereum | 52.3 | 24.4 | 主池 52.3bps 但副池 24.4bps → 疑似坏点，已拦截 |
| 2026-08-22 10:00Z | PYUSD@Solana | -50.1 | -1.2 | 主池 -50.1bps 但副池 -1.2bps → 疑似坏点，已拦截 |
| 2026-08-22 17:00Z | USDC@Base | 51.6 | -1.5 | 主池 51.6bps 但副池 -1.5bps → 疑似坏点，已拦截 |
| 2026-08-22 18:00Z | USDG@Solana | -121.4 | -23.7 | 主池 -121.4bps 但副池 -23.7bps → 疑似坏点，已拦截 |
| 2026-08-23 00:00Z | USDS@Ethereum | -54.8 | 4.7 | 主池 -54.8bps 但副池 4.7bps → 疑似坏点，已拦截 |
| 2026-08-23 04:00Z | USDe@Ethereum | 75.3 | 21.2 | 主池 75.3bps 但副池 21.2bps → 疑似坏点，已拦截 |
| 2026-08-23 05:00Z | USDG@Solana | -86.7 | 7.9 | 主池 -86.7bps 但副池 7.9bps → 疑似坏点，已拦截 |
| 2026-08-23 07:00Z | USDG@Solana | 51.6 | 19.1 | 主池 51.6bps 但副池 19.1bps → 疑似坏点，已拦截 |
| 2026-08-23 14:00Z | USDC@Base | 73.5 | -29.9 | 主池 73.5bps 但副池 -29.9bps → 疑似坏点，已拦截 |
| 2026-08-23 14:00Z | PYUSD@Ethereum | -113.2 | -4.2 | 主池 -113.2bps 但副池 -4.2bps → 疑似坏点，已拦截 |
| 2026-08-23 15:00Z | USDC@Base | 54.3 | -26.8 | 主池 54.3bps 但副池 -26.8bps → 疑似坏点，已拦截 |
| 2026-08-23 22:00Z | USDC@Base | -54.8 | 15 | 主池 -54.8bps 但副池 15.0bps → 疑似坏点，已拦截 |
| 2026-08-24 00:00Z | USDe@Solana | -57.5 | 2.9 | 主池 -57.5bps 但副池 2.9bps → 疑似坏点，已拦截 |
| 2026-08-24 04:00Z | PYUSD@Ethereum | -53.7 | -5 | 主池 -53.7bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-08-24 09:00Z | USDC@Base | 56.6 | -2.4 | 主池 56.6bps 但副池 -2.4bps → 疑似坏点，已拦截 |
| 2026-08-24 11:00Z | PYUSD@Ethereum | 87.4 | -5 | 主池 87.4bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-08-24 15:00Z | USDC@Base | -51.5 | 12.9 | 主池 -51.5bps 但副池 12.9bps → 疑似坏点，已拦截 |
| 2026-08-24 22:00Z | USDS@Ethereum | -50.5 | 23.3 | 主池 -50.5bps 但副池 23.3bps → 疑似坏点，已拦截 |
| 2026-08-24 23:00Z | USDC@Base | 51.1 | -32 | 主池 51.1bps 但副池 -32.0bps → 疑似坏点，已拦截 |
| 2026-08-25 06:00Z | USDS@Ethereum | -55.3 | 11.7 | 主池 -55.3bps 但副池 11.7bps → 疑似坏点，已拦截 |
| 2026-08-25 09:00Z | PYUSD@Ethereum | -62 | 4 | 主池 -62.0bps 但副池 4.0bps → 疑似坏点，已拦截 |
| 2026-08-25 19:00Z | USDG@Solana | 51 | 10.7 | 主池 51.0bps 但副池 10.7bps → 疑似坏点，已拦截 |
| 2026-08-25 21:00Z | USDS@Ethereum | 50.4 | -8.8 | 主池 50.4bps 但副池 -8.8bps → 疑似坏点，已拦截 |
| 2026-08-27 04:00Z | USDS@Ethereum | -52.2 | 2.3 | 主池 -52.2bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-08-27 09:00Z | PYUSD@Ethereum | -53.4 | -7 | 主池 -53.4bps 但副池 -7.0bps → 疑似坏点，已拦截 |
| 2026-08-27 13:00Z | USDC@Solana | -50.8 | -13.7 | 主池 -50.8bps 但副池 -13.7bps → 疑似坏点，已拦截 |
| 2026-08-27 14:00Z | USD1@Ethereum | -50.6 | 19 | 主池 -50.6bps 但副池 19.0bps → 疑似坏点，已拦截 |
| 2026-08-27 14:00Z | RLUSD@Ethereum | 63.8 | -7.9 | 主池 63.8bps 但副池 -7.9bps → 疑似坏点，已拦截 |
| 2026-08-27 15:00Z | RLUSD@Ethereum | 96.5 | -1.2 | 主池 96.5bps 但副池 -1.2bps → 疑似坏点，已拦截 |
| 2026-08-27 16:00Z | USDC@Base | 53 | 13.2 | 主池 53.0bps 但副池 13.2bps → 疑似坏点，已拦截 |
| 2026-08-27 18:00Z | RLUSD@Ethereum | -84.4 | -7.9 | 主池 -84.4bps 但副池 -7.9bps → 疑似坏点，已拦截 |
| 2026-08-28 00:00Z | USDS@Ethereum | 55.3 | -11.5 | 主池 55.3bps 但副池 -11.5bps → 疑似坏点，已拦截 |
| 2026-08-28 06:00Z | RLUSD@Ethereum | 66.3 | 10 | 主池 66.3bps 但副池 10.0bps → 疑似坏点，已拦截 |
| 2026-08-28 13:00Z | RLUSD@Ethereum | 53.3 | -5.4 | 主池 53.3bps 但副池 -5.4bps → 疑似坏点，已拦截 |
| 2026-08-28 14:00Z | RLUSD@Ethereum | 67.2 | 22.9 | 主池 67.2bps 但副池 22.9bps → 疑似坏点，已拦截 |
| 2026-08-28 15:00Z | PYUSD@Ethereum | -135.7 | 2 | 主池 -135.7bps 但副池 2.0bps → 疑似坏点，已拦截 |
| 2026-08-28 15:00Z | RLUSD@Ethereum | -148.1 | 18.2 | 主池 -148.1bps 但副池 18.2bps → 疑似坏点，已拦截 |
| 2026-08-28 18:00Z | PYUSD@Ethereum | -58.6 | 5.9 | 主池 -58.6bps 但副池 5.9bps → 疑似坏点，已拦截 |
| 2026-08-28 18:00Z | RLUSD@Ethereum | -62.7 | -16.7 | 主池 -62.7bps 但副池 -16.7bps → 疑似坏点，已拦截 |
| 2026-08-28 22:00Z | RLUSD@Ethereum | 65.8 | 0.5 | 主池 65.8bps 但副池 0.5bps → 疑似坏点，已拦截 |
| 2026-08-29 04:00Z | USDC@Base | -52.6 | -19.7 | 主池 -52.6bps 但副池 -19.7bps → 疑似坏点，已拦截 |
| 2026-08-29 05:00Z | PYUSD@Solana | 50.2 | -41.4 | 主池 50.2bps 但副池 -41.4bps → 疑似坏点，已拦截 |
| 2026-08-29 14:00Z | RLUSD@Ethereum | 50.3 | -0.2 | 主池 50.3bps 但副池 -0.2bps → 疑似坏点，已拦截 |
| 2026-08-30 16:00Z | RLUSD@Ethereum | 139.8 | 7 | 主池 139.8bps 但副池 7.0bps → 疑似坏点，已拦截 |
| 2026-08-30 17:00Z | PYUSD@Ethereum | -70.5 | 2.5 | 主池 -70.5bps 但副池 2.5bps → 疑似坏点，已拦截 |
| 2026-08-30 17:00Z | RLUSD@Ethereum | -100.8 | 2.8 | 主池 -100.8bps 但副池 2.8bps → 疑似坏点，已拦截 |
| 2026-08-30 21:00Z | RLUSD@Ethereum | -101.3 | 7.7 | 主池 -101.3bps 但副池 7.7bps → 疑似坏点，已拦截 |
| 2026-08-30 22:00Z | RLUSD@Ethereum | -140.5 | -5.4 | 主池 -140.5bps 但副池 -5.4bps → 疑似坏点，已拦截 |
| 2026-08-30 23:00Z | USDT@Arbitrum | -58.9 | -4.3 | 主池 -58.9bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-08-30 23:00Z | USDC@Base | 91.8 | -46.6 | 主池 91.8bps 但副池 -46.6bps → 疑似坏点，已拦截 |
| 2026-08-30 23:00Z | PYUSD@Ethereum | -214.1 | -5.9 | 主池 -214.1bps 但副池 -5.9bps → 疑似坏点，已拦截 |
| 2026-08-30 23:00Z | RLUSD@Ethereum | -57 | -17.5 | 主池 -57.0bps 但副池 -17.5bps → 疑似坏点，已拦截 |
| 2026-08-31 02:00Z | USDC@Base | -56.1 | -1.2 | 主池 -56.1bps 但副池 -1.2bps → 疑似坏点，已拦截 |
| 2026-08-31 04:00Z | USDG@Solana | -177.1 | 20.6 | 主池 -177.1bps 但副池 20.6bps → 疑似坏点，已拦截 |
| 2026-08-31 09:00Z | USDT@BSC | -51 | -3.4 | 主池 -51.0bps 但副池 -3.4bps → 疑似坏点，已拦截 |
| 2026-08-31 10:00Z | USDe@Solana | -52.4 | -13.9 | 主池 -52.4bps 但副池 -13.9bps → 疑似坏点，已拦截 |
| 2026-08-31 10:00Z | USDG@Solana | 53.1 | 17.7 | 主池 53.1bps 但副池 17.7bps → 疑似坏点，已拦截 |
| 2026-08-31 13:00Z | RLUSD@Ethereum | -52.5 | -7 | 主池 -52.5bps 但副池 -7.0bps → 疑似坏点，已拦截 |
| 2026-08-31 17:00Z | USDC@Base | 52.7 | -12.7 | 主池 52.7bps 但副池 -12.7bps → 疑似坏点，已拦截 |
| 2026-08-31 22:00Z | USDC@Base | -56.7 | 4.6 | 主池 -56.7bps 但副池 4.6bps → 疑似坏点，已拦截 |
| 2026-08-31 22:00Z | USDS@Ethereum | -54.8 | 7.2 | 主池 -54.8bps 但副池 7.2bps → 疑似坏点，已拦截 |
| 2026-09-01 03:00Z | PYUSD@Solana | -52.6 | 26.3 | 主池 -52.6bps 但副池 26.3bps → 疑似坏点，已拦截 |
| 2026-09-01 12:00Z | PYUSD@Ethereum | -54.1 | -6.3 | 主池 -54.1bps 但副池 -6.3bps → 疑似坏点，已拦截 |
| 2026-09-01 16:00Z | RLUSD@Ethereum | -104.4 | -6.7 | 主池 -104.4bps 但副池 -6.7bps → 疑似坏点，已拦截 |
| 2026-09-01 18:00Z | RLUSD@Ethereum | -105.3 | 1 | 主池 -105.3bps 但副池 1.0bps → 疑似坏点，已拦截 |
| 2026-09-01 23:00Z | USDC@Solana | 52.2 | 0.1 | 主池 52.2bps 但副池 0.1bps → 疑似坏点，已拦截 |
| 2026-09-02 01:00Z | RLUSD@Ethereum | -91.4 | 6.4 | 主池 -91.4bps 但副池 6.4bps → 疑似坏点，已拦截 |
| 2026-09-02 07:00Z | RLUSD@Ethereum | 62.6 | -8 | 主池 62.6bps 但副池 -8.0bps → 疑似坏点，已拦截 |
| 2026-09-02 08:00Z | PYUSD@Ethereum | -98.5 | -3.2 | 主池 -98.5bps 但副池 -3.2bps → 疑似坏点，已拦截 |
| 2026-09-02 08:00Z | RLUSD@Ethereum | -68.1 | 7.3 | 主池 -68.1bps 但副池 7.3bps → 疑似坏点，已拦截 |
| 2026-09-02 09:00Z | PYUSD@Ethereum | -52.6 | 9 | 主池 -52.6bps 但副池 9.0bps → 疑似坏点，已拦截 |
| 2026-09-02 09:00Z | RLUSD@Ethereum | -208.3 | -9.1 | 主池 -208.3bps 但副池 -9.1bps → 疑似坏点，已拦截 |
| 2026-09-02 10:00Z | USDe@Solana | -72.1 | -15.8 | 主池 -72.1bps 但副池 -15.8bps → 疑似坏点，已拦截 |
| 2026-09-02 11:00Z | USDC@Base | 53 | -10.2 | 主池 53.0bps 但副池 -10.2bps → 疑似坏点，已拦截 |
| 2026-09-02 13:00Z | USDT@BSC | -57.6 | -14.5 | 主池 -57.6bps 但副池 -14.5bps → 疑似坏点，已拦截 |
| 2026-09-02 13:00Z | RLUSD@Ethereum | 72.1 | -4.3 | 主池 72.1bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-09-02 14:00Z | USDS@Ethereum | -52.3 | 9.9 | 主池 -52.3bps 但副池 9.9bps → 疑似坏点，已拦截 |
| 2026-09-02 15:00Z | RLUSD@Ethereum | -61.7 | -10 | 主池 -61.7bps 但副池 -10.0bps → 疑似坏点，已拦截 |
| 2026-09-02 17:00Z | USDe@Solana | -55.8 | 5.8 | 主池 -55.8bps 但副池 5.8bps → 疑似坏点，已拦截 |
| 2026-09-03 01:00Z | USDG@Solana | 92.9 | 22.9 | 主池 92.9bps 但副池 22.9bps → 疑似坏点，已拦截 |
| 2026-09-03 02:00Z | PYUSD@Ethereum | 79.1 | -6.4 | 主池 79.1bps 但副池 -6.4bps → 疑似坏点，已拦截 |
| 2026-09-03 02:00Z | RLUSD@Ethereum | 66.6 | -7 | 主池 66.6bps 但副池 -7.0bps → 疑似坏点，已拦截 |
| 2026-09-03 12:00Z | PYUSD@Ethereum | 66.2 | 5.6 | 主池 66.2bps 但副池 5.6bps → 疑似坏点，已拦截 |
| 2026-09-03 14:00Z | USDe@Solana | 57 | -1 | 主池 57.0bps 但副池 -1.0bps → 疑似坏点，已拦截 |
| 2026-09-03 14:00Z | PYUSD@Ethereum | 75.5 | -1.6 | 主池 75.5bps 但副池 -1.6bps → 疑似坏点，已拦截 |
| 2026-09-03 14:00Z | RLUSD@Ethereum | 221.9 | -58.4 | 主池 221.9bps 但副池 -58.4bps → 疑似坏点，已拦截 |
| 2026-09-03 15:00Z | RLUSD@Ethereum | 72.4 | -4.6 | 主池 72.4bps 但副池 -4.6bps → 疑似坏点，已拦截 |
| 2026-09-03 18:00Z | USDe@Solana | -58.7 | -24.6 | 主池 -58.7bps 但副池 -24.6bps → 疑似坏点，已拦截 |
| 2026-09-03 21:00Z | USDe@Solana | -52.2 | -3.1 | 主池 -52.2bps 但副池 -3.1bps → 疑似坏点，已拦截 |
| 2026-09-04 04:00Z | USDS@Ethereum | -57 | -18.8 | 主池 -57.0bps 但副池 -18.8bps → 疑似坏点，已拦截 |
| 2026-09-04 06:00Z | USDT@BSC | -50 | 8.9 | 主池 -50.0bps 但副池 8.9bps → 疑似坏点，已拦截 |
| 2026-09-04 12:00Z | PYUSD@Ethereum | -102.7 | 208.1 | 主池 -102.7bps 但副池 208.1bps → 疑似坏点，已拦截 |
| 2026-09-05 00:00Z | U@BSC | -51.8 | 1.7 | 主池 -51.8bps 但副池 1.7bps → 疑似坏点，已拦截 |
| 2026-09-05 12:00Z | USDC@Base | 54.9 | -9.6 | 主池 54.9bps 但副池 -9.6bps → 疑似坏点，已拦截 |
| 2026-09-05 14:00Z | USD1@Ethereum | -52.9 | -19.9 | 主池 -52.9bps 但副池 -19.9bps → 疑似坏点，已拦截 |
| 2026-09-05 16:00Z | USDT@BSC | 52.5 | 23.7 | 主池 52.5bps 但副池 23.7bps → 疑似坏点，已拦截 |
| 2026-09-05 21:00Z | RLUSD@Ethereum | 53.9 | 5 | 主池 53.9bps 但副池 5.0bps → 疑似坏点，已拦截 |
| 2026-09-06 01:00Z | RLUSD@Ethereum | 82.6 | -15.3 | 主池 82.6bps 但副池 -15.3bps → 疑似坏点，已拦截 |
| 2026-09-06 04:00Z | U@BSC | -51.8 | -23.8 | 主池 -51.8bps 但副池 -23.8bps → 疑似坏点，已拦截 |
| 2026-09-06 09:00Z | USDe@Solana | -85.7 | 52.6 | 主池 -85.7bps 但副池 52.6bps → 疑似坏点，已拦截 |
| 2026-09-06 10:00Z | USDe@Solana | -105.6 | -2.2 | 主池 -105.6bps 但副池 -2.2bps → 疑似坏点，已拦截 |
| 2026-09-06 13:00Z | USDT@BSC | -50.6 | -7.6 | 主池 -50.6bps 但副池 -7.6bps → 疑似坏点，已拦截 |
| 2026-09-06 13:00Z | RLUSD@Ethereum | -55.8 | 7.8 | 主池 -55.8bps 但副池 7.8bps → 疑似坏点，已拦截 |
| 2026-09-06 14:00Z | RLUSD@Ethereum | -80.7 | -5 | 主池 -80.7bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-09-06 21:00Z | USDe@Solana | 67.3 | 20.9 | 主池 67.3bps 但副池 20.9bps → 疑似坏点，已拦截 |
| 2026-09-07 03:00Z | USDC@Base | -54 | -0.5 | 主池 -54.0bps 但副池 -0.5bps → 疑似坏点，已拦截 |
| 2026-09-07 14:00Z | USDe@Solana | -52.9 | -4.3 | 主池 -52.9bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-09-08 01:00Z | USDT@BSC | -50.3 | -4.3 | 主池 -50.3bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-09-08 02:00Z | USDC@Base | -53.7 | 3.7 | 主池 -53.7bps 但副池 3.7bps → 疑似坏点，已拦截 |
| 2026-09-08 02:00Z | USDe@Solana | -65.8 | -13.1 | 主池 -65.8bps 但副池 -13.1bps → 疑似坏点，已拦截 |
| 2026-09-08 05:00Z | USDC@Base | -51.3 | -1.2 | 主池 -51.3bps 但副池 -1.2bps → 疑似坏点，已拦截 |
| 2026-09-08 06:00Z | RLUSD@Ethereum | -51.7 | 8.1 | 主池 -51.7bps 但副池 8.1bps → 疑似坏点，已拦截 |
| 2026-09-08 08:00Z | USDT@BSC | -57.4 | -3.2 | 主池 -57.4bps 但副池 -3.2bps → 疑似坏点，已拦截 |
| 2026-09-08 09:00Z | RLUSD@Ethereum | 83.6 | 4.2 | 主池 83.6bps 但副池 4.2bps → 疑似坏点，已拦截 |
| 2026-09-08 14:00Z | USDC@Solana | 55.9 | -11.4 | 主池 55.9bps 但副池 -11.4bps → 疑似坏点，已拦截 |
| 2026-09-08 15:00Z | RLUSD@Ethereum | 95.2 | 2.2 | 主池 95.2bps 但副池 2.2bps → 疑似坏点，已拦截 |
| 2026-09-08 18:00Z | USDC@Base | 50.3 | 15.6 | 主池 50.3bps 但副池 15.6bps → 疑似坏点，已拦截 |
| 2026-09-08 19:00Z | USDC@Base | -54.3 | 2.3 | 主池 -54.3bps 但副池 2.3bps → 疑似坏点，已拦截 |
| 2026-09-09 06:00Z | USDC@Solana | 51.2 | 21.2 | 主池 51.2bps 但副池 21.2bps → 疑似坏点，已拦截 |
| 2026-09-09 10:00Z | USD1@Ethereum | -61.2 | 39.8 | 主池 -61.2bps 但副池 39.8bps → 疑似坏点，已拦截 |
| 2026-09-09 11:00Z | USDC@Base | 50.1 | -34.7 | 主池 50.1bps 但副池 -34.7bps → 疑似坏点，已拦截 |
| 2026-09-09 12:00Z | USDC@Base | 52.9 | 19.6 | 主池 52.9bps 但副池 19.6bps → 疑似坏点，已拦截 |
| 2026-09-09 15:00Z | USDC@Solana | 50.8 | -0.3 | 主池 50.8bps 但副池 -0.3bps → 疑似坏点，已拦截 |
| 2026-09-09 19:00Z | RLUSD@Ethereum | -100.8 | -2.7 | 主池 -100.8bps 但副池 -2.7bps → 疑似坏点，已拦截 |
| 2026-09-10 13:00Z | RLUSD@Ethereum | -113.7 | 7.3 | 主池 -113.7bps 但副池 7.3bps → 疑似坏点，已拦截 |
| 2026-09-10 14:00Z | USDe@Solana | 55 | -10.7 | 主池 55.0bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-09-10 14:00Z | RLUSD@Ethereum | -88.6 | -14.9 | 主池 -88.6bps 但副池 -14.9bps → 疑似坏点，已拦截 |
| 2026-09-10 15:00Z | RLUSD@Ethereum | -94.3 | -7.5 | 主池 -94.3bps 但副池 -7.5bps → 疑似坏点，已拦截 |
| 2026-09-10 23:00Z | RLUSD@Ethereum | -57.6 | -17.8 | 主池 -57.6bps 但副池 -17.8bps → 疑似坏点，已拦截 |
| 2026-09-11 01:00Z | U@BSC | -52.9 | -3.3 | 主池 -52.9bps 但副池 -3.3bps → 疑似坏点，已拦截 |
| 2026-09-11 07:00Z | USDC@Solana | -50.6 | 25.1 | 主池 -50.6bps 但副池 25.1bps → 疑似坏点，已拦截 |
| 2026-09-11 08:00Z | PYUSD@Solana | 50 | 23.3 | 主池 50.0bps 但副池 23.3bps → 疑似坏点，已拦截 |
| 2026-09-11 12:00Z | USDe@Ethereum | -97 | 14 | 主池 -97.0bps 但副池 14.0bps → 疑似坏点，已拦截 |
| 2026-09-11 12:00Z | RLUSD@Ethereum | 177.5 | 19.3 | 主池 177.5bps 但副池 19.3bps → 疑似坏点，已拦截 |
| 2026-09-11 13:00Z | USDC@Ethereum | -72.5 | 45.4 | 主池 -72.5bps 但副池 45.4bps → 疑似坏点，已拦截 |
| 2026-09-11 13:00Z | USDe@Ethereum | -141.1 | 59.8 | 主池 -141.1bps 但副池 59.8bps → 疑似坏点，已拦截 |
| 2026-09-11 13:00Z | PYUSD@Ethereum | 388.1 | -5.8 | 主池 388.1bps 但副池 -5.8bps → 疑似坏点，已拦截 |
| 2026-09-11 13:00Z | USDG@Ethereum | -70.9 | 115.6 | 主池 -70.9bps 但副池 115.6bps → 疑似坏点，已拦截 |
| 2026-09-11 16:00Z | USDC@Base | 50.3 | -12.6 | 主池 50.3bps 但副池 -12.6bps → 疑似坏点，已拦截 |
| 2026-09-11 19:00Z | USDC@Solana | 50.5 | -28.2 | 主池 50.5bps 但副池 -28.2bps → 疑似坏点，已拦截 |
| 2026-09-11 21:00Z | PYUSD@Ethereum | -67.9 | -3.7 | 主池 -67.9bps 但副池 -3.7bps → 疑似坏点，已拦截 |
| 2026-09-11 22:00Z | RLUSD@Ethereum | -100.1 | 6 | 主池 -100.1bps 但副池 6.0bps → 疑似坏点，已拦截 |
| 2026-09-11 22:00Z | USDG@Solana | 50.1 | -0.4 | 主池 50.1bps 但副池 -0.4bps → 疑似坏点，已拦截 |
| 2026-09-12 14:00Z | USDT@BSC | -51.9 | -7 | 主池 -51.9bps 但副池 -7.0bps → 疑似坏点，已拦截 |
| 2026-09-13 08:00Z | PYUSD@Ethereum | -94.7 | -3.6 | 主池 -94.7bps 但副池 -3.6bps → 疑似坏点，已拦截 |
| 2026-09-13 10:00Z | USDC@Solana | 50.3 | 0 | 主池 50.3bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-09-13 13:00Z | RLUSD@Ethereum | -53 | 24.1 | 主池 -53.0bps 但副池 24.1bps → 疑似坏点，已拦截 |
| 2026-09-13 15:00Z | USDG@Solana | -50.4 | -2.8 | 主池 -50.4bps 但副池 -2.8bps → 疑似坏点，已拦截 |
| 2026-09-14 02:00Z | USDC@Solana | -50 | 0 | 主池 -50.0bps 但副池 -0.0bps → 疑似坏点，已拦截 |
| 2026-09-14 13:00Z | USDC@Base | -54.3 | -13.3 | 主池 -54.3bps 但副池 -13.3bps → 疑似坏点，已拦截 |
| 2026-09-14 13:00Z | RLUSD@Ethereum | -67.1 | -10.7 | 主池 -67.1bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-09-14 20:00Z | RLUSD@Ethereum | 57.2 | -71.6 | 主池 57.2bps 但副池 -71.6bps → 疑似坏点，已拦截 |
| 2026-09-14 21:00Z | USD1@Ethereum | -59.1 | 13.9 | 主池 -59.1bps 但副池 13.9bps → 疑似坏点，已拦截 |
| 2026-09-14 23:00Z | USDS@Ethereum | -52.3 | 6.1 | 主池 -52.3bps 但副池 6.1bps → 疑似坏点，已拦截 |
| 2026-09-14 23:00Z | RLUSD@Ethereum | -79.6 | -7.7 | 主池 -79.6bps 但副池 -7.7bps → 疑似坏点，已拦截 |
| 2026-09-15 03:00Z | USDC@Base | -51.8 | 13.8 | 主池 -51.8bps 但副池 13.8bps → 疑似坏点，已拦截 |
| 2026-09-15 06:00Z | USDC@Base | -50 | 7.4 | 主池 -50.0bps 但副池 7.4bps → 疑似坏点，已拦截 |
| 2026-09-15 07:00Z | USDT@BSC | -50.5 | -3.9 | 主池 -50.5bps 但副池 -3.9bps → 疑似坏点，已拦截 |
| 2026-09-15 08:00Z | RLUSD@Ethereum | -68.3 | 14.2 | 主池 -68.3bps 但副池 14.2bps → 疑似坏点，已拦截 |
| 2026-09-15 13:00Z | USDS@Ethereum | 50 | -55.4 | 主池 50.0bps 但副池 -55.4bps → 疑似坏点，已拦截 |
| 2026-09-15 13:00Z | RLUSD@Ethereum | -92.5 | -5 | 主池 -92.5bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-09-15 14:00Z | RLUSD@Ethereum | -293 | 57.4 | 主池 -293.0bps 但副池 57.4bps → 疑似坏点，已拦截 |
| 2026-09-15 15:00Z | RLUSD@Ethereum | -195.7 | -2.8 | 主池 -195.7bps 但副池 -2.8bps → 疑似坏点，已拦截 |
| 2026-09-15 16:00Z | USDC@Solana | -50.8 | 0 | 主池 -50.8bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-09-15 16:00Z | RLUSD@Ethereum | -225.6 | -2.4 | 主池 -225.6bps 但副池 -2.4bps → 疑似坏点，已拦截 |
| 2026-09-15 17:00Z | RLUSD@Ethereum | 98.2 | -2.6 | 主池 98.2bps 但副池 -2.6bps → 疑似坏点，已拦截 |
| 2026-09-15 18:00Z | USDC@Base | -53.6 | -21.6 | 主池 -53.6bps 但副池 -21.6bps → 疑似坏点，已拦截 |
| 2026-09-15 18:00Z | USDS@Ethereum | -179.3 | -3.3 | 主池 -179.3bps 但副池 -3.3bps → 疑似坏点，已拦截 |
| 2026-09-15 18:00Z | PYUSD@Ethereum | 113.7 | 6.5 | 主池 113.7bps 但副池 6.5bps → 疑似坏点，已拦截 |
| 2026-09-15 18:00Z | RLUSD@Ethereum | -233.1 | -15.2 | 主池 -233.1bps 但副池 -15.2bps → 疑似坏点，已拦截 |
| 2026-09-15 19:00Z | RLUSD@Ethereum | -62.7 | 26.5 | 主池 -62.7bps 但副池 26.5bps → 疑似坏点，已拦截 |
| 2026-09-16 00:00Z | USDT@Solana | -55.2 | -2.6 | 主池 -55.2bps 但副池 -2.6bps → 疑似坏点，已拦截 |
| 2026-09-16 02:00Z | PYUSD@Ethereum | 60.4 | 3 | 主池 60.4bps 但副池 3.0bps → 疑似坏点，已拦截 |
| 2026-09-16 02:00Z | RLUSD@Ethereum | -50.9 | 8.6 | 主池 -50.9bps 但副池 8.6bps → 疑似坏点，已拦截 |
| 2026-09-16 03:00Z | USDT@BSC | -52 | -9 | 主池 -52.0bps 但副池 -9.0bps → 疑似坏点，已拦截 |
| 2026-09-16 03:00Z | U@BSC | -51.4 | -0.7 | 主池 -51.4bps 但副池 -0.7bps → 疑似坏点，已拦截 |
| 2026-09-16 09:00Z | USDT@BSC | -55 | -9.6 | 主池 -55.0bps 但副池 -9.6bps → 疑似坏点，已拦截 |
| 2026-09-16 15:00Z | PYUSD@Solana | -50.5 | -22.2 | 主池 -50.5bps 但副池 -22.2bps → 疑似坏点，已拦截 |
| 2026-09-16 18:00Z | RLUSD@Ethereum | -77 | 10 | 主池 -77.0bps 但副池 10.0bps → 疑似坏点，已拦截 |
| 2026-09-16 18:00Z | U@BSC | -51.5 | 3.3 | 主池 -51.5bps 但副池 3.3bps → 疑似坏点，已拦截 |
| 2026-09-16 20:00Z | USDS@Solana | 51.8 | -0.6 | 主池 51.8bps 但副池 -0.6bps → 疑似坏点，已拦截 |
| 2026-09-16 23:00Z | PYUSD@Ethereum | 86.1 | 5.6 | 主池 86.1bps 但副池 5.6bps → 疑似坏点，已拦截 |
| 2026-09-17 01:00Z | USDG@Solana | 52.2 | -27 | 主池 52.2bps 但副池 -27.0bps → 疑似坏点，已拦截 |
| 2026-09-17 04:00Z | PYUSD@Solana | 51.8 | 13.2 | 主池 51.8bps 但副池 13.2bps → 疑似坏点，已拦截 |
| 2026-09-17 04:00Z | RLUSD@Ethereum | 51.4 | -10.7 | 主池 51.4bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-09-17 05:00Z | RLUSD@Ethereum | 53.4 | -3.7 | 主池 53.4bps 但副池 -3.7bps → 疑似坏点，已拦截 |
| 2026-09-17 10:00Z | USDC@Base | -53.3 | 4.4 | 主池 -53.3bps 但副池 4.4bps → 疑似坏点，已拦截 |
| 2026-09-17 12:00Z | RLUSD@Ethereum | 136.7 | 5.5 | 主池 136.7bps 但副池 5.5bps → 疑似坏点，已拦截 |
| 2026-09-17 13:00Z | RLUSD@Ethereum | 84.8 | 6 | 主池 84.8bps 但副池 6.0bps → 疑似坏点，已拦截 |
| 2026-09-17 14:00Z | RLUSD@Ethereum | 105.9 | 12.7 | 主池 105.9bps 但副池 12.7bps → 疑似坏点，已拦截 |
| 2026-09-17 15:00Z | RLUSD@Ethereum | 63.2 | -13.3 | 主池 63.2bps 但副池 -13.3bps → 疑似坏点，已拦截 |
| 2026-09-17 18:00Z | USDT@BSC | -55 | -6.1 | 主池 -55.0bps 但副池 -6.1bps → 疑似坏点，已拦截 |
| 2026-09-18 00:00Z | USDC@Base | -51.5 | 22.8 | 主池 -51.5bps 但副池 22.8bps → 疑似坏点，已拦截 |
| 2026-09-18 13:00Z | USDC@Base | -86.8 | -14 | 主池 -86.8bps 但副池 -14.0bps → 疑似坏点，已拦截 |
| 2026-09-18 13:00Z | PYUSD@Ethereum | -70.7 | -5.5 | 主池 -70.7bps 但副池 -5.5bps → 疑似坏点，已拦截 |
| 2026-09-18 14:00Z | RLUSD@Ethereum | 293 | -7.4 | 主池 293.0bps 但副池 -7.4bps → 疑似坏点，已拦截 |
| 2026-09-18 15:00Z | RLUSD@Ethereum | 308.5 | -31.8 | 主池 308.5bps 但副池 -31.8bps → 疑似坏点，已拦截 |
| 2026-09-18 16:00Z | RLUSD@Ethereum | 351.2 | 15.4 | 主池 351.2bps 但副池 15.4bps → 疑似坏点，已拦截 |
| 2026-09-18 17:00Z | RLUSD@Ethereum | 345.3 | 2.8 | 主池 345.3bps 但副池 2.8bps → 疑似坏点，已拦截 |
| 2026-09-18 18:00Z | RLUSD@Ethereum | 446 | 7.1 | 主池 446.0bps 但副池 7.1bps → 疑似坏点，已拦截 |
| 2026-09-19 05:00Z | USDS@Solana | 56.6 | -0.3 | 主池 56.6bps 但副池 -0.3bps → 疑似坏点，已拦截 |
| 2026-09-20 02:00Z | PYUSD@Ethereum | -76.1 | -5.1 | 主池 -76.1bps 但副池 -5.1bps → 疑似坏点，已拦截 |
| 2026-09-20 02:00Z | RLUSD@Ethereum | -89.6 | -19.9 | 主池 -89.6bps 但副池 -19.9bps → 疑似坏点，已拦截 |
| 2026-09-20 03:00Z | RLUSD@Ethereum | -121.7 | -7.7 | 主池 -121.7bps 但副池 -7.7bps → 疑似坏点，已拦截 |
| 2026-09-20 11:00Z | USDC@Base | -51.2 | 20.6 | 主池 -51.2bps 但副池 20.6bps → 疑似坏点，已拦截 |
| 2026-09-20 15:00Z | RLUSD@Ethereum | 100.5 | -4.7 | 主池 100.5bps 但副池 -4.7bps → 疑似坏点，已拦截 |
| 2026-09-20 16:00Z | RLUSD@Ethereum | 210.4 | -6.8 | 主池 210.4bps 但副池 -6.8bps → 疑似坏点，已拦截 |
| 2026-09-20 19:00Z | USDC@Base | 53.8 | -9.2 | 主池 53.8bps 但副池 -9.2bps → 疑似坏点，已拦截 |
| 2026-09-21 00:00Z | RLUSD@Ethereum | 196.6 | 10.5 | 主池 196.6bps 但副池 10.5bps → 疑似坏点，已拦截 |
| 2026-09-21 01:00Z | USDC@Solana | -50.5 | 24.8 | 主池 -50.5bps 但副池 24.8bps → 疑似坏点，已拦截 |
| 2026-09-21 01:00Z | USDe@Ethereum | 56.5 | 0.2 | 主池 56.5bps 但副池 0.2bps → 疑似坏点，已拦截 |
| 2026-09-21 01:00Z | PYUSD@Ethereum | -94.4 | 67.7 | 主池 -94.4bps 但副池 67.7bps → 疑似坏点，已拦截 |
| 2026-09-21 01:00Z | RLUSD@Ethereum | -55.2 | 2.7 | 主池 -55.2bps 但副池 2.7bps → 疑似坏点，已拦截 |
| 2026-09-21 02:00Z | RLUSD@Ethereum | -110.7 | -10.7 | 主池 -110.7bps 但副池 -10.7bps → 疑似坏点，已拦截 |
| 2026-09-21 15:00Z | USDC@Solana | -53.6 | 30.2 | 主池 -53.6bps 但副池 30.2bps → 疑似坏点，已拦截 |
| 2026-09-21 20:00Z | RLUSD@Ethereum | 50 | 10.8 | 主池 50.0bps 但副池 10.8bps → 疑似坏点，已拦截 |
| 2026-09-22 00:00Z | USDC@Solana | 50.2 | 0 | 主池 50.2bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-09-22 01:00Z | RLUSD@Ethereum | -90.9 | 11.5 | 主池 -90.9bps 但副池 11.5bps → 疑似坏点，已拦截 |
| 2026-09-22 02:00Z | USDe@Solana | 59 | -54.9 | 主池 59.0bps 但副池 -54.9bps → 疑似坏点，已拦截 |
| 2026-09-22 08:00Z | RLUSD@Ethereum | 76.9 | 7.9 | 主池 76.9bps 但副池 7.9bps → 疑似坏点，已拦截 |
| 2026-09-22 09:00Z | RLUSD@Ethereum | 69.5 | 3.8 | 主池 69.5bps 但副池 3.8bps → 疑似坏点，已拦截 |
| 2026-09-22 14:00Z | RLUSD@Ethereum | -62.2 | -0.7 | 主池 -62.2bps 但副池 -0.7bps → 疑似坏点，已拦截 |
| 2026-09-22 16:00Z | USDe@Solana | 57.1 | 0.1 | 主池 57.1bps 但副池 0.1bps → 疑似坏点，已拦截 |
| 2026-09-23 02:00Z | USDG@Solana | 50.4 | -9.8 | 主池 50.4bps 但副池 -9.8bps → 疑似坏点，已拦截 |
| 2026-09-23 07:00Z | USDe@Solana | -85.4 | -23.7 | 主池 -85.4bps 但副池 -23.7bps → 疑似坏点，已拦截 |
| 2026-09-23 07:00Z | RLUSD@Ethereum | -66.8 | -7.4 | 主池 -66.8bps 但副池 -7.4bps → 疑似坏点，已拦截 |
| 2026-09-23 11:00Z | RLUSD@Ethereum | -52.9 | -7.3 | 主池 -52.9bps 但副池 -7.3bps → 疑似坏点，已拦截 |
| 2026-09-23 14:00Z | USDC@Base | 63.3 | -7.2 | 主池 63.3bps 但副池 -7.2bps → 疑似坏点，已拦截 |
| 2026-09-23 14:00Z | RLUSD@Ethereum | -177.2 | 2.9 | 主池 -177.2bps 但副池 2.9bps → 疑似坏点，已拦截 |
| 2026-09-23 16:00Z | RLUSD@Ethereum | -90.2 | 8.7 | 主池 -90.2bps 但副池 8.7bps → 疑似坏点，已拦截 |
| 2026-09-23 17:00Z | RLUSD@Ethereum | -69 | 6.8 | 主池 -69.0bps 但副池 6.8bps → 疑似坏点，已拦截 |
| 2026-09-24 05:00Z | RLUSD@Ethereum | 53 | 3.6 | 主池 53.0bps 但副池 3.6bps → 疑似坏点，已拦截 |
| 2026-09-24 07:00Z | USDC@Base | 51.8 | -3.2 | 主池 51.8bps 但副池 -3.2bps → 疑似坏点，已拦截 |
| 2026-09-24 08:00Z | RLUSD@Ethereum | -56.5 | -1.7 | 主池 -56.5bps 但副池 -1.7bps → 疑似坏点，已拦截 |
| 2026-09-24 09:00Z | PYUSD@Ethereum | -91.4 | 3 | 主池 -91.4bps 但副池 3.0bps → 疑似坏点，已拦截 |
| 2026-09-24 09:00Z | RLUSD@Ethereum | -130.6 | -4.2 | 主池 -130.6bps 但副池 -4.2bps → 疑似坏点，已拦截 |
| 2026-09-24 13:00Z | RLUSD@Ethereum | 76.1 | 12.6 | 主池 76.1bps 但副池 12.6bps → 疑似坏点，已拦截 |
| 2026-09-24 15:00Z | RLUSD@Ethereum | 130.6 | -10.2 | 主池 130.6bps 但副池 -10.2bps → 疑似坏点，已拦截 |
| 2026-09-24 17:00Z | USDT@BSC | -50.4 | -1.1 | 主池 -50.4bps 但副池 -1.1bps → 疑似坏点，已拦截 |
| 2026-09-24 17:00Z | USDC@Base | -51.2 | 5.7 | 主池 -51.2bps 但副池 5.7bps → 疑似坏点，已拦截 |
| 2026-09-25 00:00Z | USDT@Solana | -55.6 | -19.6 | 主池 -55.6bps 但副池 -19.6bps → 疑似坏点，已拦截 |
| 2026-09-25 02:00Z | USDe@Solana | -71.2 | 9.4 | 主池 -71.2bps 但副池 9.4bps → 疑似坏点，已拦截 |
| 2026-09-25 03:00Z | USDG@Solana | 51.9 | -22.2 | 主池 51.9bps 但副池 -22.2bps → 疑似坏点，已拦截 |
| 2026-09-25 08:00Z | U@BSC | -52.8 | -0.9 | 主池 -52.8bps 但副池 -0.9bps → 疑似坏点，已拦截 |
| 2026-09-25 10:00Z | RLUSD@Ethereum | 53.6 | -4.9 | 主池 53.6bps 但副池 -4.9bps → 疑似坏点，已拦截 |
| 2026-09-25 11:00Z | RLUSD@Ethereum | 121.7 | -6.4 | 主池 121.7bps 但副池 -6.4bps → 疑似坏点，已拦截 |
| 2026-09-25 12:00Z | PYUSD@Ethereum | 75.3 | 17.8 | 主池 75.3bps 但副池 17.8bps → 疑似坏点，已拦截 |
| 2026-09-25 15:00Z | PYUSD@Ethereum | -55.2 | -16.7 | 主池 -55.2bps 但副池 -16.7bps → 疑似坏点，已拦截 |
| 2026-09-25 15:00Z | U@BSC | -51.8 | 10.2 | 主池 -51.8bps 但副池 10.2bps → 疑似坏点，已拦截 |
| 2026-09-26 18:00Z | U@BSC | -53.1 | 2.1 | 主池 -53.1bps 但副池 2.1bps → 疑似坏点，已拦截 |
| 2026-09-26 19:00Z | USDT@BSC | -51.7 | -4.3 | 主池 -51.7bps 但副池 -4.3bps → 疑似坏点，已拦截 |
| 2026-09-26 19:00Z | U@BSC | -50.7 | -1.2 | 主池 -50.7bps 但副池 -1.2bps → 疑似坏点，已拦截 |
| 2026-09-26 20:00Z | PYUSD@Ethereum | -51.4 | -4.1 | 主池 -51.4bps 但副池 -4.1bps → 疑似坏点，已拦截 |
| 2026-09-26 23:00Z | USDC@Base | 59 | -4.2 | 主池 59.0bps 但副池 -4.2bps → 疑似坏点，已拦截 |
| 2026-09-26 23:00Z | USDS@Ethereum | 56 | -6.1 | 主池 56.0bps 但副池 -6.1bps → 疑似坏点，已拦截 |
| 2026-09-27 00:00Z | USDC@Solana | 50.2 | 0 | 主池 50.2bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-09-27 04:00Z | U@BSC | -51.5 | -21.6 | 主池 -51.5bps 但副池 -21.6bps → 疑似坏点，已拦截 |
| 2026-09-27 11:00Z | USDC@Base | -53.4 | 13.9 | 主池 -53.4bps 但副池 13.9bps → 疑似坏点，已拦截 |
| 2026-09-27 13:00Z | USDS@Solana | 50.7 | -1.4 | 主池 50.7bps 但副池 -1.4bps → 疑似坏点，已拦截 |
| 2026-09-27 13:00Z | RLUSD@Ethereum | -54.2 | 4 | 主池 -54.2bps 但副池 4.0bps → 疑似坏点，已拦截 |
| 2026-09-27 14:00Z | RLUSD@Ethereum | -104.6 | -5 | 主池 -104.6bps 但副池 -5.0bps → 疑似坏点，已拦截 |
| 2026-09-27 16:00Z | RLUSD@Ethereum | -103.8 | -5.3 | 主池 -103.8bps 但副池 -5.3bps → 疑似坏点，已拦截 |
| 2026-09-27 22:00Z | RLUSD@Ethereum | -78.7 | 4.5 | 主池 -78.7bps 但副池 4.5bps → 疑似坏点，已拦截 |
| 2026-09-28 01:00Z | USDC@Solana | 50.2 | 0 | 主池 50.2bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-09-28 14:00Z | RLUSD@Ethereum | -62.9 | -3.7 | 主池 -62.9bps 但副池 -3.7bps → 疑似坏点，已拦截 |
| 2026-09-28 17:00Z | USDS@Ethereum | -55.4 | 6.9 | 主池 -55.4bps 但副池 6.9bps → 疑似坏点，已拦截 |
| 2026-09-28 17:00Z | RLUSD@Ethereum | 80 | 1.5 | 主池 80.0bps 但副池 1.5bps → 疑似坏点，已拦截 |
| 2026-09-28 18:00Z | RLUSD@Ethereum | 82.6 | -4.6 | 主池 82.6bps 但副池 -4.6bps → 疑似坏点，已拦截 |
| 2026-09-28 21:00Z | USDC@Base | -50.4 | -0.3 | 主池 -50.4bps 但副池 -0.3bps → 疑似坏点，已拦截 |
| 2026-09-29 07:00Z | RLUSD@Ethereum | 51.7 | 7.1 | 主池 51.7bps 但副池 7.1bps → 疑似坏点，已拦截 |
| 2026-09-29 14:00Z | RLUSD@Ethereum | -102.5 | 18 | 主池 -102.5bps 但副池 18.0bps → 疑似坏点，已拦截 |
| 2026-09-29 15:00Z | RLUSD@Ethereum | -123.9 | -0.6 | 主池 -123.9bps 但副池 -0.6bps → 疑似坏点，已拦截 |
| 2026-09-29 16:00Z | RLUSD@Ethereum | -221.5 | 9.9 | 主池 -221.5bps 但副池 9.9bps → 疑似坏点，已拦截 |
| 2026-09-29 17:00Z | RLUSD@Ethereum | -250 | 5.6 | 主池 -250.0bps 但副池 5.6bps → 疑似坏点，已拦截 |
| 2026-09-30 10:00Z | RLUSD@Ethereum | 90.3 | 10.3 | 主池 90.3bps 但副池 10.3bps → 疑似坏点，已拦截 |
| 2026-09-30 11:00Z | RLUSD@Ethereum | 92.3 | -2.4 | 主池 92.3bps 但副池 -2.4bps → 疑似坏点，已拦截 |
| 2026-09-30 12:00Z | USDC@Base | 61.8 | -2.4 | 主池 61.8bps 但副池 -2.4bps → 疑似坏点，已拦截 |
| 2026-09-30 12:00Z | RLUSD@Ethereum | 174.2 | -20.4 | 主池 174.2bps 但副池 -20.4bps → 疑似坏点，已拦截 |
| 2026-09-30 13:00Z | PYUSD@Ethereum | -79.5 | -18.2 | 主池 -79.5bps 但副池 -18.2bps → 疑似坏点，已拦截 |
| 2026-09-30 14:00Z | RLUSD@Ethereum | -105.9 | -2.2 | 主池 -105.9bps 但副池 -2.2bps → 疑似坏点，已拦截 |
| 2026-09-30 15:00Z | USDT@BSC | -52.7 | -6.6 | 主池 -52.7bps 但副池 -6.6bps → 疑似坏点，已拦截 |
| 2026-09-30 15:00Z | RLUSD@Ethereum | -114.1 | 11.8 | 主池 -114.1bps 但副池 11.8bps → 疑似坏点，已拦截 |
| 2026-09-30 16:00Z | RLUSD@Ethereum | -78.7 | -8.6 | 主池 -78.7bps 但副池 -8.6bps → 疑似坏点，已拦截 |
| 2026-09-30 17:00Z | RLUSD@Ethereum | -107.4 | -2.7 | 主池 -107.4bps 但副池 -2.7bps → 疑似坏点，已拦截 |
| 2026-10-01 04:00Z | RLUSD@Ethereum | 83.9 | 6.7 | 主池 83.9bps 但副池 6.7bps → 疑似坏点，已拦截 |
| 2026-10-01 07:00Z | RLUSD@Ethereum | -116.7 | 7.8 | 主池 -116.7bps 但副池 7.8bps → 疑似坏点，已拦截 |
| 2026-10-01 14:00Z | USDe@Solana | 58.2 | 15.1 | 主池 58.2bps 但副池 15.1bps → 疑似坏点，已拦截 |
| 2026-10-01 16:00Z | USDT@BSC | -52.1 | -10 | 主池 -52.1bps 但副池 -10.0bps → 疑似坏点，已拦截 |
| 2026-10-01 16:00Z | USDG@Solana | 50.2 | 6.9 | 主池 50.2bps 但副池 6.9bps → 疑似坏点，已拦截 |
| 2026-10-01 19:00Z | USDC@Solana | -50.3 | 0 | 主池 -50.3bps 但副池 0.0bps → 疑似坏点，已拦截 |
| 2026-10-01 20:00Z | U@BSC | -50.3 | -19.2 | 主池 -50.3bps 但副池 -19.2bps → 疑似坏点，已拦截 |
| 2026-10-01 22:00Z | USDC@Base | 50.7 | 7.7 | 主池 50.7bps 但副池 7.7bps → 疑似坏点，已拦截 |
| 2026-10-01 23:00Z | USDC@Base | 56.8 | 19.9 | 主池 56.8bps 但副池 19.9bps → 疑似坏点，已拦截 |
| 2026-10-02 01:00Z | PYUSD@Ethereum | 52.9 | -2.1 | 主池 52.9bps 但副池 -2.1bps → 疑似坏点，已拦截 |
| 2026-10-02 13:00Z | PYUSD@Ethereum | -68.1 | 3.4 | 主池 -68.1bps 但副池 3.4bps → 疑似坏点，已拦截 |
| 2026-10-02 17:00Z | RLUSD@Ethereum | -78.6 | -0.4 | 主池 -78.6bps 但副池 -0.4bps → 疑似坏点，已拦截 |
| 2026-10-02 18:00Z | USDC@Base | -51.4 | 4.9 | 主池 -51.4bps 但副池 4.9bps → 疑似坏点，已拦截 |
| 2026-10-02 19:00Z | USDC@Solana | 65.3 | -24.9 | 主池 65.3bps 但副池 -24.9bps → 疑似坏点，已拦截 |
| 2026-10-02 20:00Z | USDC@Solana | 84.7 | 0 | 主池 84.7bps 但副池 0.0bps → 疑似坏点，已拦截 |

### v1（日线币级）vs v2（小时线分链）对比

- v1：183 天币级日线，2 个事件（USDG +351bps 疑似坏点、USDD -116.9bps）
- v2：小时线分链双源交叉，原始触发 1596 个（其中双源确认/大概率 559、单源 1037），拦截疑似坏点 1120 个；"首触即严重或升级至严重"的确认事件按天去重 32 个
- 差异说明：小时线能抓到盘中脱锚（v1 系统性漏掉）；分链口径下链特异性脱锚不再被聚合价平均掉；双源交叉把单池坏点拦在门外

### 结论

**1. v1 的 USDG 疑似坏点实锤了。** v2 用 GeckoTerminal 池级小时线复核 2026-04-04：USDG@eth 主池当天只有 -50~-80bps 的小波动，根本没有 +351bps。CoinGecko 日线那个点是坏点。同时 v2 还在实战中抓到一个活的 USDG 式坏点——2026-05-02 21:00 USDG@Solana 主池单池 +853bps 尖峰，被同链第二池交叉验证当场拦截（suspicious）。双源机制不是纸上谈兵。

**2. v1 的 USDD 真脱锚得到佐证。** v2 在 2026-06-27/28 抓到 USDD@BSC -53.5bps、USDD@eth -53bps，方向与 v1 一致（幅度小于 v1 日线的 -116.9bps，数据源口径差异）。USDD 池历史稀疏（745 小时），判为 unconfirmed，但两个独立源（CoinGecko 日线 + GT 小时线）同向，可信度高于单源。

**3. 阈值：50/150bps 检测线保持不变。** 小时线 50bps 级别的池内 wiggle 确实常见（1596 个原始触发，中位持续仅 2 小时），但经过双源过滤后有意义的信号大幅收敛：confirmed/likely 559 个，其中"首触即严重或升级至严重"按天去重仅 32 个。50bps 作为**检测**线不漏事，**推送**侧靠双源交叉（已上线）挡噪音，组合是合理的。如果以后线上告警疲劳，再加"连续 2 轮确认或 ≥150bps 才推"的持久性门槛，目前不需要动。

**4. 最值得人工复核的一条：USDe@Solana 2026-10-02。** 当天 14:00~22:00（UTC）两个独立 Solana 池同时显示 USDe -160~-323bps、持续 5 小时以上，而币安现货同期 $0.9998~1.0000 纹丝不动。这是教科书式的"链特异性脱锚"——按既定框架这是真机会不是坏点。但 DexScreener 当前采样池显示已回到 -7bps。到底是真实的链上流动性断裂、还是 GT 两个池的系统性报价问题，仅凭价格数据无法定论，已列为待人工复核项（查当时 Solana 链上实际成交与新闻）。

**5. 剩余局限（诚实清单）：**
- Tron 3 条腿（USDT/USD1/USDD）GeckoTerminal 无此网络，回测未覆盖；线上 DexScreener 覆盖不受影响。
- USDD 两条腿池历史稀疏（~745 小时且多缺失），PYUSD 无币安参考对。
- 1037 个 unconfirmed 事件（占 65%）是单池腿，无从交叉验证，保守计入但置信度低。
- GT 池的 USD 价是经 quote 代币换算的，quote 本身脱锚会污染结果；stable-stable 池的偏离是相对偏离。
- 回测用池 ≠ 线上用池：线上 DexScreener `tokens/v1` 每次随机采样一个 pair（已实测到 USD1@eth 在 USD1/WLFI 与 USD1/USDT 间跳），两次扫描可能盯的不是同一个池，这是线上漏报/误报的残余风险源。
- 双源只能拦**单池**坏点；若数据源 provider 级整体误报（如两个池同源报价错误），双池会一起错判为 confirmed。10-03 凌晨 USD1@eth -72bps 双池同报、几分钟后自愈，即属此类，线上按 confirmed 放行是符合设计的（事后看是噪音）。

## 事件严重程度分级 S/A/B/C（2026-10-03 追加）

### 分级标准

对象：严重线（≥150bps）触发事件。输入四维：峰值偏离、持续时长、双源确认度、广度。规则按序命中，前后一致：

| 顺序 | 条件 | 评级 | 含义 |
|---|---|---|---|
| 1 | 广度 = 全币种（币安现货同期偏离 ≥50bps） | **S** | 全币种联动：暴雷风险最高，立即人工介入 |
| 2 | 广度 = 多链（同币 ≥2 链 24h 内严重） | **S** | 非单点流动性问题，立即人工介入 |
| 3 | 单链峰值 ≥300bps 且双源 confirmed | **S** | 单链极端偏离且确认，立即人工介入 |
| 4 | 峰值 ≥250bps | **A** | 重点跟踪 |
| 5 | 峰值 ≥200bps 且 confirmed | **A** | 重点跟踪 |
| 6 | 峰值 ≥150bps 且持续 ≥24h | **A** | 重点跟踪 |
| 7 | 峰值 ≥200bps | **B** | 观察 |
| 8 | 峰值 ≥150bps 且持续 ≥4h | **B** | 观察 |
| 9 | 其余（150~200bps 短时 wiggle） | **C** | 轻微 |

**套利窗口**（独立标注，不改变评级）：单链事件 + 币安现货同期基本不动（±30bps 内）→ 🎯套利窗口，即链特异性脱锚，是用户的机会而非暴雷。评级回答"有多严重"，套利窗口回答"能不能做"。

**线上落地**：`depeg_logic.mjs::gradeDepegEvent`（回测与线上共用同一函数）；快线推送标题前缀 `[S]/[A]/[B]/[C]`，正文附评级行；事件落盘 `state/depeg_events.json` 带 `grade`/`gradedAt` 字段，慢线 enrich 直接引用；S/A 级额外走 Bark critical（`~/.bark_key` 未配置则静默跳过）。live 广度口径：同币 ≥2 条活跃链 → multi-chain；无币安现货参考价，whole-coin 不在快线使用（由慢线/回测判定）。

### 32 个历史事件评级清单

口径：kind=new-severe（首次触发即严重，不含预警升级）且 verdict ∈ {confirmed, likely}，按（天，币种，链）去重取峰值。
评级分布：**S=5、A=10、B=13、C=4**。

| 时间(UTC) | 事件 | 峰值(bps) | 持续(h) | 双源 | 广度 | 评级 | 备注 |
|---|---|---|---|---|---|---|---|
| 2026-04-06 17:00 | PYUSD@Ethereum | -158.4 | 1.0 | confirmed | multi-chain | **S** | ❓币安无参考 |
| 2026-04-27 18:00 | USD1@Ethereum | -247.1 | 5.0 | likely | single | **B** | 🎯套利窗口 |
| 2026-05-10 21:00 | USDe@Solana | -170.9 | 19.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-05-23 20:00 | USDe@Solana | +231.5 | 5.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-06-05 13:00 | PYUSD@Ethereum | -250.2 | 4.0 | confirmed | single | **A** | ❓币安无参考 |
| 2026-06-05 18:00 | USDe@Solana | -288.1 | 14.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-06-06 10:00 | PYUSD@Ethereum | -205.4 | 4.0 | confirmed | single | **A** | ❓币安无参考 |
| 2026-06-06 14:00 | USD1@Ethereum | -206.9 | 21.0 | likely | single | **B** | 🎯套利窗口 |
| 2026-06-07 19:00 | USDe@Solana | -189.6 | 14.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-06-07 20:00 | USD1@Ethereum | -195.9 | 7.0 | likely | single | **B** | 🎯套利窗口 |
| 2026-06-08 04:00 | USD1@Ethereum | -222.1 | 253.0 | likely | single | **A** | 🎯套利窗口 |
| 2026-06-09 14:00 | USDe@Solana | -160.3 | 9.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-06-23 08:00 | PYUSD@Ethereum | -242.5 | 3.0 | likely | multi-chain | **S** | ❓币安无参考 |
| 2026-06-24 05:00 | PYUSD@Solana | +272.4 | 1.0 | confirmed | multi-chain | **S** | ❓币安无参考 |
| 2026-07-08 01:00 | USDe@Solana | -288.3 | 81.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-07-14 12:00 | USDe@Solana | +195.9 | 2.0 | confirmed | single | **C** | 🎯套利窗口 |
| 2026-07-22 04:00 | PYUSD@Solana | -334.2 | 1.0 | confirmed | single | **S** | ❓币安无参考 |
| 2026-07-30 11:00 | PYUSD@Solana | +155.9 | 1.0 | confirmed | single | **C** | ❓币安无参考 |
| 2026-08-08 01:00 | PYUSD@Solana | -235.2 | 2.0 | likely | single | **B** | ❓币安无参考 |
| 2026-08-16 21:00 | USDe@Solana | -150.3 | 5.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-08-19 20:00 | USDC@Arbitrum | +155.0 | 1.0 | confirmed | single | **C** | 🎯套利窗口 |
| 2026-08-22 02:00 | USDe@Solana | +223.4 | 9.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-08-25 07:00 | USDe@Solana | -181.2 | 20.0 | likely | single | **B** | 🎯套利窗口 |
| 2026-09-04 12:00 | RLUSD@Ethereum | -271.8 | 1.0 | likely | single | **A** | 🎯套利窗口 |
| 2026-09-09 09:00 | USDe@Solana | -163.6 | 19.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-09-11 13:00 | USDC@Base | +152.3 | 1.0 | likely | single | **C** | 🎯套利窗口 |
| 2026-09-13 22:00 | USDe@Solana | -213.4 | 1.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-09-14 07:00 | USDC@Solana | -247.1 | 1.0 | likely | single | **B** | 🎯套利窗口 |
| 2026-09-17 05:00 | USDe@Solana | +243.6 | 9.0 | confirmed | single | **A** | 🎯套利窗口 |
| 2026-09-24 13:00 | USDe@Solana | +162.2 | 5.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-09-25 16:00 | USDe@Solana | +162.6 | 13.0 | confirmed | single | **B** | 🎯套利窗口 |
| 2026-09-27 08:00 | USDe@Solana | +310.4 | 2.0 | confirmed | single | **S** | 🎯套利窗口 |

### 分级结论

- 32 个严重事件里 **24 个带 🎯套利窗口**（单链 + 币安现货不动）：回测证实用户面对的主要是链特异性机会，而非全币种暴雷（本批 0 个 whole-coin）。
- S 级 5 个：3 个 PYUSD 多链（04-06 ETH / 06-23 ETH / 06-24 SOL，两两 24h 内）、1 个 PYUSD@Solana 单链 -334bps、1 个 USDe@Solana +310bps。注意 PYUSD 无币安参考对，套利窗口无法确认。
- 最长的事件：USD1@Ethereum 06-08 -222bps 持续 253h（10.5 天）→ A 级。持续超长的单链偏离即使幅度中等也值得重点跟踪。
- USDe@Solana 占 17 个，是 Solana 链上流动性反复断裂的常态，不是偶发；评级多为 A/B，策略上可当作"常态机会池"而非每次都当大事。

