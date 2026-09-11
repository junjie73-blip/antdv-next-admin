import type { FileRecord } from "./types";
import {
  DEFAULT_FILE_COLOR,
  DEFAULT_FILE_ICON,
  MIME_COLOR_RULES,
  MIME_ICON_RULES,
} from "./constants";

/**
 * 格式化文件大小
 * 例：1536 → "1.50 KB"
 */
export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / k ** i).toFixed(2)} ${units[i]}`;
}

/**
 * 根据 mimeType 获取图标名称
 */
export function getFileIcon(record: FileRecord): string {
  const mime = record.mimeType || "";
  const rule = MIME_ICON_RULES.find((r) => r.test(mime));
  return rule?.icon ?? DEFAULT_FILE_ICON;
}

/**
 * 根据 mimeType 获取图标颜色
 */
export function getFileColor(record: FileRecord): string {
  const mime = record.mimeType || "";
  const rule = MIME_COLOR_RULES.find((r) => r.test(mime));
  return rule?.color ?? DEFAULT_FILE_COLOR;
}
