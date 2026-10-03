import type { ActionItem } from '~/components/business/Table'

import type { OrgHistoryEvent } from './types'

export interface OrgHistoryActionContext {
  onViewDetail: (record: OrgHistoryEvent) => void
  onViewUserTimeline: (record: OrgHistoryEvent) => void
  onViewDeptTimeline: (record: OrgHistoryEvent) => void
  onViewRevertChain: (record: OrgHistoryEvent) => void
  onRevert: (record: OrgHistoryEvent) => void | Promise<void>
}

/**
 * 行操作保持无状态，副作用通过 ctx 注入（§14）。
 */
export function getOrgHistoryActions(record: OrgHistoryEvent, ctx: OrgHistoryActionContext): ActionItem[] {
  const items: ActionItem[] = [
    {
      label: '详情',
      icon: 'ant-design:eye-outlined',
      onClick: () => ctx.onViewDetail(record),
    },
  ]

  if (record.entityType === 'user' || record.entityType === 'user_dept') {
    items.push({
      label: '员工时间线',
      icon: 'ant-design:history-outlined',
      onClick: () => ctx.onViewUserTimeline(record),
    })
  }

  if (record.entityType === 'dept') {
    items.push({
      label: '部门时间线',
      icon: 'ant-design:apartment-outlined',
      onClick: () => ctx.onViewDeptTimeline(record),
    })
  }

  // 被撤销产生的记录（relatedId 非空）可以查看自己的撤销链
  if (record.relatedId) {
    items.push({
      label: '撤销链',
      icon: 'ant-design:branches-outlined',
      onClick: () => ctx.onViewRevertChain(record),
    })
  } else {
    items.push({
      label: '撤销',
      danger: true,
      icon: 'ant-design:undo-outlined',
      popConfirm: {
        title: '撤销该变更',
        content: '撤销会产生一条反向记录，确定继续吗？',
        confirm: () => ctx.onRevert(record),
      },
    })
  }

  return items
}
