/**
 * 面板生成接口的运行时匹配中间件
 *
 * legacy 里 Mock 数据中心把自定义接口落成 mock/generated/<id>.fake.ts，由 vite 插件热加载；
 * Nitro 的文件路由在构建期固定，运行中无法新增路由文件。因此改为：
 * 生成接口的定义持久化在 store（server/utils/store.ts 的 generated 字段），
 * 本中间件在"请求进入路由表之前"按 method + path（含 `:param` 模式）匹配这些定义，
 * 命中即套用与业务接口完全相同的运行时管道（开关 / 延迟 / 停用 / 失败注入 / 统计 / 日志），
 * 编译 mockjs 模板并短路响应；未命中的请求原样放行给正常路由。
 *
 * 注意：中间件先于路由执行，所以必须让源码接口的同 key 请求继续走正常路由
 * （legacy 里 path-to-regexp 首个命中即源码路由，生成接口只是兜底）。
 */

import type { GeneratedRouteFile } from '@antdv-admin/types'
import type { MockEvent, MockRouteInput } from '../utils/runtime'
import { defineEventHandler, getMethod, getRequestURL, setResponseStatus } from '#imports'
import { envelope } from '../utils/response'
import { methodOf, moduleOf, splitKey } from '../utils/route-meta'
import { executeWithRuntime, toRouteInput } from '../utils/runtime'
import { getStore, listGenerated } from '../utils/store'
import { mockFromTemplate } from '../utils/templates'

/** 生成接口路径里 `:name` 段的捕获值；不匹配返回 null */
export function matchGeneratedPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split('/')
  const pathSegments = pathname.split('/')
  if (patternSegments.length !== pathSegments.length) return null

  const params: Record<string, string> = {}
  for (let index = 0; index < patternSegments.length; index++) {
    const expected = patternSegments[index]!
    const actual = pathSegments[index]!
    if (expected.startsWith(':')) {
      if (actual.length === 0) return null
      params[expected.slice(1)] = decodeURIComponent(actual)
    }
    else if (expected !== actual) {
      return null
    }
  }
  return params
}

/**
 * 在所有生成定义里找首个命中项。
 * 与 legacy withRuntime 的重排一致：无参数模式优先，避免 `/demo/:id` 抢占 `/demo/list`。
 */
export function findGeneratedRoute(definitions: GeneratedRouteFile[], method: string, pathname: string): { definition: GeneratedRouteFile, params: Record<string, string> } | null {
  const upper = method.toUpperCase()
  const ordered = [...definitions.filter(item => !item.key.includes(':')), ...definitions.filter(item => item.key.includes(':'))]

  for (const definition of ordered) {
    const { method: keyMethod, path } = splitKey(definition.key)
    if (keyMethod !== upper) continue
    const params = matchGeneratedPath(path, pathname)
    if (params) return { definition, params }
  }
  return null
}

/** /api 前缀由前端 VITE_APP_BASE_API 带来，面板接口标识不含前缀，匹配前先剥掉 */
export function stripApiPrefix(pathname: string): string {
  if (pathname === '/api') return '/'
  return pathname.startsWith('/api/') ? pathname.slice('/api'.length) : pathname
}

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  const path = stripApiPrefix(pathname)
  // 非 /api 请求与控制面接口不参与生成接口匹配（mock-center 由正常路由处理）
  if (path === pathname || path.startsWith('/mock-center')) return
  if (Object.keys(getStore().generated).length === 0) return

  const method = methodOf(getMethod(event))
  const matched = findGeneratedRoute(listGenerated(), method, path)
  if (!matched) return

  const { definition, params } = matched
  const { path: patternPath } = splitKey(definition.key)
  // 同 key 已有源码接口登记时放行给正常路由，保持 legacy 的"源码优先"语义
  if (getStore().manifest[definition.key]?.source === 'source') return

  const route = {
    key: definition.key,
    method,
    module: moduleOf(patternPath),
    path: patternPath,
  }
  const context: MockRouteInput = await toRouteInput(event as unknown as MockEvent, patternPath)
  // 中间件先于路由执行，event.context.params 尚未填充，用模式捕获值覆盖
  context.params = params

  const outcome = await executeWithRuntime(route, () => envelope(200, mockFromTemplate(definition.template), definition.message ?? 'success'), context)
  if (outcome.status !== undefined && outcome.status !== 200) setResponseStatus(event, outcome.status)
  return outcome.body
})
