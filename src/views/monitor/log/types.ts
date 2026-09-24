/** 审计日志记录 */
export interface AuditLogRecord {
  logId: string
  tenantId: string
  userId?: string | null
  username?: string | null
  operation: string
  method: string
  requestUrl: string
  requestParams?: string | null
  responseData?: string | null
  ipAddress: string
  userAgent?: string | null
  executeTime: number
  /** '0'-失败 '1'-成功 */
  status: string
  errorMsg?: string | null
  createdAt: string
}
