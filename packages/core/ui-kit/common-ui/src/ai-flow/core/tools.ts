import type {
  AiMessage,
  AiResult,
  ToolContext,
  ToolLoopRequest,
  ToolLoopResult,
  ToolParam,
  ToolRegistryLike,
  ToolRunResult,
  ToolSchema,
  ToolSpec,
} from './types';

import { AiFlowError, errorText } from './errors';

/**
 * 工具注册表与工具循环。
 *
 * 分层位置：`core/tools.ts`，纯 TS。运行器只认它的 `ToolRegistryLike` 形状，
 * 所以宿主可以整个换掉实现（比如接 MCP）而不必改运行器。
 *
 * 这里**不做**的事：不猜参数含义、不做「看起来是个日期就转成 Date」这种聪明转换 ——
 * 强转只按 `ToolParam.type` 做显式的一次，转不动就报结构化错误。
 * 模型给错参数是常态，把它静默改成另一个值，比让它失败一次再重试危险得多。
 */

/** 单次工具输出回喂给模型时的截断长度：整张表塞回上下文会把后面几轮全挤掉 */
const OUTPUT_LIMIT = 4000;

export interface ToolRegistryOptions {
  /** 工具循环的默认轮数上限；节点上的 maxIterations 覆盖它 */
  maxIterations?: number;
  tools?: ToolSpec[];
}

export interface ToolRegistry extends ToolRegistryLike {
  has: (name: string) => boolean;
  register: (tool: ToolSpec) => void;
  unregister: (name: string) => boolean;
}

/** 缺省轮数上限。选 5 而不是 10：真实任务里三轮之内调不完的工具，多半是提示词写坏了 */
const DEFAULT_MAX_ITERATIONS = 5;

export function createToolRegistry(
  options: ToolRegistryOptions = {},
): ToolRegistry {
  const byName = new Map<string, ToolSpec>();
  for (const tool of options.tools ?? []) byName.set(tool.name, tool);
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const registry: ToolRegistry = {
    get: (name) => byName.get(name),
    has: (name) => byName.has(name),
    list: () => [...byName.values()],
    register: (tool) => {
      byName.set(tool.name, tool);
    },
    runTool: (name, args, ctx) => runTool(name, args, ctx, byName),
    runToolLoop: (request) =>
      runToolLoop(
        { ...request, maxIterations: request.maxIterations ?? maxIterations },
        byName,
      ),
    schemas: (names) => {
      const list = names
        ? names
            .map((name) => byName.get(name))
            .filter((item): item is ToolSpec => !!item)
        : [...byName.values()];
      return toToolSchemas(list);
    },
    unregister: (name) => byName.delete(name),
  };
  return registry;
}

/**
 * `ToolSpec` → OpenAI function-calling 的 schema。
 *
 * 纯映射、无副作用，所以可以单独断言：这一段错了，表现为「模型死活不调用工具」，
 * 是整包里最难查的一类问题，必须能在不联网的情况下验掉。
 */
export function toToolSchemas(tools: readonly ToolSpec[]): ToolSchema[] {
  return tools.map((tool) => {
    const properties: Record<
      string,
      { description?: string; type: ToolParam['type'] }
    > = {};
    const required: string[] = [];
    for (const param of tool.parameters ?? []) {
      properties[param.name] = param.description
        ? { description: param.description, type: param.type }
        : { type: param.type };
      if (param.required) required.push(param.name);
    }
    return {
      function: {
        description: tool.description,
        name: tool.name,
        parameters: { properties, required, type: 'object' as const },
      },
      type: 'function' as const,
    };
  });
}

export interface CoerceResult {
  args: Record<string, unknown>;
  errors: string[];
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/** 一次性显式强转：只做 JSON 世界与实际类型之间最保守的几种换算 */
function coerce(
  value: unknown,
  type: ToolParam['type'],
  items?: ToolParam['type'],
): { error?: string; value?: unknown } {
  if (typeOf(value) === type) {
    if (type === 'array' && items) {
      const bad = (value as unknown[]).find((item) => typeOf(item) !== items);
      if (bad !== undefined)
        return { error: `元素期望 ${items}，实际是 ${typeOf(bad)}` };
    }
    return { value };
  }

  switch (type) {
    case 'string': {
      // 数字/布尔可以直接 stringify；对象不行 —— 模型给对象说明它误解了参数含义
      if (typeof value === 'number' || typeof value === 'boolean')
        return { value: String(value) };
      return { error: `期望 string，实际是 ${typeOf(value)}` };
    }
    case 'number': {
      if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
      ) {
        return { value: Number(value) };
      }
      return { error: `期望 number，实际是 ${typeOf(value)}` };
    }
    case 'boolean': {
      if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase();
        if (lowered === 'true' || lowered === '1') return { value: true };
        if (lowered === 'false' || lowered === '0') return { value: false };
      }
      if (typeof value === 'number' && (value === 0 || value === 1))
        return { value: value === 1 };
      return { error: `期望 boolean，实际是 ${typeOf(value)}` };
    }
    case 'array':
    case 'object': {
      // 模型常把嵌套结构写成 JSON 字符串，这一种「字符串→结构」的转换是安全的
      if (typeof value === 'string') {
        try {
          return coerce(JSON.parse(value), type, items);
        } catch {
          return { error: `期望 ${type}，收到的字符串不是合法 JSON` };
        }
      }
      return { error: `期望 ${type}，实际是 ${typeOf(value)}` };
    }
    default: {
      return { error: `不支持的参数类型 "${type}"` };
    }
  }
}

