import { get } from "./request";

// ============================================================
// 仪表盘
// ============================================================

export const getDashboardKpi = () => get<any>("/dashboard/kpi");

export const getActivityTrend = (range: string) =>
  get<any>("/dashboard/activity-trend", { params: { range } });

export const getTrafficDistribution = () => get<any>("/dashboard/traffic-distribution");

export const getSystemHealth = () => get<any>("/dashboard/system-health");

export const getResourceUsage = () => get<any>("/dashboard/resource-usage");

export const getErrorRateTrend = () => get<any>("/dashboard/error-rate");

export const getUserJourney = () => get<any>("/dashboard/user-journey");

export const getModuleRank = () => get<any>("/dashboard/module-rank");
