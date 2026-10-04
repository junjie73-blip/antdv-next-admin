/* ============================================================
 * 枚举类型
 * ============================================================ */

export type BackupTriggerType = 'manual' | 'cron' | 'pre_migrate'
export type BackupType = 'full' | 'schema_only' | 'data_only'
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed'

/* ============================================================
 * 数据模型
 * ============================================================ */

/** 备份记录（与后端 snake_case 字段一致） */
export interface BackupRecord {
  backupId: string
  triggerType: BackupTriggerType
  backupType: BackupType
  status: BackupStatus
  storageKey: string | null
  fileName: string | null
  fileSize: string | null
  compression: string
  databaseName: string
  databaseSize: string | null
  checksum: string | null
  durationMs: number | null
  errorMsg: string | null
  retainUntil: string | null
  remark: string | null
  startedAt: string
  finishedAt: string | null
}

/** 备份策略 */
export interface BackupPolicy {
  policyId: string
  name: string
  cron: string
  backupType: string
  retainDays: number
  retainCount: number
  enabled: number
  bucket: string | null
  remark: string | null
}

/* ============================================================
 * 请求 / 响应
 * ============================================================ */

export interface BackupListParams {
  pageNum: number
  pageSize: number
  status?: BackupStatus
  triggerType?: BackupTriggerType
}

export interface BackupListResult {
  list: BackupRecord[]
  total: number
}

export interface BackupTriggerParams {
  backupType?: BackupType
  remark?: string
}

export interface BackupTriggerResult {
  backupId: string
}

export interface BackupDownloadInfo {
  url: string
  fileName: string
}
