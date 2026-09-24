import type { ShortcutItem, StatCardConfig, WorkbenchData } from './types'

// ============================================================
// 统计卡片配置
// ============================================================
export const STAT_CARD_CONFIGS: StatCardConfig[] = [
  {
    key: 'userCount',
    title: '团队成员',
    suffix: '人',
    icon: 'carbon:user-multiple',
    color: '#3B82F6',
    path: '/system/user',
  },
  {
    key: 'roleCount',
    title: '角色数量',
    suffix: '个',
    icon: 'carbon:user-role',
    color: '#8B5CF6',
    path: '/system/role',
  },
  {
    key: 'deptCount',
    title: '组织部门',
    suffix: '个',
    icon: 'carbon:tree-view',
    color: '#10B981',
    path: '/system/dept',
  },
  {
    key: 'unreadNotice',
    title: '未读消息',
    suffix: '条',
    icon: 'carbon:notification',
    color: '#06B6D4',
    path: '/message/my',
  },
]

// ============================================================
// 快捷入口
// ============================================================
export const SHORTCUTS: ShortcutItem[] = [
  { title: '用户管理', icon: 'carbon:user-multiple', path: '/system/user', color: '#3B82F6' },
  { title: '角色管理', icon: 'carbon:user-role', path: '/system/role', color: '#8B5CF6' },
  { title: '菜单配置', icon: 'carbon:menu', path: '/system/menu', color: '#10B981' },
  { title: '部门管理', icon: 'carbon:tree-view', path: '/system/dept', color: '#14B8A6' },
  {
    title: '权限管理',
    icon: 'carbon:aperture',
    path: '/system/permission',
    color: '#0EA5E9',
  },
  { title: '系统配置', icon: 'carbon:settings', path: '/system/config', color: '#6366F1' },
  { title: '通知公告', icon: 'carbon:notification', path: '/system/notice', color: '#EC4899' },
  { title: '数据字典', icon: 'carbon:book', path: '/system/dict', color: '#7C3AED' },
]

// ============================================================
// 默认空数据
// ============================================================
export const DEFAULT_WORKBENCH_DATA: WorkbenchData = {
  stats: {
    userCount: 0,
    roleCount: 0,
    deptCount: 0,
    noticeCount: 0,
    unreadNotice: 0,
    todoUncompleted: 0,
    todoOverdue: 0,
    urgentNoticeCount: 0,
  },
  loginTrend: [],
  recentLogs: [],
  notices: [],
}

// ============================================================
// 最近操作状态色（冷色系）
// ============================================================
export const LOG_STATUS_COLOR_MAP: Record<string, { bg: string; color: string }> = {
  '1': { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  '0': { bg: 'rgba(244,63,94,0.10)', color: '#E11D48' },
}

export const LOG_STATUS_LABEL_MAP: Record<string, string> = {
  '1': '成功',
  '0': '失败',
}
export const NOTICE_PRIORITY_MAP: Record<
  number,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  0: {
    label: '普通',
    color: '#64748B',
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.20)',
    icon: 'carbon:notification',
  },
  1: {
    label: '重要',
    color: '#EA580C',
    bg: 'rgba(234,88,12,0.10)',
    border: 'rgba(234,88,12,0.22)',
    icon: 'carbon:warning',
  },
  2: {
    label: '紧急',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    border: 'rgba(220,38,38,0.24)',
    icon: 'carbon:warning-alt',
  },
}

/* ============================================================
 * ⭐ 通知类型
 * ============================================================ */
export const NOTICE_TYPE_MAP: Record<number, { label: string; icon: string; color: string }> = {
  1: { label: '通知', icon: 'carbon:notification', color: '#3B82F6' },
  2: { label: '公告', icon: 'carbon:bullhorn', color: '#10B981' },
  3: { label: '提醒', icon: 'carbon:task', color: '#F59E0B' },
}
