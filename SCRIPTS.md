# stablecoin-risk-desk 脚本目录

> 2026-10-11 建立。稳定币脱锚监控。

## 常驻（别删）

| 脚本 | 干什么 | 谁在调用 |
|---|---|---|
| `sweep_loop.sh` | 脱锚巡检常驻循环，每 5 分钟：A server.js 健康检查 + B cex_lst_watch + C arb_spread_watch + D arb_addr_watch + E arb_fallback | all-loops-watchdog 保活 |
| `server.js` | 脱锚事件服务（HTTP API + 事件状态机），机会类改入队深化（enqueueDepegArb）、解除直发 | sweep_loop.sh 健康检查，挂了自动重启 |
| `cex_lst_watch.mjs` | CEX 稳定币现货 + LST 价格监控；2026-10-30 起触发入统一队列（原直推已拆）、场所状态门 F7（state/venue_status.json） | sweep_loop.sh 每轮调用 |
| `cex_dip_watch.mjs` | 交易所逐所盯跌（进程内 10s/30s 自轮询）；机会类经 deps.enqueueArb 入队、resolved 直发 | server.js 启动时拉起 |
| `depeg_logic.mjs` | 脱锚判定逻辑（阈值、流动性过滤；confirmDepeg 自 2026-10-30 仅作取证/回测） | cex_lst_watch.mjs、server.js 共用 |
| `arb_lib.mjs` | 套利整合共享底座（RPC/Chainlink/币安/V3 模拟/Aave/统一队列/PushPlus） | 全部 arb_* 组件共用 |
| `arb_spread_watch.mjs` | 主流币三方价差监控（ETH/WBTC：DEX 白名单池 vs 预言机 vs 币安），越线入队 | sweep_loop.sh 每轮 C 段 |
| `arb_addr_watch.mjs` | 元套利地址跟踪（Aave V3 事件增量 + 种子库过滤），大额借入入队 | sweep_loop.sh 每轮 D 段 |
| `arb_fallback.mjs` | 研判兜底：队列超 10 分钟未处理推简短提示；已消解条目静默清除 | sweep_loop.sh 每轮 E 段 |
| ~~`arb_ignite.mjs`~~ | 公告点火器：**2026-10-30 已撤**（用户拍板：公告每天一轮、提前量为负），已移 archive/arb_ignite.mjs.retired-2026-10-30-announcement-too-slow；公告流程 Z 节已摘除 | — |
| `arb_event_context.mjs` | 研判上下文包 CLI（按条目 id 输出当刻实测全集，含 F1 独立 USD 锚 usdAnchorRef） | 研判 agent 调用 |
| `arb_mark_done.mjs` | 研判收尾 CLI（写 done 账本 + 删队列 + 回写 depeg 状态） | 研判 agent 调用 |

## 手动/辅助（不常驻）

| 脚本 | 干什么 |
|---|---|
| `backtest_depeg.mjs` / `backtest_depeg_v2.mjs` | 脱锚回测（v1 日线 / v2 小时线+双源） |
| `check_cex_deposit.mjs` | 查 CEX 充提状态（套利路径用） |
| `supply_flow_watch.mjs` | 供应量/资金流监控（辅助） |
| `build_arb/` | 元地址库建库工具（Keccak/RPC 拉 Borrow 事件、建 sqlite），一次性已跑完，保留复现 |
| `ARB_INTEGRATION.md` | 套利体系整合设计文档（架构/口径/运维账） |
| `arb_addresses.md` | 元套利地址可读名单（含 61 口径对账）；数据在 `state/arb_addresses.sqlite` |

## 快速判断

- `sweep_loop.sh`、`server.js`、`cex_lst_watch.mjs`、`depeg_logic.mjs` 是核心链路，动之前先看调用关系
- 改 `depeg_logic.mjs` 的币种 legs（如摘除坏点源）要同步验证 history 不再刷屏
