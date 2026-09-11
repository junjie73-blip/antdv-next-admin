import type { ActionItem } from "@/components/business/Table";
import type { UserRecord } from "./types";

/** 用户行操作上下文 */
export interface UserActionContext {
  onEdit: (record: UserRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: UserRecord) => void | Promise<void>;
}

/**
 * 生成用户行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getUserActions(record: UserRecord, ctx: UserActionContext): ActionItem[] {
  return [
    {
      icon: "ant-design:edit-outlined",
      label: "编辑",
      onClick: () => ctx.onEdit(record),
    },
    {
      icon: "ant-design:delete-outlined",
      label: "删除",
      danger: true,
      popConfirm: {
        title: "删除用户",
        content: `确定删除「${record.username}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
