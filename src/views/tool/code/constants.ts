import type { HtmlType, QueryType, TemplateKey, TplCategory } from "./types";

import { cn } from "@/utils/cn";

// ============================================================
// 字典
// ============================================================

export const TPL_CATEGORY_OPTIONS: Array<{ label: string; value: TplCategory }> = [
  { label: "单表 CRUD", value: "crud" },
  { label: "树形表", value: "tree" },
];

export const PG_TYPE_OPTIONS = [
  { label: "varchar(64)", value: "varchar(64)" },
  { label: "varchar(128)", value: "varchar(128)" },
  { label: "varchar(255)", value: "varchar(255)" },
  { label: "text", value: "text" },
  { label: "int2", value: "int2" },
  { label: "int4", value: "int4" },
  { label: "int8", value: "int8" },
  { label: "numeric(10,2)", value: "numeric(10,2)" },
  { label: "bool", value: "bool" },
  { label: "uuid", value: "uuid" },
  { label: "timestamp", value: "timestamp" },
  { label: "timestamptz", value: "timestamptz" },
  { label: "date", value: "date" },
  { label: "jsonb", value: "jsonb" },
] as const;

export const TS_TYPE_OPTIONS = [
  { label: "string", value: "string" },
  { label: "number", value: "number" },
  { label: "bigint", value: "bigint" },
  { label: "boolean", value: "boolean" },
  { label: "Date", value: "Date" },
  { label: "unknown", value: "unknown" },
] as const;

export const HTML_TYPE_OPTIONS: Array<{ label: string; value: HtmlType }> = [
  { label: "输入框", value: "input" },
  { label: "文本域", value: "textarea" },
  { label: "数字输入", value: "inputNumber" },
  { label: "下拉框", value: "select" },
  { label: "单选框", value: "radio" },
  { label: "多选框", value: "checkbox" },
  { label: "日期时间", value: "datetime" },
  { label: "开关", value: "switch" },
  { label: "图片上传", value: "imageUpload" },
  { label: "文件上传", value: "fileUpload" },
];

export const QUERY_TYPE_OPTIONS: Array<{ label: string; value: QueryType }> = [
  { label: "等于", value: "EQ" },
  { label: "不等于", value: "NE" },
  { label: "大于", value: "GT" },
  { label: "小于", value: "LT" },
  { label: "模糊匹配", value: "LIKE" },
  { label: "区间", value: "BETWEEN" },
];

export const TEMPLATE_TABS: Array<{ key: TemplateKey; label: string }> = [
  // 后端
  { key: "controller", label: "controller.ts" },
  { key: "service", label: "service.ts" },
  { key: "repository", label: "repository.ts" },
  { key: "schema", label: "schema.ts" },
  { key: "index", label: "index.ts" },
  // 前端
  { key: "api", label: "api.ts" },
  { key: "vue", label: "index.vue" },
  { key: "frontendTypes", label: "types.ts" },
  { key: "frontendConstants", label: "constants.ts" },
  { key: "frontendColumns", label: "columns.ts" },
  { key: "frontendSchemas", label: "schemas.ts" },
  { key: "frontendActions", label: "actions.ts" },
  // SQL
  { key: "tableSql", label: "table.sql" },
  { key: "menuSql", label: "menu.sql" },
];

/** 表名 / 列名正则（与后端一致） */
export const IDENT_RE = /^[a-z][a-z0-9_]*$/;

// ============================================================
// 样式类名
// ============================================================

export const containerClassName = cn("space-y-4");

export const drawerBodyStyle = {
  padding: 0,
  height: "calc(100vh - 55px)",
  display: "flex",
  flexDirection: "column" as const,
};

export const drawerContentClassName = cn("flex", "flex-col", "h-full", "px-2");

export const drawerTabsClassName = cn("flex-1", "overflow-hidden", "px-6");

export const drawerFooterClassName = cn(
  "flex-shrink-0 border-t px-6 py-3",
  "border-gray-100 dark:border-gray-800",
);

export const codeBlockClassName = cn(
  "max-h-[60vh] overflow-auto rounded p-4",
  "text-sm leading-relaxed font-mono",
  "bg-gray-50 text-gray-800",
  "dark:bg-gray-950 dark:text-gray-200",
);

export const sectionTitleClassName = cn("text-sm font-medium", "text-gray-700 dark:text-gray-200");
