/** 优先级映射 */
export const PRIORITY_MAP: Record<number, { label: string; color: string; bg: string }> = {
  0: {
    label: "普通",
    color: "#8c8c8c",
    bg: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  1: {
    label: "重要",
    color: "#faad14",
    bg: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  },
  2: {
    label: "紧急",
    color: "#f5222d",
    bg: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  },
};

/** 过滤器图标与颜色配置（count 由组件注入统计后合并） */
export const FILTER_META: Record<
  "all" | "uncompleted" | "completed" | "overdue",
  { label: string; icon: string; color: string }
> = {
  all: { label: "全部", icon: "carbon:list", color: "#1677ff" },
  uncompleted: { label: "未完成", icon: "carbon:in-progress", color: "#faad14" },
  completed: { label: "已完成", icon: "carbon:checkmark-outline", color: "#52c41a" },
  overdue: { label: "逾期", icon: "carbon:warning-alt", color: "#f5222d" },
};
