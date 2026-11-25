/**
 * AI 配置数据层 —— Agent / 模型供应商 / 模型列表 / 知识库 / 编排应用各自独立存储。
 *
 * 设计口径与 approval.ts 一致：
 * - 五张表由 defineCollection 声明，业务 id 为 number，_pk 交给 defineCollection 内部管理；
 * - 种子是手写的确定性数据（零 faker / Math.random / Date.now），只在库为空时写入一次；
 * - 所有字段白名单、关联补全与状态流转都收敛在这里，handler 只负责把失败结果转成 bizError。
 *
 * 安全口径（对齐《AI集成度现状评估与缺口分析》P0「密钥服务端托管、前端零接触」）：
 * - 本模块**从不保存明文 key**，只存 `keyMasked`（末 4 位掩码）与 `keyStatus`；
 * - `maskApiKey()` 幂等：已是掩码的字符串再次脱敏不会变样，便于编辑表单原值回填；
 * - 真实凭据应由宿主服务端托管，前端只拿到掩码串展示。
 *
 * 关联关系：model.providerId → provider.id（providerName 由 db 层回填，不信客户端传值）。
 */

import dayjs from 'dayjs';

import { defineCollection, nextBizId } from './sqlite';

/* -------------------------------------------------------------------------- */
/* 类型与常量                                                                   */
/* -------------------------------------------------------------------------- */

export type AiProviderProtocol = 'dashscope' | 'http' | 'openai-compatible';
export type AiKeyStatus = 'configured' | 'missing' | 'rotate';
export type AiProviderStatus = 'disabled' | 'enabled';
export type AiModelStatus = 'error' | 'offline' | 'online';
export type AiKnowledgeStatus = 'disabled' | 'enabled';
export type AiFlowStatus = 'draft' | 'published';
export type AiAgentStatus = 'disabled' | 'draft' | 'running';

export interface AiProviderRecord {
  code: string;
  description: string;
  endpoint: string;
  id: number;
  /** 脱敏串，如 sk-****9f2a；未配置时为 — */
  keyMasked: string;
  keyStatus: AiKeyStatus;
  name: string;
  protocol: AiProviderProtocol;
  status: AiProviderStatus;
  updatedAt: string;
}

export interface AiModelRecord {
  callsToday: number;
  code: string;
  context: string;
  id: number;
  name: string;
  /** 关联 provider.id；由 db 层校验存在性 */
  providerId: number;
  /** 关联 provider.name；写入时由 db 层回填 */
  providerName: string;
  protocol: AiProviderProtocol;
  status: AiModelStatus;
  updatedAt: string;
}

export interface AiKnowledgeRecord {
  chunks: number;
  code: string;
  docs: number;
  id: number;
  name: string;
  scope: string;
  status: AiKnowledgeStatus;
  /** 已向量化分片数 */
  vectors: number;
  vectorModel: string;
  updatedAt: string;
}

/**
 * Agent 自身配置：只存身份、职责、负责人、状态与标签。
 * 不存模型/供应商/知识库字段——那些分别由各自模块维护，避免两份真源。
 */
export interface AiAgentRecord {
  code: string;
  description: string;
  id: number;
  name: string;
  owner: string;
  status: AiAgentStatus;
  tags: string[];
  updatedAt: string;
}

/** 对应 AI 工作流编排应用的元数据（不含图定义本身，图在前端画布里） */
export interface AiFlowRecord {
  code: string;
  description: string;
  id: number;
  name: string;
  nodeCount: number;
  status: AiFlowStatus;
  updatedAt: string;
  version: number;
}

export const AI_PROTOCOL_LABELS: Record<AiProviderProtocol, string> = {
  dashscope: 'DashScope',
  http: 'HTTP',
  'openai-compatible': 'OpenAI 兼容',
};

export const AI_KEY_STATUS_LABELS: Record<AiKeyStatus, string> = {
  configured: '已配置',
  missing: '未配置',
  rotate: '待轮换',
};

/** 种子与统计用的固定业务日，保证零随机、可复现 */
export const AI_MOCK_TODAY = '2026-11-19';

function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

/* -------------------------------------------------------------------------- */
/* 结果封装：db 层明确返回成败，接口层统一转 success / bizError                   */
/* -------------------------------------------------------------------------- */

export interface DbResult<T> {
  code: number;
  data?: T;
  message: string;
  ok: boolean;
}

