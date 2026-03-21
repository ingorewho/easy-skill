"""
事件记录器
处理窗口变化事件并生成结构化记录
"""

import re
import time
from datetime import datetime
from typing import Optional, Dict, Any

from config import EXCLUDE_APPS, MIN_RECORD_DURATION


class EventLogger:
    """事件记录器 - 处理窗口变化并生成结构化记录"""

    # 操作类型分类规则
    OPERATION_TYPES = {
        'browsing': ['chrome', 'safari', 'firefox', 'edge', 'arc', 'brave', 'opera'],
        'coding': ['code', 'vscode', 'cursor', 'pycharm', 'intellij', 'webstorm', 'goland', 'clion', 'rider'],
        'terminal': ['terminal', 'iterm', 'warp', 'alacritty', 'kitty', 'wezterm'],
        'communication': ['slack', 'wechat', 'telegram', 'discord', 'zoom', 'teams', 'feishu', 'dingtalk'],
        'email': ['mail', 'outlook', 'thunderbird', 'spark'],
        'design': ['figma', 'sketch', 'photoshop', 'illustrator', 'adobe xd', 'principle'],
        'media': ['spotify', 'music', 'youtube', 'netflix', 'vlc', 'iina'],
        'document': ['pages', 'numbers', 'keynote', 'word', 'excel', 'powerpoint', 'notion', 'obsidian'],
        'database': ['tableplus', 'datagrip', 'sequel pro', 'navicat', 'pgadmin', 'dbeaver'],
    }

    def __init__(self, storage_manager):
        self.storage = storage_manager
        self.session_start = time.time()
        self.current_activity: Optional[Dict[str, Any]] = None
        self.last_window_title = None

    def on_window_change(self, old_window: Optional[dict], new_window: dict):
        """
        窗口变化回调

        Args:
            old_window: 上一个窗口信息
            new_window: 新窗口信息
        """
        if not new_window:
            return

        # 检查是否需要排除此应用
        app_name = new_window.get('app_name', 'Unknown')
        if self._should_exclude_app(app_name):
            return

        # 计算上一个活动的持续时间
        if self.current_activity:
            duration = time.time() - self.current_activity['start_time']
            if duration >= MIN_RECORD_DURATION:
                self._save_activity(self.current_activity, duration)

        # 创建新活动记录
        self.current_activity = {
            'start_time': time.time(),
            'app_name': app_name,
            'window_title': new_window.get('window_title', ''),
            'pid': new_window.get('pid', 0),
            'bundle_id': new_window.get('bundle_id', ''),
            'operation_type': self._classify_operation(new_window),
            'core_elements': self._extract_core_elements(new_window)
        }

        self.last_window_title = new_window.get('window_title', '')

    def _should_exclude_app(self, app_name: str) -> bool:
        """检查是否应该排除此应用"""
        return app_name in EXCLUDE_APPS

    def _classify_operation(self, window: dict) -> str:
        """
        根据应用名称分类操作类型

        Args:
            window: 窗口信息字典

        Returns:
            操作类型字符串
        """
        app = window.get('app_name', '').lower()
        title = window.get('window_title', '').lower()

        # 根据应用名称匹配类型
        for op_type, apps in self.OPERATION_TYPES.items():
            if any(a in app for a in apps):
                return op_type

        # 根据窗口标题进一步判断
        if any(kw in title for kw in ['github', 'gitlab', 'stackoverflow']):
            return 'browsing'
        elif any(kw in title for kw in ['.py', '.js', '.ts', '.java', '.go']):
            return 'coding'

        return 'application'

    def _extract_core_elements(self, window: dict) -> Dict[str, Any]:
        """
        提取核心要素

        Args:
            window: 窗口信息字典

        Returns:
            核心要素字典
        """
        title = window.get('window_title', '')
        app = window.get('app_name', '')

        return {
            'app': app,
            'title': title,
            'domain': self._extract_domain(title),
            'project': self._extract_project(title, app),
            'file': self._extract_file(title),
            'keywords': self._extract_keywords(title, app)
        }

    def _extract_domain(self, title: str) -> Optional[str]:
        """从标题提取域名（浏览器）"""
        # 匹配常见域名模式
        patterns = [
            r'([a-zA-Z0-9-]+\.(com|org|net|io|dev|co|ai|app|cloud|tech))',
            r'([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\s+-\s+',
            r'\|\s+([a-zA-Z0-9-]+\.[a-zA-Z]{2,})',
        ]

        for pattern in patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                domain = match.group(1).lower()
                # 过滤掉常见非域名词汇
                if domain not in ['http', 'https', 'www']:
                    return domain

        # 特殊处理：提取 GitHub/GitLab 仓库名
        if 'github.com' in title.lower():
            match = re.search(r'github\.com/([^/]+/[^/]+)', title)
            if match:
                return f"github.com/{match.group(1)}"

        return None

    def _extract_project(self, title: str, app: str) -> Optional[str]:
        """提取项目名称"""
        app_lower = app.lower()

        # VSCode/Cursor: "filename - project - Code"
        if any(code in app_lower for code in ['code', 'cursor']):
            parts = title.split(' - ')
            if len(parts) >= 2:
                # 通常是倒数第二个部分
                project = parts[-2].strip()
                if project and project not in ['Code', 'Cursor']:
                    return project

        # IntelliJ 系列: "filename [project] - App"
        match = re.search(r'\[([^\]]+)\]', title)
        if match:
            return match.group(1).strip()

        # 从路径提取
        match = re.search(r'(?:/|^)([a-zA-Z0-9_-]+)/(?:src|lib|app|pages)', title)
        if match:
            return match.group(1)

        return None

    def _extract_file(self, title: str) -> Optional[str]:
        """提取文件名"""
        # 匹配常见代码文件扩展名
        file_pattern = r'([a-zA-Z0-9_\-\.]+\.(py|js|ts|jsx|tsx|java|go|rs|rb|php|swift|kt|scala|cpp|c|h|hpp|cs|fs|ex|exs|jl|lua|r|m|mm|vue|svelte|css|scss|sass|less|html|htm|xml|json|yaml|yml|toml|md|txt|sh|zsh|bash|fish|ps1|bat|cmd))'

        match = re.search(file_pattern, title, re.IGNORECASE)
        if match:
            return match.group(1)

        # 匹配一般文件名（有扩展名）
        general_pattern = r'([a-zA-Z0-9_-]+\.[a-zA-Z0-9]{1,10})\b'
        match = re.search(general_pattern, title)
        if match:
            return match.group(1)

        return None

    def _extract_keywords(self, title: str, app: str) -> list:
        """提取关键词"""
        keywords = set()

        # 提取技术关键词
        tech_keywords = [
            'python', 'javascript', 'typescript', 'react', 'vue', 'angular',
            'node', 'docker', 'kubernetes', 'aws', 'gcp', 'azure',
            'database', 'api', 'frontend', 'backend', 'devops', 'ai', 'ml',
            'testing', 'debug', 'deploy', 'git', 'pr', 'issue', 'bug', 'feature'
        ]

        title_lower = title.lower()
        for kw in tech_keywords:
            if kw in title_lower:
                keywords.add(kw)

        return list(keywords)

    def _save_activity(self, activity: dict, duration: float):
        """保存活动记录到存储"""
        record = {
            'timestamp': datetime.fromtimestamp(activity['start_time']).isoformat(),
            'end_time': datetime.now().isoformat(),
            'duration_seconds': round(duration, 2),
            'app_name': activity['app_name'],
            'window_title': activity['window_title'],
            'operation_type': activity['operation_type'],
            'core_elements': activity['core_elements']
        }
        self.storage.append_record(record)

    def flush(self):
        """强制保存当前活动（用于程序退出时）"""
        if self.current_activity:
            duration = time.time() - self.current_activity['start_time']
            if duration >= MIN_RECORD_DURATION:
                self._save_activity(self.current_activity, duration)
            self.current_activity = None
