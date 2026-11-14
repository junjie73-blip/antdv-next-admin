import type {
  AiProvider,
  AiRequest,
  AiResult,
  AiStreamChunk,
  AiToolCall,
  AiUsage,
  ToolSchema,
} from './types';

import { AiFlowError, errorText } from './errors';

/**
 * Provider 层：把「调用大模型」这件事收敛成两个契约实现。
 *
 * 分层位置：`core/provider.ts`，纯 TS。
 *
 * 两条硬边界（都是仓库规矩，不是偏好）：
 * 1. **本包不发真实网络请求，也不认任何具体供应商 SDK** —— 唯一的出口是宿主注进来的
 *    `fetcher`，没注就抛可诊断错误而不是静默返回空文本；
 * 2. **没有密钥**：`baseUrl` 与 `headers`（含 `Authorization`）全部来自 `configureAiFlow()`，
 *    本文件里既不读 `import.meta.env`，也不出现任何形如令牌的常量。
 *
 * `stream` 只暴露 AsyncIterable 抽象：SSE / websocket / 宿主自定义通道都由实现方决定，
 * 包内不建立任何传输连接，连接一律由宿主注进来的 Provider 实现持有。
 */

/* --------------------------- 测试与演示用的脚本 Provider --------------------------- */

export interface ScriptedResponse {
  /** 命中条件：请求文本里包含这段（等价于「按 prompt 里的标记取回复」） */
  contains?: string;
  /** 前 N 次命中时直接抛错，用来测节点级重试与指数退避 */
  fail?: number;
  finishReason?: string;
  /** 命中条件：请求来自哪个节点 id。与 `contains` 同时命中时最优先；只有它命中时是最宽的兜底（见 `pick`） */
  id?: string;
  text: string;
  usage?: AiUsage;
}

export interface ScriptedProviderOptions {
  chunkSize?: number;
  /** 没命中任何条目时用它；不配则回落到 responses[0] */
  fallback?: ScriptedResponse;
  onInvoke?: (request: AiRequest, matched: ScriptedResponse) => void;
  responses: ScriptedResponse[];
}

export interface ScriptedProvider extends AiProvider {
  /** 全部调用（含失败的那些）按序留在里面，单测直接断言调用序列 */
  calls: AiRequest[];
  reset: () => void;
}

function requestText(request: AiRequest): string {
  return request.messages
    .map((message) => `${message.role}:${message.content}`)
    .join('\n');
}

/**
 * 按脚本返回预置文本的 Provider。
 *
 * 存在的理由：**测试与示例页不许联网**。它同时是 `src/presets` 的数据源，
 * 所以宿主写第一个真实 Provider 之前，就能把整条画布跑通、把运行面板演完。
 */