function ok<T>(data: T, message: string): DbResult<T> {
  return { code: 200, data, message, ok: true };
}

function fail<T>(code: number, message: string): DbResult<T> {
  return { code, message, ok: false };
}

/**
 * 明文 key → 末 4 位掩码。幂等，且永不落库明文。
 * 约定：空串 / '—' / '-' 视为未配置；短于 4 位的串整体打码。
 */
export function maskApiKey(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text || text === '—' || text === '-') return '';
  const tail = text.slice(-4);
  return `sk-****${tail}`;
}

/* -------------------------------------------------------------------------- */
/* 手写初始化数据（零随机）                                                     */
/* -------------------------------------------------------------------------- */

const PROVIDER_SEED: AiProviderRecord[] = [
  {
    code: 'V-01',
    description: '混元系列，OpenAI 兼容网关',
    endpoint: 'api.hunyuan.cloud/v1',
    id: 1,
    keyMasked: 'sk-****9f2a',
    keyStatus: 'configured',
    name: '腾讯云',
    protocol: 'openai-compatible',
    status: 'enabled',
    updatedAt: '2026-11-18 10:00:00',
  },
  {
    code: 'V-02',
    description: 'DeepSeek 开放平台',
    endpoint: 'api.deepseek.com/v1',
    id: 2,
    keyMasked: 'sk-****3c81',
    keyStatus: 'configured',
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    status: 'enabled',
    updatedAt: '2026-11-18 10:05:00',
  },
  {
    code: 'V-03',
    description: '阿里云百炼，DashScope 协议',
    endpoint: 'dashscope.aliyuncs.com',
    id: 3,
    keyMasked: 'sk-****b704',
    keyStatus: 'rotate',
    name: '阿里云',
    protocol: 'dashscope',
    status: 'enabled',
    updatedAt: '2026-11-17 16:30:00',
  },
  {
    code: 'V-04',
    description: '智谱 GLM 开放平台',
    endpoint: 'open.bigmodel.cn/api',
    id: 4,
    keyMasked: 'sk-****1d55',
    keyStatus: 'configured',
    name: '智谱',
    protocol: 'openai-compatible',
    status: 'enabled',
    updatedAt: '2026-11-16 09:12:00',
  },
  {
    code: 'V-05',
    description: '内网自建推理网关，无需外部密钥',
    endpoint: 'internal://llm-gateway',
    id: 5,
    keyMasked: '—',
    keyStatus: 'missing',
    name: '自建推理服务',
    protocol: 'http',
    status: 'disabled',
    updatedAt: '2026-11-15 14:00:00',
  },
  {
    code: 'V-06',
    description: '备用网关，密钥已过期待轮换',
    endpoint: 'gateway.internal/v1',
    id: 6,
    keyMasked: 'sk-****e0a3',
    keyStatus: 'rotate',
    name: '备用网关',
    protocol: 'openai-compatible',
    status: 'enabled',
    updatedAt: '2026-11-14 11:20:00',
  },
];

const MODEL_SEED: AiModelRecord[] = [
  {
    callsToday: 8620,
    code: 'hunyuan-pro',
    context: '128K',
    id: 1,
    name: 'hunyuan-pro',
    providerId: 1,
    providerName: '腾讯云',
    protocol: 'openai-compatible',
    status: 'online',
    updatedAt: '2026-11-19 09:10:00',
  },
  {
    callsToday: 5310,
    code: 'hunyuan-turbo',
    context: '64K',
    id: 2,
    name: 'hunyuan-turbo',
    providerId: 1,
    providerName: '腾讯云',
    protocol: 'openai-compatible',
    status: 'online',
    updatedAt: '2026-11-19 08:40:00',
  },
  {
    callsToday: 7140,
    code: 'deepseek-v3',
    context: '64K',
    id: 3,
    name: 'deepseek-v3',
    providerId: 2,
    providerName: 'DeepSeek',
    protocol: 'openai-compatible',
    status: 'online',
    updatedAt: '2026-11-19 09:02:00',
  },
  {
    callsToday: 3320,
    code: 'qwen-max',
    context: '32K',
    id: 4,
    name: 'qwen-max',
    providerId: 3,
    providerName: '阿里云',
    protocol: 'dashscope',
    status: 'online',
    updatedAt: '2026-11-18 17:20:00',
  },
  {
    callsToday: 1980,
    code: 'glm-4',
    context: '128K',
    id: 5,
    name: 'glm-4',
    providerId: 4,
    providerName: '智谱',
    protocol: 'openai-compatible',
    status: 'error',
    updatedAt: '2026-11-19 07:35:00',
  },
  {
    callsToday: 0,
    code: 'local-embedding',
    context: '8K',
    id: 6,
    name: 'local-embedding',
    providerId: 5,
    providerName: '自建推理服务',
    protocol: 'http',
    status: 'offline',
    updatedAt: '2026-11-15 14:10:00',
  },
];

