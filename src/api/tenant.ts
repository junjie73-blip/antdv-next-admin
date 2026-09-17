import { get } from "./request";

import { http } from "@/utils";

// ============================================================
// 租户管理
// ============================================================

export function getTenantList(params: any) {
  return http.Get("/tenant/list", { params }).send(true);
}

export function getTenantDetail(id: string) {
  return http.Get(`/tenant/${id}`);
}

/** 租户下拉选项 */
export function getTenantOptions() {
  return get<{ tenantId: string; tenantCode: string; tenantName: string }[]>("/tenant/options");
}

export function createTenant(data: any) {
  return http.Post("/tenant/save", data);
}

export function updateTenant(id: string, data: any) {
  return http.Post(`/tenant/update/${id}`, data);
}

export function deleteTenant(id: string) {
  return http.Get(`/tenant/remove/${id}`);
}

export function batchDeleteTenant(ids: string[]) {
  return http.Post("/tenant/batch-delete", { ids });
}

export function exportTenants(params?: Record<string, unknown>) {
  return http.Get("/tenant/export", { params });
}
