import { request } from '~/composables'

export interface PageResult<T> {
  list: T[]
  total: number
}

/* ============ 流程中心（Facade 聚合） ============ */
export type TodoSource = 'approval' | 'workflow'

export interface TodoItem {
  source: TodoSource
  id: string
  instanceId: string
  title: string
  nodeName: string
  defKey: string
  initiatorId: string
  initiatorName?: string
  createdAt: string
  dueAt?: string | null
  priority?: number
  status: string
}

export interface CenterTodoQuery {
  source?: TodoSource
  keyword?: string
  defKey?: string
  priority?: number
  pageNum?: number
  pageSize?: number
}

export function getCenterTodoList(params: CenterTodoQuery) {
  return request.get<PageResult<TodoItem>>('/workflow/center/todo', params)
}

export function centerComplete(data: {
  source: TodoSource
  id: string
  action: 'approve' | 'reject'
  comment?: string
  reasonType?: string
  formData?: Record<string, any>
}) {
  return request.post<void>('/workflow/center/complete', data)
}

export function centerBatchComplete(data: {
  items: Array<{ source: TodoSource; id: string }>
  action: 'approve' | 'reject'
  comment?: string
}) {
  return request.post<{ success: number; failed: number; errors: any[] }>('/workflow/center/batch-complete', data)
}

export interface FlowDetail {
  source: TodoSource
  id: string
  title: string
  status: string
  defKey: string
  initiatorId: string
  initiatorName?: string
  createdAt: string
  updatedAt: string
  nodes?: any[]
  definition?: any
  nodeStatus?: Record<string, string>
  formData?: Record<string, unknown>
  logs: Array<{
    id: string
    action: string
    actionLabel?: string
    nodeName?: string
    operatorId?: string
    operatorName?: string
    remark?: string | null
    createdAt: string
  }>
}

export function getCenterDetail(source: TodoSource, id: string) {
  return request.get<FlowDetail>(`/workflow/center/detail/${source}/${id}`)
}

/* ============ 已办 / 我发起的 ============ */
export function getDoneList(params: { keyword?: string; pageNum?: number; pageSize?: number }) {
  return request.get<PageResult<TodoItem>>('/workflow/center/done', params)
}

export function getInitiatedList(params: { keyword?: string; status?: string; pageNum?: number; pageSize?: number }) {
  return request.get<PageResult<TodoItem>>('/workflow/center/initiated', params)
}

/* ============ 流程定义 ============ */
export function getDefinitionList(params: {
  keyword?: string
  category?: string
  status?: string
  pageNum?: number
  pageSize?: number
}) {
  return request.get<PageResult<any>>('/workflow/definition/list', params)
}

export function getDefinitionDetail(id: string) {
  return request.get<any>(`/workflow/definition/${id}`)
}

export function createDefinition(data: any) {
  return request.post<any>('/workflow/definition', data)
}

export function updateDefinition(id: string, data: any) {
  return request.post<any>(`/workflow/definition/${id}`, data)
}

export function publishDefinition(id: string) {
  return request.post<void>(`/workflow/definition/${id}/publish`)
}

export function newVersionDefinition(id: string) {
  return request.post<any>(`/workflow/definition/${id}/new-version`)
}

export function deleteDefinition(id: string) {
  return request.delete<void>(`/workflow/definition/${id}`)
}

/* ============ 审批日志 ============ */
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

export function getApprovalLogs(params: {
  title?: string
  action?: string
  operatorName?: string
  pageNum?: number
  pageSize?: number
}) {
  return request.get<PageResult<ApprovalLogRecord>>('/approval/log/list', params)
}

/* ============================================================
 * 抄送
 * ============================================================ */
export interface WfCcItem {
  ccId: string
  instanceId: string
  taskId: string | null
  nodeId: string
  nodeName: string
  title: string
  content: string | null
  initiatorId: string
  initiatorName: string | null
  defKey: string
  isRead: number
  readAt: string | null
  createdAt: string
}

export interface WfCcListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  isRead?: number
  defKey?: string
}

/** 我的抄送列表 */
export function getMyCcList(params: WfCcListParams) {
  return request.get<{ list: WfCcItem[]; total: number }>('/workflow/cc/my', params)
}

/** 未读抄送数 */
export function getUnreadCcCount() {
  return request.get<{ count: number }>('/workflow/cc/unread-count')
}

/** 标记单条已读 */
export function markCcRead(ccId: string) {
  return request.put(`/workflow/cc/${ccId}/read`)
}

