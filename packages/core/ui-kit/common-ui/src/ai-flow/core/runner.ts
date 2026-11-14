import type { GraphEdge, GraphIndex } from '@antdv/graph';

import type { AiNodeRegistry } from './registry';
import type {
  AiEventListener,
  AiFlowDefinition,
  AiFlowEvent,
  AiNodeData,
  AiNodeHandler,
  AiNodeHandlerContext,
  AiNodeResult,
  AiProvider,
  AiRequest,
  AiResult,
  AiRunState,
  AiUsage,
  NodeRunState,
  ToolRegistryLike,
} from './types';

import {
  createExpressionEvaluator,
  createGraphIndex,
  topologicalSort,
} from '@antdv/graph';

import { AiFlowError, errorText } from './errors';
import { renderTemplate } from './prompt';
import { createAiNodeRegistry } from './registry';

/**
 * AI 编排运行器。
 *
 * 五条口径，改这个文件前先读：
 *
 * 1. **运行器不认识「大模型」这件事。** 节点语义全在 `registry.ts` 的注册表条目里，
 *    运行器只做五件事：分层调度、重试与超时、值表读写、用量记账、事件广播。
 *    新增一种节点（RAG、Agent、图像生成）不需要动这里一行，这里也不许出现 `node.type === 'llm'`。
 * 2. **时钟与等待都是注入的。** `clock()` 决定所有时间戳，`sleep(ms)` 决定退避与超时怎么等。
 *    单测里给假时钟 + 假 sleep，重试退避、耗时、事件顺序就全是确定的数字；
 *    换成 `Date.now` + `setTimeout` 这些断言会变成「看起来稳定」的 flaky。
 * 3. **运行态是纯数据。** `AiRunState` 不含函数与 Promise，可序列化、可换进程 `resume`；
 *    内存里那份 `runs` 只是同一次运行的缓存，不是真相来源。
 * 4. **同层并发、波内去重。** 拓扑上同一层的节点并发执行，受 `maxConcurrency` 限流；
 *    同一波里重复到达的目标只跑一次。跨波再次到达会重跑 —— 这是运行器允许画循环
 *    （模型自检后退回上一步重问是 AI 编排的常见形状）的代价，`maxSteps` 就是它的兜底。
 * 5. **`run()` 不 reject。** 任何节点级失败都落进运行态（`status: 'failed'` + 日志 + 节点 error），
 *    调用方只需要处理一种出口；只有 `resume()` 的参数用错才抛异常，那是调用方的 bug。
 *
 * 这里**不做**的事：不做持久化（宿主自己存 `AiRunState`）、不做计费与限流、
 * 不猜「多久算超时」（`timeoutMs` 缺省不生效，交给 Provider 实现自己决定）。
 */

const DEFAULT_MAX_STEPS = 100;
const DEFAULT_MAX_CONCURRENCY = 4;
/** 重试首跳的缺省延迟：够躲过一次瞬时 5xx / 限流窗口，又不至于让失败的运行拖太久 */
const DEFAULT_RETRY_DELAY_MS = 200;

export interface AiRunnerOptions {
  clock?: () => number;
  /** 多版本共存：续跑历史运行时按 flowId 在这张表里查定义 */
  definitions?: Record<string, AiFlowDefinition>;
  /** 节点没写 model 时的兜底；与 Provider 自己的默认值叠加 */
  defaultModel?: string;
  /** 表达式与模板可见的常量上下文（当前用户、租户、词典），只读 */
  evaluatorContext?: Record<string, unknown>;
  /** 未注册 kind 的兜底处理器；不传则未知节点类型直接失败 */
  fallbackHandler?: AiNodeHandler;
  /** 追加或覆盖内置处理器：同 kind 后注册者胜 */
  handlers?: AiNodeHandler[];
  idFactory?: (prefix: string) => string;
  /** 同一波内同时跑几个节点。缺省 4：再高容易撞供应商的并发限流 */
  maxConcurrency?: number;
  /** 单次运行允许的波次上限，兜住循环与画错的图 */
  maxSteps?: number;
  provider: AiProvider;
  /** 指数退避的首跳缺省延迟（ms）；节点上的 retryDelayMs 优先 */
  retryDelayMs?: number;
  /** 退避与超时的等待实现；测试里注入假 sleep 才能确定化 */
  sleep?: (ms: number) => Promise<void>;
  /** 全局节点超时缺省值（ms）；节点上的 timeoutMs 优先 */
  timeoutMs?: number;
  tools?: ToolRegistryLike;
}

