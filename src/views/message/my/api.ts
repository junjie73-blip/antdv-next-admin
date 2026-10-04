import { request } from '~/composables'

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
  return request.get<{ list: MessageRecord[]; total: number }>('/message/my', params)
}

export function getUnreadMessageCount(bizType?: MessageBizType) {
  return request.get<{ count: number }>('/message/unread-count', bizType ? { bizType } : {})
}

export function getUnreadSummary() {
  return request.get<UnreadSummary>('/message/unread-summary')
}

export function markMessageRead(messageId: string) {
  return request.put(`/message/${messageId}/read`)
}

export function markMessagesReadBatch(messageIds: string[]) {
  return request.put<{ updated: number }>('/message/read-batch', { messageIds })
}

export function markAllMessagesRead(bizType?: MessageBizType) {
  return request.put<{ updated: number }>('/message/read-all', bizType ? { bizType } : {})
}

export function deleteMessage(messageId: string) {
  return request.delete(`/message/${messageId}`)
}

export function deleteMessagesBatch(messageIds: string[]) {
  return request.post<{ deleted: number }>('/message/batch-delete', { messageIds })
}

export function clearReadMessages() {
  return request.delete<{ deleted: number }>('/message/clear-read')
}
