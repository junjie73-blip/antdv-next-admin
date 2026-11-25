/**
 * AI Control Plane 数据层：Provider / Prompt 模板 / Context 治理 / Trace。
 *
 * 设计口径与 ai.ts / security-advanced.ts 一致：defineCollection + 确定性种子，
 * 业务 id 为 number，_pk 交给 defineCollection 管理。
 * 密钥字段只存 `keyRef`（环境变量名或 KMS 引用）与 `keyTail`（末四位），不落明文。
 */
import { defineCollection, nextBizId } from './sqlite';

export interface CpProvider {
  id: number;
  name: string;
  protocol: 'dashscope' | 'http' | 'openai-compatible';
  endpoint: string;
  keyRef: string;
  keyTail: string;
  models: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface CpPrompt {
  id: number;
  route: string;
  name: string;
  system: string;
  variables: string[];
  enabled: boolean;
  version: number;
  updatedAt: string;
}

export interface CpContext {
  id: number;
  name: string;
  maxTokens: number;
  maxHistory: number;
  strategy: 'none' | 'drop-oldest' | 'summarize';
  maskPii: boolean;
  updatedAt: string;
}

export interface CpTrace {
  id: number;
  traceId: string;
  tool: string;
  route: string;
  args: string;
  result: 'success' | 'cancelled' | 'error';
  ms: number;
  tokens: number;
  createdAt: string;
}

const T = '2026-11-24 10:00:00';

const SEED_PROVIDERS: CpProvider[] = [
  {
    enabled: true,
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    id: 1,
    keyRef: 'DASHSCOPE_API_KEY',
    keyTail: '9x2k',
    models: ['qwen-plus', 'qwen-max'],
    name: '灵积（OpenAI 兼容）',
    protocol: 'openai-compatible',
    updatedAt: T,
  },
  {
    enabled: false,
    endpoint: 'http://localhost:11434/v1',
    id: 2,
    keyRef: 'OLLAMA_API_KEY',
    keyTail: 'none',
    models: ['qwen2.5:7b'],
    name: '本地 Ollama',
    protocol: 'http',
    updatedAt: T,
  },
];

const SEED_PROMPTS: CpPrompt[] = [
  {
    enabled: true,
    id: 1,
    name: '审批单 Copilot',
    route: '/approval/mine',
    system: '你在「我的审批」页面。实体：{{entity}}。选中行：{{selectedRows}}。筛选：{{filters}}。只使用页面声明的字段。',
    updatedAt: T,
    variables: ['entity', 'selectedRows', 'filters'],
    version: 1,
  },
  {
    enabled: true,
    id: 2,
    name: '全局默认',
    route: '*',
    system: '你是企业后台 Copilot。当前页面：{{route}}。回答要简洁，涉及写操作必须请求人工确认。',
    updatedAt: T,
    variables: ['route'],
    version: 1,
  },
];

const SEED_CONTEXTS: CpContext[] = [
  {
    id: 1,
    maskPii: true,
    maxHistory: 8,
    maxTokens: 4096,
    name: '默认治理策略',
    strategy: 'drop-oldest',
    updatedAt: T,
  },
];

const SEED_TRACES: CpTrace[] = [
  {
    args: '{"utterance":"有哪些待我审批的单据"}',
    createdAt: T,
    id: 1,
    ms: 128,
    result: 'success',
    route: '/approval/mine',
    tokens: 312,
    tool: 'search_table',
    traceId: 'tr_cp_demo_1',
  },
  {
    args: '{"title":"批量通过审批"}',
    createdAt: T,
    id: 2,
    ms: 12,
    result: 'cancelled',
    route: '/approval/mine',
    tokens: 86,
    tool: 'confirm_action',
    traceId: 'tr_cp_demo_2',
  },
];

export const CP_PROVIDER_DB = defineCollection<CpProvider>({
  seed: () => SEED_PROVIDERS.map((item) => ({ ...item, models: [...item.models] })),
  table: 'tb_ai_cp_provider',
});
export const CP_PROMPT_DB = defineCollection<CpPrompt>({
  seed: () => SEED_PROMPTS.map((item) => ({ ...item, variables: [...item.variables] })),
  table: 'tb_ai_cp_prompt',
});
export const CP_CONTEXT_DB = defineCollection<CpContext>({
  seed: () => SEED_CONTEXTS.map((item) => ({ ...item })),
  table: 'tb_ai_cp_context',
});
export const CP_TRACE_DB = defineCollection<CpTrace>({
  seed: () => SEED_TRACES.map((item) => ({ ...item })),
  table: 'tb_ai_cp_trace',
});

type Writable<T> = Omit<T, 'id' | 'updatedAt'> & { id?: number };

function tableOf(db: unknown[]): string {
  if (db === CP_PROVIDER_DB) return 'tb_ai_cp_provider';
  if (db === CP_PROMPT_DB) return 'tb_ai_cp_prompt';
  if (db === CP_CONTEXT_DB) return 'tb_ai_cp_context';
  return 'tb_ai_cp_trace';
}

function save<T extends { id: number; updatedAt: string }>(
  db: T[],
  input: Writable<T>,
  stamp: string,
): T {
  const id = input.id ?? nextBizId(tableOf(db));
  const index = db.findIndex((item) => item.id === id);
  const record = { ...input, id, updatedAt: stamp } as T;
  if (index === -1) db.unshift(record);
  else db[index] = record;
  return record;
}

export function saveProvider(input: Writable<CpProvider>): CpProvider {
  const keyRef = String(input.keyRef ?? '').trim();
  if (!keyRef) throw new Error('API Key 引用不能为空（只填环境变量名或 KMS key id）');
  return save(CP_PROVIDER_DB, input, new Date().toISOString());
}

export function savePrompt(input: Writable<CpPrompt>): CpPrompt {
  if (!String(input.system ?? '').trim()) throw new Error('System Prompt 不能为空');
  const current = input.id ? CP_PROMPT_DB.find((item) => item.id === input.id) : undefined;
  return save(
    CP_PROMPT_DB,
    { ...input, version: current ? current.version + 1 : 1 },
    new Date().toISOString(),
  );
}

export function saveContext(input: Writable<CpContext>): CpContext {
  if (!input.maxTokens || input.maxTokens < 256) throw new Error('Token 预算不能小于 256');
  return save(CP_CONTEXT_DB, input, new Date().toISOString());
}

export function addTrace(input: Omit<CpTrace, 'id'>): CpTrace {
  const record: CpTrace = { ...input, id: nextBizId('tb_ai_cp_trace') };
  CP_TRACE_DB.unshift(record);
  return record;
}

/** 按路由取模板：精确匹配优先，其次全局 */
export function resolvePrompt(route: string): CpPrompt | undefined {
  return (
    CP_PROMPT_DB.find((item) => item.enabled && item.route === route) ??
    CP_PROMPT_DB.find((item) => item.enabled && item.route === '*')
  );
}
