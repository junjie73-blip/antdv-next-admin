import type { ExpressionEvaluator } from '@antdv/graph';

import type {
  BindingContext,
  DataSourceFetcher,
  DataSourceFunction,
  DataSourceSpec,
} from './types';

import { createExpressionEvaluator } from '@antdv/graph';

import {
  bareExpression,
  mergeContext,
  resolveValue,
  setPath,
  unsafePathMessage,
} from './binding';

/**
 * 数据源执行器：`static` / `rest` / `function` 三类取数，结果写回 scope。
 *
 * 分层位置：`core/`，纯 TS：不发请求、不认识浏览器。
 * 「取数」这件事的唯一出口是注入的 `fetcher` —— 本包不许 import 宿主的 `~/api`，
 * 也不许自己造一套请求层（那会和 `@antdv/request` 打架）。缺 `fetcher` 时 `rest` 类型
 * **明确报错**而不是返回空数组：空数据会被页面当成「今天没人下单」，
 * 而「没接触线」是配置问题，必须响。
 *
 * 本文件**不做**的事：不做缓存失效策略（刷新只有 `refresh`）、不做轮询（宿主定时调）、
 * 不做请求合并去重以外的优化（同 id 并发只发一次是唯一的去重规则）。
 */

/** 缺省取数超时；真实超时由宿主 fetcher 自己兜，这里只保证「不会永远挂在 loading 上」 */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export type DataSourceErrorCode =
  | 'dependency-cycle'
  | 'dependency-failed'
  | 'fetch-failed'
  | 'invalid-spec'
  | 'no-fetcher'
  | 'no-handler'
  | 'unknown-datasource'
  | 'unsafe-path';

export class DataSourceError extends Error {
  readonly code: DataSourceErrorCode;
  readonly dataSourceId: string;

  constructor(
    code: DataSourceErrorCode,
    message: string,
    dataSourceId: string,
  ) {
    super(message);
    this.code = code;
    this.dataSourceId = dataSourceId;
    this.name = 'DataSourceError';
  }

  static is(error: unknown): error is DataSourceError {
    return error instanceof DataSourceError;
  }
}

/** 一个数据源的运行态；`data` 在出错时保持上一次的值，方便页面「有旧数据就别白屏」 */
export interface DataSourceRunState {
  data: unknown;
  error: string | undefined;
  id: string;
  loading: boolean;
  /** 错误码同时暴露给 UI，宿主可以按 `no-fetcher` 之类的 code 出不同的提示 */
  code?: DataSourceErrorCode;
  path?: string;
  updatedAt?: number;
}

export interface DataSourceRunnerOptions {
  /** 每次取数前合成表达式上下文（宿主的登录人、字典等只读变量） */
  context?: () => BindingContext;
  datasources?: Iterable<DataSourceSpec>;
  evaluator?: ExpressionEvaluator;
  fetcher?: DataSourceFetcher;
  /** 传函数是为了让宿主在运行期换实现而不用重建 runner */
  functions?:
    | (() => Record<string, DataSourceFunction>)
    | Record<string, DataSourceFunction>;
  now?: () => number;
  timeoutMs?: number;
}

export interface DataSourceRunner {
  /** 增量登记；同 id 后到者覆盖（Schema 改了就该以新为准） */
  define: (specs: readonly DataSourceSpec[]) => void;
  get: (id: string) => DataSourceSpec | undefined;
  ids: () => string[];
  /** 已经成功取到数据（不含 loading 与 error） */
  isReady: (id: string) => boolean;
  /** 装载：已就绪直接返回旧值；正在装载复用同一个 promise；失败可再调 */
  load: (
    id: string,
    scope?: Record<string, unknown>,
  ) => Promise<DataSourceRunState>;
  /** 装载全部 `auto !== false` 的数据源；依赖关系由各自的 `load` 保证 */
  loadAll: (
    scope?: Record<string, unknown>,
  ) => Promise<Record<string, DataSourceRunState>>;
  /** 无视缓存重新取一次，依赖会一起重新检查 */
  refresh: (
    id: string,
    scope?: Record<string, unknown>,
  ) => Promise<DataSourceRunState>;
  reset: (id?: string) => void;
  stateOf: (id: string) => DataSourceRunState | undefined;
  states: () => Record<string, DataSourceRunState>;
  /** 订阅状态变化（loading / 成功 / 失败都推一次）；返回取消函数 */
  subscribe: (
    listener: (id: string, state: DataSourceRunState) => void,
  ) => () => void;
}

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

/**
 * 依赖环检测：`dependsOn` 写错成环时，「等依赖就绪」会永远等下去，
 * 页面表现为一个不动的 loading。宁可在这里明确失败。
 */
