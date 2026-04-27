#!/bin/bash

echo "🛑 正在终止所有 Midscene 相关进程..."

# 1. 终止 node 执行的 skill 脚本
echo "  📍 查找 node skill 进程..."
SKILL_PIDS=$(ps aux | grep -E 'node.*scripts/main\.js|node.*skill-run' | grep -v grep | awk '{print $2}')
if [ -n "$SKILL_PIDS" ]; then
    echo "  发现 skill 进程: $SKILL_PIDS"
    echo "$SKILL_PIDS" | xargs kill -9 2>/dev/null
    echo "  ✅ 已终止 skill 进程"
else
    echo "  ℹ️  未发现运行中的 skill 进程"
fi

# 2. 终止 adb 相关进程（谨慎处理，只杀与 screencap、shell 相关的）
echo "  📍 查找 ADB 相关进程..."
ADB_PIDS=$(ps aux | grep -E 'adb.*screencap|adb.*shell' | grep -v grep | awk '{print $2}')
if [ -n "$ADB_PIDS" ]; then
    echo "  发现 ADB 进程: $ADB_PIDS"
    echo "$ADB_PIDS" | xargs kill -9 2>/dev/null
    echo "  ✅ 已终止 ADB 进程"
else
    echo "  ℹ️  未发现 ADB 进程"
fi

# 3. 终止 Chrome/Chromium 调试进程（如果是 browser 平台）
echo "  📍 查找 Chrome/Chromium 调试进程..."
CHROME_PIDS=$(ps aux | grep -E 'Chrome.*--remote-debugging-port|chromium.*--remote-debugging-port' | grep -v grep | awk '{print $2}')
if [ -n "$CHROME_PIDS" ]; then
    echo "  发现 Chrome 调试进程: $CHROME_PIDS"
    echo "$CHROME_PIDS" | xargs kill -9 2>/dev/null
    echo "  ✅ 已终止 Chrome 调试进程"
else
    echo "  ℹ️  未发现 Chrome 调试进程"
fi

# 4. 清理残留的临时目录
echo "  📍 清理临时目录..."
TEMP_DIRS=$(ls -d /tmp/skill-run-* 2>/dev/null | head -20)
if [ -n "$TEMP_DIRS" ]; then
    echo "$TEMP_DIRS" | xargs rm -rf 2>/dev/null
    echo "  ✅ 已清理临时目录 ($(echo "$TEMP_DIRS" | wc -l) 个)"
else
    echo "  ℹ️  未发现临时目录"
fi

# 5. 检查是否还有残留的 node 进程（显示给用户）
echo ""
echo "📊 当前 Node 进程状态:"
NODE_PROCS=$(ps aux | grep node | grep -v grep | grep -v 'grep\|vscode\|electron')
if [ -n "$NODE_PROCS" ]; then
    echo "$NODE_PROCS" | awk '{printf "  PID: %s, 命令: %s\n", $2, $11}'
else
    echo "  无相关 node 进程"
fi

echo ""
echo "✨ 清理完成！"
echo ""
echo "💡 提示: 如果还有卡住的进程，可以手动执行:"
echo "   ps aux | grep -E 'node|adb' | grep -v grep"
echo "   kill -9 <PID>"
