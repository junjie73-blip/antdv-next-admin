import { cn } from '~/utils/cn'

/* ============================================================
 * 布局
 * ============================================================ */

/** 外层：移动端上下堆叠，桌面端左右分栏 + 等高 */
export const containerClassName = cn('flex flex-col gap-4', 'lg:flex-row', 'lg:h-full')

/** 左栏 */
export const leftPanelClassName = cn('w-full shrink-0', 'lg:w-64 xl:w-72', 'lg:h-full')

/** 右栏 */
export const rightPanelClassName = cn('flex min-w-0 flex-1 flex-col', 'lg:h-full')

/* ============================================================
 * 卡片
 * ============================================================ */

export const cardClassName = cn(
  'flex flex-col overflow-hidden',
  'rounded-xl border border-gray-200 bg-white shadow-sm',
  'dark:border-gray-800 dark:bg-gray-900',
  'h-full',
)

export const cardHeaderClassName = cn(
  'flex shrink-0 items-center justify-between gap-2',
  'border-b border-gray-100 px-4 py-3',
  'dark:border-gray-800',
)

export const cardTitleClassName = cn(
  'flex items-center gap-2 text-sm font-semibold',
  'text-gray-800 dark:text-gray-100',
)

export const cardTitleBarClassName = cn('h-3.5 w-1 rounded-full', 'bg-blue-500 dark:bg-blue-400')

export const cardBodyClassName = cn('min-h-0 flex-1 overflow-auto')

/* ============================================================
 * 部门树
 * ============================================================ */

export const deptSearchClassName = cn('px-3 pt-3')

/* ============================================================
 * 工具栏
 * ============================================================ */

export const toolbarClassName = cn('flex flex-wrap items-center gap-2', 'px-4 pt-4')

/* ============================================================
 * 状态标签
 * ============================================================ */

export const statusTagClassName = cn('inline-flex items-center gap-1')

/* ============================================================
 * 状态映射
 * ============================================================ */

export const DEPT_STATUS_COLOR_MAP: Record<string, string> = {
  '1': 'green',
  '0': 'red',
}

export const DEPT_STATUS_LABEL_MAP: Record<string, string> = {
  '1': '正常',
  '0': '停用',
}

export const DEPT_STATUS_ICON_MAP: Record<string, string> = {
  '1': 'carbon:checkmark-outline',
  '0': 'carbon:close-outline',
}

/* ============================================================
 * 树节点类名（用于自定义 title 渲染）
 * ============================================================ */

export const treeNodeClassName = (active: boolean) =>
  cn(
    'group flex items-center gap-1.5 rounded-md px-1.5 py-0.5',
    'text-[13px] leading-5 transition-colors',
    active ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200',
  )

export const treeNodeIconClassName = (active: boolean) =>
  cn('shrink-0 text-xs', active ? 'text-ant-primary dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')
