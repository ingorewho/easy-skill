# Record Skill

系统活动记录与每日总结 Skill for Claude Code。

## 功能

- 🔴 **实时监控**：记录窗口切换、应用使用等操作
- 📊 **每日总结**：生成详细的活动报告
- 🎯 **生产力评分**：基于操作类型计算生产力分数
- 📁 **项目管理**：自动提取涉及的项目和文件
- 🔒 **本地存储**：所有数据保存在本地

## 快速开始

### 1. 安装依赖

```bash
cd ~/.claude/record-monitor
pip3 install -r requirements.txt
```

### 2. 授予权限

首次使用时，需要授予辅助功能权限：
1. 打开 系统设置 → 隐私与安全 → 辅助功能
2. 添加并启用终端应用

### 3. 使用 Skill

在 Claude Code 中：

```
# 启动监控
/record_start

# 查看状态
/record_status

# 生成今日总结
/summary_today

# 停止监控
/record_stop
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `/record_start` | 启动监控程序 |
| `/record_stop` | 停止监控程序 |
| `/record_status` | 查看监控状态 |
| `/summary_today` | 今日活动总结 |
| `/summary_date YYYY-MM-DD` | 指定日期总结 |
| `/summary_range start end` | 日期范围总结 |

## 数据存储

数据按天存储在 `records/YYYY-MM-DD.json`，格式为 JSON Lines：

```json
{
  "timestamp": "2025-02-20T14:30:15",
  "app_name": "Visual Studio Code",
  "operation_type": "coding",
  "core_elements": {
    "project": "easy-skill",
    "file": "monitor.py"
  }
}
```

## 目录结构

```
easy-skill/
├── .claude/skills/record-skill/
│   ├── SKILL.md          # Skill 定义
│   └── README.md         # 本文件
└── records/              # 数据存储目录
    ├── 2025-02-20.json
    └── ...

~/.claude/record-monitor/   # 监控程序
├── monitor.py
├── lib/
│   ├── window_watcher.py
│   ├── event_logger.py
│   ├── storage.py
│   └── summarizer.py
└── storage/
    └── current.lock
```

## 配置

编辑 `~/.claude/record-monitor/config.py`：

```python
# 排除的应用（不记录）
EXCLUDE_APPS = ['System Settings', 'Finder']

# 最小记录时长（秒）
MIN_RECORD_DURATION = 1.0

# 轮询间隔（秒）
POLL_INTERVAL = 0.5
```

## 故障排查

### 无法启动监控
```bash
# 检查锁文件
ls -la ~/.claude/record-monitor/storage/current.lock

# 手动删除锁文件
rm ~/.claude/record-monitor/storage/current.lock
```

### 测试监控程序
```bash
# 前台启动（查看调试信息）
python3 ~/.claude/record-monitor/monitor.py start

# 在另一个终端查看记录
tail -f records/$(date +%Y-%m-%d).json
```

## License

MIT
