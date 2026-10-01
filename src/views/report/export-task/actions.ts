import type { ActionItem } from '~/components/business/Table'

import type { ExportTaskActionContext, ExportTaskRecord } from './types'

import { canDownload } from './constants'

export function getExportTaskActions(record: ExportTaskRecord, ctx: ExportTaskActionContext): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '详情',
      icon: 'lucide:eye',
      onClick: () => ctx.onDetail(record),
    },
  ]

  // 完成 + 未过期 → 下载
  if (canDownload(record)) {
    actions.push({
      label: '下载',
      icon: 'lucide:download',
      onClick: () => ctx.onDownload(record),
    })
  }

  // 失败 → 重试
  if (record.status === 'failed') {
    actions.push({
      label: '重试',
      icon: 'lucide:rotate-cw',
      popConfirm: {
        title: '重试导出',
        content: `确定重新提交「${record.file_name ?? record.task_id.slice(0, 8)}」吗？`,
        confirm: () => ctx.onRetry(record),
      },
    })
  }

  // 进行中 → 取消
  if (record.status === 'pending' || record.status === 'processing') {
    actions.push({
      label: '取消',
      icon: 'lucide:ban',
      danger: true,
      popConfirm: {
        title: '取消任务',
        content: '确定取消这个导出任务吗？',
        confirm: () => ctx.onCancel(record),
      },
    })
  }

  // 已完成/失败/取消 → 删除
  if (['completed', 'failed', 'cancelled'].includes(record.status)) {
    actions.push({
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      popConfirm: {
        title: '删除任务',
        content: '确定删除这条导出任务记录吗？',
        confirm: () => ctx.onDelete(record),
      },
    })
  }

  return actions
}
