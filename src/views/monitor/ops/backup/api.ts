import { http } from '~/utils'

import type {
  BackupDownloadInfo,
  BackupListParams,
  BackupListResult,
  BackupPolicy,
  BackupTriggerParams,
  BackupTriggerResult,
} from './types'

/* ============================================================
 * 备份记录
 * ============================================================ */

export const listBackups = (params: BackupListParams) => http.Get<BackupListResult>('/system/backup/list', { params })

export const triggerBackup = (data: BackupTriggerParams) =>
  http.Post<BackupTriggerResult>('/system/backup/trigger', data)

export const getDownloadUrl = (backupId: string) =>
  http.Get<BackupDownloadInfo>(`/system/backup/${backupId}/download`).then((res) => res.data)

export const deleteBackup = (backupId: string) => http.Delete(`/system/backup/${backupId}`)

/* ============================================================
 * 备份策略
 * ============================================================ */

export const listPolicies = () =>
  http
    .Get<BackupPolicy[]>('/system/backup/policies')
    .send(true)
    .then((res) => res.data)

export const savePolicy = (data: Partial<BackupPolicy> & { name: string; cron: string }) =>
  http.Put('/system/backup/policies', data)

export const deletePolicy = (id: string) => http.Delete(`/system/backup/policies/${id}`)
