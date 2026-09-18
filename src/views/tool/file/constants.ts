import type { FileCategory, MimeTypeOption } from "./types";

import { cn } from "@/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4");

export const cardClassName = cn(
  "rounded-lg border border-gray-100 bg-white",
  "dark:border-gray-800 dark:bg-gray-900",
);

export const actionClassName = cn("flex items-center justify-center whitespace-nowrap");

export const btnClassName = cn("!px-0.5");

// ========== MIME 类型筛选选项 ==========
export const MIME_TYPE_OPTIONS: MimeTypeOption[] = [
  { label: "全部", value: "all" },
  { label: "图片", value: "image/" },
  { label: "PDF", value: "application/pdf" },
  { label: "Word", value: "application/msword" },
  { label: "Excel", value: "application/vnd.ms-excel" },
  { label: "视频", value: "video/" },
  { label: "音频", value: "audio/" },
  { label: "压缩包", value: "application/zip" },
  { label: "文本", value: "text/" },
];

// ========== 左侧分类导航 ==========
// 说明：
//  - key 为纯标识，不带斜杠，前端直接作为 category 参数传后端
//  - mimePrefixes 仅用于展示层（图标/颜色匹配），不再参与筛选
//  - markdown（text/markdown、.md）归入"文档"
export const FILE_CATEGORIES: FileCategory[] = [
  {
    key: "all",
    label: "全部",
    icon: "carbon:grid",
    color: "#1677ff",
    mimePrefixes: [],
  },
  {
    key: "image",
    label: "图片",
    icon: "carbon:image",
    color: "#1677ff",
    mimePrefixes: ["image/"],
  },
  {
    key: "document",
    label: "文档",
    icon: "carbon:document",
    color: "#1890ff",
    mimePrefixes: ["text/", "application/pdf", "application/msword", "application/vnd"],
    // 扩展：markdown 后缀也归为文档（后端做 OR 过滤时需要）
    extensions: [".md", ".markdown", ".txt", ".pdf", ".doc", ".docx"],
  },
  {
    key: "audio",
    label: "音频",
    icon: "carbon:music",
    color: "#722ed1",
    mimePrefixes: ["audio/"],
  },
  {
    key: "video",
    label: "视频",
    icon: "carbon:video",
    color: "#eb2f96",
    mimePrefixes: ["video/"],
  },
  {
    key: "archive",
    label: "压缩包",
    icon: "carbon:zip",
    color: "#8c8c8c",
    mimePrefixes: ["application/zip", "application/x-rar", "application/x-tar"],
  },
  {
    key: "application",
    label: "应用程序",
    icon: "carbon:application",
    color: "#52c41a",
    mimePrefixes: ["application/x-msdownload", "application/octet-stream"],
  },
  {
    key: "other",
    label: "其他",
    icon: "carbon:document-blank",
    color: "#8c8c8c",
    mimePrefixes: [],
  },
];

// ========== MIME 前缀 → 图标 / 颜色映射 ==========
export const MIME_ICON_RULES: Array<{ test: (mime: string) => boolean; icon: string }> = [
  { test: (m) => m.startsWith("image/"), icon: "carbon:image" },
  { test: (m) => m.startsWith("video/"), icon: "carbon:video" },
  { test: (m) => m.startsWith("audio/"), icon: "ant-design:audio-outlined" },
  // markdown 归到文档，用文档图标
  {
    test: (m) => m.startsWith("text/markdown") || m.startsWith("text/x-markdown"),
    icon: "carbon:document",
  },
  { test: (m) => m.startsWith("text/"), icon: "carbon:document" },
  { test: (m) => m.includes("pdf"), icon: "carbon:document-pdf" },
  {
    test: (m) => m.includes("word") || m.includes("msword"),
    icon: "ant-design:file-word-outlined",
  },
  {
    test: (m) => m.includes("excel") || m.includes("spreadsheet"),
    icon: "ant-design:file-excel-outlined",
  },
  {
    test: (m) => m.includes("zip") || m.includes("rar") || m.includes("tar"),
    icon: "ant-design:file-zip-outlined",
  },
];

export const MIME_COLOR_RULES: Array<{ test: (mime: string) => boolean; color: string }> = [
  { test: (m) => m.startsWith("image/"), color: "#1677ff" },
  { test: (m) => m.startsWith("video/"), color: "#eb2f96" },
  { test: (m) => m.startsWith("audio/"), color: "#722ed1" },
  { test: (m) => m.includes("pdf"), color: "#f5222d" },
  { test: (m) => m.includes("word") || m.includes("msword"), color: "#1890ff" },
  { test: (m) => m.includes("excel") || m.includes("spreadsheet"), color: "#52c41a" },
  { test: (m) => m.includes("zip") || m.includes("rar") || m.includes("tar"), color: "#8c8c8c" },
];

export const DEFAULT_FILE_ICON = "carbon:document";
export const DEFAULT_FILE_COLOR = "#8c8c8c";

// ========== 上传配置 ==========
/** 上传接口地址（按项目实际接口调整） */
export const UPLOAD_ACTION = "/api/v1/upload/file";

/** 单文件大小上限（MB） */
export const UPLOAD_MAX_SIZE = 50;

/** 允许上传的文件类型（留空表示不限制） */
export const UPLOAD_ACCEPT = "";
