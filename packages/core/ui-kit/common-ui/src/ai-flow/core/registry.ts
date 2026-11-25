// `RenderedPrompt` 的出处是 `prompt.ts`：它描述的是「渲染产物的形状」，属于提示词组装层，
// 不在 `types.ts` 的对外契约里，所以这里从 prompt 取而不是要求 types 重新导出
import type { RenderedPrompt } from './prompt';
import type {
  AiMessage,
  AiNodeData,
  AiNodeHandler,
  AiNodeHandlerContext,
  AiNodeHandlerRegistry,
} from './types';

import { AiFlowError } from './errors';
import { parseOutput } from './output-parser';
import { renderPrompt } from './prompt';

/**
 * AI 节点的语义注册表。
 *
 * 分层位置：`core/registry.ts`，纯 TS，被 `runner.ts` 消费。
 *
 * 注册表口径：**内置的八种节点本身就是
 * 注册表里的条目，不是引擎里的 switch** —— 想把 `llm` 换成「带缓存的模型网关调用」，
 * 注册一个同名 kind 的处理器覆盖掉即可，不必 fork 运行器，也不必它开配置开关。
 * 反过来，运行器里因此不许出现任何 `if (node.type === 'llm')`。
 *
 * 这里**不做**的事：不做边路由与并发调度、不做重试与超时的实施、不写运行态。
 * 那些都属于 `runner.ts`；处理器只回答「这一步该往哪走、交出什么」，
 * 超时与取消通过 `ctx.withTimeout` / `ctx.abort` 向处理器要协作，而不是替它决定。
 */

/**
 * 注册表的对外形状就是 `AiNodeHandlerRegistry` 本身。
 *
 * 用别名而不是在函数签名里再抄一遍五个方法：`runner.ts` 只依赖这五个方法，
 * 内置条目怎么排、extra 怎么覆盖都属于本文件的实现细节，换掉时不该波及运行器类型。
 */
export type AiNodeRegistry = AiNodeHandlerRegistry;

export function createAiNodeRegistry(
  extra: AiNodeHandler[] = [],
): AiNodeRegistry {
  const byKind = new Map<string, AiNodeHandler>();
  for (const handler of builtinAiNodeHandlers)
    byKind.set(handler.kind, handler);
  for (const handler of extra) byKind.set(handler.kind, handler);
  return {
    get: (kind) => byKind.get(kind),
    has: (kind) => byKind.has(kind),
    list: () => [...byKind.values()],
    register: (handler) => {
      byKind.set(handler.kind, handler);
    },
    unregister: (kind) => byKind.delete(kind),
  };
}

/** 输出落库的键名：显式 outputKey 优先，否则用节点 id —— 下游 `{{ 节点id }}` 就能直接引用 */
function keyOf(ctx: AiNodeHandlerContext, fallback: string): string {
  return ctx.data.outputKey ?? fallback;
}

/** 与 graph 表达式求值一致的宽松真值：0 / '' / false / null / undefined 为假 */
export function isTruthy(value: unknown): boolean {
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  return true;
}

/** prompt 节点的产物形状：llm 节点认它，从而支持「prompt → llm」这条最常见的连线 */
export interface PromptOutput extends RenderedPrompt {
  /** 标记字段：普通对象没有它，就不会把宿主自己塞进 values 的东西误认成提示词 */
  rendered: true;
}

export function isPromptOutput(value: unknown): value is PromptOutput {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { rendered?: unknown }).rendered === true &&
    Array.isArray((value as { messages?: unknown }).messages)
  );
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => toText(item)).join('\n');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * 组装 llm 节点的对话。优先级：节点自己的 `prompt` 模板 > `inputKeys` 指定的上游产物 >
 * 全部直接前驱产物。
 *
 * 最后那层兜底很关键：画布上「连了线但没配 inputKeys」是最常见的画法，
 * 直接报错的话用户看到一个空请求；把它当上下文喂进去才是连线本来想表达的意思。
 */
export function buildMessages(ctx: AiNodeHandlerContext): AiMessage[] {
  const data = ctx.data;
  const messages: AiMessage[] = [];

  const system = ctx.render(data.system ?? '');
  if (system) messages.push({ content: system, role: 'system' });

  if (data.prompt) {
    messages.push({ content: ctx.render(data.prompt), role: 'user' });
    return messages;
  }

  const keys = data.inputKeys?.length ? data.inputKeys : (ctx.directKeys ?? []);
  if (keys.length === 0) {
    throw new AiFlowError(
      `llm 节点 "${ctx.node.label ?? ctx.node.id}" 没有任何输入：配 prompt，或连一条上游边`,
      'llm-no-input',
      { nodeId: ctx.node.id },
    );
  }

  for (const key of keys) {
    const value = ctx.values[key];
    if (value === undefined) {
      throw new AiFlowError(
        `llm 节点 "${ctx.node.label ?? ctx.node.id}" 的输入 {{ ${key} }} 还没有值：上游是否没跑，或者换了 outputKey？`,
        'llm-input-missing',
        { nodeId: ctx.node.id },
      );
    }
    if (isPromptOutput(value)) {
      // 上游是 prompt 节点：接上它组装好的多轮（含 few-shot）。
      // 剥掉它自己的 system 段：本节点的 data.system 已经排在最前，两条 system 会让模型
      // 以为话题重开，而宿主十有八九是想覆盖它。
      messages.push(
        ...value.messages.filter((message) => message.role !== 'system'),
      );
      continue;
    }
    messages.push({ content: toText(value), role: 'user' });
  }
  return messages;
}

