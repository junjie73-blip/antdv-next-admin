import type { CacheGroupInfo, CacheInfo, CacheKeyInfo, CacheKeyValue } from '~/views/monitor/cache/types'

import { http } from '~/utils'

/** Redis 概览 */
export function getCacheInfo() {
  return http.Get<CacheInfo>('/monitor/cache/info')
}

/** 缓存组列表 */
export function getCacheGroups() {
  return http.Get<CacheGroupInfo[]>('/monitor/cache/groups').send(true)
}

/** 组内 key 列表 */
export function getCacheKeys(params: { prefix: string }) {
  return http.Get<CacheKeyInfo[]>('/monitor/cache/keys', { params }).send(true)
}

/** key 值 */
export function getCacheValue(params: { key: string }) {
  return http.Get<CacheKeyValue>('/monitor/cache/value', { params }).send(true)
}

/** 删除单个 key */
export function deleteCacheKey(key: string) {
  return http.Delete('/monitor/cache/key', {
    params: { key },
  })
}

/** 清空某个缓存组 */
export function clearCacheGroup(prefix: string) {
  return http.Delete('/monitor/cache/group', {
    params: { prefix },
  })
}

/** 清空所有缓存 */
export function clearCacheAll() {
  return http.Delete('/monitor/cache/all')
}
