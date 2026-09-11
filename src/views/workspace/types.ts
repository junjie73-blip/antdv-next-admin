/** 统计数据 */
export interface WorkbenchStats {
  userCount: number;
  roleCount: number;
  deptCount: number;
  noticeCount: number;
  unreadNotice: number;
  todoUncompleted: number;
  todoOverdue: number;
}

/** 最近操作日志项 */
export interface LogItem {
  log_id: string;
  username: string;
  operation: string;
  /** '0'-失败 '1'-成功 */
  status: string;
  created_at: string;
}

/** 工作台概览数据 */
export interface WorkbenchData {
  stats: WorkbenchStats;
  loginTrend?: any[];
  recentLogs: LogItem[];
}

/** 统计卡片配置（静态） */
export interface StatCardConfig {
  /** 对应 stats 字段名 */
  key: keyof WorkbenchStats;
  title: string;
  suffix: string;
  icon: string;
  color: string;
  path: string;
}

/** 快捷入口配置 */
export interface ShortcutItem {
  title: string;
  icon: string;
  path: string;
  color: string;
}
