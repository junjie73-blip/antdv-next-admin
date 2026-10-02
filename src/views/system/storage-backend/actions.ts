import type { ActionItem } from '~/components/business/Table'

import { SYSTEM_PERMS } from '~/enums/permissions'

import type { StorageBackendActionContext, StorageBackendRecord } from './types'

export function getStorageActions(r: StorageBackendRecord, ctx: StorageBackendActionContext): ActionItem[] {
  const isActive = r.isActive === 1

  return [
    {
      label: '编辑',
      icon: 'lucide:edit',
      auth: SYSTEM_PERMS.storage.manage,
      onClick: () => ctx.onEdit(r),
    },
    {
      label: '激活',
      icon: 'lucide:power',
      auth: SYSTEM_PERMS.storage.manage,
      disabled: isActive,
      popConfirm: {
        title: '激活存储后端',
        content: `激活后新上传的文件将写入「${r.backendName}」，确定继续？`,
        confirm: () => ctx.onActivate(r),
      },
    },
    {
      label: '检查',
      icon: 'lucide:activity',
      auth: SYSTEM_PERMS.storage.manage,
      onClick: () => ctx.onCheck(r),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      danger: true,
      auth: SYSTEM_PERMS.storage.manage,
      disabled: isActive,
      popConfirm: {
        title: '删除存储后端',
        content: `确定删除「${r.backendName}」吗？`,
        confirm: () => ctx.onDelete(r),
      },
    },
  ]
}
