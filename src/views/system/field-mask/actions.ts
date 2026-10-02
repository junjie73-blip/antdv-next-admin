import type { ActionItem } from '~/components/business/Table'

import { SYSTEM_PERMS } from '~/enums/permissions'

import type { FieldMaskActionContext, FieldMaskRecord } from './types'

export function getFieldMaskActions(r: FieldMaskRecord, ctx: FieldMaskActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: SYSTEM_PERMS.fieldMask.manage,
      onClick: () => ctx.onEdit(r),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: SYSTEM_PERMS.fieldMask.manage,
      popConfirm: {
        title: '删除脱敏策略',
        content: `确定删除「${r.name}」吗？`,
        confirm: () => ctx.onDelete(r),
      },
    },
  ]
}
