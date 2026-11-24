import { del, get, post } from './request';

/**
 * AI 开发接口层（对应 backend-mock 的 `server/api/ai/**`）。
 *
 * 四页（供应商 / 模型 / 知识库 / 编排）共用一份 SQLite 数据， CRUD 与统计都在后端完成；
 * 前端只发请求与 reload，不在本地改数字或状态。
 *
 * 安全口径：供应商的 key 字段只有脱敏串（keyMasked）会回传到前端，
 * 明文 key 即便从表单传入，也在服务端立即被脱敏，绝不落库、绝不回包。
 */

export type AiProviderProtocol = 'dashscope' | 'http' | 'openai-compatible';
export type AiKeyStatus = 'configured' | 'missing' | 'rotate';
export type AiProviderStatus = 'disabled' | 'enabled';
export type AiModelStatus = 'error' | 'offline' | 'online';
export type AiKnowledgeStatus = 'disabled' | 'enabled';
export type AiFlowStatus = 'draft' | 'published';

export interface AiProvider {
  code: string;
  description: string;
  endpoint: string;
  id: number;
  /** 脱敏串，如 sk-****9f2a */
  keyMasked: string;
  keyStatus: AiKeyStatus;
  name: string;
  protocol: AiProviderProtocol;
  status: AiProviderStatus;
  updatedAt: string;
}

export interface AiModel {
  callsToday: number;
  code: string;
  context: string;
  id: number;
  name: string;
  providerId: number;
  /** 由后端按 providerId 关联回填 */
  providerName: string;
  protocol: AiProviderProtocol;
  status: AiModelStatus;
  updatedAt: string;
}

export interface AiKnowledge {
  chunks: number;
  code: string;
  docs: number;
  id: number;
  name: string;
  scope: string;
  status: AiKnowledgeStatus;
  vectors: number;
  vectorModel: string;
  updatedAt: string;
}

export interface AiFlow {
  code: string;
  description: string;
  id: number;
  name: string;
  nodeCount: number;
  status: AiFlowStatus;
  updatedAt: string;
  version: number;
}

/** 四页共用的总览统计（/ai/overview） */
export interface AiOverview {
  flowDraft: number;
  flowNodeCount: number;
  flowPublished: number;
  flowTotal: number;
  keyMissing: number;
  keyRotate: number;
  knowledgeDocs: number;
  knowledgePending: number;
  knowledgeTotal: number;
  knowledgeVectors: number;
  modelCallsToday: number;
  modelError: number;
  modelOnline: number;
  modelTotal: number;
  providerEnabled: number;
  providerTotal: number;
}

type ListResult<T> = {
  list: T[];
  total: number;
};
type Params = Record<string, unknown>;

/* ------------------------------ 总览统计 ------------------------------ */

export function getAiOverview() {
  return get<AiOverview>('/ai/overview');
}

/* ------------------------------ 模型供应商 ------------------------------ */

export function getAiProviderList(params?: Params) {
  return get<ListResult<AiProvider>>('/ai/provider/list', params);
}
export function saveAiProvider(data: Params) {
  return post<AiProvider>('/ai/provider/save', data);
}
export function deleteAiProvider(id: number) {
  return del<null>(`/ai/provider/${id}`);
}

/* ------------------------------ 模型列表 ------------------------------ */

export function getAiModelList(params?: Params) {
  return get<ListResult<AiModel>>('/ai/model/list', params);
}
export function saveAiModel(data: Params) {
  return post<AiModel>('/ai/model/save', data);
}
export function deleteAiModel(id: number) {
  return del<null>(`/ai/model/${id}`);
}

/* ------------------------------ 知识库 ------------------------------ */

export function getAiKnowledgeList(params?: Params) {
  return get<ListResult<AiKnowledge>>('/ai/knowledge/list', params);
}
export function saveAiKnowledge(data: Params) {
  return post<AiKnowledge>('/ai/knowledge/save', data);
}
export function deleteAiKnowledge(id: number) {
  return del<null>(`/ai/knowledge/${id}`);
}

/* ------------------------------ 工作流编排元数据 ------------------------------ */

export function getAiFlowList(params?: Params) {
  return get<ListResult<AiFlow>>('/ai/flow/list', params);
}
export function saveAiFlow(data: Params) {
  return post<AiFlow>('/ai/flow/save', data);
}
export function deleteAiFlow(id: number) {
  return del<null>(`/ai/flow/${id}`);
}
