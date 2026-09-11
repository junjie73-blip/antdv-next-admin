import type { ActionItem } from "@/components/business/Table";
import type { CacheKeyRecord } from "./types";

/** 操作回调上下文 */
export interface CacheActionContext {
  onDelete: (record: CacheKeyRecord) => void | Promise<void>;
}

/**
 * 生成缓存 Key 行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getCacheActions(record: CacheKeyRecord, ctx: CacheActionContext): ActionItem[] {
  return [
    {
      label: "删除",
      danger: true,
      popConfirm: {
        title: "删除 Key",
        content: `确定删除「${record.key}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
