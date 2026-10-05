/**
 * Mock 数据中心控制面接口
 *
 * 这些接口本身就是普通 mock 路由（前缀 /mock-center 由 mock/_runtime.ts 识别为控制面，
 * 不参与延迟 / 停用 / 错误注入，也不写清单与日志），因此只在 dev server 存在，
 * 生产构建不含任何对应实现。
 */

import type { GeneratedRouteDefinition, GlobalRuntime, RouteManifestItem, RouteRuntime } from './store'
import type { MockContext } from './_runtime'
import { defineFakeRoute } from 'vite-plugin-fake-server/client'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  clearObservability,
  findGenerated,
  getStore,
  listGenerated,
  listManifest,
  patchGlobal,
  patchRouteRuntime,
  persist,
  unregisterGenerated,
} from './store'
import { envelope, mockFromTemplate, withRuntime } from './_runtime'

interface RouteView extends RouteManifestItem {
  /** 生效中的运行时配置（已合并全局默认值） */
  effective: RouteRuntime & { delay: number; failRate: number }
  avgMs: number
  count: number
  errors: number
  lastAt: string
  overridden: boolean
}
const ID_RE = /^[a-z][a-z0-9-]{1,63}$/
const KEY_RE = /^\[(GET|POST|PUT|PATCH|DELETE)\]\/[A-Za-z0-9\-/:._]+$/
const PRESET_TEMPLATES = [
  {
    name: '分页列表',
    template: {
      'list|10': [{ 'id|+': 1, email: '@email', name: '@cname', 'status|1': [0, 1], 'createTime': '@datetime("yyyy-MM-dd HH:mm:ss")' }],
      'total|+100': 100,
    },
    key: '[GET]/demo/page-list',
    title: '演示分页列表',
  },
  {
    name: '统计概览',
    template: { 'today|100-999': 1, 'week|1000-9999': 1, 'growth|-20-50': 1, 'online|10-200': 1 },
    key: '[GET]/demo/statistics',
    title: '演示统计概览',
  },
  {
    name: '树形结构',
    template: { 'items|3': [{ id: '@guid', 'label|1': ['一级', '二级', '三级'], 'children|0-2': [{ id: '@guid', label: '子节点' }] }] },
    key: '[GET]/demo/tree',
    title: '演示树形数据',
  },
  {
    name: '中文名单',
    template: { 'rows|20': [{ 'id|+': 1, name: '@cname', phone: '@integer(13000000000, 13999999999)', address: '@county(true)' }] },
    key: '[GET]/demo/names',
    title: '演示中文名单',
  },
]
/** 插件默认中缀：面板生成的文件必须叫 `<id>.fake.ts` 才会被 fake-server 收进路由 */
const FAKE_SUFFIX = '.fake.ts'

function generatedDir(): string {
  return resolve(process.cwd(), 'mock/generated')
}
/**
 * 以磁盘为准对账：直接在文件管理器里删掉 mock/generated/*.fake.ts 时，fake-server 只会摘掉路由，
 * 控制面注册表与清单里的条目会留在内存里，这里把它们一并清掉，避免面板出现幽灵接口。
 */
