import { http } from '~/utils'

import type { ApprovalLogRecord } from './types'

interface PageResult<T> {
  list: T[]
  total: number
}

export function getApprovalLogs(params: {
  title?: string
  action?: string
  operatorName?: string
  pageNum?: number
  pageSize?: number
}) {
  return http.Get<PageResult<ApprovalLogRecord>>('/approval/log/list', { params })
}
