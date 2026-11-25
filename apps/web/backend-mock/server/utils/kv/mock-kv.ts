/**
 * Mock KV 存储包装层
 *
 * 底层是 Nitro v3 内置 KV（`nitro/kv` 的 `useKV`，即 unstorage），挂载点 `mock`
 * 在 nitro.config.ts 里配置为 fs 驱动 → 重启后配置仍在。这里只做键规则、schema
 * 校验和默认值兜底，不自己另起一套存储；测试通过 vitest alias 换成内存实现。
 */

import { useKV } from 'nitro/kv';

import {
  DEFAULT_GLOBAL_MOCK_CONFIG,
  globalMockConfigSchema,
  MOCK_KV_BASE,
  MOCK_KV_KEYS,
  routeOverrideKey,
  routeOverrideSchema,
  type GlobalMockConfig,
  type RouteOverride,
  type TaskHistoryEntry,
} from '../../contracts/runtime-kv';

/** unstorage 的最小子集；避免把 unstorage 具体类型泄漏到业务层 */
export interface MockKvStorage {
  getItem<T = unknown>(key: string): Promise<T | null>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
  hasItem?(key: string): Promise<boolean>;
  getKeys(prefix?: string): Promise<string[]>;
  clear?(): Promise<void>;
}

function kv(): MockKvStorage {
  return useKV(MOCK_KV_BASE) as unknown as MockKvStorage;
}

/** 读取全局配置；脏数据一律回落默认值，避免 KV 被手改坏后服务起不来 */
export async function getGlobalConfig(): Promise<GlobalMockConfig> {
  const raw = await kv().getItem<unknown>(MOCK_KV_KEYS.GLOBAL);
  const parsed = globalMockConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_GLOBAL_MOCK_CONFIG;
}

export async function setGlobalConfig(
  patch: Partial<GlobalMockConfig>,
): Promise<GlobalMockConfig> {
  const next = globalMockConfigSchema.parse({
    ...(await getGlobalConfig()),
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await kv().setItem(MOCK_KV_KEYS.GLOBAL, next);
  return next;
}

export async function getRouteOverride(
  routeKey: string,
): Promise<RouteOverride | null> {
  const raw = await kv().getItem<unknown>(routeOverrideKey(routeKey));
  if (!raw) return null;
  const parsed = routeOverrideSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function setRouteOverride(
  input: RouteOverride,
): Promise<RouteOverride> {
  const next = routeOverrideSchema.parse({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  await kv().setItem(routeOverrideKey(next.routeKey), next);
  return next;
}

export async function removeRouteOverride(routeKey: string): Promise<boolean> {
  const key = routeOverrideKey(routeKey);
  // 用 hasItem 判断存在性：getKeys 在 fs 驱动下会按分隔符归一化键名，
  // 含 `%2F` 的编码键可能列不出来，导致"删成功了却报 false"。
  const store = kv();
  const existed = store.hasItem
    ? await store.hasItem(key)
    : (await store.getKeys('overrides/')).includes(key);
  await store.removeItem(key);
  return existed;
}

/** 列出全部覆盖项；只返回通过 schema 校验的条目 */
export async function listRouteOverrides(): Promise<RouteOverride[]> {
  const keys = await kv().getKeys('overrides/');
  const items = await Promise.all(
    keys.map((key) => kv().getItem<unknown>(key)),
  );
  return items
    .map((raw) => routeOverrideSchema.safeParse(raw))
    .filter((result) => result.success)
    .map((result) => (result as { data: RouteOverride }).data)
    .sort((a, b) => a.routeKey.localeCompare(b.routeKey));
}

const TASK_HISTORY_LIMIT = 100;

export async function appendTaskHistory(
  entry: TaskHistoryEntry,
): Promise<TaskHistoryEntry[]> {
  const current = await listTaskHistory();
  const next = [...current, entry].slice(-TASK_HISTORY_LIMIT);
  await kv().setItem(MOCK_KV_KEYS.TASK_HISTORY, next);
  return next;
}

export async function listTaskHistory(): Promise<TaskHistoryEntry[]> {
  const raw = await kv().getItem<unknown>(MOCK_KV_KEYS.TASK_HISTORY);
  return Array.isArray(raw) ? (raw as TaskHistoryEntry[]) : [];
}

/** 清理任务历史：保留最近 keep 条 */
export async function trimTaskHistory(keep = 50): Promise<number> {
  const current = await listTaskHistory();
  if (current.length <= keep) return 0;
  await kv().setItem(MOCK_KV_KEYS.TASK_HISTORY, current.slice(-keep));
  return current.length - keep;
}

export async function setGeneratedSnapshot<T>(data: T): Promise<void> {
  await kv().setItem(MOCK_KV_KEYS.GENERATED, {
    generatedAt: new Date().toISOString(),
    data,
  });
}

export async function getGeneratedSnapshot<T = unknown>(): Promise<
  { generatedAt: string; data: T } | null
> {
  return kv().getItem<{ generatedAt: string; data: T }>(MOCK_KV_KEYS.GENERATED);
}

export async function setRefreshedSnapshot<T>(data: T): Promise<void> {
  await kv().setItem(MOCK_KV_KEYS.REFRESHED, {
    refreshedAt: new Date().toISOString(),
    data,
  });
}

export async function getRefreshedSnapshot<T = unknown>(): Promise<
  { refreshedAt: string; data: T } | null
> {
  return kv().getItem<{ refreshedAt: string; data: T }>(MOCK_KV_KEYS.REFRESHED);
}

/** 删除带过期时间的临时键（cleanup 任务用） */
export async function removeExpiredKeys(): Promise<number> {
  const keys = await kv().getKeys('ephemeral/');
  let removed = 0;
  for (const key of keys) {
    const meta = await kv().getItem<{ expiresAt?: number }>(`${key}:meta`);
    if (meta && typeof meta.expiresAt === 'number' && meta.expiresAt < Date.now()) {
      await kv().removeItem(key);
      await kv().removeItem(`${key}:meta`);
      removed += 1;
    }
  }
  return removed;
}

/** 测试/运维使用：清空 mock 挂载点下的所有键 */
export async function clearMockKv(): Promise<void> {
  const all = await kv().getKeys();
  for (const key of all) await kv().removeItem(key);
}
