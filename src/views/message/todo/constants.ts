/** 优先级映射（去橙色系） */
export const PRIORITY_MAP: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  0: {
    label: '普通',
    color: '#64748B', // slate
    bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    dot: '#94A3B8',
  },
  1: {
    label: '重要',
    color: '#8B5CF6', // violet
    bg: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
    dot: '#A78BFA',
  },
  2: {
    label: '紧急',
    color: '#F43F5E', // rose
    bg: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    dot: '#FB7185',
  },
}

/** 过滤器图标与颜色配置 */
export const FILTER_META: Record<
  'all' | 'uncompleted' | 'completed' | 'overdue',
  { label: string; icon: string; color: string; gradient: string }
> = {
  all: {
    label: '全部',
    icon: 'carbon:list',
    color: '#3B82F6', // blue
    gradient: 'from-blue-500 to-cyan-500',
  },
  uncompleted: {
    label: '未完成',
    icon: 'carbon:in-progress',
    color: '#6366F1', // indigo
    gradient: 'from-indigo-500 to-violet-500',
  },
  completed: {
    label: '已完成',
    icon: 'carbon:checkmark-outline',
    color: '#10B981', // emerald
    gradient: 'from-emerald-500 to-teal-500',
  },
  overdue: {
    label: '逾期',
    icon: 'carbon:warning-alt',
    color: '#F43F5E', // rose
    gradient: 'from-rose-500 to-pink-500',
  },
}
