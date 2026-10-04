import type { FetchParams } from '~/components/business/Table'

import { request } from '~/composables'

import { del, get, post, put } from './request'

// ============================================================
// 通知公告
// ============================================================

export function getNoticeList(params?: FetchParams) {
  return get<{ list: any[]; total: number }>('/notice/list', params as any)
}

export function saveNotice(data: Record<string, any>) {
  return post<void>('/notice', data)
}

export function updateNotice(id: string, data: Record<string, any>) {
  return put<void>(`/notice/${id}`, data)
}

export function getNoticeDetail(id: string) {
  return get<any>(`/notice/detail/${id}`)
}

export function deleteNotice(id: string) {
  return del<void>(`/notice/remove/${id}`)
}

export function sendNotice(id: string) {
  return post<void>(`/notice/${id}/send`)
}

export function revokeNotice(id: string) {
  return post<void>(`/notice/${id}/revoke`)
}

export function exportNotices(params?: Record<string, unknown>) {
  return get<any>('/notice/export', params)
}
export function batchDelete(ids: string[]) {
  return request.post<void>('/notice/batch-delete', { ids })
}
// ============================================================
// 我的消息
// ============================================================
export function getMyNoticeList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>('/message/my', params)
}

export function markNoticeRead(noticeId: string) {
  return put<void>(`/message/${noticeId}/read`)
}

export function markAllNoticeRead(params?: { source?: string; noticeType?: number; bizType?: string }) {
  return put<void>('/message/read-all', params)
}

/** ⭐ 修复：返回类型改成 { count: number }（与后端对齐） */
export function getNoticeUnreadCount() {
  return get<{ count: number }>('/message/unread-count')
}

/** ⭐ 修复：路径从 /message/template/options 改为 /notice/template/options */
export function getTemplateOptions(channelType?: string) {
  return get<{ label: string; value: string; channelType: string; status: string }[]>('/notice/template/options', {
    channelType,
  } as any)
}

export function getWfNotificationList(params: {
  instanceId?: string
  eventType?: string
  pageNum?: number
  pageSize?: number
}) {
  return request.get('/workflow/notification/list', params)
}
