import type { ActionItem } from '~/components/business/Table'

import { SYSTEM_PERMS } from '~/enums/permissions'

import type { UserGroupActionContext, UserGroupRecord } from './types'

export function getUserGroupActions(r: UserGroupRecord, ctx: UserGroupActionContext): ActionItem[] {
  return [
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: SYSTEM_PERMS.userGroup.update,
      onClick: () => ctx.onEdit(r),
    },
    {
      label: '成员',
      icon: 'lucide:users',
      auth: SYSTEM_PERMS.userGroup.members,
      onClick: () => ctx.onMembers(r),
    },
    {
      label: '角色',
      icon: 'lucide:shield',
      auth: SYSTEM_PERMS.userGroup.roles,
      onClick: () => ctx.onRoles(r),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: SYSTEM_PERMS.userGroup.delete,
      popConfirm: {
        title: '删除用户组',
        content: `确定删除「${r.groupName}」吗？成员和角色绑定将被清除。`,
        confirm: () => ctx.onDelete(r),
      },
    },
  ]
}
