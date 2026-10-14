import { cn } from '@antdv/shared/cn';

/* ============================================================
 * 调色板
 * ============================================================ */
export const PALETTE = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#722ed1',
  cyan: '#13c2c2',
  rose: '#f43f5e',
  emerald: '#10b981',
} as const;

export const PALETTE_LIST = [
  PALETTE.primary,
  PALETTE.success,
  PALETTE.warning,
  PALETTE.danger,
  PALETTE.info,
  PALETTE.cyan,
] as const;

/* ============================================================
 * 严重级别配色
 * ============================================================ */
export const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',
};

/* ============================================================
 * 变更范围配色
 * ============================================================ */
export const SCOPE_COLOR: Record<string, string> = {
  dept_tree: '#3b82f6',
  user_profile: '#10b981',
  user_dept: '#f59e0b',
  user_role: '#8b5cf6',
  position: '#06b6d4',
  other: '#94a3b8',
};

export const SCOPE_LABEL: Record<string, string> = {
  dept_tree: '部门调整',
  user_profile: '个人信息',
  user_dept: '人员调动',
  user_role: '角色变更',
  position: '岗位',
  other: '其他',
};

/* ============================================================
 * KPI 颜色映射
 * ============================================================ */
export const KPI_COLOR_MAP: Record<string, { beam: string; wrap: string }> = {
  blue: {
    beam: PALETTE.primary,
    wrap: 'bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400',
  },
  emerald: {
    beam: PALETTE.success,
    wrap: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  violet: {
    beam: PALETTE.info,
    wrap: 'bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400',
  },
  amber: {
    beam: PALETTE.warning,
    wrap: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400',
  },
  red: {
    beam: PALETTE.danger,
    wrap: 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400',
  },
  cyan: {
    beam: PALETTE.cyan,
    wrap: 'bg-cyan-50 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400',
  },
};

/* ============================================================
 * 时间范围选项
 * ============================================================ */
export const TIME_RANGE_OPTIONS = [
  { label: '今日', value: 'today' as const },
  { label: '近7天', value: '7d' as const },
  { label: '近30天', value: '30d' as const },
];

/* ============================================================
 * 样式类名
 * ============================================================ */
export const analyticsCardClassName = cn(
  'group relative overflow-hidden rounded-xl',
  'border border-slate-100 bg-white',
  'transition-all duration-300 hover:shadow-lg',
  'dark:border-slate-800 dark:bg-slate-900',
);

export const sectionTitleClassName = cn(
  'text-base font-semibold',
  'text-slate-800 dark:text-slate-200',
);