export interface AiRunner {
  /** 取消一次进行中的运行；返回是否真的有这么一次运行在跑 */
  cancel: (runId: string) => boolean;
  readonly handlers: AiNodeRegistry;
  on: (listener: AiEventListener) => () => void;
  readonly options: AiRunnerOptions;
  readonly provider: AiProvider;
  /** 续跑一个挂起的运行态。状态不是 awaiting、或定义查不到，抛可诊断错误 */
  resume: (
    runState: AiRunState | string,
    humanInput?: unknown,
  ) => Promise<AiRunState>;
  run: (
    flow: AiFlowDefinition,
    input?: Record<string, unknown>,
  ) => Promise<AiRunState>;
  /** 内存里登记的运行态（同 runId）；序列化过的运行不依赖它 */
  state: (runId: string) => AiRunState | undefined;
}

/** 一次进行中的运行的外壳：不属于运行态本身，所以不进 AiRunState */
interface ActiveRun {
  abort: AbortController;
  canceled: boolean;
  state: AiRunState;
}

type WaveOutcome =
  | { kind: 'advance'; next: string[] }
  | { kind: 'stop'; next: string[] };

export function createAiRunner(options: AiRunnerOptions): AiRunner {
  const clock = options.clock ?? (() => Date.now());
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms))));
  const registry = createAiNodeRegistry(options.handlers ?? []);
  const evaluator = createExpressionEvaluator();
  const listeners = new Set<AiEventListener>();
  const runs = new Map<string, AiRunState>();
  const actives = new Map<string, ActiveRun>();
  const counters = new Map<string, number>();
  /** 最近见过的定义：让 `resume(state)` 在没配 definitions 时也能跑起来 */
  const seenDefinitions = new Map<string, AiFlowDefinition>();
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxConcurrency = Math.max(
    1,
    Math.trunc(options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY),
  );
  const nextId =
    options.idFactory ??
    ((prefix: string) => {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}-${n}`;
    });

  function emit(event: AiFlowEvent) {
    for (const listener of listeners) listener(event);
  }

  function logOf(
    state: AiRunState,
    level: 'error' | 'info' | 'warn',
    message: string,
    nodeId?: string,
  ) {
    state.logs.push({ at: clock(), level, message, nodeId });
    emit({ kind: 'run.log', level, message, nodeId, runId: state.id });
  }

  function emptyUsage(): AiUsage {
    return { completion: 0, prompt: 0, total: 0 };
  }

  function addUsage(target: AiUsage, usage: AiUsage | undefined) {
    if (!usage) return;
    target.completion += usage.completion;
    target.prompt += usage.prompt;
    target.total += usage.total;
  }

  function resolveDefinition(flowId: string): AiFlowDefinition {
    const found = options.definitions?.[flowId] ?? seenDefinitions.get(flowId);
    if (found) return found;
    throw new AiFlowError(
      `运行引用了定义 "${flowId}"，但它不在运行器的 definitions 里：续跑历史运行请把对应版本传进 createAiRunner({ definitions })`,
      'definition-not-found',
    );
  }

  function entryNodeIds(index: GraphIndex<any>): string[] {
    const roots = index.nodes.filter(
      (node) => (index.incoming.get(node.id)?.length ?? 0) === 0,
    );
    if (roots.length > 0) return roots.map((node) => node.id);
    // 全图入度都不为 0（纯循环）时按拓扑序兜一个起点，让 maxSteps 去报「跑不完」这种更准确的错
    const sorted = topologicalSort(index);
    return sorted.order.length > 0 ? [sorted.order[0] as string] : [];
  }

  function nodeSeed(
    nodeId: string,
    kind: string,
    label?: string,
  ): NodeRunState {
    return { attempts: 0, id: nodeId, kind, label, status: 'pending' };
  }

  function createState(
    flow: AiFlowDefinition,
    input: Record<string, unknown> | undefined,
  ): AiRunState {
    const nodes: Record<string, NodeRunState> = {};
    for (const node of flow.nodes ?? [])
      nodes[node.id] = nodeSeed(node.id, node.type, node.label ?? node.id);
    return {
      flowId: flow.id,
      frontier: entryNodeIds(createGraphIndex(flow)),
      id: nextId('run'),
      logs: [],
      nodes,
      startedAt: clock(),
      status: 'running',
      steps: 0,
      usage: emptyUsage(),
      values: { ...input },
    };
  }

  /** 波内并发：车道数等于上限，谁先跑完谁领下一个；起始顺序按声明序，所以事件序列可断言 */
  async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const out = new Array<R>(items.length);
    let cursor = 0;
    const lanes = Math.min(Math.max(1, limit), items.length);
    const runners = Array.from({ length: lanes }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        out[index] = await worker(items[index] as T, index);
      }
    });
    await Promise.all(runners);
    return out;
  }

  function dedupe(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function directKeysOf(index: GraphIndex<any>, nodeId: string): string[] {
    return (index.incoming.get(nodeId) ?? []).map((edge) => {
      const key = index.nodesById.get(edge.source)?.data?.outputKey;
      return typeof key === 'string' && key ? key : edge.source;
    });
  }

  function patchNode(
    state: AiRunState,
    nodeId: string,
    patch: Partial<NodeRunState>,
  ) {
    const current =
      state.nodes[nodeId] ?? nodeSeed(nodeId, patch.kind ?? 'unknown');
    state.nodes[nodeId] = { ...current, ...patch };
  }

  function isTimeout(error: unknown): boolean {
    return error instanceof AiFlowError && error.code === 'node-timeout';
  }

  /** 本次节点执行新烧掉的量：整条运行的 usage 是累加的，节点级要能单独看出来 */
  function diffUsage(after: AiUsage, before: AiUsage): AiUsage | undefined {
    if (
      after.total === before.total &&
      after.prompt === before.prompt &&
      after.completion === before.completion
    ) {
      return undefined;
    }
    return {
      completion: after.completion - before.completion,
      prompt: after.prompt - before.prompt,
      total: after.total - before.total,
    };
  }

  function routeEdges(
    index: GraphIndex<any>,
    nodeId: string,
    edgeIds: string[] | undefined,
  ): { missing: string[]; next: string[] } {
    const edges = index.outgoing.get(nodeId) ?? [];
    const chosen: GraphEdge[] = edgeIds
      ? edges.filter((edge) => edgeIds.includes(edge.id))
      : edges;
    const selected = new Set(chosen.map((edge) => edge.id));
    // 分支只认「本节点的出边」：指向别处的 edgeId 说明分支配错了，
    // 当成没命中悄悄放过，症状是流程走了一条图上根本不存在的路线
    const missing = edgeIds ? edgeIds.filter((id) => !selected.has(id)) : [];
    return { missing, next: chosen.map((edge) => edge.target) };
  }

  async function executeNode(
    active: ActiveRun,
    index: GraphIndex<any>,
    nodeId: string,
  ): Promise<WaveOutcome> {
    const state = active.state;
    const node = index.nodesById.get(nodeId);
    if (!node)
      return failRun(state, `定义里找不到节点 ${nodeId}`, nodeId, {
        status: 'failed',
      });
    if (active.canceled) {
      patchNode(state, nodeId, { finishedAt: clock(), status: 'canceled' });
      return { kind: 'stop', next: [] };
    }

    const handler = registry.get(node.type) ?? options.fallbackHandler;
    if (!handler) {
      const reason = `节点类型 "${node.type}" 没有注册处理器，且未配置 fallbackHandler`;
      patchNode(state, nodeId, { error: reason, status: 'failed' });
      return failRun(state, reason, nodeId);
    }

    const data: AiNodeData = node.data ?? {};
    let nodeState =
      state.nodes[nodeId] ?? nodeSeed(nodeId, node.type, node.label);
    state.nodes[nodeId] = nodeState;
    const startedAt = clock();
    // attempts 记的是「这一次执行」的尝试数：循环回来的节点会被重置，历史次数看日志
    nodeState.attempts = 0;
    nodeState.error = undefined;
    nodeState.startedAt = startedAt;
    nodeState.status = 'running';

    const retries = Math.max(0, Math.trunc(data.retries ?? 0));
    const retryDelayMs =
      data.retryDelayMs ?? options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    let lastError = '未知失败';

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (active.canceled) {
        patchNode(state, nodeId, { finishedAt: clock(), status: 'canceled' });
        return { kind: 'stop', next: [] };
      }
      nodeState.attempts += 1;
      if (attempt > 0) {
        logOf(
          state,
          'warn',
          `节点 "${node.label ?? nodeId}" 第 ${nodeState.attempts} 次尝试（上一次失败：${lastError}）`,
          nodeId,
        );
        // 指数退避 1×, 2×, 4×…；等待走注入的 sleep，所以测试里拿到的是确定的延迟序列
        await sleep(retryDelayMs * 2 ** (attempt - 1));
      }
      emit({
        attempt: nodeState.attempts,
        kind: 'node.started',
        nodeId,
        runId: state.id,
      });

      const nodeAbort = new AbortController();
      const onRunAbort = () => nodeAbort.abort(new Error('运行已取消'));
      if (active.abort.signal.aborted) onRunAbort();
      else
        active.abort.signal.addEventListener('abort', onRunAbort, {
          once: true,
        });

      const usageBefore = { ...state.usage };
      const scope: Record<string, unknown> = {
        ...options.evaluatorContext,
        ...state.values,
      };
      const track = (usage: AiUsage | undefined) =>
        addUsage(state.usage, usage);

      const withTimeout = async <T>(
        task: () => Promise<T>,
        ms?: number,
      ): Promise<T> => {
        const budget = ms ?? options.timeoutMs;
        if (!budget || !Number.isFinite(budget) || budget <= 0) return task();
        const pending = task();
        // 竞速落败的一方稍后再拒绝不该变成未捕获异常：宿主的全局错误处理会被刷屏
        pending.catch(() => undefined);
        const timer = sleep(budget).then(() => {
          nodeAbort.abort(new Error(`执行超过 ${budget}ms`));
          throw new AiFlowError(
            `节点 "${node.label ?? nodeId}" 执行超过 ${budget}ms 被中止`,
            'node-timeout',
            {
              nodeId,
            },
          );
        });
        return Promise.race([pending, timer]);
      };

      const invoke = async (
        request: Omit<AiRequest, 'nodeId' | 'signal'>,
      ): Promise<AiResult> => {
        const result = await options.provider.invoke({
          ...request,
          model: request.model ?? options.defaultModel,
          nodeId,
          signal: nodeAbort.signal,
        });
        track(result.usage);
        return result;
      };

      const stream = async function* (
        request: Omit<AiRequest, 'nodeId' | 'signal'>,
      ) {
        if (!options.provider.stream) {
          throw new AiFlowError(
            'Provider 没有实现 stream：给它加一个 AsyncIterable 出口，或把节点的 stream 关掉',
            'provider-stream-missing',
            { nodeId },
          );
        }
        const source = options.provider.stream({
          ...request,
          model: request.model ?? options.defaultModel,
          nodeId,
          signal: nodeAbort.signal,
        });
        for await (const chunk of source) {
          if (chunk.usage) track(chunk.usage);
          yield chunk;
        }
      };

      const ctx: AiNodeHandlerContext = {
        abort: nodeAbort.signal,
        data,
        directKeys: directKeysOf(index, nodeId),
        emit: (payload) => emit({ ...payload, runId: state.id } as AiFlowEvent),
        evaluate: (expression) => evaluator.evaluate(expression, scope),
        input: nodeState.input,
        invoke,
        node,
        now: clock,
        outgoingEdges: index.outgoing.get(nodeId) ?? [],
        provider: options.provider,
        render: (template) =>
          renderTemplate(template, scope, {
            label: `节点 ${node.label ?? nodeId}`,
          }),
        runId: state.id,
        scope,
        sleep,
        state,
        stream,
        tools: options.tools,
        values: state.values,
        withTimeout,
      };

      let result: AiNodeResult;
      try {
        result = await handler.run(ctx);
      } catch (error) {
        active.abort.signal.removeEventListener('abort', onRunAbort);
        lastError = errorText(error);
        // 取消导致的中止不重试、不算配置错误：报「失败」会让人去查一个没坏的节点
        if (
          active.canceled ||
          (nodeAbort.signal.aborted && !isTimeout(error))
        ) {
          patchNode(state, nodeId, { finishedAt: clock(), status: 'canceled' });
          return { kind: 'stop', next: [] };
        }
        patchNode(state, nodeId, { error: lastError });
        // patchNode 把节点条目换成了新对象：把本地引用指回去，否则下一次尝试的 attempts/usage 会写进脱手的旧对象，
        // 表现就是「重试了三次的节点，运行态里 attempts 永远是 1」
        nodeState = state.nodes[nodeId] as NodeRunState;
        if (attempt < retries) continue;
        break;
      }
      active.abort.signal.removeEventListener('abort', onRunAbort);

      const finishedAt = clock();
      const durationMs = finishedAt - startedAt;
      const nodeUsage = diffUsage(state.usage, usageBefore);
      if (nodeUsage) nodeState.usage = nodeUsage;

      if (result.status === 'fail') {
        patchNode(state, nodeId, {
          durationMs,
          error: result.reason,
          finishedAt,
          status: 'failed',
        });
        emit({
          durationMs,
          error: result.reason,
          kind: 'node.finished',
          nodeId,
          ok: false,
          runId: state.id,
        });
        // 语义失败既不重试，也不该掉进下面「重试次数用尽」那个出口：那里会再把同一条 node.finished 发一遍
        return failRun(
          state,
          `节点 "${node.label ?? nodeId}" 失败：${result.reason}`,
          nodeId,
        );
      }

      patchNode(state, nodeId, { durationMs, finishedAt, status: 'succeeded' });
      emit({
        durationMs,
        kind: 'node.finished',
        nodeId,
        ok: true,
        runId: state.id,
      });

      if (result.status === 'await') {
        patchNode(state, nodeId, {
          durationMs,
          outputKey: result.outputKey,
          status: 'awaiting',
        });
        state.status = 'awaiting';
        state.awaiting = { nodeId, resumeLabel: result.resumeLabel };
        emit({
          kind: 'run.awaiting',
          nodeId,
          resumeLabel: result.resumeLabel,
          runId: state.id,
        });
        return { kind: 'stop', next: [] };
      }

      if (result.status === 'finish') {
        state.output = result.output;
        state.status = 'succeeded';
        return { kind: 'stop', next: [] };
      }

      if (result.status === 'advance') {
        writeOutput(state, nodeId, result, nodeUsage);
      }

      const moved = routeEdges(
        index,
        nodeId,
        result.status === 'advance' ? result.nextEdgeIds : undefined,
      );
      if (moved.missing.length > 0) {
        return failRun(
          state,
          `节点 "${node.label ?? nodeId}" 选择了不属于它出边的分支：${moved.missing.join('、')}`,
          nodeId,
        );
      }
      return { kind: 'advance', next: moved.next };
    }

    // 重试次数用尽仍然失败：整条运行落 failed，而不是悄悄继续往下走
    patchNode(state, nodeId, { finishedAt: clock(), status: 'failed' });
    emit({
      durationMs: clock() - startedAt,
      error: lastError,
      kind: 'node.finished',
      nodeId,
      ok: false,
      runId: state.id,
    });
    return failRun(
      state,
      `节点 "${node.label ?? nodeId}" 失败：${lastError}`,
      nodeId,
    );
  }

  /** 产物落值表：显式 outputKey 优先，没配但确实有产物时回落节点 id */
  function writeOutput(
    state: AiRunState,
    nodeId: string,
    result: Extract<AiNodeResult, { status: 'advance' }>,
    usage: AiUsage | undefined,
  ) {
    if (result.output === undefined && !result.outputKey) return;
    const key = result.outputKey ?? nodeId;
    state.values[key] = result.output;
    patchNode(state, nodeId, { output: result.output, outputKey: key, usage });
    emit({
      kind: 'node.output',
      nodeId,
      output: result.output,
      outputKey: key,
      runId: state.id,
    });
  }

  function failRun(
    state: AiRunState,
    reason: string,
    nodeId?: string,
    patch?: Partial<NodeRunState>,
  ): WaveOutcome {
    if (nodeId && patch) patchNode(state, nodeId, patch);
    state.status = 'failed';
    logOf(state, 'error', reason, nodeId);
    return { kind: 'stop', next: [] };
  }

  /** 从这批种子出发沿出边能到达的所有节点（含种子自己） */
  function reachableFrom(index: GraphIndex<any>, seeds: string[]): Set<string> {
    const seen = new Set<string>();
    const stack = [...seeds];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of index.outgoing.get(id) ?? []) stack.push(edge.target);
    }
    return seen;
  }

  /**
   * 收口时把「再怎么等也不会跑到」的节点从 `pending` 改成 `skipped`。
   *
   * 判据是可达性，不是「跑没跑过」：只有从剩下的 frontier（挂起时还包括那个 awaiting 节点）
   * 沿出边走得到的节点，将来才可能被调度；走不到的那些停在 pending，界面上就和「还没轮到」
   * 长得一模一样 —— 画布上未命中的分支因此看不见，而这正是分支流程最需要看清的一件事。
   * 类型里本来就有 `skipped`，画布也早给它备了外环，只是运行器一直没产出过它。
   *
   * `failed` / `canceled` 不标：那种停法是被中断的，pending 节点记录的是「没来得及跑」，
   * 语义上真该保留 pending，将来宿主从中间续跑也还认得它们。
   */
  function markUnreached(state: AiRunState, index: GraphIndex<any>): void {
    const seeds = [...state.frontier];
    if (state.awaiting) seeds.push(state.awaiting.nodeId);
    const stillPossible = reachableFrom(index, seeds);
    let count = 0;
    for (const node of Object.values(state.nodes)) {
      if (node.status !== 'pending' || stillPossible.has(node.id)) continue;
      patchNode(state, node.id, { status: 'skipped' });
      count += 1;
    }
    if (count > 0) {
      logOf(
        state,
        'info',
        `${count} 个节点没被走到（分支未命中或图里有孤岛），标为 skipped`,
      );
    }
  }

  async function drive(
    active: ActiveRun,
    flow: AiFlowDefinition,
    resumeAt?: string,
  ): Promise<AiRunState> {
    const state = active.state;
    const index = createGraphIndex(flow);
    // resume 时先单独跑挂起的那个节点，同波残留的兄弟分支押后一轮合并 —— 否则人工输入的产物
    // 对它不可见，这是「等完人再往下走」的应有语义
    let carry: string[] = resumeAt ? [...state.frontier] : [];
    let frontier = dedupe(resumeAt ? [resumeAt] : state.frontier);

    while (frontier.length > 0 && state.status === 'running') {
      state.steps += 1;
      if (state.steps > maxSteps) {
        state.status = 'failed';
        logOf(
          state,
          'error',
          `推进波次超过上限 ${maxSteps}，图里存在不收敛的循环（设计期校验应报 cycle）`,
        );
        break;
      }

      const outcomes = await mapWithConcurrency(
        frontier,
        maxConcurrency,
        (nodeId) => executeNode(active, index, nodeId),
      );
      const next = dedupe([
        ...outcomes.flatMap((outcome) => outcome.next),
        ...carry,
      ]);
      carry = [];
      state.frontier = next;

      // await / finish / fail 都已经在 executeNode 里把 status 改好了
      if (state.status !== 'running') break;
      if (active.canceled) {
        state.status = 'canceled';
        break;
      }
      frontier = next;
    }

    if (active.canceled && state.status !== 'succeeded')
      state.status = 'canceled';

    if (state.status === 'awaiting') {
      // 挂起不是结束：frontier 留着兄弟分支，finishedAt 也不写，续跑时要接着用
      markUnreached(state, index);
      return state;
    }
    if (state.status === 'running') state.status = 'succeeded';
    state.finishedAt = clock();
    // 先标再清 frontier：frontier 一空，"还能走到哪儿"就无处可算了
    if (state.status === 'succeeded') markUnreached(state, index);
    state.frontier = [];
    emit({ kind: 'run.finished', runId: state.id, status: state.status });
    return state;
  }

  async function start(
    flow: AiFlowDefinition,
    input?: Record<string, unknown>,
  ): Promise<AiRunState> {
    const state = createState(flow, input);
    seenDefinitions.set(flow.id, flow);
    runs.set(state.id, state);
    const active: ActiveRun = {
      abort: new AbortController(),
      canceled: false,
      state,
    };
    actives.set(state.id, active);
    emit({ kind: 'run.started', flowId: flow.id, runId: state.id });

    if (!(flow.nodes?.length ?? 0)) {
      state.status = 'failed';
      state.finishedAt = clock();
      logOf(state, 'error', '流程图里一个节点都没有');
      emit({ kind: 'run.finished', runId: state.id, status: state.status });
      actives.delete(state.id);
      return state;
    }
    if (state.frontier.length === 0) {
      state.status = 'failed';
      state.finishedAt = clock();
      logOf(state, 'error', '流程图没有入口节点（全图入度都不为 0）');
      emit({ kind: 'run.finished', runId: state.id, status: state.status });
      actives.delete(state.id);
      return state;
    }

    try {
      return await drive(active, flow);
    } finally {
      actives.delete(state.id);
    }
  }

  return {
    cancel: (runId) => {
      const active = actives.get(runId);
      if (!active) return false;
      active.canceled = true;
      active.abort.abort(new Error('运行已取消'));
      logOf(active.state, 'info', '收到取消请求，正在停止尚未开始的节点');
      return true;
    },
    handlers: registry,
    on: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    options,
    provider: options.provider,
    resume: async (runState, humanInput) => {
      const state =
        typeof runState === 'string' ? runs.get(runState) : runState;
      if (!state) {
        throw new AiFlowError(
          typeof runState === 'string'
            ? `内存里没有 runId "${runState}" 的运行：跨进程续跑请把保存过的 AiRunState 整个传进来`
            : 'resume 需要一个 AiRunState：挂起的运行态本来就是纯数据，请由调用方保存后传入',
          'run-state-missing',
        );
      }
      if (state.status !== 'awaiting' || !state.awaiting) {
        throw new AiFlowError(
          `运行 ${state.id} 当前是 ${state.status}，不在等待人工确认的状态，不能续跑`,
          'run-not-awaiting',
        );
      }
      const flow = resolveDefinition(state.flowId);
      const nodeId = state.awaiting.nodeId;
      state.awaiting = undefined;
      state.status = 'running';
      state.finishedAt = undefined;
      patchNode(state, nodeId, { input: humanInput, status: 'running' });

      const active: ActiveRun = {
        abort: new AbortController(),
        canceled: false,
        state,
      };
      actives.set(state.id, active);
      runs.set(state.id, state);
      try {
        return await drive(active, flow, nodeId);
      } finally {
        actives.delete(state.id);
      }
    },
    run: start,
    state: (runId) => runs.get(runId),
  };
}
