export interface ApprovalNode {
  nodeId: string
  requestId: string
  deptId: string
  deptName?: string
  approverId?: string | null
  approverName?: string | null
  sequence: number
  /** 0-待审批 1-已通过 2-已驳回 3-已失效 */
  status: string
  isCurrent: number
  rejectReason?: string | null
  approvedAt?: string | null
  round: number
  isApplicant?: boolean
  applicantName?: string
  rejectReasonType?: string | null
}

export interface ApprovalLogRecord {
  logId: string
  requestId: string
  operatorId: string
  operatorName: string
  action: string
  fromStatus?: string | null
  toStatus?: string | null
  remark?: string | null
  reasonType?: string | null
  createdAt: string
}

export interface ApprovalFlowRecord {
  requestId: string
  title: string
  content?: string | null
  formData?: Record<string, unknown> | null
  applicantId: string
  applicantName?: string
  currentDeptId: string
  currentDeptName?: string
  /** 0-草稿 1-审批中 2-已通过 3-已驳回 */
  status: string
  createdAt: string
  updatedAt: string
  nodes?: ApprovalNode[]
}

export interface ApprovalFlowDetail extends ApprovalFlowRecord {
  nodes: ApprovalNode[]
  logs: ApprovalLogRecord[]
}

/** 发起/重新提交表单 */
export interface ApprovalFormValues {
  title: string
  content?: string
  formData?: Record<string, unknown>
}

/** 驳回表单 */
export interface RejectFormValues {
  reasonType: string
  remark: string
}

/** 行操作上下文 */
export interface ApprovalActionContext {
  onViewFlow: (record: ApprovalFlowRecord) => void
  onApprove: (record: ApprovalFlowRecord) => void | Promise<void>
  onReject: (record: ApprovalFlowRecord) => void
  onResubmit: (record: ApprovalFlowRecord) => void
  onDelete: (record: ApprovalFlowRecord) => void | Promise<void>
}