const KNOWLEDGE_SEED: AiKnowledgeRecord[] = [
  {
    chunks: 3280,
    code: 'K-01',
    docs: 328,
    id: 1,
    name: '产品手册',
    scope: '全员',
    status: 'enabled',
    vectors: 320,
    vectorModel: 'bge-large-zh',
    updatedAt: '2026-11-19 08:00:00',
  },
  {
    chunks: 2410,
    code: 'K-02',
    docs: 241,
    id: 2,
    name: '研发规范',
    scope: '研发',
    status: 'enabled',
    vectors: 241,
    vectorModel: 'bge-large-zh',
    updatedAt: '2026-11-18 15:30:00',
  },
  {
    chunks: 5120,
    code: 'K-03',
    docs: 512,
    id: 3,
    name: '工单历史',
    scope: '客服',
    status: 'enabled',
    vectors: 498,
    vectorModel: 'text-embedding-3',
    updatedAt: '2026-11-18 11:00:00',
  },
  {
    chunks: 1630,
    code: 'K-04',
    docs: 163,
    id: 4,
    name: '接口文档',
    scope: '研发',
    status: 'enabled',
    vectors: 163,
    vectorModel: 'bge-large-zh',
    updatedAt: '2026-11-17 09:45:00',
  },
  {
    chunks: 420,
    code: 'K-05',
    docs: 42,
    id: 5,
    name: '归档资料',
    scope: '管理员',
    status: 'disabled',
    vectors: 0,
    vectorModel: '—',
    updatedAt: '2026-11-10 10:00:00',
  },
];

const FLOW_SEED: AiFlowRecord[] = [
  {
    code: 'F-01',
    description: '工单按紧急度分流，紧急单查订单后起草回复',
    id: 1,
    name: '客服工单分诊',
    nodeCount: 7,
    status: 'published',
    updatedAt: '2026-11-19 09:30:00',
    version: 3,
  },
  {
    code: 'F-02',
    description: '合同关键条款抽取与风险提示',
    id: 2,
    name: '合同审查助手',
    nodeCount: 5,
    status: 'draft',
    updatedAt: '2026-11-18 14:20:00',
    version: 1,
  },
  {
    code: 'F-03',
    description: '基于产品手册知识库的问答编排',
    id: 3,
    name: '产品知识问答',
    nodeCount: 4,
    status: 'published',
    updatedAt: '2026-11-17 16:40:00',
    version: 2,
  },
  {
    code: 'F-04',
    description: '日报自动汇总并推送到群机器人（草稿）',
    id: 4,
    name: '日报摘要推送',
    nodeCount: 6,
    status: 'draft',
    updatedAt: '2026-11-16 10:15:00',
    version: 1,
  },
];

const AGENT_SEED: AiAgentRecord[] = [
  {
    code: 'AG-01',
    description: '分析销售漏斗与商机转化，输出跟进建议。',
    id: 1,
    name: '销售洞察 Agent',
    owner: '销售运营',
    status: 'running',
    tags: ['分析', '销售'],
    updatedAt: '2026-11-19 10:20:00',
  },
  {
    code: 'AG-02',
    description: '识别工单意图与紧急度，生成标准回复草稿。',
    id: 2,
    name: '客服助手 Agent',
    owner: '客户成功',
    status: 'running',
    tags: ['客服', '分诊'],
    updatedAt: '2026-11-18 15:40:00',
  },
  {
    code: 'AG-03',
    description: '校验合同条款并标注风险点，结果需要人工复核。',
    id: 3,
    name: '合同审查 Agent',
    owner: '法务部',
    status: 'draft',
    tags: ['法务', '审阅'],
    updatedAt: '2026-11-17 11:05:00',
  },
  {
    code: 'AG-04',
    description: '汇总每日指标并推送到订阅群。',
    id: 4,
    name: '日报摘要 Agent',
    owner: '数据平台',
    status: 'draft',
    tags: ['报表', '推送'],
    updatedAt: '2026-11-16 09:12:00',
  },
  {
    code: 'AG-05',
    description: '面向新员工的制度问答，答案需标注出处。',
    id: 5,
    name: '制度问答 Agent',
    owner: '人力资源',
    status: 'disabled',
    tags: ['问答', '制度'],
    updatedAt: '2026-11-12 14:30:00',
  },
];

