import type { ActionItem } from "@/components/business/Table";
import type { DeptRecord } from "./types";

/** 部门行操作上下文 */
export interface DeptActionContext {
  /** 新增子部门 */
  onAddChild: (record: DeptRecord) => void;
  /** 编辑 */
  onEdit: (record: DeptRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: DeptRecord) => void | Promise<void>;
  /** 分配用户 */
  onAssignUsers: (record: DeptRecord) => void;
}

/**
 * 生成部门行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getDeptActions(record: DeptRecord, ctx: DeptActionContext): ActionItem[] {
  return [
    {
      label: "新增子部门",
      icon: "ant-design:plus-outlined",
      onClick: () => ctx.onAddChild(record),
    },
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "分配用户",
      icon: "ant-design:usergroup-add-outlined",
      onClick: () => ctx.onAssignUsers(record),
    },

    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除部门",
        content: "确定要删除该部门吗？子部门也将一并删除。",
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
