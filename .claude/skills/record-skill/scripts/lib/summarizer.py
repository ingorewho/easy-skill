"""
摘要生成器
生成每日活动摘要
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional


class DailySummarizer:
    """每日活动摘要器"""

    # 操作类型的中文映射
    OP_TYPE_NAMES = {
        'browsing': '浏览网页',
        'coding': '编写代码',
        'terminal': '终端操作',
        'communication': '沟通协作',
        'email': '处理邮件',
        'design': '设计工作',
        'media': '媒体娱乐',
        'document': '文档编辑',
        'database': '数据库操作',
        'application': '应用使用',
    }

    # 生产力评分权重
    PRODUCTIVITY_WEIGHTS = {
        'coding': 1.0,
        'terminal': 0.9,
        'document': 0.8,
        'email': 0.6,
        'communication': 0.5,
        'browsing': 0.4,
        'database': 0.9,
        'design': 0.85,
        'media': 0.1,
        'application': 0.3,
    }

    def __init__(self, storage_manager):
        self.storage = storage_manager

    def summarize_day(self, date_str: Optional[str] = None) -> Dict[str, Any]:
        """
        生成指定日期的摘要

        Args:
            date_str: 日期字符串 (YYYY-MM-DD)，默认为今天

        Returns:
            包含统计信息、时间线、摘要的字典
        """
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d')

        records = self.storage.read_day_records(date_str)

        if not records:
            return {
                'date': date_str,
                'total_activities': 0,
                'total_active_time': 0,
                'app_breakdown': {},
                'operation_types': {},
                'timeline': [],
                'productivity_score': 0,
                'highlights': [],
                'summary_text': f'{date_str} 没有记录到任何活动。'
            }

        # 计算各项统计
        stats = self._calculate_stats(records)
        app_usage = self._calculate_app_usage(records)
        op_type_usage = self._calculate_operation_type_usage(records)
        timeline = self._generate_timeline(records)
        productivity = self._calculate_productivity(records)
        highlights = self._extract_highlights(records)

        # 生成文本摘要
        summary_text = self._generate_summary_text(
            date_str, stats, app_usage, op_type_usage, productivity, highlights
        )

        return {
            'date': date_str,
            'total_activities': len(records),
            'total_active_time': stats['total_time_hours'],
            'app_breakdown': app_usage,
            'operation_types': op_type_usage,
            'timeline': timeline,
            'productivity_score': productivity,
            'highlights': highlights,
            'summary_text': summary_text
        }

    def summarize_range(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        生成日期范围的活动摘要

        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)

        Returns:
            汇总后的摘要信息
        """
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        all_records = []
        current = start

        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            records = self.storage.read_day_records(date_str)
            all_records.extend(records)
            current += timedelta(days=1)

        if not all_records:
            return {
                'start_date': start_date,
                'end_date': end_date,
                'total_days': (end - start).days + 1,
                'summary_text': f'{start_date} 到 {end_date} 期间没有记录到任何活动。'
            }

        stats = self._calculate_stats(all_records)
        app_usage = self._calculate_app_usage(all_records)
        op_type_usage = self._calculate_operation_type_usage(all_records)
        productivity = self._calculate_productivity(all_records)

        # 按天统计
        daily_stats = defaultdict(lambda: {'count': 0, 'time': 0})
        for r in all_records:
            date = r.get('timestamp', '')[:10]
            daily_stats[date]['count'] += 1
            daily_stats[date]['time'] += r.get('duration_seconds', 0)

        summary_text = self._generate_range_summary_text(
            start_date, end_date, stats, app_usage, op_type_usage,
            productivity, daily_stats
        )

        return {
            'start_date': start_date,
            'end_date': end_date,
            'total_days': (end - start).days + 1,
            'active_days': len(daily_stats),
            'total_activities': len(all_records),
            'total_active_time': stats['total_time_hours'],
            'daily_average': stats['total_time_hours'] / max(len(daily_stats), 1),
            'app_breakdown': app_usage,
            'operation_types': op_type_usage,
            'productivity_score': productivity,
            'daily_breakdown': dict(daily_stats),
            'summary_text': summary_text
        }

    def _calculate_stats(self, records: List[dict]) -> dict:
        """计算统计信息"""
        total_time = sum(r.get('duration_seconds', 0) for r in records)
        return {
            'total_time_seconds': total_time,
            'total_time_hours': round(total_time / 3600, 2),
            'activity_count': len(records),
            'average_duration': round(total_time / max(len(records), 1), 2)
        }

    def _calculate_app_usage(self, records: List[dict]) -> Dict[str, float]:
        """计算应用使用时长"""
        app_times = defaultdict(float)
        for r in records:
            app = r.get('app_name', 'Unknown')
            duration = r.get('duration_seconds', 0)
            app_times[app] += duration

        # 转换为小时并排序
        return {
            app: round(time / 3600, 2)
            for app, time in sorted(app_times.items(), key=lambda x: -x[1])
        }

    def _calculate_operation_type_usage(self, records: List[dict]) -> Dict[str, float]:
        """计算操作类型使用时长"""
        type_times = defaultdict(float)
        for r in records:
            op_type = r.get('operation_type', 'application')
            duration = r.get('duration_seconds', 0)
            type_times[op_type] += duration

        return {
            op_type: round(time / 3600, 2)
            for op_type, time in sorted(type_times.items(), key=lambda x: -x[1])
        }

    def _generate_timeline(self, records: List[dict]) -> List[dict]:
        """生成活动时间线"""
        timeline = []
        for r in records:
            ts = r.get('timestamp', '')
            time_str = ts[11:16] if len(ts) >= 16 else ''  # 提取 HH:MM

            core = r.get('core_elements', {})

            timeline.append({
                'time': time_str,
                'app': r.get('app_name', ''),
                'type': r.get('operation_type', ''),
                'type_name': self.OP_TYPE_NAMES.get(r.get('operation_type', ''), '其他'),
                'title': r.get('window_title', '')[:50],
                'duration': round(r.get('duration_seconds', 0) / 60, 1),  # 分钟
                'domain': core.get('domain'),
                'project': core.get('project'),
                'file': core.get('file')
            })

        return timeline

    def _calculate_productivity(self, records: List[dict]) -> int:
        """计算生产力评分 (0-100)"""
        if not records:
            return 0

        total_weighted_time = 0
        total_time = 0

        for r in records:
            op_type = r.get('operation_type', 'application')
            duration = r.get('duration_seconds', 0)
            weight = self.PRODUCTIVITY_WEIGHTS.get(op_type, 0.3)

            total_weighted_time += duration * weight
            total_time += duration

        if total_time == 0:
            return 0

        score = int((total_weighted_time / total_time) * 100)
        return min(100, max(0, score))

    def _extract_highlights(self, records: List[dict]) -> List[dict]:
        """提取亮点/重要活动"""
        highlights = []

        # 最长时间的活动
        if records:
            longest = max(records, key=lambda r: r.get('duration_seconds', 0))
            if longest.get('duration_seconds', 0) > 1800:  # 超过30分钟
                highlights.append({
                    'type': 'focus_session',
                    'title': f"专注工作: {longest.get('app_name', '')}",
                    'duration_minutes': round(longest.get('duration_seconds', 0) / 60, 1),
                    'description': longest.get('window_title', '')[:60]
                })

        # 检测多应用切换（忙碌模式）
        if len(records) > 20:
            highlights.append({
                'type': 'busy_mode',
                'title': '高强度工作',
                'description': f'切换了 {len(records)} 个活动窗口'
            })

        # 提取涉及的项目
        projects = set()
        for r in records:
            core = r.get('core_elements', {})
            project = core.get('project')
            if project:
                projects.add(project)

        if projects:
            highlights.append({
                'type': 'projects',
                'title': '涉及项目',
                'projects': list(projects)[:5]
            })

        return highlights

    def _generate_summary_text(self, date_str: str, stats: dict,
                               app_usage: dict, op_type_usage: dict,
                               productivity: int, highlights: list) -> str:
        """生成文本摘要"""
        lines = []

        # 标题
        lines.append(f"📊 {date_str} 活动总结")
        lines.append("")

        # 基本统计
        lines.append(f"⏱️ 总活动时间: {stats['total_time_hours']:.1f} 小时")
        lines.append(f"📋 活动次数: {stats['activity_count']} 次")
        lines.append(f"🎯 生产力评分: {productivity}/100")
        lines.append("")

        # 应用使用排行
        if app_usage:
            lines.append("🔝 应用使用排行:")
            for i, (app, hours) in enumerate(list(app_usage.items())[:5], 1):
                percentage = (hours / max(stats['total_time_hours'], 0.01)) * 100
                lines.append(f"  {i}. {app} - {hours:.1f} 小时 ({percentage:.0f}%)")
            lines.append("")

        # 操作类型分布
        if op_type_usage:
            lines.append("📊 操作类型分布:")
            for op_type, hours in list(op_type_usage.items())[:5]:
                type_name = self.OP_TYPE_NAMES.get(op_type, op_type)
                lines.append(f"  • {type_name}: {hours:.1f} 小时")
            lines.append("")

        # 亮点
        if highlights:
            lines.append("✨ 今日亮点:")
            for h in highlights:
                if h['type'] == 'focus_session':
                    lines.append(f"  🎯 {h['title']} - {h['duration_minutes']:.0f}分钟")
                elif h['type'] == 'projects':
                    lines.append(f"  📁 {h['title']}: {', '.join(h['projects'])}")
                elif h['type'] == 'busy_mode':
                    lines.append(f"  ⚡ {h['title']} - {h['description']}")
            lines.append("")

        return '\n'.join(lines)

    def _generate_range_summary_text(self, start_date: str, end_date: str,
                                     stats: dict, app_usage: dict,
                                     op_type_usage: dict, productivity: int,
                                     daily_stats: dict) -> str:
        """生成日期范围的文本摘要"""
        lines = []

        lines.append(f"📊 {start_date} 至 {end_date} 活动汇总")
        lines.append("")

        active_days = len(daily_stats)
        total_days = (datetime.strptime(end_date, '%Y-%m-%d') -
                      datetime.strptime(start_date, '%Y-%m-%d')).days + 1

        lines.append(f"📅 统计期间: {total_days} 天")
        lines.append(f"✅ 活跃天数: {active_days} 天")
        lines.append(f"⏱️ 总活动时间: {stats['total_time_hours']:.1f} 小时")
        lines.append(f"📊 日均时长: {stats['total_time_hours'] / max(active_days, 1):.1f} 小时")
        lines.append(f"🎯 平均生产力: {productivity}/100")
        lines.append("")

        if app_usage:
            lines.append("🔝 最常使用的应用:")
            for i, (app, hours) in enumerate(list(app_usage.items())[:5], 1):
                lines.append(f"  {i}. {app}: {hours:.1f} 小时")
            lines.append("")

        return '\n'.join(lines)