/* -------------------------------------------------------------------------- */
/* 集合声明必须在种子之后：defineCollection 会立刻调用 seed()，提前声明会踩 TDZ   */
/* -------------------------------------------------------------------------- */

export const AI_AGENT_DB: AiAgentRecord[] = defineCollection<AiAgentRecord>({
  seed: () => AGENT_SEED.map((item) => ({ ...item, tags: [...item.tags] })),
  table: 'tb_ai_agent',
});
export const AI_PROVIDER_DB: AiProviderRecord[] =
  defineCollection<AiProviderRecord>({
    seed: () => PROVIDER_SEED.map((item) => ({ ...item })),
    table: 'tb_ai_provider',
  });
export const AI_MODEL_DB: AiModelRecord[] = defineCollection<AiModelRecord>({
  seed: () => MODEL_SEED.map((item) => ({ ...item })),
  table: 'tb_ai_model',
});
export const AI_KNOWLEDGE_DB: AiKnowledgeRecord[] =
  defineCollection<AiKnowledgeRecord>({
    seed: () => KNOWLEDGE_SEED.map((item) => ({ ...item })),
    table: 'tb_ai_knowledge',
  });
export const AI_FLOW_DB: AiFlowRecord[] = defineCollection<AiFlowRecord>({
  seed: () => FLOW_SEED.map((item) => ({ ...item })),
  table: 'tb_ai_flow',
});

/* -------------------------------------------------------------------------- */
/* 查询 / 统计                                                                 */
/* -------------------------------------------------------------------------- */

export function findProvider(id: number): AiProviderRecord | undefined {
  return AI_PROVIDER_DB.find((item) => item.id === id);
}

export function findModel(id: number): AiModelRecord | undefined {
  return AI_MODEL_DB.find((item) => item.id === id);
}

export function findKnowledge(id: number): AiKnowledgeRecord | undefined {
  return AI_KNOWLEDGE_DB.find((item) => item.id === id);
}

export function findFlow(id: number): AiFlowRecord | undefined {
  return AI_FLOW_DB.find((item) => item.id === id);
}

export function findAgent(id: number): AiAgentRecord | undefined {
  return AI_AGENT_DB.find((item) => item.id === id);
}

/**
 * 关联查询：模型列表带上 providerName。
 * 以 provider 表为准回填，避免历史脏数据里模型带的旧名字以假乱真。
 */
export function listModelsWithProvider(): AiModelRecord[] {
  return AI_MODEL_DB.map((model) => ({
    ...model,
    providerName: findProvider(model.providerId)?.name ?? model.providerName,
  }));
}

export interface ProviderStats {
  total: number;
  enabled: number;
  disabled: number;
  keyConfigured: number;
  keyRotate: number;
  keyMissing: number;
}

export function summarizeProviders(): ProviderStats {
  const rows = AI_PROVIDER_DB;
  return {
    disabled: rows.filter((row) => row.status === 'disabled').length,
    enabled: rows.filter((row) => row.status === 'enabled').length,
    keyConfigured: rows.filter((row) => row.keyStatus === 'configured').length,
    keyMissing: rows.filter((row) => row.keyStatus === 'missing').length,
    keyRotate: rows.filter((row) => row.keyStatus === 'rotate').length,
    total: rows.length,
  };
}

export interface ModelStats {
  total: number;
  online: number;
  offline: number;
  error: number;
  callsToday: number;
}

export function summarizeModels(): ModelStats {
  const rows = AI_MODEL_DB;
  return {
    callsToday: rows.reduce((sum, row) => sum + Number(row.callsToday || 0), 0),
    error: rows.filter((row) => row.status === 'error').length,
    offline: rows.filter((row) => row.status === 'offline').length,
    online: rows.filter((row) => row.status === 'online').length,
    total: rows.length,
  };
}

