import type { ActionItem } from '~/components/business/Table'

import type { BackupPolicy, BackupRecord } from './types'

export interface BackupActionContext {
  /** 下载备份文件 */
  onDownload: (record: BackupRecord) => void | Promise<void>
  /** 删除备份 */
  onDelete: (record: BackupRecord) => void | Promise<void>
}

/**
 * 生成备份记录的行操作
 *
 * 无状态：不 import store / 不发请求 / 不弹 message，
 * 所有副作用通过 ctx 由 index.vue 注入（参考规范 §14）。
 */
export function getBackupActions(record: BackupRecord, ctx: BackupActionContext): ActionItem[] {
  const actions: ActionItem[] = []

  // 仅"已完成"的备份可下载
  if (record.status === 'completed') {
    actions.push({
      label: '下载',
      icon: 'ant-design:download-outlined',
      onClick: () => ctx.onDownload(record),
    })
  }

  actions.push({
    label: '删除',
    icon: 'ant-design:delete-outlined',
    danger: true,
    popConfirm: {
      title: '删除备份',
      content: `确定删除「${record.fileName ?? record.backupId}」？对象存储文件将一并删除，无法恢复。`,
      confirm: () => ctx.onDelete(record),
    },
  })

  return actions
}

export interface PolicyActionContext {
  onEdit: (record: BackupPolicy) => void
  onDelete: (record: BackupPolicy) => void | Promise<void>
}

export function getPolicyActions(record: BackupPolicy, ctx: PolicyActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      popConfirm: {
        title: '删除策略',
        content: `确定删除策略「${record.name}」吗？删除后定时任务将不再执行。`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