function detectCycle(
  specs: Map<string, DataSourceSpec>,
  id: string,
): string[] | undefined {
  const path: string[] = [];
  const seen = new Set<string>();

  function walk(current: string): string[] | undefined {
    const spec = specs.get(current);
    if (!spec) return undefined;
    if (path.includes(current))
      return [...path.slice(path.indexOf(current)), current];
    if (seen.has(current)) return undefined;
    seen.add(current);
    path.push(current);
    for (const dep of spec.dependsOn ?? []) {
      const found = specs.get(dep) ? walk(dep) : undefined;
      if (found) return found;
    }
    path.pop();
    return undefined;
  }

  return walk(id);
}

export function createDataSourceRunner(
  options: DataSourceRunnerOptions = {},
): DataSourceRunner {
  const specs = new Map<string, DataSourceSpec>();
  const state = new Map<string, DataSourceRunState>();
  /** 并发去重的唯一依据：同 id 在飞时后来的调用直接复用这个 promise */
  const pending = new Map<string, Promise<DataSourceRunState>>();
  const listeners = new Set<(id: string, state: DataSourceRunState) => void>();
  const evaluator = options.evaluator ?? createExpressionEvaluator();
  const now = options.now ?? (() => Date.now());

  for (const spec of options.datasources ?? []) specs.set(spec.id, spec);

  const write = (
    id: string,
    patch: Partial<DataSourceRunState>,
  ): DataSourceRunState => {
    const previous = state.get(id);
    // `id` 放在最后：它由参数决定，不该被 previous 或 patch 覆盖成别的
    const next: DataSourceRunState = {
      data: undefined,
      error: undefined,
      loading: false,
      ...previous,
      ...patch,
      id,
    };
    state.set(id, next);
    for (const listener of listeners) listener(id, next);
    return next;
  };

  const resolveFunctions = (): Record<string, DataSourceFunction> => {
    const raw = options.functions;
    if (!raw) return {};
    return typeof raw === 'function' ? raw() : raw;
  };

  const baseContext = (): BindingContext => options.context?.() ?? {};

  const timeoutMs = (): number => options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  /** 超时包装：fetcher 不响应中断也没关系，至少 loading 会落到 error */
  async function withTimeout<T>(
    task: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    if (!ms || ms <= 0) return task;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        task,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} 超过 ${ms}ms 没有返回`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async function fetchRest(
    spec: DataSourceSpec,
    scope: Record<string, unknown> | undefined,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!spec.url || !spec.url.trim())
      throw new DataSourceError(
        'invalid-spec',
        `rest 数据源「${spec.id}」没有配 url`,
        spec.id,
      );
    const fetcher = options.fetcher;
    if (!fetcher) {
      throw new DataSourceError(
        'no-fetcher',
        `rest 数据源「${spec.id}」需要取数器：请在宿主里 configureLowcode({ fetcher }) 注入（这里不静默返回空数据，空列表会被页面当成业务结论）`,
        spec.id,
      );
    }
    const limit = spec.timeoutMs ?? timeoutMs();
    return withTimeout(
      Promise.resolve(
        fetcher({
          body:
            spec.body === undefined
              ? undefined
              : resolveValue(spec.body, scope ?? {}, {
                  ctx: baseContext(),
                  evaluator,
                }),
          headers: spec.headers,
          method: (spec.method ?? 'GET').toUpperCase(),
          params,
          timeoutMs: limit,
          url: resolveValue(spec.url, scope ?? {}, {
            ctx: baseContext(),
            evaluator,
          }) as string,
        }),
      ),
      limit,
      `数据源「${spec.id}」`,
    );
  }

  async function runFunction(
    spec: DataSourceSpec,
    scope: Record<string, unknown> | undefined,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const functions = resolveFunctions();
    if (spec.handler) {
      const handler = functions[spec.handler];
      if (!handler) {
        throw new DataSourceError(
          'no-handler',
          `数据源「${spec.id}」的处理器「${spec.handler}」没有登记，现有：${Object.keys(functions).join(' / ') || '（无）'}`,
          spec.id,
        );
      }
      return await Promise.resolve(
        handler({
          evaluate: (expression) =>
            evaluator.evaluate(expression, {
              ...mergeContext(scope ?? {}, baseContext()),
              ...params,
              $params: params,
            }),
          params,
          scope: scope ?? {},
          spec,
        }),
      );
    }
    if (spec.expression) {
      // 没注册处理器时退化成受限表达式：够算个汇总值，也够宿主少写一行接线
      return evaluator.evaluate(bareExpression(spec.expression), {
        ...mergeContext(scope ?? {}, baseContext()),
        ...params,
        $params: params,
      });
    }
    throw new DataSourceError(
      'invalid-spec',
      `function 数据源「${spec.id}」既没有 handler 也没有 expression`,
      spec.id,
    );
  }

  async function fetchValue(
    spec: DataSourceSpec,
    scope: Record<string, unknown> | undefined,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (spec.kind) {
      case 'static': {
        return resolveValue(spec.data, scope ?? {}, {
          ctx: baseContext(),
          evaluator,
        });
      }
      case 'rest': {
        return await fetchRest(spec, scope, params);
      }
      case 'function': {
        return await runFunction(spec, scope, params);
      }
      default: {
        throw new DataSourceError(
          'invalid-spec',
          `数据源「${spec.id}」的 kind「${spec.kind}」不认识（可用 static / rest / function）`,
          spec.id,
        );
      }
    }
  }

  async function settle(
    id: string,
    scope: Record<string, unknown> | undefined,
  ): Promise<DataSourceRunState> {
    const spec = specs.get(id);
    if (!spec) {
      return write(id, {
        error: `数据源「${id}」不存在，Schema 里引用了没登记的 id`,
        loading: false,
        code: 'unknown-datasource',
      });
    }
    const cycle = detectCycle(specs, id);
    if (cycle) {
      return write(id, {
        code: 'dependency-cycle',
        error: `数据源依赖成环：${cycle.join(' -> ')}`,
        loading: false,
      });
    }

    // 依赖未就绪就不抢跑：走 `load` 而不是 `settle`，同一次装载里同一个依赖只会被取一次
    for (const dep of spec.dependsOn ?? []) {
      const depState = await load(dep, scope);
      if (depState.error) {
        return write(id, {
          code: 'dependency-failed',
          error: `依赖的数据源「${dep}」失败：${depState.error}`,
          loading: false,
        });
      }
    }

    write(id, {
      loading: true,
      error: undefined,
      code: undefined,
      path: spec.path,
    });
    try {
      const params = resolveValue(spec.params ?? {}, scope ?? {}, {
        ctx: baseContext(),
        evaluator,
      }) as Record<string, unknown>;
      const data = await fetchValue(spec, scope, params);
      if (spec.path) {
        const unsafe = unsafePathMessage(spec.path);
        if (unsafe) throw new DataSourceError('unsafe-path', unsafe, spec.id);
        if (scope) setPath(scope, spec.path, data);
      }
      return write(id, {
        data,
        error: undefined,
        code: undefined,
        loading: false,
        path: spec.path,
        updatedAt: now(),
      });
    } catch (error) {
      const error = DataSourceError.is(error) ? error : undefined;
      return write(id, {
        code: error?.code ?? 'fetch-failed',
        // 保留上一次的数据：页面「有旧数据就别白屏」比「一切归零」好过
        error: messageOf(error),
        loading: false,
        path: spec.path,
      });
    }
  }

  const load = (
    id: string,
    scope?: Record<string, unknown>,
  ): Promise<DataSourceRunState> => {
    const running = pending.get(id);
    if (running) return running;
    const current = state.get(id);
    if (current && !current.error && current.updatedAt !== undefined)
      return Promise.resolve(current);
    const task = settle(id, scope).finally(() => {
      pending.delete(id);
    });
    pending.set(id, task);
    return task;
  };

  return {
    define: (items) => {
      for (const spec of items) {
        if (!spec?.id) continue;
        specs.set(spec.id, spec);
      }
    },
    get: (id) => specs.get(id),
    ids: () => [...specs.keys()],
    isReady: (id) => {
      const item = state.get(id);
      return Boolean(item && item.updatedAt !== undefined && !item.error);
    },
    load,
    loadAll: async (scope) => {
      const targets = [...specs.values()].filter((spec) => spec.auto !== false);
      await Promise.all(targets.map((spec) => load(spec.id, scope)));
      const out: Record<string, DataSourceRunState> = {};
      for (const spec of targets) out[spec.id] = state.get(spec.id)!;
      return out;
    },
    refresh: (id, scope) => {
      // 清掉缓存与在飞的 promise：刷新按钮点在 loading 中时必须真的重发一次，
      // 否则复用旧 promise 会让它「转一下就没动静」。依赖仍在 settle 里各自重判。
      state.delete(id);
      pending.delete(id);
      return load(id, scope);
    },
    reset: (id) => {
      if (id === undefined) {
        state.clear();
        pending.clear();
        return;
      }
      state.delete(id);
      pending.delete(id);
    },
    stateOf: (id) => state.get(id),
    states: () => {
      const out: Record<string, DataSourceRunState> = {};
      for (const [key, value] of state) out[key] = value;
      return out;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
