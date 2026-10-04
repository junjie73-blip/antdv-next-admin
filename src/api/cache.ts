import type { CacheGroupInfo, CacheInfo, CacheKeyInfo, CacheKeyValue } from '~/views/monitor/runtime/cache/types'

import { request } from '~/composables'

/* ============================================================
 * 缓存操作日志
 * ============================================================ */
export type CacheOperationType = 'clear_group' | 'delete_key' | 'view_stats'

export interface CacheOperationLog {
  logId: string
  tenantId: string
  operatorId: string | null
  operatorName: string | null
  operation: CacheOperationType | string
  target: string
  keyCount: number
  durationMs: number
  /** '1' 成功 / '0' 失败 */
  status: string
  errorMsg: string | null
  createdAt: string
}

export interface CacheOperationListParams {
  pageNum?: number
  pageSize?: number
}

export function getCacheOperations(params: CacheOperationListParams = {}) {
  return request.get<{ list: CacheOperationLog[]; total: number }>('/monitor/cache/operations', params)
}
/** Redis 概览 */
export function getCacheInfo() {
  return request.get<CacheInfo>('/monitor/cache/info')
}

/** 缓存组列表 */
export function getCacheGroups() {
  return request.get<CacheGroupInfo[]>('/monitor/cache/groups')
}

/** 组内 key 列表 */
export function getCacheKeys(params: { prefix: string }) {
  return request.get<CacheKeyInfo[]>('/monitor/cache/keys', params)
}

/** key 值 */
export function getCacheValue(params: { key: string }) {
  return request.get<CacheKeyValue>('/monitor/cache/value', params)
}

/** 删除单个 key */
export function deleteCacheKey(key: string) {
  return request.delete('/monitor/cache/key', { key })
}

/** 清空某个缓存组 */
export function clearCacheGroup(prefix: string) {
  return request.delete('/monitor/cache/group', { prefix })
}

/** 清空所有缓存 */
export function clearCacheAll() {
  return request.delete('/monitor/cache/all')
}
