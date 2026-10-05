/**
 * Mock 运行时层（不是接口文件）
 *
 * 文件名不带 `.fake` 中缀，vite-plugin-fake-server 不会把它当路由文件加载。
 * 职责：把符合插件规范的 FakeRoute 加上「全局开关 / 单接口延迟 / 停用 / 失败注入 / 命中统计与日志」，
 * 并把这些接口登记进 store，供 Mock 数据中心面板展示与编辑。
 *
 * 业务接口文件的写法保持插件原生：
 *
 * ```ts
 * import { defineFakeRoute } from 'vite-plugin-fake-server/client'
 * import { envelope, withRuntime } from '../_runtime'
 *
 * export default defineFakeRoute(
 *   withRuntime([
 *     { method: 'GET', url: '/system/user/list', response: ({ query }) => envelope(200, {}, 'ok') },
 *   ]),
 * )
 * ```
 *
 * 插件用 bundle-import 逐个加载 mock 文件，相对依赖会被内联成每个文件各自的副本，
 * 因此跨文件状态只能放在 globalThis 上（见 ./store）。
 */

import type { FakeRoute, HttpMethodType, ProcessedRequest, Recordable } from 'vite-plugin-fake-server'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GeneratedRouteDefinition, RouteManifestItem } from './store'

import { performance } from 'node:perf_hooks'
import { STATUS_CODES } from 'node:http'
import Mock from 'mockjs'

import { pushLog, recordHit, registerGenerated, registerManifest, resolveRuntime } from './store'

export type { GeneratedRouteDefinition, RouteManifestItem }

export const MOCK_METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'] as const
export type MockMethod = (typeof MOCK_METHODS)[number]

/** 统一响应信封，与后端 R<T> 保持一致 */
export interface MockEnvelope<T = unknown> {
  code: number
  data: T
  message: string
}

/**
 * 处理器入参：插件的 ProcessedRequest，外加两个便捷字段
 * - `data`：已解析的请求体，无 body 时是空对象（插件给的是空串）
 * - `path`：注册时的路径，不含查询串
 */
export interface MockContext extends ProcessedRequest {
  data: Recordable
  path: string
}

export type MockHandler = (request: MockContext, req: IncomingMessage, res: ServerResponse) => unknown | Promise<unknown>

/** 带面板元信息的路由：除 `meta` 外全部是插件的 FakeRoute 字段 */
export interface MockFakeRoute extends Omit<FakeRoute, 'response'> {
  meta?: Partial<RouteManifestItem>
  response?: MockHandler
}

/** 控制面前缀：这些接口不参与延迟 / 停用 / 错误注入，也不写清单与日志，避免面板把自己关掉 */
const CONTROL_PREFIX = '/mock-center'

const METHOD_PREFIX_RE = /^\[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\]\s*/i

/** 插件默认方法就是 GET，这里补齐便于清单展示 */
function methodOf(route: MockFakeRoute): MockMethod {
  return ((route.method ?? 'GET').toString().toUpperCase()) as MockMethod
}

/** 面板与日志使用的接口标识，如 `[GET]/system/user/list` */
export function keyOf(method: string, url: string): string {
  return `[${method.toUpperCase()}]${url}`
}

/** `[GET]/system/user/:id` → 方法与路径，供面板生成的定义回填 */
export function splitKey(key: string): { method: MockMethod; path: string } {
  const matched = key.match(METHOD_PREFIX_RE)
  return {
    method: ((matched?.[1] ?? 'GET').toUpperCase()) as MockMethod,
    path: key.replace(METHOD_PREFIX_RE, '') || '/',
  }
}

/** 分组只用于列表展示与筛选，取路径前两段：/system/user/list → system/user */
function moduleOf(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? segments.slice(0, 2).join('/') : 'root'
}

/**
 * 包装成插件可加载的 FakeRoute[]。
 *
 * path-to-regexp 取首个命中项：字面量路由必须先注册，否则 `/system/user/options`
 * 会被 `/system/user/:id` 抢占，所以这里按「无参数路径优先」重排。
 */
export function withRuntime(routes: MockFakeRoute[]): FakeRoute[] {
  const ordered = [...routes.filter(route => !route.url.includes(':')), ...routes.filter(route => route.url.includes(':'))]

  registerManifest(
    ordered
      .filter(route => !isControl(route.url))
      .map(route => ({
        duplicates: [],
        key: keyOf(methodOf(route), route.url),
        method: methodOf(route),
        module: moduleOf(route.url),
        path: route.url,
        source: 'source' as const,
        ...route.meta,
      })),
  )

  return ordered.map(route => toFakeRoute(route))
}

