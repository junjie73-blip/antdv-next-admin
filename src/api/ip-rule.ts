import { http } from "@/utils";

// ============================================================
// IP 白黑名单
// 注意：ip-rule 后端 status 是 string，不做 int 转换
// ============================================================

export function getIpRuleList(params: any) {
  return http.Get("/ip-rule/list", { params });
}

export function createIpRule(data: any) {
  return http.Post("/ip-rule", data);
}

export function updateIpRule(id: string, data: any) {
  return http.Put(`/ip-rule/${id}`, data);
}

export function deleteIpRule(id: string) {
  return http.Delete(`/ip-rule/${id}`);
}

export function checkIpRule(ip: string) {
  return http.Post("/ip-rule/check", { ip });
}
