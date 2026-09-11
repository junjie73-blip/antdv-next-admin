import type { ActionItem } from "@/components/business/Table";
import type { NoticeRecord } from "./types";

/** 操作回调上下文 */
export interface NoticeActionContext {
  onEdit: (record: NoticeRecord) => void;
  onSend: (record: NoticeRecord) => void;
  onDelete: (record: NoticeRecord) => void;
}

/**
 * 生成通知行操作项
 * 保持无状态：副作用由 ctx 注入
 */
export function getNoticeActions(record: NoticeRecord, ctx: NoticeActionContext): ActionItem[] {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "发送",
      icon: "ant-design:send-outlined",
      onClick: () => ctx.onSend(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除通知",
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