export function createScriptedProvider(
  options: ScriptedProviderOptions,
): ScriptedProvider {
  const calls: AiRequest[] = [];
  const countdown = new Map<ScriptedResponse, number>();
  const chunkSize = Math.max(1, Math.trunc(options.chunkSize ?? 4));

  /**
   * 匹配顺序是「越具体越优先」。四条规则各占一个象限，谁也不越界：
   *
   * 1. `id` 与 `contains` 都命中 —— 既指定了节点又指定了输入，最具体（同节点内按输入分流）；
   * 2. 只写了 `contains` 且文本命中 —— 跨节点的按输入分流；
   * 3. 只写了 `id` 且节点命中 —— 这个节点的默认回复；
   * 4. `fallback`；5. 第一条。
   *
   * 原来 3 排在 1、2 前面，于是「给 classify 配一条默认回复」会把按「退款」「物流」分流的两条
   * 一起吃掉：示例页画的条件分支永远只走一条，画布与运行面板上的分支演示全是假的。
   *
   * 反过来也不行：**带了 `contains` 的条目不许只靠 id 命中**。它写的是一段条件，
   * 条件没满足就不能代表这个节点 —— 否则同一个节点的第一条分流规则会顺手当上默认回复，
   * 而那句默认回复本来配在第三条。带 id 又不带 contains 的那一条才是默认回复，
   * 与规则 2「不带 id 的 contains 才是跨节点规则」正好对称。
   */
  function pick(request: AiRequest): ScriptedResponse {
    const text = requestText(request);
    const idHit = (item: ScriptedResponse) =>
      Boolean(item.id && item.id === request.nodeId);
    const textHit = (item: ScriptedResponse) =>
      Boolean(item.contains && text.includes(item.contains));
    const matched =
      options.responses.find((item) => idHit(item) && textHit(item)) ??
      options.responses.find((item) => !item.id && textHit(item)) ??
      options.responses.find((item) => idHit(item) && !item.contains) ??
      options.fallback ??
      options.responses[0];
    // 一条都没配上（配置写空了 / 只有别的节点的 id）：立刻说清楚，别把 undefined 当成回复发下去
    if (!matched) {
      throw new AiFlowError(
        `scripted provider 没有匹配到预置回复（nodeId=${request.nodeId ?? '未知'}）；` +
          `已配置 ${options.responses.length} 条`,
        'scripted-no-response',
        { nodeId: request.nodeId },
      );
    }
    return matched;
  }

  /** 失败注入按「剩余次数」递减，所以同一个节点重试两次后才成功，序列可数 */
  function consume(request: AiRequest): ScriptedResponse {
    calls.push(request);
    const matched = pick(request);
    const left = matched.fail ?? 0;
    const remaining = countdown.get(matched) ?? left;
    if (remaining > 0) {
      countdown.set(matched, remaining - 1);
      throw new Error(
        `scripted provider 注入的失败（还剩 ${remaining - 1} 次）`,
      );
    }
    countdown.set(matched, 0);
    options.onInvoke?.(request, matched);
    return matched;
  }

  const provider: ScriptedProvider = {
    calls,
    invoke: (request) => {
      const matched = consume(request);
      return {
        finishReason: matched.finishReason ?? 'stop',
        text: matched.text,
        usage: matched.usage ?? usageOf(matched.text, request),
      };
    },
    reset: () => {
      calls.length = 0;
      countdown.clear();
    },
    async *stream(request: AiRequest): AsyncIterable<AiStreamChunk> {
      const matched = consume(request);
      for (let index = 0; index < matched.text.length; index += chunkSize) {
        yield { delta: matched.text.slice(index, index + chunkSize) };
      }
      yield {
        delta: '',
        finishReason: matched.finishReason ?? 'stop',
        usage: matched.usage ?? usageOf(matched.text, request),
      };
    },
  };
  return provider;
}

/** 脚本回复没有显式 usage 时给一个可断言的确定值：按字符数换算，绝不返回 undefined */
function usageOf(text: string, request: AiRequest): AiUsage {
  const prompt = Math.ceil(requestText(request).length / 4);
  const completion = Math.ceil(text.length / 4);
  return { completion, prompt, total: prompt + completion };
}

/* ------------------------------ OpenAI 兼容 Provider ------------------------------ */

/** 注入进来的 fetch：签名刻意比原生 fetch 窄，宿主可以用 axios/request 包一层满足它 */
export interface AiFetchInit {
  body: string;
  headers: Record<string, string>;
  method: 'POST';
  signal?: AbortSignal;
}

export interface AiFetchResponse {
  headers?: { get?: (name: string) => null | string };
  json: () => Promise<unknown>;
  ok?: boolean;
  status?: number;
  stream?: () => AsyncIterable<string>;
  text?: () => Promise<string>;
}

export type AiFetcher = (
  url: string,
  init: AiFetchInit,
) => Promise<AiFetchResponse>;

export interface OpenAiCompatibleOptions {
  /** 形如 `https://宿主网关/v1`；没有任何默认值 —— 默认端点等于把流量发给某个猜出来的第三方 */
  baseUrl?: string;
  fetcher?: AiFetcher;
  headers?: (() => Record<string, string>) | Record<string, string>;
  /** 节点没写 model 时的兜底模型 */
  model?: string;
  /** 附加到请求体根上的供应商私有字段 */
  extraBody?: Record<string, unknown>;
}

export interface ChatRequestEnvelope {
  body: Record<string, unknown>;
  path: string;
}

function toProviderMessage(
  message: AiRequest['messages'][number],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    content: message.content,
    role: message.role,
  };
  if (message.toolCallId) payload.tool_call_id = message.toolCallId;
  if (message.name) payload.name = message.name;
  return payload;
}

