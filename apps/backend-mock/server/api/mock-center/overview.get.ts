/**
 * Mock 数据中心控制面接口
 *
 * 与 legacy 一致：`/mock-center` 前缀属于控制面，不走 defineMockRoute，
 * 因此不参与延迟 / 停用 / 失败注入，也不写清单与命中日志——否则面板可能把自己关掉。
 * 生产构建里整个 server/api/mock-center 目录随业务 mock 一起排除，不存在这些实现。
 */

import { defineEventHandler } from '#imports'
import { envelope } from '../../utils/response'
import { toRouteView } from '../../utils/panel'
import { getStore, listManifest } from '../../utils/store'

export default defineEventHandler(() => {
  const store = getStore()
  const views = listManifest().map(toRouteView)
  const totals = views.reduce((acc, item) => {
    acc.hits += item.count
    acc.errors += item.errors
    acc.totalMs += item.avgMs * item.count
    return acc
  }, { errors: 0, hits: 0, totalMs: 0 })

  return envelope(200, {
    counts: {
      avgMs: totals.hits > 0 ? Math.round(totals.totalMs / totals.hits) : 0,
      disabled: views.filter(item => item.effective.disabled === true).length,
      errors: totals.errors,
      generated: Object.keys(store.generated).length,
      hits: totals.hits,
      overridden: views.filter(item => item.overridden).length,
      total: views.length,
    },
    global: store.global,
  }, '获取 Mock 概览成功')
})
