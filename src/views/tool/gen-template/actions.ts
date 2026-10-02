import type { ActionItem } from '~/components/business/Table'

import { SYSTEM_PERMS } from '~/enums/permissions'

import type { GenTemplateRecord, TemplateActionContext } from './types'

export function getTemplateActions(r: GenTemplateRecord, ctx: TemplateActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: SYSTEM_PERMS.genTemplate.manage,
      onClick: () => ctx.onEdit(r),
    },
    {
      label: '版本',
      icon: 'lucide:history',
      auth: SYSTEM_PERMS.genTemplate.list,
      onClick: () => ctx.onVersions(r),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: SYSTEM_PERMS.genTemplate.manage,
      popConfirm: {
        title: '删除模板',
        content: `确定删除「${r.templateName}」吗？所有版本将被清除。`,
        confirm: () => ctx.onDelete(r),
      },
    },
  ]
}
