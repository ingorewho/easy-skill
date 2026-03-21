"""
窗口监控模块
使用 Quartz + PyObjC 监听窗口变化
"""

import time
import subprocess
import threading
from typing import Callable, Optional, Dict, Any


class WindowWatcher:
    """窗口变化监控器 - 使用 Quartz API 检测活动窗口"""

    def __init__(self, event_callback: Callable):
        """
        初始化窗口监控器

        Args:
            event_callback: 窗口变化时的回调函数
        """
        self.event_callback = event_callback
        self.monitoring = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.last_state: Optional[Dict[str, Any]] = None
        self.poll_interval = 0.5  # 轮询间隔（秒）

    def get_active_window_info(self) -> Optional[Dict[str, Any]]:
        """
        获取当前活动窗口信息

        Returns:
            窗口信息字典，包含 timestamp, app_name, window_title, pid, bundle_id
        """
        try:
            # 使用 AppleScript 获取前端应用信息（最可靠的方法）
            script = '''
                tell application "System Events"
                    set frontApp to name of first application process whose frontmost is true
                    set frontAppPath to POSIX path of (path to frontmost application)
                end tell
                tell application frontApp
                    set windowTitle to name of front window
                end tell
                return frontApp & "|" & windowTitle & "|" & frontAppPath
            '''

            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=2
            )

            if result.returncode == 0:
                parts = result.stdout.strip().split('|')
                if len(parts) >= 2:
                    app_name = parts[0]
                    window_title = parts[1] if len(parts) > 1 else ''
                    app_path = parts[2] if len(parts) > 2 else ''

                    # 提取 bundle ID
                    bundle_id = ''
                    if app_path:
                        try:
                            bid_result = subprocess.run(
                                ['mdls', '-name', 'kMDItemCFBundleIdentifier', '-raw', app_path],
                                capture_output=True,
                                text=True,
                                timeout=1
                            )
                            if bid_result.returncode == 0:
                                bundle_id = bid_result.stdout.strip()
                                if bundle_id == '(null)':
                                    bundle_id = ''
                        except:
                            pass

                    return {
                        'timestamp': time.time(),
                        'app_name': app_name,
                        'window_title': window_title,
                        'pid': 0,  # AppleScript 方式不直接提供 PID
                        'bundle_id': bundle_id
                    }

        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            # 静默处理错误，避免频繁报错
            pass

        # 备选方案：尝试使用 Quartz
        return self._get_window_info_quartz()

    def _get_window_info_quartz(self) -> Optional[Dict[str, Any]]:
        """使用 Quartz API 获取窗口信息（备选方案）"""
        try:
            # 导入 Quartz 库
            from Quartz import (
                CGWindowListCopyWindowInfo,
                kCGWindowListExcludeDesktopElements,
                kCGWindowListOptionOnScreenOnly,
                kCGNullWindowID
            )

            window_list = CGWindowListCopyWindowInfo(
                kCGWindowListExcludeDesktopElements | kCGWindowListOptionOnScreenOnly,
                kCGNullWindowID
            )

            # 找到最前面的窗口（通常是活动窗口）
            for window in window_list:
                layer = window.get('kCGWindowLayer', 99)
                if layer == 0:  # 普通窗口层
                    app_name = window.get('kCGWindowOwnerName', 'Unknown')
                    window_title = window.get('kCGWindowName', '')
                    pid = window.get('kCGWindowOwnerPID', 0)

                    # Quartz 获取的标题经常为空，尝试用 AppleScript 补充
                    if not window_title:
                        try:
                            script = f'tell application "{app_name}" to return name of front window'
                            result = subprocess.run(
                                ['osascript', '-e', script],
                                capture_output=True,
                                text=True,
                                timeout=1
                            )
                            if result.returncode == 0:
                                window_title = result.stdout.strip()
                        except:
                            pass

                    return {
                        'timestamp': time.time(),
                        'app_name': app_name,
                        'window_title': window_title,
                        'pid': pid,
                        'bundle_id': ''
                    }

        except ImportError:
            # Quartz 不可用
            pass
        except Exception:
            pass

        return None

    def _monitor_loop(self):
        """监控循环 - 在主线程中运行"""
        while self.monitoring:
            try:
                current = self.get_active_window_info()

                if current and self._state_changed(self.last_state, current):
                    # 调用回调函数
                    if hasattr(self.event_callback, 'on_window_change'):
                        self.event_callback.on_window_change(self.last_state, current)
                    elif callable(self.event_callback):
                        self.event_callback(self.last_state, current)

                    self.last_state = current

            except Exception as e:
                print(f"Error in monitor loop: {e}")

            time.sleep(self.poll_interval)

    def _state_changed(self, old: Optional[dict], new: dict) -> bool:
        """
        判断窗口状态是否变化

        忽略只有窗口标题微调的情况（如时间变化）
        """
        if not old:
            return True

        # 应用变化必定记录
        if old.get('app_name') != new.get('app_name'):
            return True

        # 窗口标题变化需要判断
        old_title = old.get('window_title', '')
        new_title = new.get('window_title', '')

        if old_title != new_title:
            # 忽略常见的动态标题（如音乐播放器的时间显示）
            # 简单比较：如果相似度很高，可能是动态更新
            if self._titles_similar(old_title, new_title):
                return False
            return True

        return False

    def _titles_similar(self, title1: str, title2: str) -> bool:
        """判断两个标题是否相似（可能是同一窗口的动态更新）"""
        if not title1 or not title2:
            return False

        # 如果长度差异很大，可能不是同一内容
        if abs(len(title1) - len(title2)) > 20:
            return False

        # 计算最长公共子串
        from difflib import SequenceMatcher
        similarity = SequenceMatcher(None, title1, title2).ratio()

        # 相似度高于 0.8 认为是同一窗口的动态更新
        return similarity > 0.8

    def start_monitoring(self):
        """开始监控 - 阻塞调用，在监控循环中保持运行"""
        self.monitoring = True

        # 初始化 last_state
        self.last_state = self.get_active_window_info()

        # 启动监控循环
        self._monitor_loop()

    def stop(self):
        """停止监控"""
        self.monitoring = False

    def is_monitoring(self) -> bool:
        """检查是否正在监控"""
        return self.monitoring
