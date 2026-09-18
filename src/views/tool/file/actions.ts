import type { FileRecord } from "./types";

import type { ActionItem } from "@/components/business/Table";

/** 文件行操作上下文 */
export interface FileActionContext {
  onPreview: (record: FileRecord) => void;
  onDownload: (record: FileRecord) => void;
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: FileRecord) => void | Promise<void>;
}

/**
 * 生成文件行操作项
 * 保持无状态：副作用通过 ctx 注入
 */
export function getFileActions(record: FileRecord, ctx: FileActionContext): ActionItem[] {
  return [
    {
      label: "预览",
      icon: "ant-design:eye-outlined",
      onClick: () => ctx.onPreview(record),
    },
    {
      label: "下载",
      icon: "ant-design:download-outlined",
      onClick: () => ctx.onDownload(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除文件",
        content: `确定要删除「${record.filename}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
