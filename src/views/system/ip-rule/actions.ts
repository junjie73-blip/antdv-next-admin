import type { ActionItem } from '~/components/business/Table'

import type { IpRuleRecord } from './types'

/** 行操作上下文 */
export interface IpRuleActionContext {
  onEdit: (record: IpRuleRecord) => void
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: IpRuleRecord) => void | Promise<void>
}

/**
 * 生成 IP 规则行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getIpRuleActions(record: IpRuleRecord, ctx: IpRuleActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      popConfirm: {
        title: '删除IP规则',
        content: `确定要删除「${record.ipPattern}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
