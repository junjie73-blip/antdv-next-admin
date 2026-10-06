/**
 * Mock 运行时状态仓库（legacy mock/store.ts 的 Nitro 移植）
 *
 * 与 legacy 的差异：
 * - vite-plugin-fake-server 用 bundle-import 把相对依赖内联进每个 mock 文件，状态只能挂 globalThis；
 *   Nitro 是单进程服务，理论上模块级变量即可共享，但 dev 下 handler 会被热重载重建，
 *   保留 globalThis 单例可以让热重载与手动重置的行为与 legacy 完全一致。
 * - 面板生成的自定义接口过去落地为 mock/generated/<id>.fake.ts 由插件热加载，
 *   Nitro 无法在运行时新增文件路由，所以生成接口的「定义」直接持久化进本 store，
 *   由 server/middleware/generated.ts 在请求进入路由前匹配短路（见该文件注释）。
 *
 * 持久化保留配置（总开关 / 单接口覆盖 / 生成接口定义）；命中统计与日志仍属于当次进程会话。
 */

import type { GeneratedRouteFile, MockGlobalRuntime, MockRequestLog, MockRouteItem } from '@antdv-admin/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 单接口运行时覆盖（存储态；面板请求体里的 null 语义由 MockRouteRuntimePatch 承担） */
export interface RouteRuntime {
  /** 响应延迟（ms），未设置时跟随全局默认延迟 */
  delay?: number
  /** 停用该接口，返回 404 信封 */
  disabled?: boolean
  /** 随机失败率（0-100） */
  failRate?: number
  /** 注入失败时返回的 HTTP 状态码，默认 500 */
  status?: number
}

export type GlobalRuntime = MockGlobalRuntime

/**
 * 清单条目 = 面板视图（MockRouteItem）去掉运行时统计后的注册信息部分。
 * 保持与 legacy 相同的字段名，面板零改动。
 */
export type RouteManifestItem = Omit<
  MockRouteItem,
  'avgMs' | 'count' | 'errors' | 'lastAt' | 'effective' | 'overridden'
>

export interface RouteStat {
  avgMs: number
  count: number
  errors: number
  lastAt: string
  totalMs: number
}

export type RequestLogEntry = MockRequestLog

export interface MockStore {
  /** 面板生成的自定义接口（含定义与展示用 file 路径），持久化 */
  generated: Record<string, GeneratedRouteFile>
  global: GlobalRuntime
  logs: RequestLogEntry[]
  /** 按接口标识存储；重复注册只追加分组，进程重启后由各 handler 重新注册 */
  manifest: Record<string, RouteManifestItem>
  /** 按接口标识记录的运行时覆盖（持久化） */
  routes: Record<string, RouteRuntime>
  stats: Record<string, RouteStat>
  seq: number
}

const DEFAULT_GLOBAL: GlobalRuntime = { defaultDelay: 0, enabled: true, failRate: 0 }
const DEFAULT_STATE_FILE = '.mock-state.json'
const GLOBAL_KEY = '__ANTDV_MOCK_STORE__'
export const LOG_LIMIT = 200

/**
 * 持久化文件路径：默认取 nitro.config.ts 的 runtimeConfig.stateFile（相对 server 进程 cwd），
 * 由 server/plugins/state-file.ts 在启动时注入实际值；测试可用 setPersistFile 指到临时目录。
 */
let persistFile: string | null = null

export function setPersistFile(file: string): void {
  persistFile = file
}

function persistedPath(): string {
  return resolve(process.cwd(), persistFile ?? DEFAULT_STATE_FILE)
}

/** 仅测试用：丢弃单例，让下一个 getStore() 重新按当前持久化文件构建 */
export function resetStore(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockStore }
  delete holder[GLOBAL_KEY]
}

type PersistedState = Pick<MockStore, 'generated' | 'global' | 'routes'>

function readPersisted(): PersistedState {
  const fallback: PersistedState = { generated: {}, global: { ...DEFAULT_GLOBAL }, routes: {} }
  const file = persistedPath()
  if (!existsSync(file)) return fallback
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<PersistedState>
    return {
      generated: parsed.generated ?? {},
      global: { ...DEFAULT_GLOBAL, ...parsed.global },
      routes: parsed.routes ?? {},
    }
  } catch {
    return fallback
  }
}

function create(): MockStore {
  const persisted = readPersisted()
  return { ...persisted, logs: [], manifest: {}, stats: {}, seq: 0 }
}

