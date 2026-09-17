import type { CommonButton } from "./types";

import { cn } from "@/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4 h-full");
export const tagClassName = cn("inline-flex items-center gap-1");

// ========== 状态映射 ==========
export const PERMISSION_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const PERMISSION_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "启用",
  "0": "禁用",
};

export const PERMISSION_STATUS_ICON_MAP: Record<string, string> = {
  "1": "carbon:checkmark-outline",
  "0": "carbon:close-outline",
};

// ========== 常见按钮预设 ==========
export const COMMON_BUTTONS: CommonButton[] = [
  {
    label: "新增",
    permName: "新增",
    permCode: "create",
    icon: "ant-design:plus-outlined",
    key: "create",
  },
  {
    label: "编辑",
    permName: "编辑",
    permCode: "update",
    icon: "ant-design:edit-outlined",
    key: "update",
  },
  {
    label: "详情",
    permName: "详情",
    permCode: "detail",
    icon: "ant-design:info-outlined",
    key: "detail",
  },
  {
    label: "删除",
    permName: "删除",
    permCode: "delete",
    icon: "ant-design:delete-outlined",
    key: "delete",
  },
  {
    label: "批量删除",
    permName: "批量删除",
    permCode: "deleteBatch",
    icon: "ant-design:delete-outlined",
    key: "deleteBatch",
  },
  {
    label: "导出",
    permName: "导出",
    permCode: "export",
    icon: "ant-design:export-outlined",
    key: "export",
  },
  {
    label: "导入",
    permName: "导入",
    permCode: "import",
    icon: "ant-design:import-outlined",
    key: "import",
  },
];
