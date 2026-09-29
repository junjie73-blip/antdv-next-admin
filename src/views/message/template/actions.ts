import type { ActionItem } from '~/components/business/Table'

import { MESSAGE_PERMS } from '~/enums/permissions'

import type { TemplateRecord, TemplateActionContext } from './types'

export function getTemplateActions(record: TemplateRecord, ctx: TemplateActionContext): ActionItem[] {
  return [
    {
      label: '预览',
      icon: 'carbon:view',
      onClick: () => ctx.onPreview(record),
      auth: MESSAGE_PERMS.template.detail,
    },
    {
      label: '测试',
      icon: 'carbon:send-alt',
      auth: MESSAGE_PERMS.template.test,
      onClick: () => ctx.onTest(record),
    },
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      auth: MESSAGE_PERMS.template.update,
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '复制',
      icon: 'carbon:copy',
      auth: MESSAGE_PERMS.template.create,
      onClick: () => ctx.onCopy(record),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      auth: MESSAGE_PERMS.template.delete,
      popConfirm: {
        title: '删除模板',
        content: `确定删除「${record.templateName}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
