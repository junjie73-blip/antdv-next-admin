import type { MenuRecord } from "./types";

import type { ActionItem } from "~/components/business/Table";

/** 菜单行操作上下文 */
export interface MenuActionContext {
  onAddChild: (record: MenuRecord) => void;
  onAddPermission: (record: MenuRecord) => void;
  onEdit: (record: MenuRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: MenuRecord) => void | Promise<void>;
}

/**
 * 生成菜单行操作项
 * 说明：
 * - 「新增子菜单」仅目录（menuType=1）可用
 * - 「新增权限」仅菜单（menuType=2）可用
 */
export function getMenuActions(record: MenuRecord, ctx: MenuActionContext): ActionItem[] {
  return [
    {
      label: "新增子菜单",
      icon: "ant-design:plus-outlined",
      disabled: record.menuType !== 1,
      onClick: () => ctx.onAddChild(record),
    },
    {
      label: "新增权限",
      icon: "ant-design:plus-outlined",
      disabled: record.menuType !== 2,
      onClick: () => ctx.onAddPermission(record),
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
        title: "删除菜单",
        content: `确定要删除「${record.menuName}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
