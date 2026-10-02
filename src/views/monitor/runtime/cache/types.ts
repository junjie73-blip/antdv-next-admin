export interface CacheInfo {
  redisVersion: string
  redisMode: string
  os: string
  uptimeDays: number
  connectedClients: number
  usedMemory: number
  usedMemoryHuman: string
  usedMemoryPeakHuman: string
  maxMemoryHuman: string
  totalCommandsProcessed: number
  instantaneousOpsPerSec: number
  keyspaceHits: number
  keyspaceMisses: number
  hitRate: string
  expiredKeys: number
  evictedKeys: number
  dbKeys: number
  [key: string]: unknown
}

export interface CacheGroupInfo {
  name: string
  prefix: string
  remark: string
  count: number
  discovered?: boolean
}

export interface CacheKeyInfo {
  key: string
  ttl: number
  type: string
}

export interface CacheKeyValue {
  key: string
  type: string
  ttl: number
  value: unknown
  total?: number
  truncated?: boolean
}
