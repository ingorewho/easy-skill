---
name: record-skill
description: System activity recording and daily summary skill. Controls a background monitor to track window switches, app usage, and generate daily activity summaries with productivity insights.
metadata:
  openclaw:
    emoji: "📊"
    requires:
      env:
        - RECORD_SKILL_HOME
        - RECORD_STORAGE_DIR
      bins:
        - python3
    install:
      - id: pip-deps
        kind: pip
        package: "pyobjc-framework-Quartz pyobjc-framework-ApplicationServices pyyaml"
        label: "Install Python dependencies"
user-invocable: true
---

# Record Skill - 系统活动记录与总结

此 Skill 用于控制系统活动监控程序，记录窗口切换、应用使用等操作，并生成每日总结报告。

## 支持的命令

### /record_start
启动系统活动监控程序。监控将在后台运行，记录所有窗口切换事件。

```
$ /record_start
```

### /record_stop
停止系统活动监控程序。

```
$ /record_stop
```

### /record_status
检查监控程序的运行状态和存储统计。

```
$ /record_status
```

### /summary_today
生成今天的活动总结，包括：
- 总活动时间和次数
- 应用使用分布
- 操作类型统计
- 生产力评分
- 时间线
- 今日亮点

```
$ /summary_today
```

### /summary_date [YYYY-MM-DD]
生成指定日期的活动总结。

```
$ /summary_date 2025-02-20
```

### /summary_range [start_date] [end_date]
生成指定日期范围的活动总结（如周报）。

```
$ /summary_range 2025-02-15 2025-02-20
```

### /record_config
显示当前配置信息。

```
$ /record_config
```

## 工作原理

### 监控程序
- 独立的 Python 进程，使用 AppleScript 和 Quartz API 监听窗口变化
- 监控程序位置：`.claude/skills/record-skill/scripts/monitor.py`
- 以轮询方式（0.5秒间隔）检测活动窗口

### 数据存储
- 按天存储为 JSON Lines 格式
- 存储位置：`records/YYYY-MM-DD.json`
- 包含信息：时间戳、应用名称、窗口标题、操作类型、核心要素等

### 交互方式
- Skill 通过调用 monitor.py 控制监控程序
- 通过读取 records/ 目录下的 JSON 文件生成总结

## 记录内容

每条记录包含：

```json
{
  "timestamp": "2025-02-20T14:30:15.123456",
  "end_time": "2025-02-20T14:35:20.456789",
  "duration_seconds": 305.33,
  "app_name": "Visual Studio Code",
  "window_title": "monitor.py - easy-skill - Code",
  "operation_type": "coding",
  "core_elements": {
    "app": "Visual Studio Code",
    "title": "monitor.py - easy-skill - Code",
    "domain": null,
    "project": "easy-skill",
    "file": "monitor.py",
    "keywords": ["python", "debug"]
  }
}
```

## 操作类型分类

监控程序会自动识别以下操作类型：

| 类型 | 说明 | 识别的应用 |
|------|------|-----------|
| coding | 编写代码 | VSCode, Cursor, PyCharm, IntelliJ 等 |
| browsing | 浏览网页 | Chrome, Safari, Firefox, Arc 等 |
| terminal | 终端操作 | Terminal, iTerm, Warp 等 |
| communication | 沟通协作 | Slack, WeChat, Telegram, Zoom 等 |
| email | 处理邮件 | Mail, Outlook 等 |
| design | 设计工作 | Figma, Sketch, Photoshop 等 |
| media | 媒体娱乐 | Spotify, YouTube 等 |
| document | 文档编辑 | Pages, Word, Notion 等 |
| database | 数据库操作 | TablePlus, DataGrip 等 |
| application | 其他应用 | 其他未分类应用 |

## 输出格式示例

### 每日总结

```
📊 2025-02-20 活动总结

⏱️ 总活动时间: 8.5 小时
📋 活动次数: 45 次
🎯 生产力评分: 78/100

🔝 应用使用排行:
  1. Visual Studio Code - 4.2 小时 (49%)
  2. Google Chrome - 2.1 小时 (25%)
  3. Terminal - 1.5 小时 (18%)
  4. Slack - 0.7 小时 (8%)

📊 操作类型分布:
  • 编写代码: 4.2 小时
  • 浏览网页: 2.1 小时
  • 终端操作: 1.5 小时
  • 沟通协作: 0.7 小时

✨ 今日亮点:
  🎯 专注工作: Visual Studio Code - 45分钟
  📁 涉及项目: easy-skill, another-project
  ⚡ 高强度工作 - 切换了 45 个活动窗口
```

## 隐私说明

- 所有数据仅存储在本地项目目录
- 不会上传任何数据到远程服务器
- 可随时删除 records/ 目录清理历史数据
- 排除的应用列表可在 config.py 中配置

## 系统要求

- macOS 系统
- Python 3.8+
- 辅助功能权限（首次使用时需要授权）

## 故障排查

### 监控无法启动
1. 检查是否已授予辅助功能权限
2. 查看 lock 文件：`cat .claude/skills/record-skill/storage/current.lock`
3. 手动删除锁文件后重试

### 没有记录数据
1. 确保监控正在运行：`/record_status`
2. 检查 records/ 目录是否有 JSON 文件
3. 检查是否配置了排除的应用

### 权限问题
首次使用时，需要在 系统设置 → 隐私与安全 → 辅助功能 中授予权限。

## 实现细节

当用户调用命令时，执行以下操作：

### /record_start
1. 检查监控程序是否已在运行（检查 lock 文件）
2. 如未运行，启动监控程序：`python3 .claude/skills/record-skill/scripts/monitor.py start`
3. 返回启动状态

### /record_stop
1. 检查监控程序是否在运行
2. 发送停止信号到进程
3. 返回停止状态

### /summary_today
1. 读取今天的数据文件：`records/$(date +%Y-%m-%d).json`
2. 解析所有活动记录
3. 生成统计信息和摘要
4. 以结构化格式呈现给用户
