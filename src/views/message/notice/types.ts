/** 通知记录 */
export interface NoticeRecord {
  noticeId: string
  title: string
  content: string
  /** 1-通知 2-公告 3-提醒 */
  noticeType: number
  /** '0'-草稿 '1'-已发布 */
  status: string
  /** 0-普通 1-重要 2-紧急 */
  priority: number
  /** 0-普通 1-置顶 */
  isTop: number
  /** ⭐ 关联的消息模板 ID */
  templateId?: string | null
  /** ⭐ 发送状态 '0'-未发送 '1'-已发送 */
  sendStatus: string
  sendTime?: string | null
  publishTime?: string | null
  /** ⭐ 撤回相关 */
  revokedAt?: string | null
  revokedBy?: string | null
  targetUserIds?: string[]
  createdAt: string
  updatedAt?: string
}

/** 用户选项 */
export interface UserOption {
  label: string
  value: string
}

/** 通知保存 payload */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoticeSavePayload extends Omit<NoticeRecord, 'noticeId' | 'createdAt'> {}

/** 通知类型 */
export type NoticeType = 1 | 2 | 3

/** 通知状态 */
export type NoticeStatus = '0' | '1'
