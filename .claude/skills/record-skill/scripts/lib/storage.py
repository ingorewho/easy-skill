"""
存储管理模块
按天存储JSON数据，支持读写锁定
"""

import json
import fcntl
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional


class StorageManager:
    """存储管理器 - 负责按天存储活动记录"""

    def __init__(self, storage_dir: Path):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _get_today_file(self) -> Path:
        """获取今天的存储文件路径"""
        today = datetime.now().strftime('%Y-%m-%d')
        return self.storage_dir / f"{today}.json"

    def _get_file_for_date(self, date_str: str) -> Path:
        """获取指定日期的存储文件路径"""
        return self.storage_dir / f"{date_str}.json"

    def append_record(self, record: dict) -> bool:
        """
        追加记录到当前日期的文件
        使用文件锁保证并发安全
        """
        try:
            file_path = self._get_today_file()

            # 使用文件锁保证并发安全
            with open(file_path, 'a+') as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    # 移动到文件末尾
                    f.seek(0, 2)
                    # 写入JSON行
                    f.write(json.dumps(record, ensure_ascii=False) + '\n')
                    f.flush()
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            return True
        except Exception as e:
            print(f"Error appending record: {e}")
            return False

    def read_day_records(self, date_str: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        读取指定日期的所有记录

        Args:
            date_str: 日期字符串 (YYYY-MM-DD)，默认为今天

        Returns:
            记录列表
        """
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d')

        file_path = self._get_file_for_date(date_str)

        if not file_path.exists():
            return []

        records = []
        try:
            with open(file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            records.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            print(f"Error reading records: {e}")

        return records

    def get_available_dates(self) -> List[str]:
        """获取所有可用日期列表"""
        dates = []
        try:
            for f in self.storage_dir.glob('*.json'):
                # 排除非日期命名的文件
                if len(f.stem) == 10 and f.stem[4] == '-' and f.stem[7] == '-':
                    dates.append(f.stem)
        except Exception as e:
            print(f"Error listing dates: {e}")

        return sorted(dates, reverse=True)

    def get_storage_stats(self) -> Dict[str, Any]:
        """获取存储统计信息"""
        try:
            dates = self.get_available_dates()
            total_size = sum(
                f.stat().st_size
                for f in self.storage_dir.glob('*.json')
            )

            return {
                'total_days': len(dates),
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'earliest_date': dates[-1] if dates else None,
                'latest_date': dates[0] if dates else None,
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {
                'total_days': 0,
                'total_size_bytes': 0,
                'total_size_mb': 0,
                'earliest_date': None,
                'latest_date': None,
            }
