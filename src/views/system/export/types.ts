export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'

/** 导出任务记录 */
export interface ExportTask {
  taskId: string
  bizType: string
  exportFormat: string
  status: ExportStatus
  progress: number
  rowCount: number
  fileUrl: string | null
  fileName: string | null
  fileSize: string | null
  errorMsg: string | null
  retryCount: number
  downloadCount: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  durationMs: number | null
}
