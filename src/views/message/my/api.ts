import { http } from '~/utils'

export type MessageBizType = 'notice' | 'todo' | 'workflow' | 'system' | 'announcement'

export interface MessageRecord {
  messageId: string
  tenantId: string
  userId: string
  bizType: MessageBizType
  bizId: string | null
  title: string
  content: string | null
  priority: number
  isRead: number
  readAt: string | null
  isTop: number
  expireAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageListParams {
  pageNum?: number
  pageSize?: number
  isRead?: number
  bizType?: MessageBizType
  keyword?: string
}

export interface UnreadSummary {
  total: number
  byType: Record<string, number>
}

export function getMyMessageList(params: MessageListParams) {
  return http.Get<{ list: MessageRecord[]; total: number }>('/message/my', { params })
}

export function getUnreadMessageCount(bizType?: MessageBizType) {
  return http.Get<{ count: number }>('/message/unread-count', {
    params: bizType ? { bizType } : {},
  })
}

export function getUnreadSummary() {
  return http.Get<UnreadSummary>('/message/unread-summary')
}

export function markMessageRead(messageId: string) {
  return http.Put(`/message/${messageId}/read`)
}

export function markMessagesReadBatch(messageIds: string[]) {
  return http.Put<{ updated: number }>('/message/read-batch', { messageIds })
}

export function markAllMessagesRead(bizType?: MessageBizType) {
  return http.Put<{ updated: number }>('/message/read-all', {
    ...(bizType ? { bizType } : {}),
  })
}

export function deleteMessage(messageId: string) {
  return http.Delete(`/message/${messageId}`)
}

export function deleteMessagesBatch(messageIds: string[]) {
  return http.Post<{ deleted: number }>('/message/batch-delete', { messageIds })
}

export function clearReadMessages() {
  return http.Delete<{ deleted: number }>('/message/clear-read')
}