export interface KnowledgeStats {
  total: number;
  enabled: number;
  disabled: number;
  docs: number;
  chunks: number;
  vectors: number;
  pending: number;
}

export function summarizeKnowledge(): KnowledgeStats {
  const rows = AI_KNOWLEDGE_DB;
  const docs = rows.reduce((sum, row) => sum + Number(row.docs || 0), 0);
  const vectors = rows.reduce((sum, row) => sum + Number(row.vectors || 0), 0);
  return {
    chunks: rows.reduce((sum, row) => sum + Number(row.chunks || 0), 0),
    disabled: rows.filter((row) => row.status === 'disabled').length,
    docs,
    enabled: rows.filter((row) => row.status === 'enabled').length,
    pending: Math.max(docs - vectors, 0),
    total: rows.length,
    vectors,
  };
}

export interface FlowStats {
  total: number;
  draft: number;
  published: number;
  nodeCount: number;
}

export function summarizeFlows(): FlowStats {
  const rows = AI_FLOW_DB;
  return {
    draft: rows.filter((row) => row.status === 'draft').length,
    nodeCount: rows.reduce((sum, row) => sum + Number(row.nodeCount || 0), 0),
    published: rows.filter((row) => row.status === 'published').length,
    total: rows.length,
  };
}

/** 总览：四个页面共用一个接口拿 stats，字段扁平便于各页各取所需 */
export interface AiOverview {
  agentDraft: number;
  agentRunning: number;
  agentTotal: number;
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

export function summarizeAiOverview(): AiOverview {
  const provider = summarizeProviders();
  const model = summarizeModels();
  const knowledge = summarizeKnowledge();
  const flow = summarizeFlows();
  return {
    agentDraft: AI_AGENT_DB.filter((row) => row.status === 'draft').length,
    agentRunning: AI_AGENT_DB.filter((row) => row.status === 'running').length,
    agentTotal: AI_AGENT_DB.length,
    flowDraft: flow.draft,
    flowNodeCount: flow.nodeCount,
    flowPublished: flow.published,
    flowTotal: flow.total,
    keyMissing: provider.keyMissing,
    keyRotate: provider.keyRotate,
    knowledgeDocs: knowledge.docs,
    knowledgePending: knowledge.pending,
    knowledgeTotal: knowledge.total,
    knowledgeVectors: knowledge.vectors,
    modelCallsToday: model.callsToday,
    modelError: model.error,
    modelOnline: model.online,
    modelTotal: model.total,
    providerEnabled: provider.enabled,
    providerTotal: provider.total,
  };
}

/* -------------------------------------------------------------------------- */
/* 供应商：字段白名单 + 写入时脱敏                                               */
/* -------------------------------------------------------------------------- */

const PROVIDER_PROTOCOLS = new Set<AiProviderProtocol>([
  'dashscope',
  'http',
  'openai-compatible',
]);

function pickProviderFields(
  data: Record<string, unknown>,
): Partial<AiProviderRecord> {
  const picked: Partial<AiProviderRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.protocol !== undefined)
    picked.protocol = String(data.protocol).trim() as AiProviderProtocol;
  if (data.endpoint !== undefined)
    picked.endpoint = String(data.endpoint).trim();
  if (data.description !== undefined)
    picked.description = String(data.description);
  if (data.status !== undefined)
    picked.status = String(data.status).trim() as AiProviderStatus;
  if (data.keyStatus !== undefined)
    picked.keyStatus = String(data.keyStatus).trim() as AiKeyStatus;
  return picked;
}

function validProvider(row: AiProviderRecord): string {
  if (!row.name) return '请输入供应商名称';
  if (!row.endpoint) return '请输入 API Endpoint';
  if (!PROVIDER_PROTOCOLS.has(row.protocol))
    return '调用协议不合法（openai-compatible / dashscope / http）';
  if (row.status !== 'enabled' && row.status !== 'disabled')
    return '供应商状态不合法';
  if (!['configured', 'missing', 'rotate'].includes(row.keyStatus))
    return '密钥状态不合法';
  return '';
}

/** 把入参里的 key 转成掩码：明文只在这一行内存里出现，绝不写进 db */
function applyApiKey(
  target: AiProviderRecord,
  data: Record<string, unknown>,
  editing: boolean,
): void {
  if (data.key === undefined) {
    if (!editing) {
      target.keyMasked = '—';
      target.keyStatus = 'missing';
    }
    return;
  }
  const masked = maskApiKey(data.key);
  if (!masked) {
    target.keyMasked = '—';
    target.keyStatus = 'missing';
    return;
  }
  target.keyMasked = masked;
  target.keyStatus = 'configured';
}

