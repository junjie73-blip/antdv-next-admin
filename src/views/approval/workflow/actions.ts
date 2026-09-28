import type { ActionItem } from '~/components/business/Table'

import type { ApprovalActionContext, ApprovalFlowRecord } from './types'

export function getApprovalActions(record: ApprovalFlowRecord, ctx: ApprovalActionContext): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '查看审批过程',
      icon: 'lucide:git-branch',
      onClick: () => ctx.onViewFlow(record),
    },
  ]

  // 审批中：显示通过 / 驳回
  if (record.status === '1') {
    actions.push(
      {
        label: '通过',
        icon: 'lucide:check',
        onClick: () => ctx.onApprove(record),
      },
      {
        label: '驳回',
        icon: 'lucide:x',
        danger: true,
        onClick: () => ctx.onReject(record),
      },
    )
  }

  // 已驳回：显示重新提交 / 删除
  if (record.status === '3') {
    actions.push(
      {
        label: '重新提交',
        icon: 'lucide:refresh-cw',
        onClick: () => ctx.onResubmit(record),
      },
      {
        label: '删除',
        icon: 'lucide:trash-2',
        danger: true,
        popConfirm: {
          title: '删除申请',
          content: `确定删除「${record.title}」吗？`,
          confirm: () => ctx.onDelete(record),
        },
      },
    )
  }

  // 草稿：允许直接删除
  if (record.status === '0') {
    actions.push({
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      popConfirm: {
        title: '删除申请',
        content: `确定删除「${record.title}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    })
  }

  return actions
}
