/** 缓存信息概览 */
export interface CacheInfo {
  version?: string;
  connectedClients?: number;
  usedMemory?: number;
  uptime?: number;
  hits?: number;
  misses?: number;
  /** 命中率，后端可能直接给字符串数字，例如 "98.5" */
  hitRate?: string | number;
  dbKeys?: number;
}

/** 缓存 Key 记录 */
export interface CacheKeyRecord {
  key: string;
  type: string;
  /** 秒数，-1 表示永久 */
  ttl: number;
}
