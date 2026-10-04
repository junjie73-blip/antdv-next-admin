import { request } from '~/composables'

// ============================================================
// IP 白黑名单
// 注意：ip-rule 后端 status 是 string，不做 int 转换
// ============================================================

export function getIpRuleList(params: any) {
  return request.get('/ip-rule/list', params)
}

export function createIpRule(data: any) {
  return request.post('/ip-rule', data)
}

export function updateIpRule(id: string, data: any) {
  return request.put(`/ip-rule/${id}`, data)
}

export function deleteIpRule(id: string) {
  return request.delete(`/ip-rule/${id}`)
}

export function checkIpRule(ip: string) {
  return request.post('/ip-rule/check', { ip })
}
