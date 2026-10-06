import type { MockGlobalRuntime } from '@antdv-admin/types'
import { defineEventHandler, readBody } from '#imports'
import { bizError, envelope } from '../../utils/response'
import { patchGlobal } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>
  const patch: Partial<MockGlobalRuntime> = {}

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.defaultDelay === 'number') {
    if (!Number.isFinite(body.defaultDelay) || body.defaultDelay < 0 || body.defaultDelay > 30000) return bizError(400, '默认延迟需为 0-30000 毫秒')
    patch.defaultDelay = Math.round(body.defaultDelay)
  }
  if (typeof body.failRate === 'number') {
    if (!Number.isFinite(body.failRate) || body.failRate < 0 || body.failRate > 100) return bizError(400, '失败率需为 0-100')
    patch.failRate = Math.round(body.failRate)
  }

  return envelope(200, patchGlobal(patch), 'Mock 全局运行时已更新')
})
