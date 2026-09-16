import { http } from "@/utils";
import { del, get, post, put } from "./request";

// ============================================================
// 部门管理
// ============================================================

export function getDeptTree(params?: { onlyEnabled?: "1" }) {
  return get<any[]>("/dept/tree", params);
}

export function getDeptList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/dept/list", params);
}

export function getDeptDetail(id: string) {
  return get<any>(`/dept/${id}`);
}

export function addDept(data: Record<string, any>) {
  return post<any>("/dept", data);
}

export function updateDept(id: string, data: Record<string, any>) {
  return put<any>(`/dept/${id}`, data);
}

export function deleteDept(id: string) {
  return del<void>(`/dept/${id}`);
}

// ---------- 部门-用户 ----------
export function getDeptUsers(id: string) {
  return get<any[]>(`/dept/${id}/users`);
}
export function updateDeptUsers(id: string, userIds: string[]) {
  return http.Put(`/dept/${id}/users`, { userIds });
}
