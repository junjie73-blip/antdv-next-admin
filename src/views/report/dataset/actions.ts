import type { ActionItem } from '~/components/business/Table'

import { REPORT_PERMS } from '~/enums/permissions'

import type { DatasetActionContext, DatasetRecord } from './types'

export function getDatasetActions(record: DatasetRecord, ctx: DatasetActionContext): ActionItem[] {
  return [
    {
      label: '预览',
      icon: 'lucide:eye',
      auth: REPORT_PERMS.dataset.test,
      onClick: () => ctx.onPreview(record),
    },
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: REPORT_PERMS.dataset.update,
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: REPORT_PERMS.dataset.delete,
      popConfirm: {
        title: '删除数据集',
        content: `确定删除「${record.dataset_name}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