function toolsOf(ctx: AiNodeHandlerContext) {
  if (!ctx.tools) {
    throw new AiFlowError(
      `节点 "${ctx.node.label ?? ctx.node.id}" 要用工具，但运行器没有注入工具注册表：configureAiFlow({ tools }) 或 createAiRunner({ tools })`,
      'tools-missing',
      { nodeId: ctx.node.id },
    );
  }
  return ctx.tools;
}

/** 未注册的工具名在**运行前**就报出来：等到模型点名调用它已经烧掉一次往返的钱 */
function specsOf(ctx: AiNodeHandlerContext, names: string[]) {
  const registry = toolsOf(ctx);
  const missing = names.filter((name) => !registry.get(name));
  if (missing.length > 0) {
    throw new AiFlowError(
      `节点 "${ctx.node.label ?? ctx.node.id}" 引用了未注册的工具：${missing.join('、')}`,
      'unknown-tool',
      { nodeId: ctx.node.id },
    );
  }
  return registry.schemas(names);
}

/** 深度渲染 args 里的字符串模板；非字符串原样透传，数组递归 */
function renderArgs(value: unknown, ctx: AiNodeHandlerContext): unknown {
  if (typeof value === 'string') return ctx.render(value);
  if (Array.isArray(value)) return value.map((item) => renderArgs(item, ctx));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value))
      out[key] = renderArgs(item, ctx);
    return out;
  }
  return value;
}

/** 流式产出：累积文本 + 逐段发事件。usage 由运行器在 invoke/stream 外层统一记账，这里不管 */
async function streamText(
  ctx: AiNodeHandlerContext,
  request: Parameters<AiNodeHandlerContext['stream']>[0],
) {
  let text = '';
  for await (const chunk of ctx.stream(request)) {
    text += chunk.delta;
    if (chunk.delta)
      ctx.emit({ kind: 'node.chunk', nodeId: ctx.node.id, text: chunk.delta });
    // 取消传播：provider 的 for-await 不一定响应 abort，这里自己收口，否则 cancel 要等流跑完
    if (ctx.abort.aborted) break;
  }
  return text;
}

async function runLlmText(ctx: AiNodeHandlerContext): Promise<string> {
  const data: AiNodeData = ctx.data;
  const messages = buildMessages(ctx);
  const base = {
    maxTokens: data.maxTokens,
    messages,
    model: data.model,
    temperature: data.temperature,
  };

  if (data.tools?.length) {
    const tools = specsOf(ctx, data.tools);
    const loop = await ctx.withTimeout(
      () =>
        toolsOf(ctx).runToolLoop({
          ctx: {
            now: ctx.now,
            runId: ctx.runId,
            signal: ctx.abort,
            values: ctx.values,
          },
          invoke: ctx.invoke,
          maxIterations: data.maxIterations,
          messages,
          model: data.model,
          nodeId: ctx.node.id,
          request: { ...base, tools },
        }),
      data.timeoutMs,
    );
    return loop.result.text;
  }

  if (data.stream && ctx.provider.stream) {
    return ctx.withTimeout(() => streamText(ctx, base), data.timeoutMs);
  }

  const result = await ctx.withTimeout(
    async () => ctx.invoke(base),
    data.timeoutMs,
  );
  return result.text;
}

