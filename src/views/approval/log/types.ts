export interface ApprovalLogRecord {
  log_id: string
  request_id: string
  title: string
  operatorId: string
  operatorName: string
  /** SUBMIT / APPROVE / REJECT / RESUBMIT */
  action: string
  from_status?: string | null
  to_status?: string | null
  remark?: string | null
  reason_type?: string | null
  createdAt: string
}

export interface ApprovalLogSearchParams {
  title?: string
  action?: string
  operatorName?: string
}