/**
 * 注册 Mock 数据中心面板生成的自定义接口：把 mockjs 模板渲染成响应，
 * 同时把定义写进 store 供列表回填与编辑；文件被删除时由控制面调用 unregisterGenerated 清理。
 */
export function defineGeneratedMock(definitions: GeneratedRouteDefinition[], enable = true): FakeRoute[] {
  if (!enable) return []

  const routes = definitions.map<MockFakeRoute>((definition) => {
    const { method, path } = splitKey(definition.key)
    registerGenerated([{ ...definition, file: generatedFileOf(definition.id) }])

    return {
      meta: { file: generatedFileOf(definition.id), source: 'generated', title: definition.title },
      method,
      response: () => envelope(200, mockFromTemplate(definition.template), definition.message ?? 'success'),
      url: path,
    }
  })

  return withRuntime(routes)
}

/** 用 mockjs 模板生成数据，支持 `'list|10': [...]` 这类语法 */
export function mockFromTemplate(template: GeneratedRouteDefinition['template']): unknown {
  return Mock.mock(template)
}

export function envelope<T>(code: number, data: T, message: string): MockEnvelope<T> {
  return { code, data, message }
}

export function generatedFileOf(id: string): string {
  return `mock/generated/${id}.fake.ts`
}

function isControl(url: string): boolean {
  return url === CONTROL_PREFIX || url.startsWith(`${CONTROL_PREFIX}/`)
}

function toFakeRoute(route: MockFakeRoute): FakeRoute {
  const control = isControl(route.url)
  const key = keyOf(methodOf(route), route.url)
  const handler = route.response

  const fakeRoute: FakeRoute = {
    ...(route.headers ? { headers: route.headers } : {}),
    method: methodOf(route) as HttpMethodType,
    url: route.url,
  }

  if (route.statusCode !== undefined) fakeRoute.statusCode = route.statusCode
  if (route.statusText !== undefined) fakeRoute.statusText = route.statusText

  if (!handler) return fakeRoute

  fakeRoute.response = async (processed: ProcessedRequest, req: IncomingMessage, res: ServerResponse) => {
    const context = toContext(processed, route.url)

    if (control) return handler(context, req, res)

    const startedAt = performance.now()
    const runtime = resolveRuntime(key)
    let status = 200
    let code = 200
    let skipped = false

    try {
      if (!runtime.globalEnabled) {
        skipped = true
        return reject(res, (status = 503), 'Mock 服务已全局停用，请在 Mock 数据中心恢复')
      }
      if (runtime.disabled) {
        skipped = true
        return reject(res, (status = 404), `Mock 接口已停用：${key}`)
      }

      if (runtime.delay > 0) await sleep(runtime.delay)

      if (runtime.failRate > 0 && Math.random() * 100 < runtime.failRate) {
        status = runtime.forcedStatus ?? 500
        code = status
        return reject(res, status, `Mock 已按 ${runtime.failRate}% 失败率注入错误响应`)
      }

      const result = await handler(context, req, res)
      if (isEnvelope(result)) code = result.code
      return result
    } finally {
      const ms = Math.max(1, Math.round(performance.now() - startedAt))
      recordHit(key, ms, status)
      pushLog({
        code,
        injected: !skipped && status >= 400,
        key,
        method: methodOf(route),
        module: moduleOf(route.url),
        ms,
        path: route.url,
        skipped,
        status,
      })
    }
  }

  return fakeRoute
}

function toContext(processed: ProcessedRequest, path: string): MockContext {
  const data = normalizeBody(processed.body) as Recordable

  return {
    ...processed,
    body: data,
    data,
    headers: normalizeHeaders(processed.headers),
    params: normalizeParams(processed.params),
    path,
    query: processed.query ?? {},
    url: processed.url ?? path,
  }
}

/** 无请求体时 fake-server 给到空串，统一成空对象，便于业务侧直接取字段 */
function normalizeBody(body: unknown): unknown {
  return body === '' || body === undefined || body === null ? {} : body
}

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]),
  )
}

function normalizeParams(params: Record<string, string | string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(params ?? {}).map(([name, value]) => [name, Array.isArray(value) ? value.join(',') : value]))
}

function isEnvelope(value: unknown): value is MockEnvelope {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}

/** fake-server 在调用 response 前已写好 200，这里按需覆写状态码与状态文本 */
function reject(res: ServerResponse, status: number, message: string): MockEnvelope<null> {
  res.statusCode = status
  res.statusMessage = STATUS_CODES[status] ?? 'Error'
  return envelope(status, null, message)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type { FakeRoute, HttpMethodType, ProcessedRequest }
