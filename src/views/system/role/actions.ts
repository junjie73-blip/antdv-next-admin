import type { ActionItem } from '~/components/business/Table'

import type { RoleRecord } from './types'

/** 角色行操作上下文 */
export interface RoleActionContext {
  onEdit: (record: RoleRecord) => void
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: RoleRecord) => void | Promise<void>
  /** 授权 */
  onPermission: (record: RoleRecord) => void | Promise<void>
}

/**
 * 生成角色行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getRoleActions(record: RoleRecord, ctx: RoleActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      auth: 'system:role:update',
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '授权',
      icon: 'ant-design:lock-outlined',
      auth: 'system:role:auth',
      onClick: () => ctx.onPermission(record),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      auth: 'system:role:delete',
      popConfirm: {
        title: '确定要删除该角色吗？',
        content: `确定要删除「${record.roleName}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
