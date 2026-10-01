export interface ApprovalLogRecord {
  log_id: string
  request_id: string
  request_title?: string | null
  operator_id: string
  operator_name: string | null
  action: string
  from_status?: string | null
  to_status?: string | null
  remark?: string | null
  reason_type?: string | null
  created_at: string
}
