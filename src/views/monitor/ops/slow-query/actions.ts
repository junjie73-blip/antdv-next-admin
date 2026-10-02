import type { SlowQueryRecord } from '~/api/monitor-slow-query'
import type { ActionItem } from '~/components/business/Table'

import { MONITOR_PERMS } from '~/enums/permissions'

export interface SlowQueryActionContext {
  onDetail: (r: SlowQueryRecord) => void
  onResolve: (r: SlowQueryRecord) => void | Promise<void>
  onIgnore: (r: SlowQueryRecord) => void | Promise<void>
}

export function getSlowQueryActions(r: SlowQueryRecord, ctx: SlowQueryActionContext): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: '详情',
      icon: 'lucide:eye',
      auth: MONITOR_PERMS.slowQuery.list,
      onClick: () => ctx.onDetail(r),
    },
  ]

  if (r.status === 'open') {
    actions.push({
      label: '已解决',
      icon: 'lucide:check-circle',
      auth: MONITOR_PERMS.slowQuery.review,
      popConfirm: {
        title: '标记为已解决',
        content: '确定将该慢查询标记为已解决吗？',
        confirm: () => ctx.onResolve(r),
      },
    })
    actions.push({
      label: '忽略',
      icon: 'lucide:eye-off',
      auth: MONITOR_PERMS.slowQuery.review,
      popConfirm: {
        title: '忽略',
        content: '确定忽略该慢查询吗？后续不再告警。',
        confirm: () => ctx.onIgnore(r),
      },
    })
  }

  return actions
}
