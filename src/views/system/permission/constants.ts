import { cn } from "@/utils/cn";
import type { PermissionScope, ResourceType } from "./types";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4");

export const cardClassName = cn(
  "shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
);

// ========== 状态映射 ==========
export const PERM_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const PERM_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "启用",
  "0": "禁用",
};

export const PERM_STATUS_OPTIONS = [
  { label: "启用", value: "1" },
  { label: "禁用", value: "0" },
];

// ========== 级别映射 ==========
export const SCOPE_COLOR_MAP: any = {
  platform: "purple",
  business: "blue",
};

export const SCOPE_LABEL_MAP: any = {
  platform: "平台级",
  business: "业务级",
};

export const SCOPE_OPTIONS = [
  { label: "平台级", value: "platform" as PermissionScope },
  { label: "业务级", value: "business" as PermissionScope },
];

// ========== 资源类型映射（去掉 menu / button） ==========
export const RESOURCE_TYPE_COLOR_MAP: any = {
  api: "blue",
  data: "orange",
  other: "default",
};

export const RESOURCE_TYPE_LABEL_MAP: any = {
  api: "接口",
  data: "数据",
  other: "其他",
};

export const RESOURCE_TYPE_OPTIONS = [
  { label: "接口", value: "api" as ResourceType },
  { label: "数据", value: "data" as ResourceType },
  { label: "其他", value: "other" as ResourceType },
];

// ========== 动作映射 ==========
export const ACTION_COLOR_MAP: Record<string, string> = {
  create: "green",
  read: "blue",
  update: "orange",
  delete: "red",
  export: "cyan",
  import: "purple",
  list: "geekblue",
  detail: "blue",
};

export const ACTION_OPTIONS = [
  { label: "创建 (create)", value: "create" },
  { label: "读取 (read)", value: "read" },
  { label: "更新 (update)", value: "update" },
  { label: "删除 (delete)", value: "delete" },
  { label: "列表 (list)", value: "list" },
  { label: "详情 (detail)", value: "detail" },
  { label: "导出 (export)", value: "export" },
  { label: "导入 (import)", value: "import" },
];

// ========== 新增权限时的空表单值（默认 api） ==========
export const PERMISSION_EMPTY_VALUES = {
  permCode: "",
  permName: "",
  resourceType: "api" as ResourceType,
  action: "create",
  status: "1",
  description: "",
};
