#!/usr/bin/env python3
"""
macOS Activity Monitor
实时监控窗口切换、应用激活等系统事件

用法:
    python3 monitor.py start     # 启动监控
    python3 monitor.py stop      # 停止监控
    python3 monitor.py status    # 查看状态
"""

import sys
import os
import signal
import time
import argparse
from pathlib import Path

# 添加 lib 目录和 skill 目录到路径
script_dir = Path(__file__).parent
skill_dir = script_dir.parent
sys.path.insert(0, str(script_dir))
sys.path.insert(0, str(skill_dir))

from lib.window_watcher import WindowWatcher
from lib.event_logger import EventLogger
from lib.storage import StorageManager
from lib.summarizer import DailySummarizer
from config import STORAGE_DIR, LOCK_FILE, PROJECT_STORAGE_DIR, LOG_DIR


class ActivityMonitor:
    """活动监控主类"""

    def __init__(self):
        self.watcher = None
        self.logger = None
        self.storage = None
        self.running = False
        self._shutdown_requested = False

    def start(self):
        """启动监控"""
        # 检查是否已在运行
        if LOCK_FILE.exists():
            pid = LOCK_FILE.read_text().strip()
            print(f"Monitor is already running! (PID: {pid})")
            print(f"Lock file: {LOCK_FILE}")
            sys.exit(1)

        # 确保目录存在
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        PROJECT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        LOG_DIR.mkdir(parents=True, exist_ok=True)

        # 初始化组件
        self.storage = StorageManager(PROJECT_STORAGE_DIR)
        self.logger = EventLogger(self.storage)
        self.watcher = WindowWatcher(self.logger)

        # 创建锁文件，记录当前进程 PID
        try:
            LOCK_FILE.write_text(str(os.getpid()))
        except Exception as e:
            print(f"Error creating lock file: {e}")
            sys.exit(1)

        # 设置信号处理
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        self.running = True
        print("=" * 50)
        print("Activity monitor started successfully!")
        print(f"Storage directory: {PROJECT_STORAGE_DIR}")
        print(f"Lock file: {LOCK_FILE}")
        print("Press Ctrl+C to stop")
        print("=" * 50)

        try:
            # 启动监控循环（阻塞）
            self.watcher.start_monitoring()
        except KeyboardInterrupt:
            print("\nReceived keyboard interrupt")
        finally:
            self.stop()

    def stop(self):
        """停止监控"""
        if not self.running and not LOCK_FILE.exists():
            return

        self.running = False
        self._shutdown_requested = True

        print("\nStopping monitor...")

        # 停止 watcher
        if self.watcher:
            self.watcher.stop()

        # 刷新最后的活动记录
        if self.logger:
            self.logger.flush()

        # 删除锁文件
        try:
            if LOCK_FILE.exists():
                LOCK_FILE.unlink()
                print("Lock file removed")
        except Exception as e:
            print(f"Error removing lock file: {e}")

        print("Monitor stopped.")

    def status(self):
        """显示监控状态"""
        if LOCK_FILE.exists():
            try:
                pid = int(LOCK_FILE.read_text().strip())
                # 检查进程是否确实存在
                os.kill(pid, 0)  # 信号 0 不发送信号，只检查进程

                # 获取存储统计
                storage = StorageManager(PROJECT_STORAGE_DIR)
                stats = storage.get_storage_stats()

                print("=" * 50)
                print("✅ Monitor is RUNNING")
                print(f"   PID: {pid}")
                print(f"   Lock file: {LOCK_FILE}")
                print(f"   Storage: {PROJECT_STORAGE_DIR}")
                print()
                print("📊 Storage Statistics:")
                print(f"   Total days: {stats['total_days']}")
                print(f"   Total size: {stats['total_size_mb']:.2f} MB")
                if stats['latest_date']:
                    print(f"   Latest record: {stats['latest_date']}")
                print("=" * 50)

            except (ValueError, OSError, ProcessLookupError):
                # 进程不存在，清理锁文件
                print("⚠️  Stale lock file found. Cleaning up...")
                try:
                    LOCK_FILE.unlink()
                    print("Lock file removed. Monitor is not running.")
                except Exception as e:
                    print(f"Error removing lock file: {e}")
        else:
            print("=" * 50)
            print("❌ Monitor is NOT running")
            print(f"   Storage directory: {PROJECT_STORAGE_DIR}")

            # 显示存储统计
            try:
                storage = StorageManager(PROJECT_STORAGE_DIR)
                stats = storage.get_storage_stats()
                if stats['total_days'] > 0:
                    print()
                    print("📊 Existing Records:")
                    print(f"   Total days: {stats['total_days']}")
                    print(f"   Total size: {stats['total_size_mb']:.2f} MB")
                    if stats['latest_date']:
                        print(f"   Latest record: {stats['latest_date']}")
            except Exception:
                pass

            print("=" * 50)

    def _signal_handler(self, signum, frame):
        """处理系统信号"""
        signal_name = signal.Signals(signum).name if hasattr(signal, 'Signals') else str(signum)
        print(f"\nReceived signal: {signal_name}")
        self.stop()
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="macOS Activity Monitor - 记录系统活动",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s start        # 启动监控
  %(prog)s stop         # 停止监控
  %(prog)s status       # 查看状态
  %(prog)s summary      # 生成今日摘要
        """
    )
    parser.add_argument(
        'action',
        choices=['start', 'stop', 'status', 'summary'],
        help='要执行的操作'
    )
    parser.add_argument(
        '--date',
        metavar='YYYY-MM-DD',
        help='指定日期（用于 summary 操作）'
    )

    args = parser.parse_args()

    monitor = ActivityMonitor()

    if args.action == 'start':
        monitor.start()
    elif args.action == 'stop':
        if LOCK_FILE.exists():
            try:
                pid = int(LOCK_FILE.read_text().strip())
                os.kill(pid, signal.SIGTERM)
                print(f"Sent stop signal to monitor (PID: {pid})")
                # 等待锁文件消失
                for _ in range(10):
                    if not LOCK_FILE.exists():
                        print("Monitor stopped successfully")
                        break
                    time.sleep(0.5)
                else:
                    print("Warning: Monitor may not have stopped cleanly")
            except (ValueError, ProcessLookupError):
                print("Monitor process not found. Removing stale lock file...")
                LOCK_FILE.unlink()
            except PermissionError:
                print("Permission denied. Try running with sudo?")
        else:
            print("Monitor is not running.")
    elif args.action == 'status':
        monitor.status()
    elif args.action == 'summary':
        date_str = args.date or time.strftime('%Y-%m-%d')
        storage = StorageManager(PROJECT_STORAGE_DIR)
        summarizer = DailySummarizer(storage)
        result = summarizer.summarize_day(date_str)
        print(result['summary_text'])


if __name__ == "__main__":
    main()
