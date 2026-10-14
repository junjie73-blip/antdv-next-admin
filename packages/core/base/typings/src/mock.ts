/**
 * Mock 服务的共享契约：apps/backend-mock 的实现与 apps/web 的
 * 「Mock 数据中心」面板都从这里取类型，避免两侧各写一份。
 */

/** 与后端 R<T> 保持一致的统一响应信封 */
export interface ApiEnvelope<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** Mock 运行时总开关与默认值 */
export interface MockGlobalRuntime {
  /** 全局默认延迟（ms） */
  defaultDelay: number;
  /** Mock 服务总开关 */
  enabled: boolean;
  /** 全局随机失败率（0-100） */
  failRate: number;
}

/** 单接口运行时覆盖，null 表示清除覆盖回落全局 */
export interface MockRouteRuntimePatch {
  key: string;
  delay?: null | number;
  disabled?: boolean | null;
  failRate?: null | number;
  status?: null | number;
}

/** 接口清单条目：注册信息 + 统计 + 生效配置 */
export interface MockRouteItem {
  /** 接口标识，如 `[GET]/system/user/list` */
  key: string;
  method: string;
  /** 分组，取路由前两段，如 `system/user` */
  module: string;
  /** 其余注册了同一 method + path 的分组 */
  duplicates: string[];
  /** 面板生成接口的落地文件 */
  file?: string;
  path: string;
  source: 'generated' | 'source';
  /** 展示名，仅生成接口有值 */
  title?: string;
  avgMs: number;
  count: number;
  errors: number;
  lastAt: string;
  /** 该接口生效的延迟与失败率（已合并全局默认） */
  effective: {
    delay: number;
    disabled?: boolean;
    failRate: number;
    status?: number;
  };
  /** 是否存在单接口覆盖 */
  overridden: boolean;
}

export interface MockOverview {
  counts: {
    avgMs: number;
    disabled: number;
    errors: number;
    generated: number;
    hits: number;
    overridden: number;
    total: number;
  };
  global: MockGlobalRuntime;
}

/** 一次请求命中记录 */
export interface MockRequestLog {
  at: string;
  /** 业务响应码，无信封时等于 HTTP 状态码 */
  code: number;
  id: number;
  /** 由失败率注入产生的错误 */
  injected: boolean;
  key: string;
  method: string;
  module: string;
  ms: number;
  path: string;
  /** 因总开关或单接口停用被跳过 */
  skipped: boolean;
  status: number;
}

/** 面板生成接口的定义 */
export interface GeneratedRouteDefinition {
  /** 唯一标识，同时作为落地文件名 */
  id: string;
  key: string;
  template: Record<string, unknown> | string | unknown[];
  message?: string;
  title?: string;
}

export interface GeneratedRouteFile extends GeneratedRouteDefinition {
  file: string;
}

/** 预置响应模板 */
export interface MockTemplatePreset {
  name: string;
  key: string;
  title: string;
  template: Record<string, unknown>;
}

/** 支持的方法集合，与 Nitro 的 handler method 命名对齐 */
export const MOCK_METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
] as const;

export type MockMethod = (typeof MOCK_METHODS)[number];
