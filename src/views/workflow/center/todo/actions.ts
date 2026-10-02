import type { ActionItem } from '~/components/business/Table'

import { WORKFLOW_PERMS } from '~/enums/permissions'

import type { TodoActionContext, TodoItem } from './types'

export function getTodoActions(item: TodoItem, ctx: TodoActionContext): ActionItem[] {
  //  0-运行中 1-已完成 2-已终止 3-已挂起
  const isPending = item.status === '0'
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
    {
      label: '加签',
      icon: 'lucide:user-plus',
      disabled: !isPending || item.source !== 'workflow',
      onClick: () => ctx.onAddSign(item),
    },
    {
      label: '转办',
      disabled: !isPending || item.source !== 'workflow',
      icon: 'lucide:arrow-right-left',
      onClick: () => ctx.onTransfer(item),
    },
    {
      label: '回退',
      icon: 'lucide:corner-up-left',
      danger: true,
      disabled: !isPending || item.source !== 'workflow',
      popConfirm: {
        title: '回退任务',
        content: '回退后任务将退回上一节点，确定继续？',
        confirm: () => ctx.onRollback(item),
      },
    },
    {
      label: '流转历史',
      disabled: !isPending || item.source !== 'workflow',
      icon: 'lucide:history',
      onClick: () => ctx.onTransferHistory(item),
    },
  ]
}
