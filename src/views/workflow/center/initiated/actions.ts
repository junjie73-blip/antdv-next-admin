import type { TodoItem } from '~/api/workflow'
import type { ActionItem } from '~/components/business/Table'

import { WORKFLOW_PERMS } from '~/enums/permissions'

export interface InitiatedActionContext {
  onDetail: (item: TodoItem) => void
  onSuspend: (item: TodoItem) => void | Promise<void>
  onResume: (item: TodoItem) => void | Promise<void>
  onTerminate: (item: TodoItem) => void | Promise<void>
}

export function getInitiatedActions(item: TodoItem, ctx: InitiatedActionContext): ActionItem[] {
  // 0-运行中 1-已完成 2-已终止 3-已挂起
  const isRunning = item.status === '0'
  const isSuspended = item.status === '3'

  const actions: ActionItem[] = [
    {
      label: '详情',
      icon: 'lucide:eye',
      auth: WORKFLOW_PERMS.center.detail,
      onClick: () => ctx.onDetail(item),
    },
  ]

  if (isRunning) {
    actions.push({
      label: '挂起',
      icon: 'lucide:pause',
      popConfirm: {
        title: '挂起流程',
        content: '挂起后流程将暂停，确定继续？',
        confirm: () => ctx.onSuspend(item),
      },
    })
  }

  if (isSuspended) {
    actions.push({
      label: '恢复',
      icon: 'lucide:play',
      onClick: () => ctx.onResume(item),
    })
  }

  if (isRunning || isSuspended) {
    actions.push({
      label: '终止',
      icon: 'lucide:circle-stop',
      danger: true,
      popConfirm: {
        title: '终止流程',
        content: '终止后无法恢复，确定继续？',
        confirm: () => ctx.onTerminate(item),
      },
    })
  }

  return actions
}
