/** 消息记录 */
export interface NoticeRecord {
  noticeId: string
  noticeType: number
  /** 消息来源：notice | workflow | report | system */
  source?: 'notice' | 'workflow' | 'report' | 'system'
  title: string
  content: string
  /** 0 未读 / 1 已读 */
  isRead: number
  priority?: number
  publishTime: string | null
  /** 工作流通知：跳转参数 */
  bizType?: string | null
  bizId?: string | null
  /** 工作流通知：来源类型（approval / workflow） */
  bizSource?: string | null
}

/** 消息 Tab */
export type NoticeTabKey = 'all' | 'unread' | 'read'

/** 消息来源筛选 */
export type NoticeSourceFilter = '' | 'notice' | 'workflow' | 'report' | 'system'

/** 表格查询参数 */
export interface NoticeQueryParams {
  pageNum?: number
  pageSize?: number
  isRead?: number
  source?: string
  noticeType?: number
}

/** WebSocket 推送消息 */
export interface NotificationItem {
  noticeId: string
  noticeType: number
  source?: string
  title: string
  content: string
  isRead: 0 | 1
  priority?: number
  publishTime?: string | null
  createdAt?: string
  bizType?: string | null
  bizId?: string | null
  bizSource?: string | null
}
