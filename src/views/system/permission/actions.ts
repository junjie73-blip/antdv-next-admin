import type { PermissionRecord } from "./types";

import type { ActionItem } from "~/components/business/Table";

/** 权限行操作上下文 */
export interface PermissionActionContext {
  /** 查看详情 */
  onView: (record: PermissionRecord) => void;
  /** 编辑 */
  onEdit: (record: PermissionRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: PermissionRecord) => void | Promise<void>;
}

/**
 * 生成权限行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getPermissionActions(
  record: PermissionRecord,
  ctx: PermissionActionContext,
): ActionItem[] {
  return [
    {
      label: "查看",
      icon: "ant-design:eye-outlined",
      onClick: () => ctx.onView(record),
    },
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
        title: "删除权限",
        content: `确定要删除权限「${record.permName}」吗？删除后关联的角色将失去此权限`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
