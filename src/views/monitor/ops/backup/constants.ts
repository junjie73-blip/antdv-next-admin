import { cn } from '~/utils/cn'

import type { BackupStatus, BackupTriggerType, BackupType } from './types'

/* ============================================================
 * 映射表
 * ============================================================ */

/** 状态 → 展示 */
export const BACKUP_STATUS_MAP: Record<BackupStatus, { text: string; color: string }> = {
  pending: { text: '等待', color: 'default' },
  running: { text: '进行中', color: 'processing' },
  completed: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
}

/** 触发方式 → 文案 */
export const TRIGGER_TYPE_MAP: Record<BackupTriggerType, string> = {
  manual: '手动',
  cron: '定时',
  pre_migrate: '迁移前',
}
export const CRON_PRESETS = [
  { label: '每天 02:00', value: '0 0 2 * * ?' },
  { label: '每周一 02:00', value: '0 0 2 ? * MON' },
  { label: '每月 1 号 02:00', value: '0 0 2 1 * ?' },
  { label: '每 6 小时', value: '0 0 */6 * * ?' },
  { label: '每 30 分钟', value: '0 */30 * * * ?' },
]
/** 备份类型 → 文案 */
export const BACKUP_TYPE_MAP: Record<BackupType, string> = {
  full: '全量',
  schema_only: '仅结构',
  data_only: '仅数据',
}

/* ============================================================
 * 下拉选项（供 schema 复用）
 * ============================================================ */

export const BACKUP_STATUS_OPTIONS = (Object.entries(BACKUP_STATUS_MAP) as Array<[BackupStatus, { text: string }]>).map(
  ([value, { text }]) => ({ label: text, value }),
)

export const TRIGGER_TYPE_OPTIONS = (Object.entries(TRIGGER_TYPE_MAP) as Array<[BackupTriggerType, string]>).map(
  ([value, label]) => ({ label, value }),
)

export const BACKUP_TYPE_OPTIONS = (Object.entries(BACKUP_TYPE_MAP) as Array<[BackupType, string]>).map(
  ([value, label]) => ({ label, value }),
)

/* ============================================================
 * 表格常量
 * ============================================================ */

/** 行 key */
export const BACKUP_ROW_KEY = 'backupId'
export const POLICY_ROW_KEY = 'policyId'
/** 轮询间隔（毫秒） */
export const BACKUP_POLL_INTERVAL = 10_000

/** 触发备份后延迟刷新（毫秒） */
export const BACKUP_RELOAD_DELAY = 1500

/* ============================================================
 * 样式类名
 * ============================================================ */

export const pageWrapperClass = cn('space-y-4', 'p-4')

export const headerClassName = cn('flex', 'items-center', 'justify-between')

export const headerTitleClass = cn('text-lg', 'font-semibold')
export const POLICY_EDITABLE_FIELDS = [
  'policyId',
  'name',
  'cron',
  'backupType',
  'retainDays',
  'retainCount',
  'enabled',
  'bucket',
  'remark',
] as const
