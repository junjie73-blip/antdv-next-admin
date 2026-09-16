import { http } from "@/utils";

// ============================================================
// 缓存监控
// ============================================================

export function getCacheInfo(): any {
  return http.Get("/monitor/cache/info").send(true);
}

export function getCacheKeys(params: any) {
  return http.Get("/monitor/cache/keys", { params });
}

export function deleteCacheKey(key: string) {
  return http.Delete(`/monitor/cache/key/${encodeURIComponent(key)}`);
}

export function clearCache() {
  return http.Post("/monitor/cache/clear");
}

// ============================================================
// 服务监控
// ============================================================

export function getServerInfo() {
  return http.Get("/monitor/server/info");
}
