import type { PermissionRecord } from "./types";

import type { ActionItem } from "@/components/business/Table";

/** 按钮权限行操作上下文 */
export interface PermissionActionContext {
  onEdit: (record: PermissionRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: PermissionRecord) => void | Promise<void>;
}

/**
 * 生成按钮权限行操作项
 */
export function getPermissionActions(
  record: PermissionRecord,
  ctx: PermissionActionContext,
): ActionItem[] {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除按钮权限",
        content: `确定要删除「${record.menuName}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
