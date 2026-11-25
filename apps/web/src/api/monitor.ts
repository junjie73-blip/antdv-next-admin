import { get, put } from './request';

/**
 * 系统管理补集的接口：服务监控、两类日志、系统配置、通用记录详情。
 * 路径与 `apps/web/backend-mock/server/api/system/**` 一一对应，静态对账用例会逐条校验。
 */

export interface MonitorMetric {
  detail: string;
  key: string;
  label: string;
  tone: 'error' | 'info' | 'success' | 'warning';
  unit: string;
  value: number;
}

export interface MonitorSnapshotData {
  database: {
    activeConnections: number;
    name: string;
    qps: number;
    replicas: number;
    slowQueries: number;
  };
  environment: string;
  health: { label: string; tone: string };
  healthScore: number;
  hostname: string;
  processes: Array<{
    cpu: number;
    id: string;
    memory: number;
    name: string;
    threads: number;
    uptime: string;
    version: string;
  }>;
  rabbitmq: {
    consumers: number;
    name: string;
    ready: number;
    unacked: number;
    vhost: string;
  };
  redis: {
    hitRate: number;
    keys: number;
    memory: string;
    name: string;
    ops: number;
  };
  region: string;
  resources: MonitorMetric[];
  updatedAt: string;
}

export interface ClientLogRecord {
  id: number;
  level: 'debug' | 'error' | 'info' | 'warn';
  message: string;
  page: string;
  source: string;
  time: string;
  traceId: string;
  username: string;
}

export interface CaptchaLogRecord {
  code: string;
  id: number;
  ip: string;
  location: string;
  receiver: string;
  result: 'failed' | 'passed';
  scene: string;
  time: string;
  type: 'email' | 'image' | 'sms';
}

export interface ConfigField {
  key: string;
  label: string;
  options?: string[];
  placeholder?: string;
  type: 'number' | 'password' | 'select' | 'switch' | 'text';
}

export interface ConfigPanel {
  description: string;
  fields: ConfigField[];
  icon: string;
  key: string;
  title: string;
}

export type ConfigValues = Record<
  string,
  Record<string, boolean | number | string>
>;

export interface RecordDetailData {
  icon: string;
  id: string;
  module: string;
  record: null | Record<string, unknown>;
  sections: Array<{
    fields: Array<{ key: string; label: string }>;
    title: string;
  }>;
  title: string;
}

/** 服务监控快照 */
export function getMonitorSnapshot(params?: Record<string, unknown>) {
  return get<MonitorSnapshotData>('/system/monitor/snapshot', params);
}

/** 客户端日志列表 */
export function getClientLogList(params?: Record<string, unknown>) {
  return get<{
    list: ClientLogRecord[];
    stats: {
      debug: number;
      error: number;
      info: number;
      total: number;
      warn: number;
    };
    total: number;
  }>('/system/client-log/list', params);
}

/** 验证码日志列表 */
export function getCaptchaLogList(params?: Record<string, unknown>) {
  return get<{
    list: CaptchaLogRecord[];
    stats: { failed: number; passed: number; total: number };
    total: number;
  }>('/system/captcha-log/list', params);
}

/** 系统配置的面板定义与当前值 */
export function getSystemConfig() {
  return get<{ panels: ConfigPanel[]; values: ConfigValues }>(
    '/system/config/list',
  );
}

/** 保存单个配置面板 */
export function saveSystemConfig(data: Record<string, unknown>) {
  return put<{ panel: string; values: Record<string, unknown> }>(
    '/system/config/save',
    data,
  );
}

/** 恢复单个配置面板的默认值 */
export function resetSystemConfig(data: Record<string, unknown>) {
  return put<{ panel: string; values: Record<string, unknown> }>(
    '/system/config/reset',
    data,
  );
}

/** 通用记录详情：module = user / role / dept / post / notice / settings / file / log / loginLog / online */
export function getRecordDetail(moduleKey: string, id: string) {
  return get<RecordDetailData>(`/system/record/${moduleKey}/${id}`);
}
