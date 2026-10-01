import type { ActionItem } from '~/components/business/Table'

import { WORKFLOW_PERMS } from '~/enums/permissions'

import type { DefinitionActionContext, DefinitionRecord } from './types'

export function getDefinitionActions(record: DefinitionRecord, ctx: DefinitionActionContext): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: WORKFLOW_PERMS.definition.update,
      onClick: () => ctx.onEdit(record),
    },
  ]

  if (record.status === '0') {
    actions.push({
      label: '发布',
      icon: 'lucide:rocket',
      auth: WORKFLOW_PERMS.definition.publish,
      popConfirm: {
        title: '发布流程',
        content: `确定发布「${record.def_name}」v${record.version} 吗？`,
        confirm: () => ctx.onPublish(record),
      },
    })
  }

  if (record.status === '1') {
    actions.push({
      label: '新版本',
      icon: 'lucide:git-branch',
      auth: WORKFLOW_PERMS.definition.newVersion,
      onClick: () => ctx.onNewVersion(record),
    })
  }

  if (record.status !== '1') {
    actions.push({
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: WORKFLOW_PERMS.definition.delete,
      popConfirm: {
        title: '删除流程',
        content: `确定删除「${record.def_name}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    })
  }

  return actions
}
