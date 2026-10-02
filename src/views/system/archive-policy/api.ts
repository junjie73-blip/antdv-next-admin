import { http } from '~/utils'

export type ArchiveTable =
  | 'sys_audit_log'
  | 'sys_login_log'
  | 'sys_notice_send_log'
  | 'sys_job_log'
  | 'sys_message'
  | 'sys_audit_daily'
  | 'sys_login_daily'
  | 'sys_cache_operation_log'
  | 'sys_slow_query_log'

export interface ArchivePolicyRecord {
  policyId: string
  tableName: string
  displayName: string
  retentionMonths: number
  archiveEnabled: number
  storageEnabled: number
  batchSize: number
  cronExpression: string
  enabled: number
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  remark: string | null
  updatedAt: string
}

export interface ArchivePolicyUpdateParams {
  displayName?: string
  retentionMonths?: number
  archiveEnabled?: number
  storageEnabled?: number
  batchSize?: number
  cronExpression?: string
  enabled?: number
  remark?: string | null
}

export interface ArchiveTriggerResult {
  tableName: string
  dryRun: boolean
  wouldArchive?: number
  archived?: number
  message: string
}

export function getArchivePolicyList() {
  return http.Get<ArchivePolicyRecord[]>('/archive-policy/list')
}

export function getArchivePolicyByTable(tableName: ArchiveTable) {
  return http.Get<ArchivePolicyRecord>(`/archive-policy/table/${tableName}`)
}

export function updateArchivePolicy(tableName: ArchiveTable, data: ArchivePolicyUpdateParams) {
  return http.Put(`/archive-policy/table/${tableName}`, data)
}

export function triggerArchive(data: { tableName: ArchiveTable; dryRun: boolean }) {
  return http.Post<ArchiveTriggerResult>('/archive-policy/trigger', data)
}

export function getArchiveLogs(params?: { pageNum?: number; pageSize?: number }) {
  return http.Get<{ list: any[]; total: number }>('/archive-policy/logs', { params })
}