export function saveProvider(
  data: Record<string, unknown>,
): DbResult<AiProviderRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的供应商ID');
    const index = AI_PROVIDER_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '供应商不存在或已被删除');
    const merged: AiProviderRecord = {
      ...AI_PROVIDER_DB[index]!,
      ...pickProviderFields(data),
      updatedAt: now(),
    };
    applyApiKey(merged, data, true);
    const invalid = validProvider(merged);
    if (invalid) return fail(400, invalid);
    AI_PROVIDER_DB[index] = merged;
    return ok(merged, '供应商已保存');
  }

  const nextId = nextBizId('tb_ai_provider');
  const created: AiProviderRecord = {
    code: `V-${String(nextId).padStart(2, '0')}`,
    description: '',
    endpoint: '',
    id: nextId,
    keyMasked: '—',
    keyStatus: 'missing',
    name: '',
    protocol: 'openai-compatible',
    status: 'enabled',
    updatedAt: now(),
    ...pickProviderFields(data),
  };
  applyApiKey(created, data, false);
  const invalid = validProvider(created);
  if (invalid) return fail(400, invalid);
  AI_PROVIDER_DB.push(created);
  return ok(created, '供应商已创建');
}

export function deleteProvider(id: number): DbResult<{ id: number }> {
  const index = AI_PROVIDER_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '供应商不存在或已被删除');
  AI_PROVIDER_DB.splice(index, 1);
  return ok({ id }, '供应商已删除');
}

/* -------------------------------------------------------------------------- */
/* 模型：providerId 必须指向存在的供应商，providerName 由 db 回填                  */
/* -------------------------------------------------------------------------- */

function pickModelFields(
  data: Record<string, unknown>,
): Partial<AiModelRecord> {
  const picked: Partial<AiModelRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.providerId !== undefined)
    picked.providerId = Number(data.providerId);
  if (data.protocol !== undefined)
    picked.protocol = String(data.protocol).trim() as AiProviderProtocol;
  if (data.context !== undefined) picked.context = String(data.context).trim();
  if (data.callsToday !== undefined)
    picked.callsToday = Number(data.callsToday) || 0;
  if (data.status !== undefined)
    picked.status = String(data.status).trim() as AiModelStatus;
  return picked;
}

function validModel(row: AiModelRecord): string {
  if (!row.name) return '请输入模型名称';
  if (!row.code) return '请输入模型编码';
  if (!Number.isFinite(row.providerId) || !findProvider(row.providerId))
    return '关联的供应商不存在';
  if (!PROVIDER_PROTOCOLS.has(row.protocol)) return '调用协议不合法';
  if (!['error', 'offline', 'online'].includes(row.status))
    return '模型状态不合法';
  return '';
}

/** providerId 合法性 + providerName 回填，写入前统一走这里 */
function resolveModelProvider(row: AiModelRecord): string {
  const provider = findProvider(row.providerId);
  if (!provider) return '关联的供应商不存在';
  row.providerName = provider.name;
  // 协议缺省跟随供应商，避免前端漏填时模型与供应商协议打架
  if (!PROVIDER_PROTOCOLS.has(row.protocol)) row.protocol = provider.protocol;
  return '';
}

export function saveModel(
  data: Record<string, unknown>,
): DbResult<AiModelRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的模型ID');
    const index = AI_MODEL_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '模型不存在或已被删除');
    const merged: AiModelRecord = {
      ...AI_MODEL_DB[index]!,
      ...pickModelFields(data),
      updatedAt: now(),
    };
    const linkError = resolveModelProvider(merged);
    if (linkError) return fail(400, linkError);
    const invalid = validModel(merged);
    if (invalid) return fail(400, invalid);
    AI_MODEL_DB[index] = merged;
    return ok(merged, '模型已保存');
  }

  const nextId = nextBizId('tb_ai_model');
  const created: AiModelRecord = {
    callsToday: 0,
    code: '',
    context: '',
    id: nextId,
    name: '',
    providerId: 0,
    providerName: '',
    protocol: 'openai-compatible',
    status: 'online',
    updatedAt: now(),
    ...pickModelFields(data),
  };
  const linkError = resolveModelProvider(created);
  if (linkError) return fail(400, linkError);
  const invalid = validModel(created);
  if (invalid) return fail(400, invalid);
  AI_MODEL_DB.push(created);
  return ok(created, '模型已创建');
}

