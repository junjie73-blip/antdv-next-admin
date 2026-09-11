import { cn } from "@/utils/cn";
import type { MimeTypeOption } from "./types";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4");

export const cardClassName = cn(
  "shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
);

export const actionClassName = cn("flex", "items-center", "justify-center", "whitespace-nowrap");

export const btnClassName = cn("!px-0.5");

// ========== MIME 类型筛选选项 ==========
export const MIME_TYPE_OPTIONS: MimeTypeOption[] = [
  { label: "全部", value: "" },
  { label: "图片", value: "image/" },
  { label: "文档", value: "application/pdf" },
  { label: "Word", value: "application/msword" },
  { label: "Excel", value: "application/vnd.ms-excel" },
  { label: "视频", value: "video/" },
  { label: "音频", value: "audio/" },
  { label: "压缩包", value: "application/zip" },
  { label: "文本", value: "text/" },
];

// ========== MIME 前缀 → 图标 / 颜色映射 ==========
/** 按 mimeType 前缀匹配的图标 */
export const MIME_ICON_RULES: Array<{ test: (mime: string) => boolean; icon: string }> = [
  { test: (m) => m.startsWith("image/"), icon: "carbon:image" },
  { test: (m) => m.startsWith("video/"), icon: "carbon:video" },
  { test: (m) => m.startsWith("audio/"), icon: "carbon:sound-wave" },
  { test: (m) => m.startsWith("text/"), icon: "carbon:document" },
  { test: (m) => m.includes("pdf"), icon: "carbon:document-pdf" },
  { test: (m) => m.includes("word") || m.includes("msword"), icon: "carbon:document-word" },
  {
    test: (m) => m.includes("excel") || m.includes("spreadsheet"),
    icon: "carbon:document-excel",
  },
  {
    test: (m) => m.includes("zip") || m.includes("rar") || m.includes("tar"),
    icon: "carbon:document-archive",
  },
];

/** 按 mimeType 前缀匹配的颜色 */
export const MIME_COLOR_RULES: Array<{ test: (mime: string) => boolean; color: string }> = [
  { test: (m) => m.startsWith("image/"), color: "#1677ff" },
  { test: (m) => m.startsWith("video/"), color: "#eb2f96" },
  { test: (m) => m.startsWith("audio/"), color: "#722ed1" },
  { test: (m) => m.includes("pdf"), color: "#f5222d" },
  { test: (m) => m.includes("word") || m.includes("msword"), color: "#1890ff" },
  { test: (m) => m.includes("excel") || m.includes("spreadsheet"), color: "#52c41a" },
  { test: (m) => m.includes("zip") || m.includes("rar") || m.includes("tar"), color: "#8c8c8c" },
];

/** 默认图标 / 颜色 */
export const DEFAULT_FILE_ICON = "carbon:document";
export const DEFAULT_FILE_COLOR = "#8c8c8c";