export function getStore(): MockStore {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockStore }
  holder[GLOBAL_KEY] ??= create()
  return holder[GLOBAL_KEY]!
}

export function persist(store: MockStore): void {
  try {
    const state: PersistedState = { generated: store.generated, global: store.global, routes: store.routes }
    writeFileSync(persistedPath(), JSON.stringify(state, null, 2), 'utf8')
  } catch (error: unknown) {
    console.warn('[mock/store] 运行时配置写入失败：', error instanceof Error ? error.message : String(error))
  }
}

export function patchGlobal(patch: Partial<GlobalRuntime>): GlobalRuntime {
  const store = getStore()
  store.global = { ...store.global, ...patch }
  persist(store)
  return store.global
}

/** 显式传 undefined 表示清除该覆盖，回落到全局默认 */
export function patchRouteRuntime(key: string, patch: RouteRuntime): RouteRuntime {
  const store = getStore()
  const merged: Record<string, number | boolean | undefined> = { ...store.routes[key], ...patch }
  // "启用"本身不是覆盖，去掉后面板的"已自定义"标记才准确
  if (merged.disabled === false) delete merged.disabled
  const kept = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined))
  if (Object.keys(kept).length === 0) delete store.routes[key]
  else store.routes[key] = kept as RouteRuntime
  persist(store)
  return store.routes[key] ?? {}
}

/** 单接口覆盖优先，未设置时回落到全局 */
export function resolveRuntime(key: string): {
  delay: number
  disabled: boolean
  failRate: number
  forcedStatus?: number
  globalEnabled: boolean
} {
  const store = getStore()
  const runtime = store.routes[key] ?? {}
  return {
    delay: runtime.delay ?? store.global.defaultDelay,
    disabled: runtime.disabled === true,
    failRate: runtime.failRate ?? store.global.failRate,
    forcedStatus: runtime.status,
    globalEnabled: store.global.enabled,
  }
}

/** 同一 method + path 被多个模块注册时保留首个来源，其余记入 duplicates */
export function registerManifest(items: RouteManifestItem[]): void {
  const store = getStore()
  for (const item of items) {
    const existing = store.manifest[item.key]
    if (!existing) {
      store.manifest[item.key] = { ...item, duplicates: [] }
      continue
    }
    if (existing.module !== item.module && !existing.duplicates.includes(item.module)) existing.duplicates.push(item.module)
    if (item.source === 'generated') store.manifest[item.key] = { ...existing, ...item, duplicates: existing.duplicates }
  }
}

export function removeManifest(key: string): void {
  delete getStore().manifest[key]
}

export function listManifest(): RouteManifestItem[] {
  return Object.values(getStore().manifest)
}

export function registerGenerated(items: GeneratedRouteFile[]): void {
  const store = getStore()
  for (const item of items) store.generated[item.id] = item
}

/** 返回被移除的接口，控制面据此回提示删除的落地文件（Nitro 下仅为展示路径） */
export function unregisterGenerated(id: string): GeneratedRouteFile | undefined {
  const store = getStore()
  const item = store.generated[id]
  if (!item) return undefined
  delete store.generated[id]
  delete store.routes[item.key]
  delete store.stats[item.key]
  removeManifest(item.key)
  persist(store)
  return item
}

export function listGenerated(): GeneratedRouteFile[] {
  return Object.values(getStore().generated)
}

export function findGenerated(id: string): GeneratedRouteFile | undefined {
  return getStore().generated[id]
}

export function recordHit(key: string, ms: number, status: number): void {
  const store = getStore()
  const prev = store.stats[key] ?? { avgMs: 0, count: 0, errors: 0, lastAt: '-', totalMs: 0 }
  const count = prev.count + 1
  store.stats[key] = {
    avgMs: Math.round((prev.totalMs + ms) / count),
    count,
    errors: prev.errors + (status >= 400 ? 1 : 0),
    lastAt: now(),
    totalMs: prev.totalMs + ms,
  }
}

export function pushLog(entry: Omit<RequestLogEntry, 'at' | 'id'>): void {
  const store = getStore()
  store.logs.unshift({ ...entry, at: now(), id: ++store.seq })
  if (store.logs.length > LOG_LIMIT) store.logs.length = LOG_LIMIT
}

export function clearObservability(): void {
  const store = getStore()
  store.logs = []
  store.stats = {}
}

function now(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