export function deleteModel(id: number): DbResult<{ id: number }> {
  const index = AI_MODEL_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '模型不存在或已被删除');
  AI_MODEL_DB.splice(index, 1);
  return ok({ id }, '模型已删除');
}

/* -------------------------------------------------------------------------- */
/* 知识库：CRUD                                                                 */
/* -------------------------------------------------------------------------- */

function pickKnowledgeFields(
  data: Record<string, unknown>,
): Partial<AiKnowledgeRecord> {
  const picked: Partial<AiKnowledgeRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.docs !== undefined) picked.docs = Number(data.docs) || 0;
  if (data.vectorModel !== undefined)
    picked.vectorModel = String(data.vectorModel).trim();
  if (data.scope !== undefined) picked.scope = String(data.scope).trim();
  if (data.chunks !== undefined) picked.chunks = Number(data.chunks) || 0;
  if (data.vectors !== undefined) picked.vectors = Number(data.vectors) || 0;
  if (data.status !== undefined)
    picked.status = String(data.status).trim() as AiKnowledgeStatus;
  return picked;
}

function validKnowledge(row: AiKnowledgeRecord): string {
  if (!row.name) return '请输入知识库名称';
  if (!row.scope) return '请输入可见范围';
  if (row.status !== 'enabled' && row.status !== 'disabled')
    return '知识库状态不合法';
  return '';
}

export function saveKnowledge(
  data: Record<string, unknown>,
): DbResult<AiKnowledgeRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的知识库ID');
    const index = AI_KNOWLEDGE_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '知识库不存在或已被删除');
    const merged: AiKnowledgeRecord = {
      ...AI_KNOWLEDGE_DB[index]!,
      ...pickKnowledgeFields(data),
      updatedAt: now(),
    };
    const invalid = validKnowledge(merged);
    if (invalid) return fail(400, invalid);
    AI_KNOWLEDGE_DB[index] = merged;
    return ok(merged, '知识库已保存');
  }

  const nextId = nextBizId('tb_ai_knowledge');
  const created: AiKnowledgeRecord = {
    chunks: 0,
    code: `K-${String(nextId).padStart(2, '0')}`,
    docs: 0,
    id: nextId,
    name: '',
    scope: '全员',
    status: 'enabled',
    vectors: 0,
    vectorModel: '—',
    updatedAt: now(),
    ...pickKnowledgeFields(data),
  };
  const invalid = validKnowledge(created);
  if (invalid) return fail(400, invalid);
  AI_KNOWLEDGE_DB.push(created);
  return ok(created, '知识库已创建');
}

export function deleteKnowledge(id: number): DbResult<{ id: number }> {
  const index = AI_KNOWLEDGE_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '知识库不存在或已被删除');
  AI_KNOWLEDGE_DB.splice(index, 1);
  return ok({ id }, '知识库已删除');
}

/* -------------------------------------------------------------------------- */
/* 编排应用元数据：CRUD                                                         */
/* -------------------------------------------------------------------------- */

function pickFlowFields(data: Record<string, unknown>): Partial<AiFlowRecord> {
  const picked: Partial<AiFlowRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.description !== undefined)
    picked.description = String(data.description);
  if (data.nodeCount !== undefined)
    picked.nodeCount = Number(data.nodeCount) || 0;
  if (data.version !== undefined) picked.version = Number(data.version) || 1;
  if (data.status !== undefined)
    picked.status = String(data.status).trim() as AiFlowStatus;
  return picked;
}

function validFlow(row: AiFlowRecord): string {
  if (!row.name) return '请输入编排名称';
  if (row.status !== 'draft' && row.status !== 'published')
    return '编排状态不合法';
  return '';
}

