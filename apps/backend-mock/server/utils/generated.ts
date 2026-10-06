/**
 * 面板生成接口的校验与落库
 *
 * legacy 会把定义写成 mock/generated/<id>.fake.ts 交给 vite 插件热加载；
 * Nitro 的路由表在启动期固定，所以定义改为持久化进 store，
 * 由 server/middleware/generated.ts 在请求进入路由表前匹配短路。
 * file 字段仍按 legacy 命名规则生成，仅供面板展示。
 */

import type { GeneratedRouteDefinition, GeneratedRouteFile } from '@antdv-admin/types'
import type { RouteManifestItem } from './store'

import { generatedFileOf, moduleOf, splitKey } from './route-meta'
import { findGenerated, getStore, persist, registerGenerated, registerManifest } from './store'
import { parseTemplate } from './templates'

const ID_RE = /^[a-z][a-z0-9-]{1,63}$/
const KEY_RE = /^\[(GET|POST|PUT|PATCH|DELETE)\]\/[A-Za-z0-9\-/:._]+$/

/** 接口标识规则：与 legacy 相同，删除接口时也用它挡掉非法 id */
export function isGeneratedId(id: string): boolean {
  return ID_RE.test(id)
}

/** 校验请求体并补默认值；错误文案与 legacy 保持逐字一致 */
export function validateDefinition(body: Record<string, unknown>): { error?: string, value?: GeneratedRouteDefinition } {
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!ID_RE.test(id)) return { error: '接口标识需为小写字母开头的短横线命名（2-64 位），且不能含特殊字符' }
  if (!KEY_RE.test(key)) return { error: '请求地址需形如 [GET]/demo/statistics，支持 GET / POST / PUT / PATCH / DELETE' }

  const parsed = parseTemplate(body.template)
  if (parsed.error) return { error: parsed.error }

  const existing = findGenerated(id)
  const duplicated = getStore().manifest[key]
  if (duplicated && (!existing || existing.key !== key)) return { error: `该 method + path 已被接口「${key}」占用，请换个地址或改为编辑原接口` }

  return {
    value: {
      id,
      key,
      message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : '获取数据成功',
      template: parsed.template!,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : id,
    },
  }
}

/** 覆盖式登记：新增与编辑同名 id 都同步 store、清单与持久化文件 */
export function saveGeneratedDefinition(definition: GeneratedRouteDefinition): GeneratedRouteFile {
  const file = generatedFileOf(definition.id)
  const item: GeneratedRouteFile = { ...definition, file }

  registerGenerated([item])

  const { method, path } = splitKey(definition.key)
  const manifestItem: RouteManifestItem = {
    duplicates: [],
    file,
    key: definition.key,
    method,
    module: moduleOf(path),
    path,
    source: 'generated',
  }
  if (definition.title) manifestItem.title = definition.title
  registerManifest([manifestItem])

  persist(getStore())
  return item
}
