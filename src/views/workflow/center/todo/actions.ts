import type { ActionItem } from '~/components/business/Table'

import { WORKFLOW_PERMS } from '~/enums/permissions'

import type { TodoActionContext, TodoItem } from './types'

export function getTodoActions(item: TodoItem, ctx: TodoActionContext): ActionItem[] {
  //  0-运行中 1-已完成 2-已终止 3-已挂起
  return [
    {
      label: '通过',
      icon: 'lucide:check',
      disabled: ['1', '3'].includes(item.status),
      auth: WORKFLOW_PERMS.center.complete,
      onClick: () => ctx.onApprove(item),
    },
    {
      label: '驳回',
      icon: 'lucide:x',
      danger: true,
      disabled: !['0'].includes(item.status),
      auth: WORKFLOW_PERMS.center.complete,
      onClick: () => ctx.onReject(item),
    },
    {
      label: '详情',
      icon: 'lucide:eye',
      auth: WORKFLOW_PERMS.center.detail,
      onClick: () => ctx.onDetail(item),
    },
  ]
}