/**
 * `AiRequest` → OpenAI 兼容的 `/chat/completions` 请求体。
 *
 * 写成纯函数的理由：联网不可测，但「我们准备发出去的东西长什么样」必须可测 ——
 * 字段名拼错、`max_tokens` 忘传这类问题在这里断言，比在集成环境里看 400 便宜得多。
 */
export function toChatRequest(
  request: AiRequest,
  defaults: { model?: string } = {},
): ChatRequestEnvelope {
  const model = request.model ?? defaults.model;
  if (!model) {
    throw new AiFlowError(
      '请求没有指定 model，Provider 也没有默认模型：给节点配 model，或在 configureAiFlow({ models }) 里配默认值',
      'provider-model-missing',
      { nodeId: request.nodeId },
    );
  }
  const body: Record<string, unknown> = {
    messages: request.messages.map(toProviderMessage),
    model,
    stream: request.stream ?? false,
  };
  if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.tools?.length) {
    body.tools = request.tools.map(toProviderToolSchema);
    body.tool_choice = request.toolChoice ?? 'auto';
  }
  if (request.extra) Object.assign(body, request.extra);
  return { body, path: '/chat/completions' };
}

/** 我们的 ToolSchema 已经是目标形状，这里只做一次显式展开，避免把内部字段名一起发出去 */
function toProviderToolSchema(schema: ToolSchema): Record<string, unknown> {
  return {
    function: {
      description: schema.function.description,
      name: schema.function.name,
      parameters: schema.function.parameters,
    },
    type: 'function',
  };
}

function toUsage(payload: unknown): AiUsage | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const raw = payload as Record<string, unknown>;
  const prompt = numberOr(raw.prompt_tokens ?? raw.input_tokens, 0);
  const completion = numberOr(raw.completion_tokens ?? raw.output_tokens, 0);
  const total = numberOr(raw.total_tokens, prompt + completion);
  return { completion, prompt, total };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 模型给的 arguments 是 JSON 字符串；坏 JSON 退化成 `{ raw }` 让工具自己报「缺参数」 */
function toToolCall(raw: unknown): AiToolCall | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const fn = (item.function ?? item) as Record<string, unknown>;
  const name = typeof fn.name === 'string' ? fn.name : '';
  if (!name) return undefined;
  const id = typeof item.id === 'string' ? item.id : name;
  const args = fn.arguments;
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      return {
        args:
          parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : { value: parsed },
        id,
        name,
      };
    } catch {
      return { args: { raw: args }, id, name };
    }
  }
  return { args: (args as Record<string, unknown>) ?? {}, id, name };
}

/** 响应 → `AiResult`。对缺字段宽容、对类型严格：拿不到 content 就当空串并保留 tool_calls */
export function fromChatResponse(payload: unknown): AiResult {
  if (!payload || typeof payload !== 'object') {
    throw new AiFlowError(
      `模型响应不是一个对象（收到 ${typeof payload}）：检查网关是否返回了 HTML 错误页`,
      'provider-response-invalid',
    );
  }
  const raw = payload as Record<string, unknown>;
  if (raw.error) {
    const detail = raw.error as Record<string, unknown>;
    throw new AiFlowError(
      `模型返回错误：${String(detail.message ?? errorText(raw.error))}`,
      'provider-response-error',
    );
  }
  const choices = Array.isArray(raw.choices) ? raw.choices : [];
  const first = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (first.message ?? {}) as Record<string, unknown>;
  const calls = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .map(toToolCall)
        .filter((item): item is AiToolCall => item !== undefined)
    : undefined;
  return {
    finishReason:
      typeof first.finish_reason === 'string' ? first.finish_reason : undefined,
    text: typeof message.content === 'string' ? message.content : '',
    toolCalls: calls?.length ? calls : undefined,
    usage: toUsage(raw.usage),
  };
}

/** 流式片段 → `AiStreamChunk`。`data: [DONE]` 由 `parseSseData` 挡掉，不会走到这里 */
export function fromChatStreamChunk(payload: unknown): AiStreamChunk {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const choices = Array.isArray(raw.choices) ? raw.choices : [];
  const first = (choices[0] ?? {}) as Record<string, unknown>;
  const delta = (first.delta ?? first.message ?? {}) as Record<string, unknown>;
  return {
    delta: typeof delta.content === 'string' ? delta.content : '',
    finishReason:
      typeof first.finish_reason === 'string' ? first.finish_reason : undefined,
    usage: toUsage(raw.usage),
  };
}

