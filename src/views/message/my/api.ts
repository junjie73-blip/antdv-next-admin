import { http } from '~/utils'

import type { NoticeQueryParams } from './types'

/** 获取我的消息列表 */
export function fetchMyNotices(params: NoticeQueryParams) {
  return http.Get('/notice/my', { params }).send()
}

/** 标记单条消息已读 */
export function markNoticeRead(noticeId: string) {
  return http.Put(`/notice/${noticeId}/read`)
}

/** 全部标记已读 */
export function markAllNoticesRead() {
  return http.Put('/notice/read-all')
}
