import type { ActionItem } from '~/components/business/Table'

import type { DictItemRecord } from './types'

/** 字典项行操作上下文 */
export interface DictItemActionContext {
  onEdit: (record: DictItemRecord) => void
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: DictItemRecord) => void | Promise<void>
}

/**
 * 生成字典项行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getDictItemActions(record: DictItemRecord, ctx: DictItemActionContext): ActionItem[] {
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
        title: '删除字典项',
        content: `确定要删除「${record.dictLabel}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
