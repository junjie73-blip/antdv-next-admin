// views/system/notice/actions.ts
import type { ActionItem } from '~/components/business/Table'

import { MESSAGE_PERMS } from '~/enums/permissions'

import type { NoticeRecord } from './types'

/** 操作回调上下文 */
export interface NoticeActionContext {
  onEdit: (record: NoticeRecord) => void
  onSend: (record: NoticeRecord) => void
  onDelete: (record: NoticeRecord) => void
  onRevoke: (record: NoticeRecord) => void
}

export function getNoticeActions(record: NoticeRecord, ctx: NoticeActionContext): ActionItem[] {
  const isSent = record.sendStatus === '1'

  return [
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      auth: MESSAGE_PERMS.notice.update,
      // ⭐ 已发送的通知不可编辑
      disabled: isSent,
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '发送',
      icon: 'ant-design:send-outlined',
      auth: MESSAGE_PERMS.notice.send,
      disabled: isSent,
      popConfirm: {
        title: '发送通知',
        content: `确定立即发送「${record.title}」吗？`,
        confirm: () => ctx.onSend(record),
      },
    },
    {
      label: '撤回',
      icon: 'ant-design:rollback-outlined',
      auth: MESSAGE_PERMS.notice.revoke,
      // ⭐ 只有已发送才能撤回
      disabled: !isSent,
      popConfirm: {
        title: '撤回通知',
        content: `确定撤回「${record.title}」吗？撤回后用户将无法看到该通知。`,
        confirm: () => ctx.onRevoke(record),
      },
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      auth: MESSAGE_PERMS.notice.delete,
      danger: true,
      popConfirm: {
        title: '删除通知',
        content: '确定删除该通知吗？',
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
