#!/bin/bash
# Easy Skill 启动脚本
# 用法: ./start.sh [start|stop|restart|status|logs [backend|frontend]]

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$ROOT_DIR/$(basename "$0")"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

BACKEND_PORT=8080
FRONTEND_PORT=3000
BACKEND_READY_TIMEOUT=90   # Spring Boot 冷启动较慢，给足时间
FRONTEND_READY_TIMEOUT=30

JAVA17_HOME="/Users/rainman/Library/Java/JavaVirtualMachines/oracle_open_jdk-17/Contents/Home"

mkdir -p "$LOG_DIR"

# ---------- 工具函数 ----------
log()   { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
ok()    { printf '\033[32m✅ %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
err()   { printf '\033[31m❌ %s\033[0m\n' "$*"; }

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

pid_alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

read_pid() {
  [ -f "$1" ] && cat "$1" 2>/dev/null
}

rotate_log() {
  # 保留上次日志为 .prev，避免多次启动产生大量文件
  [ -f "$1" ] && mv "$1" "$1.prev"
}

# ---------- 预检 ----------
preflight() {
  local missing=0
  for cmd in mvn npm node curl lsof ffmpeg; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "缺少依赖: $cmd"
      missing=1
    fi
  done
  [ "$missing" = "1" ] && exit 1

  if [ -d "$JAVA17_HOME" ]; then
    export JAVA_HOME="$JAVA17_HOME"
  fi
  local java_major
  java_major=$("${JAVA_HOME:-}/bin/java" -version 2>&1 | awk -F '"' '/version/ {print $2}' | awk -F'.' '{print $1}')
  if [ -z "$java_major" ] || [ "$java_major" -lt 17 ] 2>/dev/null; then
    err "需要 Java 17+ (当前 JAVA_HOME=${JAVA_HOME:-未设置})"
    exit 1
  fi
}

# ---------- 后端 ----------
start_backend() {
  local old_pid
  old_pid="$(read_pid "$BACKEND_PID_FILE")"
  if pid_alive "$old_pid"; then
    warn "后端已在运行 (PID $old_pid)，跳过"
    return 0
  fi
  if port_in_use "$BACKEND_PORT"; then
    err "端口 $BACKEND_PORT 已被占用，请先释放 (lsof -iTCP:$BACKEND_PORT)"
    return 1
  fi

  rotate_log "$BACKEND_LOG"
  log "[Backend] 启动 Spring Boot (JAVA_HOME=$JAVA_HOME)"
  (
    cd "$ROOT_DIR/backend" && \
    nohup mvn spring-boot:run -q > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )
  disown 2>/dev/null || true

  log "[Backend] 等待端口 $BACKEND_PORT 和 /api/skills 就绪 (最长 ${BACKEND_READY_TIMEOUT}s)"
  local i
  for ((i=1; i<=BACKEND_READY_TIMEOUT; i++)); do
    if port_in_use "$BACKEND_PORT" && \
       curl -fs "http://localhost:$BACKEND_PORT/api/skills" >/dev/null 2>&1; then
      ok "[Backend] 就绪 (PID $(read_pid "$BACKEND_PID_FILE"), ${i}s)"
      return 0
    fi
    # 如果进程挂了，立刻报错
    if ! pid_alive "$(read_pid "$BACKEND_PID_FILE")"; then
      err "[Backend] 进程意外退出，查看日志: $BACKEND_LOG"
      return 1
    fi
    sleep 1
  done
  err "[Backend] ${BACKEND_READY_TIMEOUT}s 内未就绪，查看日志: $BACKEND_LOG"
  return 1
}

# ---------- 前端 ----------
start_frontend() {
  local old_pid
  old_pid="$(read_pid "$FRONTEND_PID_FILE")"
  if pid_alive "$old_pid"; then
    warn "前端已在运行 (PID $old_pid)，跳过"
    return 0
  fi
  if port_in_use "$FRONTEND_PORT"; then
    err "端口 $FRONTEND_PORT 已被占用，请先释放 (lsof -iTCP:$FRONTEND_PORT)"
    return 1
  fi

  if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    log "[Frontend] 首次运行，安装依赖..."
    (cd "$ROOT_DIR/frontend" && npm install -q) || { err "npm install 失败"; return 1; }
  fi

  rotate_log "$FRONTEND_LOG"
  log "[Frontend] 启动 Vite"
  (
    cd "$ROOT_DIR/frontend" && \
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )
  disown 2>/dev/null || true

  local i
  for ((i=1; i<=FRONTEND_READY_TIMEOUT; i++)); do
    if port_in_use "$FRONTEND_PORT"; then
      ok "[Frontend] 就绪 (PID $(read_pid "$FRONTEND_PID_FILE"), ${i}s)"
      return 0
    fi
    if ! pid_alive "$(read_pid "$FRONTEND_PID_FILE")"; then
      err "[Frontend] 进程意外退出，查看日志: $FRONTEND_LOG"
      return 1
    fi
    sleep 1
  done
  err "[Frontend] ${FRONTEND_READY_TIMEOUT}s 内未就绪，查看日志: $FRONTEND_LOG"
  return 1
}

# ---------- 停止 ----------
stop_one() {
  local name="$1" pid_file="$2"
  local pid
  pid="$(read_pid "$pid_file")"
  if pid_alive "$pid"; then
    log "[$name] 停止 PID $pid"
    kill "$pid" 2>/dev/null
    for _ in {1..10}; do
      pid_alive "$pid" || break
      sleep 1
    done
    if pid_alive "$pid"; then
      warn "[$name] 未响应 SIGTERM，发送 SIGKILL"
      kill -9 "$pid" 2>/dev/null
    fi
    ok "[$name] 已停止"
  else
    log "[$name] 未运行"
  fi
  rm -f "$pid_file"
}

stop_all() {
  stop_one "Frontend" "$FRONTEND_PID_FILE"
  stop_one "Backend"  "$BACKEND_PID_FILE"
}

# 强制停止：杀 PID + 子进程，并用 lsof 清理端口孤儿（mvn→java、npm→node 常残留）
force_stop_one() {
  local name="$1" pid_file="$2" port="$3"
  local pid
  pid="$(read_pid "$pid_file")"

  if pid_alive "$pid"; then
    log "[$name] 强制停止 PID $pid (含子进程)"
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill  -TERM    "$pid" 2>/dev/null || true
    for _ in 1 2 3; do
      pid_alive "$pid" || break
      sleep 1
    done
    if pid_alive "$pid"; then
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill  -KILL    "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pid_file"

  # 端口兜底：清理任何仍监听该端口的孤儿进程
  if port_in_use "$port"; then
    local orphans
    orphans=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')
    if [ -n "$orphans" ]; then
      warn "[$name] 端口 $port 仍被占用 (PID: $orphans)，强制清理"
      echo "$orphans" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
  ok "[$name] 已停止"
}

force_stop_all() {
  force_stop_one "Frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"
  force_stop_one "Backend"  "$BACKEND_PID_FILE"  "$BACKEND_PORT"
}

# ---------- 状态 ----------
status() {
  local bpid fpid
  bpid="$(read_pid "$BACKEND_PID_FILE")"
  fpid="$(read_pid "$FRONTEND_PID_FILE")"
  printf '\n%-10s %-8s %-12s %s\n' "服务" "PID" "端口" "状态"
  printf '%-10s %-8s %-12s %s\n' "--------" "------" "------" "------"
  if pid_alive "$bpid"; then
    printf '%-10s %-8s %-12s \033[32m%s\033[0m\n' "Backend"  "$bpid" "$BACKEND_PORT"  "RUNNING"
  else
    printf '%-10s %-8s %-12s \033[31m%s\033[0m\n' "Backend"  "-"     "$BACKEND_PORT"  "STOPPED"
  fi
  if pid_alive "$fpid"; then
    printf '%-10s %-8s %-12s \033[32m%s\033[0m\n' "Frontend" "$fpid" "$FRONTEND_PORT" "RUNNING"
  else
    printf '%-10s %-8s %-12s \033[31m%s\033[0m\n' "Frontend" "-"     "$FRONTEND_PORT" "STOPPED"
  fi
  echo ""
  echo "日志目录: $LOG_DIR"
}

# ---------- 查看日志 ----------
tail_logs() {
  local which="${1:-both}"
  case "$which" in
    backend)  tail -f "$BACKEND_LOG" ;;
    frontend) tail -f "$FRONTEND_LOG" ;;
    both|"")  tail -f "$BACKEND_LOG" "$FRONTEND_LOG" ;;
    *) err "未知日志目标: $which (可选: backend|frontend|both)"; exit 1 ;;
  esac
}

# ---------- 入口 ----------
cmd="${1:-start}"
case "$cmd" in
  start)
    preflight
    start_backend  || { stop_all; exit 1; }
    start_frontend || { stop_all; exit 1; }
    echo ""
    ok "Easy Skill 已后台启动"
    echo "  前端: http://localhost:$FRONTEND_PORT"
    echo "  后端: http://localhost:$BACKEND_PORT"
    echo ""
    echo "常用命令:"
    echo "  ./start.sh status       # 查看状态"
    echo "  ./start.sh logs         # 查看两端日志"
    echo "  ./start.sh logs backend # 仅后端日志"
    echo "  ./start.sh stop         # 停止服务"
    ;;
  stop)    stop_all ;;
  restart) force_stop_all; sleep 1; exec "$SCRIPT_PATH" start ;;
  status)  status ;;
  logs)    tail_logs "${2:-both}" ;;
  *)
    echo "用法: $0 [start|stop|restart|status|logs [backend|frontend]]"
    exit 1
    ;;
esac
