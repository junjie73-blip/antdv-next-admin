import { cn } from "~/utils/cn";

/* ============================================================
 * 布局
 * ============================================================ */

/** 外层：移动端上下堆叠，桌面端左右分栏 */
export const containerClassName = cn("flex flex-col gap-4", "lg:flex-row", "lg:h-full");

/** 左栏：移动端全宽，桌面端固定宽 */
export const leftPanelClassName = cn("w-full shrink-0", "lg:w-64 xl:w-72", "lg:h-full");

/** 右栏：撑满剩余，允许收缩，纵向 flex 让表格撑满 */
export const rightPanelClassName = cn("flex min-w-0 flex-1 flex-col", "lg:h-full");

/* ============================================================
 * 卡片
 * ============================================================ */

export const cardClassName = cn(
  "flex flex-col overflow-hidden",
  "rounded-xl border border-gray-200 bg-white shadow-sm",
  "dark:border-gray-800 dark:bg-gray-900",
  "h-full",
);

export const cardHeaderClassName = cn(
  "flex shrink-0 items-center justify-between gap-2",
  "border-b border-gray-100 px-4 py-3",
  "dark:border-gray-800",
);

export const cardTitleClassName = cn(
  "flex items-center gap-2 text-sm font-semibold",
  "text-gray-800 dark:text-gray-100",
);

export const cardTitleBarClassName = cn("h-3.5 w-1 rounded-full", "bg-blue-500 dark:bg-blue-400");

export const cardBodyClassName = cn("min-h-0 flex-1 overflow-auto");

export const cardFooterClassName = cn(
  "shrink-0 border-t border-gray-100 px-4 py-3",
  "dark:border-gray-800",
);

/* ============================================================
 * 部门树
 * ============================================================ */

/** 部门树项 */
export const deptNodeClassName = cn(
  "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
  "text-sm text-gray-700 transition-colors",
  "hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
);

/** 部门树选中项 */
export const deptNodeActiveClassName = cn(
  "bg-blue-50 font-medium text-blue-600",
  "dark:bg-blue-950/40 dark:text-blue-400",
);

export const deptSearchClassName = cn("px-3 pt-3");

/* ============================================================
 * 工具栏
 * ============================================================ */

export const toolbarClassName = cn("flex flex-wrap items-center gap-2", "px-4 pt-4");

/* ============================================================
 * 表格容器
 * ============================================================ */

export const tableWrapperClassName = cn("min-h-0 flex-1 overflow-hidden", "px-4 pb-4 pt-3");

/* ============================================================
 * 状态标签
 * ============================================================ */

export const statusTagClassName = cn("inline-flex items-center gap-1");

/* ============================================================
 * 状态映射
 * ============================================================ */

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

/* ============================================================
 * 导出配置
 * ============================================================ */

export const USER_EXPORT_HEADERS = ["用户名", "真实姓名", "邮箱", "手机号", "部门", "角色", "状态"];

export const USER_EXPORT_SHEET_NAME = "用户列表";

/* ============================================================
 * 弹窗表单
 * ============================================================ */

export const modalBodyClassName = cn("max-h-[70vh] overflow-y-auto px-1");
