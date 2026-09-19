import { cn } from "~/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4");

export const cardClassName = cn(
  "shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
);

// ========== 状态映射 ==========
export const TENANT_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const TENANT_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "启用",
  "0": "禁用",
};

export const TENANT_STATUS_OPTIONS = [
  { label: "启用", value: "1" },
  { label: "禁用", value: "0" },
];