/** SSE 文本块里抠出所有 `data:` 负载并 JSON.parse，纯函数以便离线断言 */
export function parseSseData(chunk: string): unknown[] {
  const payloads: unknown[] = [];
  for (const line of (chunk ?? '').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice('data:'.length).trim();
    if (!data || data === '[DONE]') continue;
    try {
      payloads.push(JSON.parse(data));
    } catch {
      // 半包（网络分片切在 JSON 中间）在 SSE 里是常态，跳过而不是抛错；
      // 调用方按 `\n\n` 组帧后自然会补上完整的一条
    }
  }
  return payloads;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/u, '')}${path}`;
}

function headerOf(
  headers: OpenAiCompatibleOptions['headers'],
): Record<string, string> {
  const resolved = typeof headers === 'function' ? headers() : (headers ?? {});
  return { 'content-type': 'application/json', ...resolved };
}

/**
 * OpenAI 兼容（`/chat/completions`）Provider。
 *
 * 缺 `fetcher` 或 `baseUrl` 时**调用**才报错而不是构造时报错：宿主常常先
 * `configureAiFlow({})` 建好接线、等用户在设置页填完网关再注入，
 * 构造期就抛会让应用启动直接失败，而那时用户连错误提示在哪都看不到。
 */
export function createOpenAiCompatibleProvider(
  options: OpenAiCompatibleOptions = {},
): AiProvider {
  function requireTransport(): {
    fetcher: AiFetcher;
    url: (path: string) => string;
  } {
    if (!options.fetcher) {
      throw new AiFlowError(
        'OpenAI 兼容 Provider 没有可用的 fetcher：请在应用启动时 configureAiFlow({ fetcher }) 注入，' +
          '或改用 createScriptedProvider 跑离线演示。本包按仓库规矩不直接调用全局 fetch。',
        'provider-fetcher-missing',
      );
    }
    const baseUrl = options.baseUrl;
    if (!baseUrl) {
      throw new AiFlowError(
        'OpenAI 兼容 Provider 缺 baseUrl：它属于宿主网关配置，本包不内置任何默认端点。',
        'provider-base-url-missing',
      );
    }
    const fetcher = options.fetcher;
    return { fetcher, url: (path: string) => joinUrl(baseUrl, path) };
  }

  return {
    invoke: async (request) => {
      const { fetcher, url } = requireTransport();
      const { body, path } = toChatRequest(request, { model: options.model });
      let response: AiFetchResponse;
      try {
        response = await fetcher(url(path), {
          body: JSON.stringify(body),
          headers: headerOf(options.headers),
          method: 'POST',
          signal: request.signal,
        });
      } catch (error) {
        throw new AiFlowError(
          `模型请求发送失败：${errorText(error)}`,
          request.signal?.aborted
            ? 'provider-aborted'
            : 'provider-request-failed',
        );
      }
      if (response.ok === false) {
        const detail = response.text ? await response.text() : '';
        throw new AiFlowError(
          `模型网关返回 ${response.status ?? '未知状态'}：${detail.slice(0, 200) || '响应体为空'}`,
          'provider-http-error',
        );
      }
      return fromChatResponse(await response.json());
    },

    async *stream(request: AiRequest): AsyncIterable<AiStreamChunk> {
      const { fetcher, url } = requireTransport();
      const { body, path } = toChatRequest(
        { ...request, stream: true },
        { model: options.model },
      );
      const response = await fetcher(url(path), {
        body: JSON.stringify(body),
        headers: headerOf(options.headers),
        method: 'POST',
        signal: request.signal,
      });
      if (response.ok === false) {
        const detail = response.text ? await response.text() : '';
        throw new AiFlowError(
          `模型流式请求返回 ${response.status ?? '未知状态'}：${detail.slice(0, 200) || '响应体为空'}`,
          'provider-http-error',
        );
      }
      // 传输层由宿主决定：能拿到 SSE 文本流就用它，拿不到就退回一次性 json（网关缓冲整包时很常见）
      if (response.stream) {
        for await (const frame of response.stream()) {
          for (const payload of parseSseData(frame))
            yield fromChatStreamChunk(payload);
        }
        return;
      }
      const result = fromChatResponse(await response.json());
      yield {
        delta: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
      };
    },
  };
}