/** 批量标记已读 */
export function markCcReadBatch(ccIds: string[]) {
  return request.put('/workflow/cc/read-batch', { ccIds })
}

/** 全部标记已读 */
export function markCcReadAll() {
  return request.put('/workflow/cc/read-all')
}

/* ============================================================
 * 任务流转（加签 / 转办 / 回退）
 * ============================================================ */
export interface WfAddSignParams {
  userIds: string[]
  signType?: 'before' | 'after'
  comment?: string
}

export interface WfTransferParams {
  targetUserId: string
  comment?: string
}

export interface WfRollbackParams {
  targetNodeId?: string
  reason: string
}

export interface WfTransferLog {
  logId: string
  taskId: string
  instanceId: string
  actionType: 'transfer' | 'add_sign_before' | 'add_sign_after' | 'escalate'
  fromUserId: string | null
  toUserId: string | null
  operatorId: string
  reason: string | null
  createdAt: string
}

/** 加签 */
export function addSign(taskId: string, params: WfAddSignParams) {
  return request.post(`/workflow/task/${taskId}/add-sign`, params)
}

/** 转办 */
export function transferTask(taskId: string, params: WfTransferParams) {
  return request.post(`/workflow/task/${taskId}/transfer`, params)
}

/** 加签/转办历史 */
export function getTransferHistory(taskId: string) {
  return request.get<WfTransferLog[]>(`/workflow/task/${taskId}/transfer-history`)
}

/** 回退到上一节点 */
export function rollbackTask(taskId: string, params: WfRollbackParams) {
  return request.post(`/workflow/task/${taskId}/rollback`, params)
}

/* ============================================================
 * 实例操作（挂起 / 恢复 / 终止）
 * ============================================================ */
export function suspendInstance(instanceId: string) {
  return request.post(`/workflow/instance/${instanceId}/suspend`)
}

export function resumeInstance(instanceId: string) {
  return request.post(`/workflow/instance/${instanceId}/resume`)
}

export function terminateInstance(instanceId: string, reason: string) {
  return request.post(`/workflow/instance/${instanceId}/terminate`, { reason })
}

/* ============================================================
 * 委托管理
 * ============================================================ */
export interface WfDelegateItem {
  delegateId: string
  delegatorId: string
  delegatorName: string | null
  delegateeId: string
  delegateeName: string | null
  defKeys: string[] | null
  scope: string
  startAt: string
  endAt: string
  reason: string | null
  enabled: number
  createdAt: string
}

export interface WfDelegateCreateParams {
  delegateeId: string
  defKeys?: string[]
  startAt: string
  endAt: string
  reason?: string
}

export interface WfDelegateListParams {
  pageNum?: number
  pageSize?: number
  enabled?: number
}

/** 我创建的委托 */
export function getMyDelegates(params: WfDelegateListParams) {
  return request.get<{ list: WfDelegateItem[]; total: number }>('/workflow/delegate/mine', params)
}

/** 我代理的委托 */
export function getActingDelegates(params: WfDelegateListParams) {
  return request.get<{ list: WfDelegateItem[]; total: number }>('/workflow/delegate/acting', params)
}

/** 全部委托（管理员） */
export function getAllDelegates(params: WfDelegateListParams) {
  return request.get<{ list: WfDelegateItem[]; total: number }>('/workflow/delegate/list', params)
}

export function createDelegate(params: WfDelegateCreateParams) {
  return request.post('/workflow/delegate', params)
}

export function updateDelegate(delegateId: string, params: Partial<WfDelegateCreateParams> & { enabled?: number }) {
  return request.put(`/workflow/delegate/${delegateId}`, params)
}

export function deleteDelegate(delegateId: string) {
  return request.delete(`/workflow/delegate/${delegateId}`)
}

/** 立即撤销 */
export function revokeDelegate(delegateId: string) {
  return request.post(`/workflow/delegate/${delegateId}/revoke`)
}

/** 委托生效日志 */
export function getDelegateLogs(delegateId: string) {
  return request.get(`/workflow/delegate/${delegateId}/logs`)
}

/* ============================================================
 * 定义编辑器辅助
 * ============================================================ */
export function validateDefinition(definition: unknown) {
  return request.post<{ valid: boolean; error?: string; variables?: string[]; functions?: string[] }>(
    '/workflow/definition/validate',
    { definition },
  )
}

export function importBpmnXml(xml: string) {
  return request.post<{ defKey: string; defName: string; xml: string }>('/workflow/definition/import-xml', { xml })
}
