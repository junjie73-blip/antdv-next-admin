import { http } from '~/utils'

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
  return http.Get<PageResult<TodoItem>>('/workflow/center/todo', { params })
}

export function centerComplete(data: {
  source: TodoSource
  id: string
  action: 'approve' | 'reject'
  comment?: string
  reasonType?: string
  formData?: Record<string, any>
}) {
  return http.Post<void>('/workflow/center/complete', data)
}

export function centerBatchComplete(data: {
  items: Array<{ source: TodoSource; id: string }>
  action: 'approve' | 'reject'
  comment?: string
}) {
  return http.Post<{ success: number; failed: number; errors: any[] }>('/workflow/center/batch-complete', data)
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
  return http.Get<FlowDetail>(`/workflow/center/detail/${source}/${id}`)
}

/* ============ 已办 / 我发起的 ============ */
export function getDoneList(params: { keyword?: string; pageNum?: number; pageSize?: number }) {
  return http.Get<PageResult<TodoItem>>('/workflow/center/done', { params })
}

export function getInitiatedList(params: { keyword?: string; status?: string; pageNum?: number; pageSize?: number }) {
  return http.Get<PageResult<TodoItem>>('/workflow/center/initiated', { params })
}

/* ============ 流程定义 ============ */
export function getDefinitionList(params: {
  keyword?: string
  category?: string
  status?: string
  pageNum?: number
  pageSize?: number
}) {
  return http.Get<PageResult<any>>('/workflow/definition/list', { params })
}

export function getDefinitionDetail(id: string) {
  return http.Get<any>(`/workflow/definition/${id}`)
}

export function createDefinition(data: any) {
  return http.Post<any>('/workflow/definition', data)
}

export function updateDefinition(id: string, data: any) {
  return http.Post<any>(`/workflow/definition/${id}`, data)
}

export function publishDefinition(id: string) {
  return http.Post<void>(`/workflow/definition/${id}/publish`)
}

export function newVersionDefinition(id: string) {
  return http.Post<any>(`/workflow/definition/${id}/new-version`)
}

export function deleteDefinition(id: string) {
  return http.Delete<void>(`/workflow/definition/${id}`)
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
  return http.Get<PageResult<ApprovalLogRecord>>('/approval/log/list', { params })
}
