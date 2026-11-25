/** AI Control Plane 接口（Provider / Prompt / Context / Trace） */
import { del, get, post } from './request';

export interface CpProvider {
  enabled: boolean;
  endpoint: string;
  id: number;
  keyRef: string;
  keyTail: string;
  models: string[];
  name: string;
  protocol: string;
  updatedAt: string;
}

export interface CpPrompt {
  enabled: boolean;
  id: number;
  name: string;
  route: string;
  system: string;
  updatedAt: string;
  variables: string[];
  version: number;
}

export interface CpContext {
  id: number;
  maskPii: boolean;
  maxHistory: number;
  maxTokens: number;
  name: string;
  strategy: 'none' | 'drop-oldest' | 'summarize';
  updatedAt: string;
}

export interface CpTrace {
  args: string;
  createdAt: string;
  id: number;
  ms: number;
  result: string;
  route: string;
  tool: string;
  tokens: number;
  traceId: string;
}

type Kind = 'context' | 'provider' | 'prompt' | 'trace';

/** Trace 是只读审计日志：不提供 save / delete，免得页面调出不存在的接口 */
export type WritableCpKind = Exclude<Kind, 'trace'>;

/** 字面量路径表：接口对账工具按字符串静态扫描，不能用模板拼路径 */
const LIST_PATH: Record<Kind, string> = {
  context: '/ai/control-plane/context/list',
  provider: '/ai/control-plane/provider/list',
  prompt: '/ai/control-plane/prompt/list',
  trace: '/ai/control-plane/trace/list',
};
const SAVE_PATH: Record<WritableCpKind, string> = {
  context: '/ai/control-plane/context/save',
  provider: '/ai/control-plane/provider/save',
  prompt: '/ai/control-plane/prompt/save',
};
const DELETE_PATH: Record<WritableCpKind, (id: number) => string> = {
  context: (id) => `/ai/control-plane/context/${id}`,
  provider: (id) => `/ai/control-plane/provider/${id}`,
  prompt: (id) => `/ai/control-plane/prompt/${id}`,
};

export function listControlPlane<T>(kind: Kind) {
  return get<T[]>(LIST_PATH[kind]);
}

export function saveControlPlane<T>(
  kind: WritableCpKind,
  data: Record<string, unknown>,
) {
  return post<T>(SAVE_PATH[kind], data);
}

export function deleteControlPlane(kind: WritableCpKind, id: number) {
  return del<void>(DELETE_PATH[kind](id));
}
