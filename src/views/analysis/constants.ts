import { cn } from '~/utils/cn'

// ========== 调色板 ==========
export const PALETTE = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#722ed1',
  cyan: '#13c2c2',
}

// ========== 图表导出配置 ==========
export const CHART_EXPORT_CONFIG: Array<{ name: string; key: string }> = [
  { name: '系统活动趋势', key: 'mainTrend' },
  { name: '流量来源分布', key: 'trafficDist' },
  { name: '系统健康度', key: 'systemHealth' },
  { name: '资源使用概况', key: 'resourceRadar' },
  { name: '用户活跃时段', key: 'activityHeatmap' },
  { name: '用户行为漏斗', key: 'userJourney' },
  { name: '模块使用热度', key: 'moduleRank' },
]

// ========== 时间范围选项 ==========
export const TIME_RANGE_OPTIONS = [
  { label: '今日', value: 'today' as const },
  { label: '近7天', value: '7d' as const },
  { label: '近30天', value: '30d' as const },
]

// ========== 样式类名 ==========
export const analyticsCardClassName = cn(
  'rounded-xl overflow-hidden',
  'border border-slate-100 dark:border-slate-800',
  'bg-white dark:bg-slate-900',
  'shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
  'transition-all duration-300',
  'hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]',
)

export const sectionTitleClassName = cn('text-base font-semibold text-slate-800 dark:text-slate-200 mb-4')