export const builtinAiNodeHandlers: readonly AiNodeHandler[] = [
  {
    // 入口：原样放行。留成注册表条目而不是让运行器特判 start，是为了能被覆盖成
    // 「带参数校验的入口」「按租户加载上下文的入口」
    kind: 'start',
    run: () => ({ status: 'advance' }),
  },
  {
    kind: 'end',
    run: (ctx) => {
      const data = ctx.data;
      // 三种收口写法都支持：模板拼装 > 取某个产物 > 表达式计算，最后才是「没有产物」
      if (data.prompt)
        return { output: ctx.render(data.prompt), status: 'finish' };
      if (data.outputKey)
        return { output: ctx.values[data.outputKey], status: 'finish' };
      if (data.expression)
        return { output: ctx.evaluate(data.expression), status: 'finish' };
      return { output: undefined, status: 'finish' };
    },
  },
  {
    kind: 'prompt',
    run: (ctx) => {
      const data = ctx.data;
      const rendered = renderPrompt(
        { fewShot: data.fewShot, system: data.system, user: data.prompt },
        ctx.scope,
        { label: ctx.node.label ?? ctx.node.id },
      );
      const output: PromptOutput = { ...rendered, rendered: true };
      return { output, outputKey: keyOf(ctx, ctx.node.id), status: 'advance' };
    },
  },
  {
    kind: 'llm',
    run: async (ctx) => {
      const text = await runLlmText(ctx);
      const data = ctx.data;
      const output =
        data.outputFormat && data.outputFormat !== 'text'
          ? withNode(ctx, () =>
              parseOutput(data.outputFormat, text, {
                expression: data.expression,
                schema: data.schema,
              }),
            )
          : text;
      return { output, outputKey: keyOf(ctx, ctx.node.id), status: 'advance' };
    },
  },
  {
    kind: 'tool',
    run: async (ctx) => {
      const data = ctx.data;
      if (!data.tool) {
        throw new AiFlowError(
          `tool 节点 "${ctx.node.label ?? ctx.node.id}" 没有配置 tool 名`,
          'tool-name-missing',
          { nodeId: ctx.node.id },
        );
      }
      const result = await ctx.withTimeout(
        () =>
          toolsOf(ctx).runTool(
            data.tool as string,
            (renderArgs(data.args ?? {}, ctx) as Record<string, unknown>) ?? {},
            {
              now: ctx.now,
              runId: ctx.runId,
              signal: ctx.abort,
              values: ctx.values,
            },
          ),
        data.timeoutMs,
      );
      if (!result.ok) {
        throw new AiFlowError(
          `工具 "${data.tool}" 执行失败：${result.error ?? '未知原因'}`,
          'tool-failed',
          { nodeId: ctx.node.id },
        );
      }
      return {
        output: result.output,
        outputKey: keyOf(ctx, data.tool),
        status: 'advance',
      };
    },
  },
  {
    kind: 'transform',
    run: (ctx) => {
      const data = ctx.data;
      if (!data.expression) {
        throw new AiFlowError(
          `transform 节点 "${ctx.node.label ?? ctx.node.id}" 没有配置 expression`,
          'transform-expression-missing',
          { nodeId: ctx.node.id },
        );
      }
      return {
        output: ctx.evaluate(data.expression),
        outputKey: keyOf(ctx, ctx.node.id),
        status: 'advance',
      };
    },
  },
  {
    kind: 'condition',
    run: (ctx) => {
      const data = ctx.data;
      for (const branch of data.branches ?? []) {
        if (!branch.expression.trim()) continue;
        if (isTruthy(ctx.evaluate(branch.expression))) {
          return { nextEdgeIds: [branch.edgeId], status: 'advance' };
        }
      }
      if (data.defaultEdgeId)
        return { nextEdgeIds: [data.defaultEdgeId], status: 'advance' };
      if (data.expression) {
        // 只给一个表达式时的简写：真走第一条出边、假走第二条（只有一条出边时两边相同）
        const hit = isTruthy(ctx.evaluate(data.expression));
        const edges = ctx.outgoingEdges;
        const picked = hit ? edges[0] : (edges[1] ?? edges[0]);
        return picked
          ? { nextEdgeIds: [picked.id], status: 'advance' }
          : { status: 'skip' };
      }
      // 全不命中又没配默认边：走全部出边而不是失败，等价于「无条件通过」，比静默断流友好
      return { status: 'advance' };
    },
  },
  {
    // 人工确认：第一次到达即挂起，`resume(runState, input)` 时该节点被重新执行并交出人的输入。
    // 挂起态全是纯数据（frontier + nodes[].input），所以宿主重启、换进程都能续跑。
    kind: 'human',
    run: (ctx) => {
      const data = ctx.data;
      const outputKey = keyOf(ctx, `${ctx.node.id}_human`);
      if (ctx.input === undefined) {
        return { outputKey, resumeLabel: data.resumeLabel, status: 'await' };
      }
      return { output: ctx.input, outputKey, status: 'advance' };
    },
  },
];

/** 解析层的错误补上节点归属，时间线上才知道是哪一步的返回值不合格 */
function withNode<T>(ctx: AiNodeHandlerContext, task: () => T): T {
  try {
    return task();
  } catch (error) {
    if (error instanceof AiFlowError) {
      throw new AiFlowError(error.message, error.code, { nodeId: ctx.node.id });
    }
    throw error;
  }
}

/**
 * 未注册 kind 的兜底处理器。
 *
 * 缺省选「直通」而不是「失败」：草稿态的画布上常有还没实现的业务节点，
 * 直通让宿主能先跑通主干；需要严格语义的宿主传一个 `run: () => ({ status: 'fail' })` 覆盖掉。
 */
export const passthroughFallbackHandler: AiNodeHandler = {
  kind: '*',
  run: () => ({ status: 'advance' }),
};
