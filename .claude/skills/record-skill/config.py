"""配置文件"""

from pathlib import Path

# 基础路径（相对于 skill 目录）
SKILL_DIR = Path(__file__).parent
STORAGE_DIR = SKILL_DIR / "storage"
LOG_DIR = SKILL_DIR / "logs"
LOCK_FILE = STORAGE_DIR / "current.lock"

# 项目数据存储路径（项目根目录下的 records/）
# skill_dir is skills/record-skill/, so go up 2 levels to reach project root
PROJECT_ROOT = SKILL_DIR.parent.parent  # -> easy-skill/
PROJECT_STORAGE_DIR = PROJECT_ROOT / "records"

# 监控配置
POLL_INTERVAL = 0.5  # 轮询间隔（秒）
MIN_RECORD_DURATION = 1.0  # 最小记录时长（秒）

# 存储配置
MAX_DAILY_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# 隐私配置
ANONYMIZE_TITLES = False  # 是否匿名化窗口标题
EXCLUDE_APPS = ['System Settings', 'Finder']  # 排除的应用