function syncGeneratedState(): void {
  const dir = generatedDir()
  const onDisk = new Set(
    existsSync(dir)
      ? readdirSync(dir)
          .filter(name => name.endsWith(FAKE_SUFFIX))
          .map(name => name.slice(0, -FAKE_SUFFIX.length))
      : [],
  )
  for (const item of listGenerated()) if (!onDisk.has(item.id)) unregisterGenerated(item.id)
}
/** 把定义落成 mock/generated/<id>.fake.ts，fake-server 监听该目录后自动热加载 */
function writeGeneratedFile(definition: GeneratedRouteDefinition): string {
  const file = resolve(generatedDir(), `${definition.id}${FAKE_SUFFIX}`)
  const source = [
    '// 本文件由 Mock 数据中心生成，请勿手工编辑（删除或改结构请回到面板保存）',
    "import { defineFakeRoute } from 'vite-plugin-fake-server/client'",
    '',
    "import { defineGeneratedMock } from '../_runtime'",
    '',
    `export default defineFakeRoute(defineGeneratedMock(${JSON.stringify([definition], null, 2)}))`,
    '',
  ].join('\n')
  mkdirSync(generatedDir(), { recursive: true })
  writeFileSync(file, source, 'utf8')
  return `mock/generated/${definition.id}.ts`
}
function toRouteView(item: RouteManifestItem): RouteView {
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
/** 模板必须是 JSON 对象 / 数组文本，mockjs 语法写在字符串值里 */
function parseTemplate(input: unknown): { error?: string; template?: GeneratedRouteDefinition['template'] } {
  if (input && typeof input === 'object') return { template: input as GeneratedRouteDefinition['template'] }
  if (typeof input !== 'string' || input.trim().length === 0) return { error: '响应模板不能为空' }
  try {
    const parsed: unknown = JSON.parse(input)
    if (parsed === null || typeof parsed !== 'object') return { error: '响应模板需为 JSON 对象或数组' }
    return { template: parsed as GeneratedRouteDefinition['template'] }
  } catch {
    return { error: '响应模板不是合法 JSON，请检查引号与逗号' }
  }
}
function validateDefinition(body: Record<string, unknown>): { error?: string; value?: GeneratedRouteDefinition } {
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

export default defineFakeRoute(
  withRuntime([
    {
      method: 'GET',
      url: '/mock-center/overview',
      response() {
        syncGeneratedState()
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
      },
    },
    {
      method: 'GET',
      url: '/mock-center/routes',
      response({ query }: MockContext) {
        syncGeneratedState()
        const keyword = String(query.keyword ?? '').trim().toLowerCase()
        const module = String(query.module ?? '').trim()
        const source = String(query.source ?? '').trim()

        let views = listManifest().map(toRouteView)
        if (module) views = views.filter(item => item.module === module)
        if (source) views = views.filter(item => item.source === source)
        if (keyword) views = views.filter(item => `${item.key} ${item.title ?? ''} ${item.file ?? ''}`.toLowerCase().includes(keyword))

        views.sort((a, b) => a.module.localeCompare(b.module) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
        return envelope(200, { list: views, modules: [...new Set(listManifest().map(item => item.module))].sort() }, '获取 Mock 接口清单成功')
      },
    },
    {
      method: 'POST',
      url: '/mock-center/runtime',
      response({ data }: MockContext) {
        const body = (data ?? {}) as Record<string, unknown>
        const patch: Partial<GlobalRuntime> = {}

        if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
        if (typeof body.defaultDelay === 'number') {
          if (!Number.isFinite(body.defaultDelay) || body.defaultDelay < 0 || body.defaultDelay > 30000) return envelope(400, null, '默认延迟需为 0-30000 毫秒')
          patch.defaultDelay = Math.round(body.defaultDelay)
        }
        if (typeof body.failRate === 'number') {
          if (!Number.isFinite(body.failRate) || body.failRate < 0 || body.failRate > 100) return envelope(400, null, '失败率需为 0-100')
          patch.failRate = Math.round(body.failRate)
        }

        return envelope(200, patchGlobal(patch), 'Mock 全局运行时已更新')
      },
    },
    {
      method: 'POST',
      url: '/mock-center/route-runtime',
      response({ data }: MockContext) {
        const body = (data ?? {}) as Record<string, unknown>
        const key = typeof body.key === 'string' ? body.key : ''
        if (!getStore().manifest[key]) return envelope(404, null, `Mock 接口不存在：${key}`)

        const patch: RouteRuntime = {}
        if (body.delay === null || body.delay === undefined) patch.delay = undefined
        else if (typeof body.delay === 'number') {
          if (!Number.isFinite(body.delay) || body.delay < 0 || body.delay > 30000) return envelope(400, null, '响应延迟需为 0-30000 毫秒')
          patch.delay = Math.round(body.delay)
        }

        if (typeof body.disabled === 'boolean') patch.disabled = body.disabled
        else if (body.disabled === null) patch.disabled = undefined

        if (body.failRate === null || body.failRate === undefined) patch.failRate = undefined
        else if (typeof body.failRate === 'number') {
          if (!Number.isFinite(body.failRate) || body.failRate < 0 || body.failRate > 100) return envelope(400, null, '失败率需为 0-100')
          patch.failRate = Math.round(body.failRate)
        }

        if (body.status === null || body.status === undefined) patch.status = undefined
        else if (typeof body.status === 'number') {
          if (!Number.isInteger(body.status) || body.status < 400 || body.status > 599) return envelope(400, null, '注入状态码需为 400-599 的整数')
          patch.status = body.status
        }

        return envelope(200, patchRouteRuntime(key, patch), 'Mock 接口运行时已更新')
      },
    },
    {
      method: 'GET',
      url: '/mock-center/logs',
      response({ query }: MockContext) {
        const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
        const module = String(query.module ?? '').trim()
        const onlyError = String(query.onlyError ?? '') === 'true'

        let logs = getStore().logs
        if (module) logs = logs.filter(item => item.module === module)
        if (onlyError) logs = logs.filter(item => item.status >= 400 || item.code >= 400)

        return envelope(200, { limit, logs: logs.slice(0, limit), total: logs.length }, '获取命中日志成功')
      },
    },
    {
      method: 'POST',
      url: '/mock-center/logs/clear',
      response() {
        clearObservability()
        return envelope(200, null, '命中日志与统计已清空')
      },
    },
    {
      method: 'GET',
      url: '/mock-center/templates',
      response() {
        return envelope(200, PRESET_TEMPLATES, '获取响应模板成功')
      },
    },
    {
      method: 'POST',
      url: '/mock-center/preview',
      response({ data }: MockContext) {
        const body = (data ?? {}) as Record<string, unknown>
        const parsed = parseTemplate(body.template)
        if (parsed.error) return envelope(400, null, parsed.error)

        try {
          const rendered: unknown = JSON.parse(JSON.stringify(mockFromTemplate(parsed.template!)))
          return envelope(200, { sample: rendered }, '模板预览成功')
        } catch (error: unknown) {
          return envelope(400, null, `模板渲染失败：${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },
    {
      method: 'GET',
      url: '/mock-center/generated',
      response() {
        return envelope(200, listGenerated(), '获取自定义接口成功')
      },
    },
    {
      method: 'POST',
      url: '/mock-center/routes/save',
      response({ data }: MockContext) {
        const body = (data ?? {}) as Record<string, unknown>
        const validated = validateDefinition(body)
        if (validated.error || !validated.value) return envelope(400, null, validated.error ?? '接口定义不合法')

        try {
          const file = writeGeneratedFile(validated.value)
          // 覆盖式注册：编辑同名 id 时同步清单里的展示名与模板
          getStore().generated[validated.value.id] = { ...validated.value, file }
          persist(getStore())
          return envelope(200, { ...validated.value, file }, `接口「${validated.value.key}」已保存，热更新即刻生效`)
        } catch (error: unknown) {
          return envelope(500, null, `写入 mock/generated 文件失败：${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },
    {
      method: 'POST',
      url: '/mock-center/routes/remove',
      response({ data }: MockContext) {
        const body = (data ?? {}) as Record<string, unknown>
        const id = typeof body.id === 'string' ? body.id : ''
        if (!ID_RE.test(id)) return envelope(400, null, '接口标识不合法')

        const removed = unregisterGenerated(id)
        if (!removed) return envelope(404, null, `自定义接口不存在：${id}`)

        try {
          rmSync(resolve(generatedDir(), `${id}${FAKE_SUFFIX}`), { force: true })
          if (existsSync(resolve(generatedDir(), `${id}${FAKE_SUFFIX}`))) return envelope(500, null, '接口文件未被删除，请检查 mock/generated 目录权限')
          return envelope(200, { file: removed.file, id }, `接口「${removed.key}」已删除`)
        } catch (error: unknown) {
          return envelope(500, null, `删除失败：${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },
  ]),
)
