import { cn } from "~/utils/cn";

/* ============================================================
 * 布局
 * ============================================================ */

/** 外层容器：小屏上下堆叠，大屏左右分栏 */
export const containerClassName = cn(
  "flex flex-col gap-4 lg:flex-row",
  "min-h-[calc(100vh-120px)]",
);

/** 左栏：移动端全宽，桌面端固定宽 */
export const leftPanelClassName = cn("w-full shrink-0", "lg:w-72 xl:w-80");

/** 右栏：撑满剩余空间，允许收缩 */
export const rightPanelClassName = cn("min-w-0 flex-1");

/* ============================================================
 * 卡片
 * ============================================================ */

export const cardClassName = cn(
  "flex flex-col overflow-hidden rounded-xl",
  "border border-gray-200 bg-white shadow-sm",
  "dark:border-gray-800 dark:bg-gray-900",
);

export const cardHeaderClassName = cn(
  "flex shrink-0 items-center justify-between gap-2",
  "border-b border-gray-100 px-4 py-3",
  "dark:border-gray-800",
);

export const cardTitleClassName = cn("text-sm font-semibold text-gray-800", "dark:text-gray-100");

export const cardBodyClassName = cn("flex-1 overflow-y-auto");

export const cardFooterClassName = cn(
  "shrink-0 border-t border-gray-100 px-4 py-3",
  "dark:border-gray-800",
);

/* ============================================================
 * 左侧字典类型项
 * ============================================================ */

export const typeItemClassName = (active: boolean) =>
  cn(
    "group relative flex cursor-pointer items-center gap-2",
    "border-b border-gray-100 px-4 py-3 last:border-b-0",
    "transition-colors duration-150",
    "dark:border-gray-800",
    active ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
  );

/** 激活项左侧的蓝色指示条 */
export const typeItemIndicatorClassName = cn(
  "absolute left-0 top-0 h-full w-[3px] rounded-r",
  "bg-blue-500 dark:bg-blue-400",
);

export const typeItemNameClassName = cn(
  "truncate text-sm font-medium",
  "text-gray-800 dark:text-gray-100",
);

export const typeItemCodeClassName = cn(
  "mt-0.5 truncate text-xs",
  "text-gray-400 dark:text-gray-500",
);

export const typeItemActionsClassName = cn("flex shrink-0 items-center gap-0.5");

export const typeItemBtnClassName = cn(
  "!h-6 !w-6 !min-w-0 !p-0",
  "text-gray-400 opacity-0 transition-opacity",
  "group-hover:opacity-100 focus-visible:opacity-100",
);

/* ============================================================
 * 空状态
 * ============================================================ */

export const emptyClassName = cn(
  "flex flex-col items-center justify-center gap-1 py-10",
  "text-gray-400 dark:text-gray-500",
);

export const emptyIconClassName = cn("mb-1 text-4xl opacity-40");

export const emptyTitleClassName = cn("text-sm font-medium text-gray-500 dark:text-gray-400");

export const emptyDescClassName = cn("text-xs text-gray-400 dark:text-gray-500");

/* ============================================================
 * 表格
 * ============================================================ */

export const tableWrapperClassName = cn("flex-1 overflow-hidden", "px-4 py-4");

export const tagClassName = cn("inline-flex items-center gap-1");

/* ============================================================
 * 字典状态映射
 * ============================================================ */

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
