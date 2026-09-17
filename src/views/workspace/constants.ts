import type { ShortcutItem, StatCardConfig, WorkbenchData } from "./types";

// ============================================================
// 统计卡片配置
// ============================================================
export const STAT_CARD_CONFIGS: StatCardConfig[] = [
  {
    key: "userCount",
    title: "团队成员",
    suffix: "人",
    icon: "carbon:user-multiple",
    color: "#3B82F6", // 蓝
    path: "/system/user",
  },
  {
    key: "roleCount",
    title: "角色数量",
    suffix: "个",
    icon: "carbon:user-role",
    color: "#8B5CF6", // 紫
    path: "/system/role",
  },
  {
    key: "deptCount",
    title: "组织部门",
    suffix: "个",
    icon: "carbon:tree-view",
    color: "#10B981", // 翠
    path: "/system/dept",
  },
  {
    key: "unreadNotice",
    title: "未读消息",
    suffix: "条",
    icon: "carbon:notification",
    color: "#06B6D4", // 青
    path: "/message/my",
  },
];

// ============================================================
// 快捷入口
// ============================================================
export const SHORTCUTS: ShortcutItem[] = [
  { title: "用户管理", icon: "carbon:user-multiple", path: "/system/user", color: "#3B82F6" },
  { title: "角色管理", icon: "carbon:user-role", path: "/system/role", color: "#8B5CF6" },
  { title: "菜单配置", icon: "carbon:menu", path: "/system/menu", color: "#10B981" },
  { title: "部门管理", icon: "carbon:tree-view", path: "/system/dept", color: "#14B8A6" },
  {
    title: "权限管理",
    icon: "carbon:shield-checkmark",
    path: "/system/permission",
    color: "#0EA5E9",
  },
  { title: "系统配置", icon: "carbon:settings", path: "/system/config", color: "#6366F1" },
  { title: "通知公告", icon: "carbon:notification", path: "/system/notice", color: "#EC4899" },
  { title: "数据字典", icon: "carbon:book", path: "/system/dict", color: "#7C3AED" },
];

// ============================================================
// 默认空数据
// ============================================================
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

// ============================================================
// 最近操作状态色（冷色系）
// ============================================================
export const LOG_STATUS_COLOR_MAP: Record<string, { bg: string; color: string }> = {
  "1": { bg: "rgba(16,185,129,0.10)", color: "#059669" },
  "0": { bg: "rgba(244,63,94,0.10)", color: "#E11D48" },
};

export const LOG_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "成功",
  "0": "失败",
};
