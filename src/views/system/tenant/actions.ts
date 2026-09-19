import type { TenantRecord } from "./types";

import type { ActionItem } from "~/components/business/Table";

/** 租户行操作上下文 */
export interface TenantActionContext {
  onEdit: (record: TenantRecord) => void;
  onView: (record: TenantRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: TenantRecord) => void | Promise<void>;
}

/**
 * 生成租户行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getTenantActions(record: TenantRecord, ctx: TenantActionContext): ActionItem[] {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "查看",
      icon: "ant-design:eye-outlined",
      onClick: () => ctx.onView(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除租户",
        content: `确定要删除「${record.tenantName}」吗？该操作不可恢复`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
