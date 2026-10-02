import type { WfDelegateItem } from '~/api/workflow'
import type { ActionItem } from '~/components/business/Table'

export interface DelegateActionContext {
  onEdit: (r: WfDelegateItem) => void
  onRevoke: (r: WfDelegateItem) => void | Promise<void>
  onDelete: (r: WfDelegateItem) => void | Promise<void>
}

export function getDelegateActions(r: WfDelegateItem, ctx: DelegateActionContext): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '编辑',
      icon: 'lucide:edit',
      disabled: r.enabled === 0,
      onClick: () => ctx.onEdit(r),
    },
  ]

  if (r.enabled === 1) {
    actions.push({
      label: '撤销',
      icon: 'lucide:undo-2',
      popConfirm: {
        title: '撤销委托',
        content: '确定立即撤销该委托吗？',
        confirm: () => ctx.onRevoke(r),
      },
    })
  }

  actions.push({
    label: '删除',
    icon: 'lucide:trash-2',
    danger: true,
    popConfirm: {
      title: '删除委托',
      content: '确定删除该委托记录吗？',
      confirm: () => ctx.onDelete(r),
    },
  })

  return actions
}
