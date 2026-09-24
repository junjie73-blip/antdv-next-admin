/** 统计数据 */
export interface WorkbenchStats {
  userCount: number
  roleCount: number
  deptCount: number
  noticeCount: number
  unreadNotice: number
  todoUncompleted: number
  todoOverdue: number
  /** ⭐ 紧急通知数 */
  urgentNoticeCount: number
}

/** 最近操作日志项 */
export interface LogItem {
  log_id: string
  username: string
  operation: string
  status: string
  created_at: string
}

/** ⭐ 重要通知项 */
export interface NoticeBrief {
  noticeId: string
  title: string
  noticeType: number
  /** 0-普通 1-重要 2-紧急 */
  priority: number
  /** 0-否 1-置顶 */
  isTop: number
  publishTime: string
  isRead: 0 | 1
}

export interface WorkbenchData {
  stats: WorkbenchStats
  loginTrend?: unknown[]
  recentLogs: LogItem[]
  notices: NoticeBrief[]
}

export interface StatCardConfig {
  key: keyof WorkbenchStats
  title: string
  suffix: string
  icon: string
  color: string
  path: string
}

export interface ShortcutItem {
  title: string
  icon: string
  path: string
  color: string
}
