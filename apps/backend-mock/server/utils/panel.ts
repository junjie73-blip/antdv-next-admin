/**
 * 面板视图装配
 *
 * 清单条目（注册信息）与 store 里的运行时覆盖 / 命中统计合并成面板直接渲染的 MockRouteItem，
 * 逻辑与 legacy mock-center.fake.ts 的 toRouteView 一致；抽出来给 overview 与 routes 共用。
 */

import type { MockRouteItem } from '@antdv-admin/types'
import type { RouteManifestItem } from './store'
import { getStore } from './store'

export type RouteView = MockRouteItem

export function toRouteView(item: RouteManifestItem): RouteView {
  const store = getStore()
  const runtime = store.routes[item.key] ?? {}
  const stat = store.stats[item.key]

  return {
    ...item,
    avgMs: stat?.avgMs ?? 0,
    count: stat?.count ?? 0,
    effective: {
      ...runtime,
      delay: runtime.delay ?? store.global.defaultDelay,
      failRate: runtime.failRate ?? store.global.failRate,
    },
    errors: stat?.errors ?? 0,
    lastAt: stat?.lastAt ?? '-',
    overridden: Object.keys(runtime).length > 0,
  }
}
