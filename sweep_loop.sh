#!/bin/bash
# sweep_loop.sh — 稳定币脱锚常驻 5 分钟巡检（2026-10-04 从 cron worker 改为常驻，省额度）
# 每 5 分钟做五件事：
#   A. 快线看门狗：server.js 健康检查，挂了就重启
#   B. CEX 稳定币现货 + LST 监控：跑 node cex_lst_watch.mjs（脚本自带静默/去重规则）
#   C. 主流币三方价差监控 arb_spread_watch.mjs（2026-10-30 整合：越线只入队深化）
#   D. 元套利地址跟踪 arb_addr_watch.mjs（2026-10-30 整合：Aave 事件增量+种子过滤）
#   E. 研判兜底 arb_fallback.mjs（2026-10-30 整合：入队超 10 分钟未研判必提示）
#   F. 快讯点火 news_ignite_watch.mjs（2026-10-30 整合：TG 公开源触发待核事件，
#      脚本侧市场核查过升级门才入统一研判队列；新闻只点火、不定性）
# 保活：cron sweep-loop-watchdog 每 1 小时检查本循环是否存活、且心跳是否新鲜，死了/卡了就拉起。
# 日志：sweep_loop.log（超 5MB 自动只保留最后 3000 行）
# review 记录（2026-10-04）：
#   - R1: 循环被 kill 时 lockdir 会残留，导致之后每轮都"上一轮未结束"——启动时清理 + EXIT trap
#   - R2: 保活只查进程存在，查不出"进程活着但卡死"——每轮结束写心跳文件，保活检查心跳新鲜度
#   - R3: pkill 后只 sleep 1 就起新 server.js，旧进程若没死透会端口冲突——等旧进程真正退出再起
#   - R4: cex 脚本无超时保护，卡住会拖住整个循环——加 timeout 240
# 2026-10-11（方案 A 自愈）：
#   - A1: ERR trap 捕获子命令失败，记日志后继续下一轮，不退出整个循环
#   - A2: 双心跳——每轮开始写一次（证明循环活着在迭代），结束写一次（证明本轮跑完）；
#         watchdog 看"开始心跳"判断存活，看"结束心跳"判断是否卡死
set -u
cd ~/workspace/stablecoin-risk-desk || exit 1

LOG="$HOME/workspace/stablecoin-risk-desk/sweep_loop.log"
LOCKDIR="$HOME/workspace/stablecoin-risk-desk/sweep_loop.lock"
PIDFILE="$HOME/workspace/stablecoin-risk-desk/sweep_loop.pid"
HEARTBEAT="$HOME/workspace/stablecoin-risk-desk/sweep_loop.heartbeat"

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

rotate_log() {
  if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
    tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
    log "日志轮转：截断到最后 3000 行"
  fi
}

# R1: 单实例由保活 cron 的 PID 文件保证；启动时清掉上次残留的锁，退出时也清
rmdir "$LOCKDIR" 2>/dev/null
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT
# A1: 子命令失败只记日志，不退出整个循环（自愈）
trap 'log "WARN: 子命令失败（行 $LINENO），继续下一轮"' ERR

log "sweep_loop 启动 (pid $$)"
echo $$ > "$PIDFILE"
touch "$HEARTBEAT"

