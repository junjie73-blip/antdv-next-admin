import { get, post } from './request'

// ======================== 类型 ========================

/** Mock 运行时总开关与默认值 */
export interface MockGlobalRuntime {
  /** 全局默认延迟（ms） */
  defaultDelay: number
  /** Mock 服务总开关 */
  enabled: boolean
  /** 全局随机失败率（0-100） */
  failRate: number
}

/** 单接口运行时覆盖，null 表示清除覆盖回落全局 */
export interface MockRouteRuntimePatch {
  key: string
  delay?: number | null
  disabled?: boolean | null
  failRate?: number | null
  status?: number | null
}

/** 接口清单条目：注册信息 + 统计 + 生效配置 */
export interface MockRouteItem {
  /** 接口标识，如 `[GET]/system/user/list` */
  key: string
  method: string
  /** 分组，取路由前两段，如 `system/user` */
  module: string
  /** 其余注册了同一 method + path 的分组 */
  duplicates: string[]
  /** 面板生成接口的落地文件 */
  file?: string
  path: string
  source: 'generated' | 'source'
  /** 展示名，仅生成接口有值 */
  title?: string
  avgMs: number
  count: number
  errors: number
  lastAt: string
  /** 该接口生效的延迟与失败率（已合并全局默认） */
  effective: {
    delay: number
    disabled?: boolean
    failRate: number
    status?: number
  }
  /** 是否存在单接口覆盖 */
  overridden: boolean
}

export interface MockOverview {
  counts: {
    avgMs: number
    disabled: number
    errors: number
    generated: number
    hits: number
    overridden: number
    total: number
  }
  global: MockGlobalRuntime
}

/** 一次请求命中记录 */
export interface MockRequestLog {
  at: string
  /** 业务响应码，无信封时等于 HTTP 状态码 */
  code: number
  id: number
  /** 由失败率注入产生的错误 */
  injected: boolean
  key: string
  method: string
  module: string
  ms: number
  path: string
  /** 因总开关或单接口停用被跳过 */
  skipped: boolean
  status: number
}

/** 面板生成接口的定义 */
export interface GeneratedRouteDefinition {
  /** 唯一标识，同时作为落地文件名 */
  id: string
  key: string
  template: Record<string, unknown> | unknown[] | string
  message?: string
  title?: string
}

export interface GeneratedRouteFile extends GeneratedRouteDefinition {
  file: string
}

/** 预置响应模板 */
export interface MockTemplatePreset {
  name: string
  key: string
  title: string
  template: Record<string, unknown>
}

// ======================== 概览 ========================

/** Mock 服务运行概览 */
export function getMockOverview() {
  return get<MockOverview>('/mock-center/overview')
}

// ======================== 接口清单 ========================

/** Mock 接口清单（支持关键字 / 分组 / 来源筛选） */
export function getMockRoutes(params?: Record<string, unknown>) {
  return get<{ list: MockRouteItem[]; modules: string[] }>(
    '/mock-center/routes',
    params,
  )
}

/** 更新 Mock 全局运行时 */
export function updateMockRuntime(data: Partial<MockGlobalRuntime>) {
  return post<MockGlobalRuntime>('/mock-center/runtime', data)
}

/** 更新单接口运行时（延迟 / 停用 / 失败注入） */
export function updateMockRouteRuntime(data: MockRouteRuntimePatch) {
  return post<Record<string, unknown>>('/mock-center/route-runtime', data)
}

// ======================== 命中日志 ========================

/** 请求命中日志 */
export function getMockLogs(params?: Record<string, unknown>) {
  return get<{ limit: number; logs: MockRequestLog[]; total: number }>(
    '/mock-center/logs',
    params,
  )
}

/** 清空命中日志与统计 */
export function clearMockLogs() {
  return post<null>('/mock-center/logs/clear')
}

// ======================== 自定义接口 ========================

/** 预置响应模板 */
export function getMockTemplates() {
  return get<MockTemplatePreset[]>('/mock-center/templates')
}

/** 渲染一次模板，用于保存前确认响应结构 */
export function previewMockTemplate(
  template: GeneratedRouteDefinition['template'],
) {
  return post<{ sample: unknown }>('/mock-center/preview', { template })
}

/** 面板已生成的自定义接口 */
export function getGeneratedRoutes() {
  return get<GeneratedRouteFile[]>('/mock-center/generated')
}

/** 保存自定义接口，落盘为 mock/generated/<id>.ts 并热加载 */
export function saveMockRoute(data: GeneratedRouteDefinition) {
  return post<GeneratedRouteFile>('/mock-center/routes/save', data)
}

/** 删除自定义接口，同时移除落地文件与运行时覆盖 */
export function removeMockRoute(id: string) {
  return post<{ file: string; id }>('/mock-center/routes/remove', { id })
}
