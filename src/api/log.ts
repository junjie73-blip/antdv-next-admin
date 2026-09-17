import { get } from "./request";

import { http } from "@/utils";

// ============================================================
// 审计日志 / 操作日志
// ============================================================

export function getAuditLogList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/audit-log/list", params);
}

export function getAuditLogDetail(id: string) {
  return get<any>(`/audit-log/detail/${id}`);
}

export function exportAuditLog(params?: Record<string, unknown>) {
  return get<any>("/audit-log/export", params);
}

/** 兼容旧名 */
export const getOperLogList = getAuditLogList;
export const exportOperLog = exportAuditLog;

// ============================================================
// 登录日志
// ============================================================

export function getLoginLogList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/login-log/list", params);
}

export function exportLoginLog(params?: Record<string, unknown>) {
  return get<any>("/login-log/export", params);
}

// ============================================================
// 在线用户
// ============================================================

export function getOnlineList() {
  return http.Get("/online/list");
}

export function kickOnline(userId: string) {
  return http.Delete(`/online/${userId}`);
}

export function kickAllOnline() {
  return http.Post("/online/kick-all");
}

/** 兼容旧名 */
export const getOnlineUserList = getOnlineList;
export const forceLogout = kickOnline;