/**
 * 参数强转 + 必填校验。
 *
 * 返回 `{ args, errors }` 而不是抛异常：调用方（`runTool` / 工具循环）需要把错误**回喂给模型**
 * 让它改一版再试，抛异常只能让整个节点失败。
 * 未声明的键原样透传：模型爱加解释性字段，工具自己决定要不要用，比我们悄悄丢掉好。
 */
export function coerceToolArgs(
  parameters: readonly ToolParam[],
  raw: Record<string, unknown> | undefined,
): CoerceResult {
  const source = raw ?? {};
  const args: Record<string, unknown> = { ...source };
  const errors: string[] = [];

  for (const param of parameters) {
    const value = source[param.name];
    if (value === undefined || value === null) {
      if (param.required) errors.push(`缺少必填参数 "${param.name}"`);
      else delete args[param.name];
      continue;
    }
    const result = coerce(value, param.type, param.items);
    if (result.error) errors.push(`参数 "${param.name}" ${result.error}`);
    else args[param.name] = result.value;
  }

  return { args, errors };
}

function truncate(output: unknown): string {
  const text = typeof output === 'string' ? output : safeJson(output);
  return text.length > OUTPUT_LIMIT
    ? `${text.slice(0, OUTPUT_LIMIT)}…（已截断）`
    : text;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * 执行一个工具：未注册 / 参数不合格 / 实现抛错，三种失败统一成 `{ ok: false, error }`。
 *
 * 工具实现抛出的异常一律被吞成错误文本 —— 工具是外部世界（HTTP、数据库、文件系统），
 * 让它的堆栈冒到运行器只会把一个「这一步失败、可以重试」的运行变成一次未捕获异常。
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  byName: ReadonlyMap<string, ToolSpec> = new Map(),
): Promise<ToolRunResult> {
  const tool = byName.get(name);
  if (!tool) {
    return { error: `工具 "${name}" 未注册`, invalid: true, name, ok: false };
  }
  const coerced = coerceToolArgs(tool.parameters, args);
  if (coerced.errors.length > 0) {
    return { error: coerced.errors.join('；'), invalid: true, name, ok: false };
  }
  try {
    const output = await tool.run(coerced.args, ctx);
    return { name, ok: true, output };
  } catch (error) {
    return { error: errorText(error), name, ok: false };
  }
}

/**
 * 工具循环：问模型 → 它点名字要工具 → 执行 → 结果回喂 → 再问，直到模型不再要工具。
 *
 * `maxIterations` 到点**抛错**而不是返回最后一次结果：一路「模型坚持要调工具、我们一直没 answers」
 * 的循环通常意味着工具描述与任务不匹配，静默返回一个半成品文本会让用户以为跑成功了。
 */
export async function runToolLoop(
  request: ToolLoopRequest,
  byName: ReadonlyMap<string, ToolSpec> = new Map(),
): Promise<ToolLoopResult> {
  const maxIterations = Math.max(
    1,
    Math.trunc(request.maxIterations ?? DEFAULT_MAX_ITERATIONS),
  );
  const messages: AiMessage[] = [...request.messages];
  const toolResults: ToolRunResult[] = [];
  let result: AiResult | undefined;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    result = await request.invoke({
      ...request.request,
      messages,
      model: request.model ?? request.request?.model,
      nodeId: request.nodeId,
      signal: request.ctx.signal,
      tools: request.request?.tools,
    });

    const calls = result.toolCalls ?? [];
    if (calls.length === 0) {
      return { iterations: iteration, messages, result, toolResults };
    }

    // 协议要求把「assistant 发起了哪些工具调用」原样回喂，缺了它下一轮模型不知道自己在等什么
    messages.push({
      content: result.text,
      role: 'assistant',
      toolCalls: calls,
    });

    for (const call of calls) {
      const executed = await runTool(call.name, call.args, request.ctx, byName);
      toolResults.push(executed);
      messages.push({
        content: executed.ok
          ? truncate(executed.output)
          : `工具执行失败：${executed.error ?? '未知原因'}`,
        name: call.name,
        role: 'tool',
        toolCallId: call.id,
      });
    }
  }

  throw new AiFlowError(
    `工具循环达到上限 ${maxIterations} 轮仍未收敛（最后停在：${
      (result?.toolCalls ?? []).map((call) => call.name).join('、') || '无'
    }）；请检查工具描述是否让模型误以为需要反复调用`,
    'tool-loop-limit',
    { nodeId: request.nodeId },
  );
}

/** 兼容 `ToolRegistryLike` 的结构检查：宿主自己实现的注册表在装配前先问一句 */
export function isToolRegistryLike(value: unknown): value is ToolRegistryLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ToolRegistryLike>;
  return (
    typeof candidate.get === 'function' &&
    typeof candidate.list === 'function' &&
    typeof candidate.runTool === 'function' &&
    typeof candidate.schemas === 'function' &&
    typeof candidate.runToolLoop === 'function'
  );
}
