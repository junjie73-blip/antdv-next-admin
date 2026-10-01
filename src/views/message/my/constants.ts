import type { NoticeTabKey } from './types'

export const NOTICE_TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '通知', color: 'blue' },
  2: { label: '公告', color: 'green' },
  3: { label: '提醒', color: 'orange' },
}

/** 消息来源映射 */
export const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  notice: { label: '系统通知', color: 'blue' },
  workflow: { label: '工作流', color: 'purple' },
  report: { label: '报表', color: 'green' },
  system: { label: '系统', color: 'default' },
}

export const NOTICE_READ_STATUS = {
  UNREAD: 0,
  READ: 1,
} as const

export const TAB_TO_IS_READ: Record<NoticeTabKey, number | undefined> = {
  all: undefined,
  unread: NOTICE_READ_STATUS.UNREAD,
  read: NOTICE_READ_STATUS.READ,
}
