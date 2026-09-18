import type { GenTable } from "./types";

import type { ActionItem } from "@/components/business/Table/types";

export interface GenTableActionContext {
  onEdit: (record: GenTable) => void;
  onGenerate: (record: GenTable) => void;
  onDelete: (record: GenTable) => void | Promise<void>;
}

/**
 * 生成表行操作
 *
 * 保持无状态：副作用通过 ctx 注入
 */
export function getGenTableActions(record: GenTable, ctx: GenTableActionContext): ActionItem[] {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "生成代码",
      icon: "ant-design:download-outlined",
      onClick: () => ctx.onGenerate(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除生成配置",
        content: `删除后数据库表不会被删除，确定删除「${record.tableName}」的配置吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
