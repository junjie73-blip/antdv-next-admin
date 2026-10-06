/**
 * Mock 运行时状态仓库
 *
 * vite-plugin-fake-server 用 bundle-import 逐个加载 mock 文件，相对依赖（`./_runtime`）会被内联进
 * 每个文件，因此 mock/_runtime.ts 在每条 mock 里都是独立副本，模块级变量无法跨文件共享。
 * 这里把状态挂在 globalThis 上，让控制面接口与业务 mock 读写同一份运行时数据。
 *
 * 持久化只保留配置（总开关 / 单接口覆盖），命中统计与日志属于当次 dev 会话；
 * 接口清单由各 mock 文件加载时注册，从源码里删掉接口需要重启 dev server 才会同步。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 面板生成的自定义接口，落地为 mock/generated/<id>.fake.ts */
export interface GeneratedRouteDefinition {
  /** 唯一标识，同时作为落地文件名 */
  id: string
  /** mockjs 模板，命中后包进统一信封的 data */
  template: Record<string, unknown> | unknown[] | string
  /** 定义标识，如 `[GET]/demo/statistics` */
  key: string
  /** 成功信封的 message */
  message?: string
  /** 展示名 */
  title?: string
}

export interface GeneratedRouteFile extends GeneratedRouteDefinition {
  /** 相对项目根目录的落地文件，如 mock/generated/demo-statistics.fake.ts */
  file: string
}

/** 单接口运行时覆盖 */
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

export interface GlobalRuntime {
  /** 全局默认延迟（ms） */
  defaultDelay: number
  /** Mock 运行时总开关 */
  enabled: boolean
  /** 全局随机失败率（0-100），单接口未设置时生效 */
  failRate: number
}

export interface RouteManifestItem {
  /** 接口标识，如 `[GET]/system/user/list` */
  key: string
  method: string
  /** 模块分组，由路由路径前缀推导（如 `system/user`、`auth`） */
  module: string
  /** 其余注册了同一 method + path 的分组，用于提示重复定义 */
  duplicates: string[]
  /** 面板生成接口的落地文件，源码接口无此字段 */
  file?: string
  path: string
  source: 'generated' | 'source'
  /** 展示名，仅生成接口有值 */
  title?: string
}

export interface RouteStat {
  avgMs: number
  count: number
  errors: number
  lastAt: string
  totalMs: number
}

export interface RequestLogEntry {
  at: string
  /** 业务响应码，无信封时为 200 */
  code: number
  id: number
  /** 由失败率注入产生的错误响应 */
  injected: boolean
  key: string
  method: string
  module: string
  ms: number
  path: string
  /** 因总开关或单接口停用被跳过 */
  skipped: boolean
  /** 实际返回的 HTTP 状态码 */
  status: number
}

export interface MockStore {
  generated: Record<string, GeneratedRouteFile>
  global: GlobalRuntime
  logs: RequestLogEntry[]
  /** 按接口标识存储；重复注册只追加分组，dev server 重启后重建 */
  manifest: Record<string, RouteManifestItem>
  /** 按接口标识记录的运行时覆盖（持久化） */
  routes: Record<string, RouteRuntime>
  stats: Record<string, RouteStat>
  seq: number
}

const DEFAULT_GLOBAL: GlobalRuntime = { defaultDelay: 0, enabled: true, failRate: 0 }
const GLOBAL_KEY = '__ANTDV_MOCK_STORE__'
export const LOG_LIMIT = 200

function persistedPath(): string {
  return resolve(process.cwd(), 'mock/.runtime.json')
}

function readPersisted(): Pick<MockStore, 'global' | 'routes'> {
  const fallback: Pick<MockStore, 'global' | 'routes'> = { global: { ...DEFAULT_GLOBAL }, routes: {} }
  const file = persistedPath()
  if (!existsSync(file)) return fallback
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Pick<MockStore, 'global' | 'routes'>>
    return {
      global: { ...DEFAULT_GLOBAL, ...parsed.global },
      routes: parsed.routes ?? {},
    }
  } catch {
    return fallback
  }
}

function create(): MockStore {
  return { ...readPersisted(), generated: {}, logs: [], manifest: {}, stats: {}, seq: 0 }
}

export function getStore(): MockStore {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockStore }
  holder[GLOBAL_KEY] ??= create()
  return holder[GLOBAL_KEY]!
}

export function persist(store: MockStore): void {
  try {
    writeFileSync(persistedPath(), JSON.stringify({ global: store.global, routes: store.routes }, null, 2), 'utf8')
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

export function patchGeneratedRuntime(id: string, patch: RouteRuntime): RouteRuntime {
  const item = getStore().generated[id]
  return item ? patchRouteRuntime(item.key, patch) : {}
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

/** 返回被移除的接口，控制面据此删除落地文件 */
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

export function getStat(key: string): RouteStat | undefined {
  return getStore().stats[key]
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
