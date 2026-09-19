import { cn } from "~/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("flex gap-4");
export const leftPanelClassName = cn("w-[280px] shrink-0");
export const rightPanelClassName = cn("flex-1 min-w-0");
export const cardClassName = cn("shadow-sm");
export const treeCardClassName = cn("shadow-sm h-full");
export const statusTagClassName = cn("inline-flex items-center gap-1");
export const actionClassName = cn("flex", "items-center", "justify-center");
export const btnClassName = cn("!px-0.5");

// ========== 状态映射 ==========
export const DEPT_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const DEPT_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "正常",
  "0": "停用",
};

export const DEPT_STATUS_ICON_MAP: Record<string, string> = {
  "1": "carbon:checkmark-outline",
  "0": "carbon:close-outline",
};
