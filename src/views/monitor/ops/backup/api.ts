import { request } from '~/composables'

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

export const listBackups = (params: BackupListParams) => request.get<BackupListResult>('/system/backup/list', params)

export const triggerBackup = (data: BackupTriggerParams) =>
  request.post<BackupTriggerResult>('/system/backup/trigger', data)

export const getDownloadUrl = (backupId: string) =>
  request.get<BackupDownloadInfo>(`/system/backup/${backupId}/download`).then((res) => res.data)

export const deleteBackup = (backupId: string) => request.delete(`/system/backup/${backupId}`)

/* ============================================================
 * 备份策略
 * ============================================================ */

export const listPolicies = () => request.get<BackupPolicy[]>('/system/backup/policies').then((res) => res.data)

export const savePolicy = (data: Partial<BackupPolicy> & { name: string; cron: string }) =>
  request.put('/system/backup/policies', data)

export const deletePolicy = (id: string) => request.delete(`/system/backup/policies/${id}`)
