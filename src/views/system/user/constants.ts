import { cn } from "~/utils/cn";

// ========== 布局类名 ==========
export const containerClassName = cn("flex gap-4");
export const leftPanelClassName = cn("w-[240px] shrink-0");
export const rightPanelClassName = cn("flex-1 min-w-0");
export const cardClassName = cn("shadow-sm");
export const treeCardClassName = cn("shadow-sm h-full");

// ========== 状态标签 ==========
export const statusTagClassName = cn("inline-flex items-center gap-1");

// ========== 状态映射 ==========
export const USER_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const USER_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "正常",
  "0": "禁用",
};

export const USER_STATUS_ICON_MAP: Record<string, string> = {
  "1": "carbon:checkmark-outline",
  "0": "carbon:close-outline",
};

// ========== 导出配置 ==========
export const USER_EXPORT_HEADERS = ["用户名", "真实姓名", "邮箱", "手机号", "部门", "角色", "状态"];

export const USER_EXPORT_SHEET_NAME = "用户列表";
