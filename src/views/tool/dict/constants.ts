import { cn } from "~/utils/cn";

// ========== 布局类名 ==========
export const containerClassName = cn("flex gap-4");
export const leftPanelClassName = cn("w-[300px] shrink-0");
export const rightPanelClassName = cn("flex-1 min-w-0");

export const cardClassName = cn(
  "shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden",
);

export const cardHeaderClassName = cn(
  "flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800",
);

export const cardTitleClassName = cn("text-sm font-semibold text-gray-800 dark:text-gray-200");

export const cardFooterClassName = cn(
  "flex justify-start px-4 py-3 border-t border-gray-100 dark:border-gray-800",
);

// ========== 字典类型列表项类名 ==========
/** 列表项（含激活态） */
export const typeItemClassName = (active: boolean) =>
  cn(
    "flex items-center justify-between px-4 py-3 cursor-pointer",
    "border-b border-gray-100 dark:border-gray-800 transition-colors duration-200",
    "hover:bg-gray-50 dark:hover:bg-gray-800",
    active && "bg-blue-50 dark:bg-blue-900/20 border-l-[3px] border-l-[var(--ant-color-primary)]",
  );

export const typeItemNameClassName = cn(
  "text-sm font-medium text-gray-800 dark:text-gray-200 truncate",
);
export const typeItemCodeClassName = cn("text-xs text-gray-400 mt-0.5 truncate");
export const typeItemActionsClassName = cn("flex items-center gap-1 flex-shrink-0 ml-2");
export const typeItemBtnClassName = cn("!p-0.5 !min-w-0");

// ========== 空状态 ==========
export const emptyClassName = cn("flex flex-col items-center justify-center py-10 text-gray-400");
export const emptyIconClassName = cn("text-4xl mb-3 opacity-30");
export const emptyTitleClassName = cn("text-sm font-medium");
export const emptyDescClassName = cn("text-xs mt-1");

// ========== 表格单元格 ==========
export const actionClassName = cn("flex", "items-center", "justify-center");
export const btnClassName = cn("!px-0.5");
export const tagClassName = cn("inline-flex items-center gap-1");

// ========== 状态映射 ==========
export const DICT_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const DICT_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "正常",
  "0": "停用",
};

export const DICT_STATUS_ICON_MAP: Record<string, string> = {
  "1": "carbon:checkmark-outline",
  "0": "carbon:close-outline",
};
