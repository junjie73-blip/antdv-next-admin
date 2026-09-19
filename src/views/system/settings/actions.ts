import type { ConfigRecord } from "./types";

import type { ActionItem } from "~/components/business/Table";

/** 配置行操作上下文 */
export interface ConfigActionContext {
  /** 查看详情 */
  onView: (record: ConfigRecord) => void;
  /** 编辑 */
  onEdit: (record: ConfigRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: ConfigRecord) => void | Promise<void>;
}

/**
 * 生成配置行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getConfigActions(record: ConfigRecord, ctx: ConfigActionContext): ActionItem[] {
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
        title: "删除配置",
        content: `确定要删除「${record.configKey}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
