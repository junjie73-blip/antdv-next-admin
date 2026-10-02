import type { WfCcItem } from '~/api/workflow'
import type { ActionItem } from '~/components/business/Table'

export interface CcActionContext {
  onRead: (item: WfCcItem) => void | Promise<void>
  onDetail: (item: WfCcItem) => void
}

export function getCcActions(item: WfCcItem, ctx: CcActionContext): ActionItem[] {
  const actions: ActionItem[] = []

  if (item.isRead === 0) {
    actions.push({
      label: '已读',
      icon: 'lucide:check',
      onClick: () => ctx.onRead(item),
    })
  }

  actions.push({
    label: '详情',
    icon: 'lucide:eye',
    onClick: () => ctx.onDetail(item),
  })

  return actions
}
