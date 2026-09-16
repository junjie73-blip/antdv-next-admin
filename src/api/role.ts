import { http } from "@/utils";
import { del, get, post, put } from "./request";
import type { FetchParams } from "@/components/business/Table";

// ============================================================
// 角色管理
// ============================================================

export function getRoleList(params?: FetchParams) {
  return get<{ list: any[]; total: number }>("/role/list", params as any);
}

export function getRoleDetail(id: string) {
  return get<any>(`/role/${id}`);
}

export function addRole(data: Record<string, any>) {
  return post<any>("/role", data);
}

export function updateRole(id: string, data: Record<string, any>) {
  return put<any>(`/role/${id}`, data);
}

export function deleteRole(id: string) {
  return del<void>(`/role/${id}`);
}

// ---------- 角色-菜单 ----------
export function getRoleMenusTree(id: string, params?: any) {
  return get<any[]>(`/role/${id}/menus/tree`, params);
}
export function assignRoleMenus(id: string, menuIds: string[]) {
  return http.Put(`/role/${id}/menus`, { menuIds });
}

// ---------- 角色-权限 ----------
export function assignRolePermissions(id: string, permIds: string[]) {
  return http.Put(`/role/${id}/permissions`, { permIds });
}

// ---------- 角色-用户 ----------
export function getRoleUsers(id: string) {
  return get<any[]>(`/role/${id}/users`);
}
export function assignRoleUsers(id: string, userIds: string[]) {
  return http.Put(`/role/${id}/users`, { userIds });
}

// ---------- 角色-数据权限部门 ----------
export function getRoleDepts(id: string) {
  return get<string[]>(`/role/${id}/depts`);
}
export function assignRoleDepts(id: string, deptIds: string[]) {
  return http.Put(`/role/${id}/depts`, { deptIds });
}

// ---------- 导入导出 ----------
export function exportRoles(params?: Record<string, unknown>) {
  return get<any>("/role/export", params);
}
