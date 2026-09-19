import { del, get, post } from "./request";

import { http } from "~/utils";

// ============================================================
// 用户管理
// ============================================================

export function getUserList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/user/list", params);
}

export function getUserDetail(id: string) {
  return get<any>(`/user/detail/${id}`);
}

export function addUser(data: Record<string, any>) {
  return post<any>("/user", data);
}

export function updateUser(id: string, data: Record<string, any>) {
  return post<any>(`/user/update/${id}`, data);
}

export function deleteUser(id: string) {
  return del<void>(`/user/remove/${id}`);
}

/** 批量删除 —— body 为 { ids } */
export function batchDeleteUser(ids: string[]) {
  return post<void>("/user/batch-delete", { ids });
}

/** 角色下拉选项 —— GET /user/options */
export function getRoleOptions() {
  return get<any[]>("/user/options");
}
/** 兼容旧名（原错误地指向 /dept/tree） */
export const getUserOptions = getRoleOptions;

/** 全部启用用户选项 —— GET /user/all/options */
export function getUserAllOptions() {
  return get<any>("/user/all/options");
}

/** 重置用户密码 —— PUT /user/{id}/password */
export function resetUserPassword(id: string, password: string) {
  return http.Put(`/user/${id}/password`, { password });
}

// ---------- 用户-角色 ----------
export function getUserRoles(id: string) {
  return get<any[]>(`/user/${id}/roles`);
}
export function updateUserRoles(id: string, roleIds: string[]) {
  return http.Put(`/user/${id}/roles`, { roleIds });
}

// ---------- 用户-部门 ----------
export function getUserDepts(id: string) {
  return get<any[]>(`/user/${id}/depts`);
}
export function updateUserDepts(id: string, deptIds: string[]) {
  return http.Put(`/user/${id}/depts`, { deptIds });
}

// ---------- 敏感信息 ----------
export function getUserSensitive(id: string) {
  return get<Record<string, unknown>>(`/user/${id}/sensitive`);
}

// ---------- 导入导出 ----------
export function exportUsers(params?: Record<string, unknown>) {
  return get<any>("/user/export", params);
}
export function importUsers(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return http.Post("/user/import", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