while true; do
  rotate_log
  # A2: 每轮开始先写心跳——证明循环活着在迭代（watchdog 用此判断存活）
  touch "$HEARTBEAT"
  # mkdir 原子锁：上一轮没跑完则跳过本轮，防止堆积
  if mkdir "$LOCKDIR" 2>/dev/null; then
    # A. 快线看门狗
    if ! curl -s -m 10 http://127.0.0.1:8787/api/health 2>/dev/null | grep -q '"ok":true'; then
      log "server.js 不健康，执行重启"
      # 精确匹配，严禁用宽泛 pkill（2026-10-04 教训：宽泛匹配会杀掉执行它的 shell 自身）
      # 2026-10-18：加 || true——没匹配到进程时 pkill 返回非零是正常的（server 本来就死了），不触发 ERR trap
      pkill -f "^node server\.js$" 2>/dev/null || true
      # R3: 等旧进程真正退出（最多 10 秒），避免端口冲突；还不死就 SIGKILL
      for _ in $(seq 1 10); do
        pgrep -f "^node server\.js$" >/dev/null || break
        sleep 1
      done
      if pgrep -f "^node server\.js$" >/dev/null; then
        log "旧 server.js 10 秒未退出，SIGKILL"
        pkill -9 -f "^node server\.js$" 2>/dev/null; sleep 2
      fi
      DEPEG_MONITOR_ENABLED=1 setsid nohup node server.js >> depeg_service.log 2>&1 < /dev/null &
      sleep 10
      if curl -s -m 10 http://127.0.0.1:8787/api/health 2>/dev/null | grep -q '"ok":true'; then
        log "server.js 重启成功"
      else
        log "server.js 重启失败，需人工介入"
      fi
    fi
    # B. CEX 稳定币 + LST（脚本自带 08:00–10:00 静默、半夜不 Bark、30 分钟去重）
    # R4: 240 秒超时保护，防止脚本卡住拖死循环
    timeout 240 /usr/bin/node cex_lst_watch.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "cex_lst_watch 退出码 $RC（124=超时被杀）"
    fi
    # C. 主流币三方价差监控（2026-10-30 整合）：ETH/WBTC 的 DEX 白名单池 vs 币安
    # 中间价 vs Chainlink 预言机三方比对，越线只入队深化研判、不直推（脚本自带
    # +25 秒复采确认、峰值记录、带宽去重）。价差爆发加密采样时单轮可拉长，故 280 秒超时。
    timeout 280 /usr/bin/node arb_spread_watch.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "arb_spread_watch 退出码 $RC（124=超时被杀）"
    fi
    # C2. 冻结期跨所现货价差盯盘（2026-10-30 临时线，脚本内到期 2026-11-13 自停）：
    # TRX/ETH 在 Binance/Gate/OKX/KuCoin 的中间价差 + $10k 盘口模拟，
    # 可成交价差越线只入队深化、不直推；冻结场所腿在 factsText 标注 F7。
    timeout 120 /usr/bin/node arb_cex_cross_watch.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "arb_cex_cross_watch 退出码 $RC（124=超时被杀）"
    fi
    # D. 元套利地址跟踪（2026-10-30 整合）：Aave V3 Pool 五类事件按区块游标增量
    # 拉取，本地按种子地址库（arb_addresses.sqlite 中 watching）过滤；同一地址
    # 30 分钟累计借入 WETH/WBTC >$50 万或被清算 → 入队研判，小额只记库。
    timeout 240 /usr/bin/node arb_addr_watch.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "arb_addr_watch 退出码 $RC（124=超时被杀）"
    fi
    # E. 研判兜底（2026-10-30 整合）：统一队列条目入队超 10 分钟仍未被研判处理 →
    # 推一条简短提示（不许静默）；底层事件已消解的条目静默清除记档。
    timeout 60 /usr/bin/node arb_fallback.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "arb_fallback 退出码 $RC（124=超时被杀）"
    fi
    # F. 快讯点火（2026-10-30 整合）：TG 公开源（PeckShield/Cyvers/吴说/Foresight/
    # Odaily）关键词触发待核事件，脚本内节流 240 秒；过升级门（市场共现/双源确认+
    # 状态证据/元地址异动）才入队，未过门只记日志、6 小时过期记档，永不直推。
    timeout 120 /usr/bin/node news_ignite_watch.mjs >> "$LOG" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      log "news_ignite_watch 退出码 $RC（124=超时被杀）"
    fi
    rmdir "$LOCKDIR"
    # R2: 一轮完整跑完才算心跳
    touch "$HEARTBEAT"
  else
    log "上一轮未结束，跳过本轮"
  fi
  sleep 300
done
