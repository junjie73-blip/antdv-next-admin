/**
 * 路由元信息纯函数
 *
 * keyOf / splitKey / moduleOf 等逻辑与 legacy mock/_runtime.ts 保持一致，
 * 单独成文件是为了让 Vitest 可以直接覆盖（不牵入 Nitro 运行时依赖）。
 */

import type { MockMethod } from '@antdv-admin/types'

import { MOCK_METHODS } from '@antdv-admin/types'

const METHOD_PREFIX_RE = /^\[(DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\]\s*/i

export { MOCK_METHODS, type MockMethod }

/** 面板与日志使用的接口标识，如 `[GET]/system/user/list` */
export function keyOf(method: string, url: string): string {
  return `[${method.toUpperCase()}]${url}`
}

/** `[GET]/system/user/:id` → 方法与路径，供面板生成的定义回填 */
export function splitKey(key: string): { method: MockMethod, path: string } {
  const matched = key.match(METHOD_PREFIX_RE)
  return {
    method: ((matched?.[1] ?? 'GET').toUpperCase()) as MockMethod,
    path: key.replace(METHOD_PREFIX_RE, '') || '/',
  }
}

/** 分组只用于列表展示与筛选，取路径前两段：/system/user/list → system/user */
export function moduleOf(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? segments.slice(0, 2).join('/') : 'root'
}

/** 校验并归一化方法名（默认 GET，与 legacy 补齐逻辑一致） */
export function methodOf(method?: string): MockMethod {
  const upper = (method ?? 'GET').toString().toUpperCase()
  return (MOCK_METHODS as readonly string[]).includes(upper) ? upper as MockMethod : 'GET'
}

/**
 * 失败注入判定，语义与 legacy 完全一致：0 恒不注入，100 恒注入。
 * random 可注入，便于边界测试。
 */
export function shouldInjectFailure(failRate: number, random: () => number = Math.random): boolean {
  return failRate > 0 && random() * 100 < failRate
}

/**
 * 面板生成接口的展示路径。legacy 会真的写出 mock/generated/<id>.fake.ts 供插件热加载，
 * Nitro 改为把定义持久化进 store（见 server/middleware/generated.ts），字段保留只为面板展示兼容。
 */
export function generatedFileOf(id: string): string {
  return `mock/generated/${id}.fake.ts`
}
