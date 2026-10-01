import type { SegmentedProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { h } from 'vue'

import { cn } from '~/utils/cn'

export const POPUP_CONTAINER = () => document.body

/* ============================================================
 * 分类 Segmented
 * ============================================================ */
export type SettingSection = 'appearance' | 'layout' | 'common'

export const SECTION_OPTIONS: SegmentedProps['options'] = [
  { value: 'appearance', label: '外观', icon: h(Icon, { icon: 'carbon:color-palette' }) },
  { value: 'layout', label: '布局', icon: h(Icon, { icon: 'carbon:layout' }) },
  { value: 'common', label: '通用', icon: h(Icon, { icon: 'carbon:settings-adjust' }) },
]

/* ============================================================
 * 主题模式
 * ============================================================ */
export const THEME_MODE_OPTIONS: SegmentedProps['options'] = [
  { value: 'light', label: '明亮', icon: h(Icon, { icon: 'carbon:sun' }) },
  { value: 'dark', label: '黑暗', icon: h(Icon, { icon: 'carbon:moon' }) },
  { value: 'auto', label: '自动', icon: h(Icon, { icon: 'carbon:laptop' }) },
]

/* ============================================================
 * 圆角倍率
 * ============================================================ */
export const BORDER_RADIUS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 0.75, label: '0.75' },
  { value: 1, label: '1' },
]

/* ============================================================
 * 主题色
 * ============================================================ */
export const PRIMARY_COLORS = [
  { value: '#1677FF', label: '默认' },
  { value: '#722ED1', label: '紫罗兰' },
  { value: '#EB2F96', label: '樱花粉' },
  { value: '#FAAD14', label: '柠檬黄' },
  { value: '#1890FF', label: '天蓝色' },
  { value: '#52C41A', label: '浅绿色' },
  { value: '#262626', label: '锌色灰' },
  { value: '#13C2C2', label: '深绿色' },
  { value: '#1D39C4', label: '深蓝色' },
  { value: '#FA541C', label: '橙黄色' },
  { value: '#F5222D', label: '玫瑰红' },
  { value: '#2F54EB', label: '中性色' },
  { value: '#1F2937', label: '石板灰' },
  { value: '#374151', label: '中灰色' },
]

/* ============================================================
 * 页面切换动画
 * ============================================================ */
export const TRANSITION_OPTIONS = [
  { value: 'fade', label: '淡入淡出' },
  { value: 'slide', label: '滑动' },
  { value: 'slide-right', label: '向右滑入' },
  { value: 'slide-left', label: '向左滑入' },
  { value: 'slide-up', label: '向上滑入' },
  { value: 'slide-down', label: '向下滑入' },
  { value: 'zoom', label: '缩放' },
  { value: 'fade-slide', label: '淡入滑动' },
  { value: 'scale', label: '缩放淡入' },
  { value: 'flip', label: '翻转' },
]

/* ============================================================
 * 通知位置
 * ============================================================ */
export const NOTIFICATION_POSITION_OPTIONS = [
  { value: 'topLeft', label: '左上' },
  { value: 'topRight', label: '右上' },
  { value: 'bottomLeft', label: '左下' },
  { value: 'bottomRight', label: '右下' },
]

/* ============================================================
 * 时区
 * ============================================================ */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)', offset: 'UTC+8', city: '上海' },
  { value: 'Asia/Tokyo', label: '日本标准时间 (UTC+9)', offset: 'UTC+9', city: '东京' },
  { value: 'Asia/Singapore', label: '新加坡时间 (UTC+8)', offset: 'UTC+8', city: '新加坡' },
  { value: 'Europe/London', label: '伦敦时间 (UTC+0)', offset: 'UTC+0', city: '伦敦' },
  { value: 'Europe/Paris', label: '巴黎时间 (UTC+1)', offset: 'UTC+1', city: '巴黎' },
  { value: 'America/New_York', label: '纽约时间 (UTC-5)', offset: 'UTC-5', city: '纽约' },
  { value: 'America/Los_Angeles', label: '洛杉矶时间 (UTC-8)', offset: 'UTC-8', city: '洛杉矶' },
  { value: 'UTC', label: '协调世界时 (UTC)' },
]

/* ============================================================
 * 通用样式
 * ============================================================ */
export const sectionStyles: SegmentedProps['styles'] = {
  root: {
    padding: '4px',
    width: '100%',
    background: 'rgba(241, 245, 249, 0.8)',
    borderRadius: '10px',
  },
  item: { borderRadius: '8px', transition: 'all 200ms ease' },
  icon: { fontSize: '14px' },
  label: { fontSize: '12px', fontWeight: 500 },
}

export const drawerBodyClassName = cn('flex flex-col h-full', 'bg-white dark:bg-slate-950')

export const drawerHeaderClassName = cn('flex shrink-0 items-center justify-between gap-2')

export const drawerContentClassName = cn('min-h-0 flex-1 overflow-hidden')

export const panelWrapperClassName = cn('p-5 space-y-6')

export const groupIconClassName = cn(
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
  'bg-gradient-to-br from-blue-500/15 to-indigo-500/15',
  'text-ant-primary text-[15px]',
)

export const groupBoxClassName = cn(
  'rounded-2xl p-3 space-y-2',
  'bg-slate-50/80 dark:bg-slate-900/40',
  'outline outline-1 outline-slate-200/70 dark:outline-slate-700/50',
)

export const itemRowClassName = cn(
  'flex w-full items-center justify-between gap-3',
  'rounded-xl bg-white px-4 py-3',
  'outline outline-1 outline-slate-200',
  'transition-all duration-200',
  'hover:outline-ant-primary/40 hover:shadow-sm',
  'dark:bg-slate-800 dark:outline-slate-700',
)

export const itemLabelClassName = cn('text-[13px] font-medium text-slate-700 dark:text-slate-200')

export const itemDescClassName = cn('mt-0.5 text-[11px] text-slate-400 dark:text-slate-500')

export const groupTitleClassName = cn(
  'relative mb-3 flex w-fit items-center gap-2 pb-2',
  'text-[13px] font-semibold text-slate-700 dark:text-slate-200',
  'after:absolute after:bottom-0 after:left-9 after:right-0',
  'after:h-[2px] after:rounded-full',
  'after:bg-gradient-to-r after:from-ant-primary after:to-ant-primary/20',
  'after:origin-left after:scale-x-0',
  'after:transition-transform after:duration-300 after:ease-out',
  'hover:after:scale-x-100',
)
