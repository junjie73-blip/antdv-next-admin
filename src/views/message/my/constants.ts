import type { NoticeTabKey } from './types'

/** 消息类型映射 */
export const NOTICE_TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '通知', color: 'blue' },
  2: { label: '公告', color: 'green' },
  3: { label: '提醒', color: 'orange' },
}

/** 读取状态 */
export const NOTICE_READ_STATUS = {
  UNREAD: 0,
  READ: 1,
} as const

/** Tab → isRead 参数映射 */
export const TAB_TO_IS_READ: Record<NoticeTabKey, number | undefined> = {
  all: undefined,
  unread: NOTICE_READ_STATUS.UNREAD,
  read: NOTICE_READ_STATUS.READ,
}
