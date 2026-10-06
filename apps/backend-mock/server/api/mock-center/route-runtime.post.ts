import type { RouteRuntime } from '../../utils/store'
import { defineEventHandler, readBody } from '#imports'
import { bizError, envelope } from '../../utils/response'
import { getStore, patchRouteRuntime } from '../../utils/store'

/**
 * 单接口运行时覆盖：显式 null / 缺省表示清除覆盖并回落全局，
 * 与 legacy 一致——校验失败只回业务码 400（HTTP 仍 200），前端拦截器按 code 提示。
 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>
  const key = typeof body.key === 'string' ? body.key : ''
  if (!getStore().manifest[key]) return bizError(404, `Mock 接口不存在：${key}`)

  const patch: RouteRuntime = {}

  if (body.delay === null || body.delay === undefined) patch.delay = undefined
  else if (typeof body.delay === 'number') {
    if (!Number.isFinite(body.delay) || body.delay < 0 || body.delay > 30000) return bizError(400, '响应延迟需为 0-30000 毫秒')
    patch.delay = Math.round(body.delay)
  }

  if (typeof body.disabled === 'boolean') patch.disabled = body.disabled
  else if (body.disabled === null) patch.disabled = undefined

  if (body.failRate === null || body.failRate === undefined) patch.failRate = undefined
  else if (typeof body.failRate === 'number') {
    if (!Number.isFinite(body.failRate) || body.failRate < 0 || body.failRate > 100) return bizError(400, '失败率需为 0-100')
    patch.failRate = Math.round(body.failRate)
  }

  if (body.status === null || body.status === undefined) patch.status = undefined
  else if (typeof body.status === 'number') {
    if (!Number.isInteger(body.status) || body.status < 400 || body.status > 599) return bizError(400, '注入状态码需为 400-599 的整数')
    patch.status = body.status
  }

  return envelope(200, patchRouteRuntime(key, patch), 'Mock 接口运行时已更新')
})
