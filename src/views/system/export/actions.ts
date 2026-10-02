import type { ActionItem } from '~/components/business/Table'

import type { ExportTask } from './types'

/** 导出行操作上下文 */
export interface ExportActionContext {
  onDownload: (record: ExportTask) => void | Promise<void>
  onCancel: (record: ExportTask) => void | Promise<void>
  onDelete: (record: ExportTask) => void | Promise<void>
}

/**
 * 生成导出任务行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getExportActions(record: ExportTask, ctx: ExportActionContext): ActionItem[] {
  const actions: ActionItem[] = []

  if (record.status === 'completed') {
    actions.push({
      label: '下载',
      icon: 'ant-design:download-outlined',
      onClick: () => ctx.onDownload(record),
    })
  }

  if (record.status === 'pending' || record.status === 'processing') {
    actions.push({
      label: '取消',
      icon: 'ant-design:close-outlined',
      onClick: () => ctx.onCancel(record),
    })
  }

  actions.push({
    label: '删除',
    icon: 'ant-design:delete-outlined',
    danger: true,
    popConfirm: {
      title: '删除任务',
      content: '删除后文件不可恢复，确定继续？',
      confirm: () => ctx.onDelete(record),
    },
  })

  return actions
}
