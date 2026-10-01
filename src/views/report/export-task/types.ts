export type ExportType = 'excel' | 'pdf' | 'html' | 'csv'

export type ExportTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface ExportTaskRecord {
  task_id: string
  tenant_id: string
  user_id: string
  report_code: string
  export_type: ExportType
  params: Record<string, any> | null
  status: ExportTaskStatus
  progress: number
  row_count: number
  file_url: string | null
  file_name: string | null
  file_size: number | null
  error_msg: string | null
  error_type: string | null
  retry_count: number
  max_retries: number
  next_retry_at: string | null
  duration_ms: number | null
  job_id: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
}

export interface ExportStats {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  retrying: number
  todayCompleted: number
  totalSize: number
  avgDuration: number
}

export interface ExportTrendItem {
  date: string
  total: number
  completed: number
  failed: number
  avgDuration: number
}

export interface ExportTaskActionContext {
  onDetail: (record: ExportTaskRecord) => void
  onDownload: (record: ExportTaskRecord) => void
  onRetry: (record: ExportTaskRecord) => void | Promise<void>
  onCancel: (record: ExportTaskRecord) => void | Promise<void>
  onDelete: (record: ExportTaskRecord) => void | Promise<void>
}
