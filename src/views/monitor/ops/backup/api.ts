import { http } from '~/utils'

export interface BackupRecord {
  backup_id: string
  trigger_type: 'manual' | 'cron' | 'pre_migrate'
  backup_type: 'full' | 'schema_only' | 'data_only'
  status: 'pending' | 'running' | 'completed' | 'failed'
  storage_key: string | null
  file_name: string | null
  file_size: string | null
  compression: string
  database_name: string
  database_size: string | null
  checksum: string | null
  duration_ms: number | null
  error_msg: string | null
  retain_until: string | null
  remark: string | null
  started_at: string
  finished_at: string | null
}

export interface BackupPolicy {
  policy_id: string
  name: string
  cron: string
  backup_type: string
  retain_days: number
  retain_count: number
  enabled: number
  bucket: string | null
  remark: string | null
}

export const listBackups = (params: Record<string, unknown>) =>
  http.Get<{ list: BackupRecord[]; total: number }>('/system/backup/list', { params })

export const triggerBackup = (data: { backupType?: string; remark?: string }) =>
  http.Post<{ backupId: string }>('/system/backup/trigger', data)

export const getDownloadUrl = (backupId: string) =>
  http.Get<{ url: string; fileName: string }>(`/system/backup/${backupId}/download`)

export const deleteBackup = (backupId: string) => http.Delete(`/system/backup/${backupId}`)

export const listPolicies = () => http.Get<BackupPolicy[]>('/system/backup/policies')
export const savePolicy = (data: Partial<BackupPolicy> & { name: string; cron: string }) =>
  http.Put('/system/backup/policies', data)
export const deletePolicy = (id: string) => http.Delete(`/system/backup/policies/${id}`)