export function saveFlow(
  data: Record<string, unknown>,
): DbResult<AiFlowRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的编排ID');
    const index = AI_FLOW_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '编排不存在或已被删除');
    const merged: AiFlowRecord = {
      ...AI_FLOW_DB[index]!,
      ...pickFlowFields(data),
      updatedAt: now(),
    };
    const invalid = validFlow(merged);
    if (invalid) return fail(400, invalid);
    AI_FLOW_DB[index] = merged;
    return ok(merged, '编排已保存');
  }

  const nextId = nextBizId('tb_ai_flow');
  const created: AiFlowRecord = {
    code: `F-${String(nextId).padStart(2, '0')}`,
    description: '',
    id: nextId,
    name: '',
    nodeCount: 0,
    status: 'draft',
    updatedAt: now(),
    version: 1,
    ...pickFlowFields(data),
  };
  const invalid = validFlow(created);
  if (invalid) return fail(400, invalid);
  AI_FLOW_DB.push(created);
  return ok(created, '编排已创建');
}

export function deleteFlow(id: number): DbResult<{ id: number }> {
  const index = AI_FLOW_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '编排不存在或已被删除');
  AI_FLOW_DB.splice(index, 1);
  return ok({ id }, '编排已删除');
}

/* -------------------------------------------------------------------------- */
/* Agent：仅 Agent 自身字段的 CRUD                                             */
/* -------------------------------------------------------------------------- */

/**
 * 标签曾经可能被前端 VNode / JSON 串污染（详情里出现 `__v_isVNode` 大段对象）。
 * 这里统一抽文本：字符串按逗号拆分，VNode / 普通对象只取可展示字段，不回吐 JSON。
 */
function tagText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return tagText(JSON.parse(trimmed) as unknown);
      } catch {
        // 非法 JSON 按普通文本处理
      }
    }
    return trimmed;
  }
  if (typeof value === 'number') return String(value).trim();
  if (Array.isArray(value))
    return value
      .map((item) => tagText(item))
      .filter(Boolean)
      .join('、');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const children = obj.children;
    if (typeof children === 'string' || typeof children === 'number')
      return String(children).trim();
    if (Array.isArray(children)) return tagText(children);
    for (const key of ['label', 'title', 'name', 'text', 'content'] as const) {
      const text = tagText(obj[key]);
      if (text) return text;
    }
  }
  return '';
}

export function normalizeAgentTags(input: unknown): string[] {
  let source = input;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        source = JSON.parse(trimmed) as unknown;
      } catch {
        // 不是合法 JSON 就按普通逗号串处理
      }
    }
  }
  const list = Array.isArray(source)
    ? source
    : String(source ?? '').split(/[,，、]/);
  return list
    .map((item) => tagText(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickAgentFields(
  data: Record<string, unknown>,
): Partial<AiAgentRecord> {
  const picked: Partial<AiAgentRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.description !== undefined)
    picked.description = String(data.description).trim();
  if (data.owner !== undefined) picked.owner = String(data.owner).trim();
  if (data.status !== undefined)
    picked.status = String(data.status).trim() as AiAgentStatus;
  if (data.tags !== undefined) picked.tags = normalizeAgentTags(data.tags);
  return picked;
}

function validAgent(row: AiAgentRecord): string {
  if (!row.name) return '请输入 Agent 名称';
  if (!row.owner) return '请输入负责人';
  if (!['disabled', 'draft', 'running'].includes(row.status))
    return 'Agent 状态不合法';
  return '';
}

export function saveAgent(
  data: Record<string, unknown>,
): DbResult<AiAgentRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的 Agent ID');
    const index = AI_AGENT_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, 'Agent 不存在或已被删除');
    const merged: AiAgentRecord = {
      ...AI_AGENT_DB[index]!,
      ...pickAgentFields(data),
      updatedAt: now(),
    };
    const invalid = validAgent(merged);
    if (invalid) return fail(400, invalid);
    AI_AGENT_DB[index] = merged;
    return ok(merged, 'Agent 已保存');
  }

  const nextId = nextBizId('tb_ai_agent');
  const created: AiAgentRecord = {
    code: `AG-${String(nextId).padStart(2, '0')}`,
    description: '',
    id: nextId,
    name: '',
    owner: '',
    status: 'draft',
    tags: [],
    updatedAt: now(),
    ...pickAgentFields(data),
  };
  const invalid = validAgent(created);
  if (invalid) return fail(400, invalid);
  AI_AGENT_DB.push(created);
  return ok(created, 'Agent 已创建');
}

export function deleteAgent(id: number): DbResult<{ id: number }> {
  const index = AI_AGENT_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, 'Agent 不存在或已被删除');
  AI_AGENT_DB.splice(index, 1);
  return ok({ id }, 'Agent 已删除');
}
