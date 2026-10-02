/** 登录日志记录 */
export interface LoginLogRecord {
  logId: string
  tenantId: string
  userId?: string | null
  username: string
  ipAddress: string
  userAgent?: string | null
  /** '0'-失败 '1'-成功 */
  status: string
  message?: string | null
  createdAt: string
}
