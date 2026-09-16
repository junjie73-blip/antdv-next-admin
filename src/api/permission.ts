import { http } from "@/utils";

// ============================================================
// 权限管理
// 注意：permission 后端 status 是 string，不做 int 转换
// ============================================================

export function getPermissionList(params?: Record<string, any>) {
  return http.Get("/permission/list", { params }).send(true);
}

export function getPermissionDetail(id: string) {
  return http.Get(`/permission/${id}`);
}

export function createPermission(data: Record<string, any>) {
  return http.Post("/permission", data);
}

export function updatePermission(id: string, data: Record<string, any>) {
  return http.Put(`/permission/${id}`, data);
}

export function deletePermission(id: string) {
  return http.Delete(`/permission/${id}`);
}
