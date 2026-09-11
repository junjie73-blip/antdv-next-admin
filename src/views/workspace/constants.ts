import type { ShortcutItem, StatCardConfig, WorkbenchData } from "./types";

// ========== 统计卡片配置 ==========
export const STAT_CARD_CONFIGS: StatCardConfig[] = [
  {
    key: "userCount",
    title: "用户总数",
    suffix: "人",
    icon: "carbon:user-multiple",
    color: "#2563eb",
    path: "/system/user",
  },
  {
    key: "roleCount",
    title: "角色数量",
    suffix: "个",
    icon: "carbon:user-role",
    color: "#7c3aed",
    path: "/system/role",
  },
  {
    key: "deptCount",
    title: "部门数量",
    suffix: "个",
    icon: "carbon:tree-view",
    color: "#059669",
    path: "/system/dept",
  },
  {
    key: "unreadNotice",
    title: "未读消息",
    suffix: "条",
    icon: "carbon:notification",
    color: "#d97706",
    path: "/message/my",
  },
];

// ========== 快捷入口 ==========
export const SHORTCUTS: ShortcutItem[] = [
  { title: "用户管理", icon: "carbon:user-multiple", path: "/system/user", color: "#2563eb" },
  { title: "角色管理", icon: "carbon:user-role", path: "/system/role", color: "#7c3aed" },
  { title: "菜单配置", icon: "carbon:menu", path: "/system/menu", color: "#059669" },
  { title: "部门管理", icon: "carbon:tree-view", path: "/system/dept", color: "#d97706" },
  {
    title: "权限管理",
    icon: "carbon:shield-checkmark",
    path: "/system/permission",
    color: "#0891b2",
  },
  { title: "系统配置", icon: "carbon:settings", path: "/system/config", color: "#db2777" },
  { title: "通知公告", icon: "carbon:notification", path: "/system/notice", color: "#dc2626" },
  { title: "数据字典", icon: "carbon:book", path: "/system/dict", color: "#4f46e5" },
];

// ========== 默认空数据 ==========
export const DEFAULT_WORKBENCH_DATA: WorkbenchData = {
  stats: {
    userCount: 0,
    roleCount: 0,
    deptCount: 0,
    noticeCount: 0,
    unreadNotice: 0,
    todoUncompleted: 0,
    todoOverdue: 0,
  },
  loginTrend: [],
  recentLogs: [],
};

// ========== 最近操作状态色 ==========
export const LOG_STATUS_COLOR_MAP: Record<string, { bg: string; color: string }> = {
  "1": { bg: "rgba(5,150,105,0.08)", color: "#059669" },
  "0": { bg: "rgba(220,38,38,0.08)", color: "#dc2626" },
};

export const LOG_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "成功",
  "0": "失败",
};
