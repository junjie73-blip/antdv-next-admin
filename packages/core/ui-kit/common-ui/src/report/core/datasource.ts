/**
 * 取数适配层：`core/`，只定义「怎么拿到行」，不关心拿到之后怎么算。
 *
 * 存在的理由是本仓库的一条硬规矩：**子包不许 import 宿主的 `~/api` / `~/stores`**。
 * 所以取数能力一律以接口形式出现，由宿主在 `configureReport({ source | fetcher })` 注进来；
 * 单测与示例页则用这里的 `createStaticSource()` 跑同一套渲染链路。
 *
 * 三条确定性口径：
 * 1. **取不到数据要报错，不许静默给空表**：空表在 UI 上和"这个月真的没生意"长得一模一样，
 *    是最难排查的一类"数据不对"。未知数据集 id 会把已注册的 id 一起写进 message。
 * 2. **同一份请求只发一次**：一张报表里常有 4 个 widget 用同一个数据集，
 *    按 `datasetId + params 指纹`合并并发请求（见 `createRequestCoalescer`）。
 * 3. **取消只影响调用方**：外部 `signal` 触发时该调用方拿到 `AbortError`，
 *    共享的底层请求继续跑完给其他等待者 —— 反过来说，要真正掐掉网络请求请把同一个
 *    `AbortController` 的 signal 透给你的 fetcher（本包把 signal 交出去了）。
 *
 * 不做的事：不做缓存失效策略（TTL/ETag 属于宿主）、不做分页、不做重试。
 */

import type { DatasetSpec, FilterValues, Row } from './types';

/** 一次取数的上下文 */
export interface ReportLoadContext {
  /** 报表级过滤器的当前值，供远端把它们翻译成查询参数 */
  filters?: FilterValues;
  /** 参与请求指纹的额外参数；同 params 同数据集的并发请求会被合并 */
  params?: Record<string, unknown>;
  /** 取消信号；由调用方持有 */
  signal?: AbortSignal;
}

export interface ReportDataSource {
  load: (
    dataset: DatasetSpec,
    ctx: ReportLoadContext,
  ) => Promise<Row[]> | Row[];
}

export type DatasourceErrorCode =
  | 'dataset-not-found'
  | 'empty-payload'
  | 'fetcher-missing'
  | 'rows-key-missing'
  | 'shape-unsupported';

export class ReportDataSourceError extends Error {
  constructor(
    readonly code: DatasourceErrorCode,
    message: string,
    readonly datasetId?: string,
  ) {
    super(message);
    this.name = 'ReportDataSourceError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}

export function createAbortError(message = '请求已取消'): Error {
  if (typeof DOMException === 'function')
    return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * 参数指纹：对象键排序后序列化。
 *
 * 排序是必须的 —— `{'a':1,'b':2}` 与 `{'b':2,'a':1}` 是同一个请求，
 * 不排序的话每次 JSON 键序一变就多打一次接口，表现为"刷新一下又转圈"。
 * 值里出现 `undefined` 时按 `null` 处理，与 JSON 往返一致。
 */
export function fingerprintParams(
  params: Record<string, unknown> | undefined,
): string {
  if (!params) return '{}';
  const entries = Object.keys(params)
    .toSorted()
    .map(
      (key) => [key, params[key] === undefined ? null : params[key]] as const,
    );
  return JSON.stringify(stable(entries));
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stable(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .toSorted()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** 请求指纹 = 数据集 + 参数，合并与去重都以它为单位 */
export function requestKey(
  datasetId: string,
  params: Record<string, unknown> | undefined,
): string {
  return `${datasetId}|${fingerprintParams(params)}`;
}

export interface RequestCoalescer {
  /** 掐掉所有在途请求：底层 signal 被 abort，等待者（含没传 signal 的）一起拿到 AbortError */
  abortAll: (reason?: string) => void;
  /** 当前在途的指纹，调试用 */
  inflight: () => string[];
  /** 同一个 key 并发只执行一次 executor；返回的 promise 各自受自己的 signal 约束 */
  run: <T>(
    key: string,
    executor: (signal: AbortSignal) => Promise<T> | T,
    signal?: AbortSignal,
  ) => Promise<T>;
}

export function createRequestCoalescer(): RequestCoalescer {
  const pending = new Map<
    string,
    { controller: AbortController; promise: Promise<unknown> }
  >();

  return {
    // `createAbortError` 而不是裸 `new Error`：`name` 必须是 AbortError，
    // 下游 `isAbortError` 才认得出"这是取消不是故障"，不会把它记进错误率。
    abortAll(reason) {
      const error = createAbortError(reason ?? '请求已取消');
      for (const entry of pending.values()) entry.controller.abort(error);
      pending.clear();
    },
    inflight: () => [...pending.keys()],
    run<T>(
      key: string,
      executor: (signal: AbortSignal) => Promise<T> | T,
      signal?: AbortSignal,
    ) {
      const existing = pending.get(key);
      if (existing) return withSignal(existing.promise, signal) as Promise<T>;

      const controller = new AbortController();
      const settled = Promise.resolve().then(() => executor(controller.signal));
      // 与 abort 信号赛跑：否则 `abortAll` 之后共享 promise 永远 pending，
      // 没传 signal 的调用方会一直转圈 —— 而注释里承诺的是"等待者一起拒绝"。
      const shared = Promise.race([
        settled,
        rejectOnAbort<unknown>(controller.signal),
      ]);
      const entry = { controller, promise: shared };
      pending.set(key, entry);
      // 失败由各调用方各自的 withSignal 分支负责；这里成对处理既清索引，
      // 也避免"共享 promise 没人接"造成的 unhandledRejection 噪音。
      // 挂在 race 结果（而不是 settled）上：executor 永不落定但被 abort 时也要出索引。
      const drop = () => {
        if (pending.get(key) === entry) pending.delete(key);
      };
      void shared.then(drop, drop);
      return withSignal(entry.promise, signal) as Promise<T>;
    },
  };
}

/**
 * 把 signal 变成一个「abort 时拒绝、否则永不落定」的 promise。
 *
 * 只用于 `Promise.race`：`race` 会给每个入参挂 handler，所以这条 promise
 * 在"输了"的时候不会产生 unhandledRejection —— 这是它比裸 addEventListener 安全的地方。
 */
function rejectOnAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    const abort = () => {
      const raw = signal.reason;
      // DOMException 在 Node / 浏览器里都**不是** `instanceof Error`，所以两条都判：
      // 只判 Error 的话 `abortAll('页面已卸载')` 的原因会被兜底成默认的「请求已取消」，
      // 宿主控制台看到的是"取消了"而不是"为什么取消"。
      if (
        raw instanceof Error ||
        (typeof DOMException === 'function' && raw instanceof DOMException)
      ) {
        reject(raw);
        return;
      }
      reject(createAbortError(typeof raw === 'string' ? raw : undefined));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * 从"接口原样返回的东西"里取出行数组。
 *
 * `rowsKey` 支持 `data.list` 这样的点路径；给了路径却取不到数组时抛错并说明取到了什么，
 * 比悄悄返回 `[]` 值钱得多（口径 1）。没给 `rowsKey` 时，只认"本身是数组"或
 * `{ rows / records / items / list / data }` 这几个常见包装键。
 */
export function readRowsAt(
  payload: unknown,
  rowsKey?: string,
  datasetId?: string,
): Row[] {
  if (Array.isArray(payload)) return payload as Row[];

  if (!payload || typeof payload !== 'object') {
    throw new ReportDataSourceError(
      'shape-unsupported',
      `返回的数据无法解释成行数组（实际是 ${payload === null ? 'null' : typeof payload}）`,
      datasetId,
    );
  }

  if (rowsKey) {
    const value = rowsKey
      .split('.')
      .reduce<unknown>(
        (acc, segment) =>
          (acc as Record<string, unknown> | undefined)?.[segment],
        payload,
      );
    if (!Array.isArray(value)) {
      throw new ReportDataSourceError(
        'rows-key-missing',
        `按 rowsKey「${rowsKey}」没取到数组（取到的是 ${value === null ? 'null' : typeof value}）`,
        datasetId,
      );
    }
    return value as Row[];
  }

  const record = payload as Record<string, unknown>;
  for (const candidate of ['rows', 'records', 'items', 'list', 'data']) {
    if (Array.isArray(record[candidate])) return record[candidate] as Row[];
  }
  throw new ReportDataSourceError(
    'rows-key-missing',
    `返回的是对象但没声明 rowsKey，可识别的包装键（rows/records/items/list/data）也都不存在`,
    datasetId,
  );
}

/**
 * 静态载荷的两种写法：裸行数组，或接口信封对象。
 *
 * 后者是刻意支持的 —— 示例页与单测要模拟真实后端（`{ code, data: { list } }`），
 * 拆法与远端完全一致：都交给 `readRowsAt` 按 `dataset.rowsKey` 拆，
 * 这样"换成真接口"只改 source，不改 DSL。
 */
export type StaticPayload = Record<string, unknown> | Row[];

export type StaticTable =
  | (() => Promise<StaticPayload> | StaticPayload)
  | StaticPayload;

/** 内存数据集：示例页、单测、以及"后端还没好"的第一版都用它 */
export function createStaticSource(
  tables: Record<string, StaticTable>,
): ReportDataSource {
  const keys = Object.keys(tables);
  return {
    load(dataset) {
      const table = tables[dataset.id];
      if (table === undefined) {
        throw new ReportDataSourceError(
          'dataset-not-found',
          `静态源里没有数据集「${dataset.id}」，已注册的有：${keys.length > 0 ? keys.join(', ') : '（空）'}`,
          dataset.id,
        );
      }
      const rows = typeof table === 'function' ? table() : table;
      return Promise.resolve(rows).then((list) =>
        readRowsAt(list, dataset.rowsKey, dataset.id),
      );
    },
  };
}

/** 把任意"给我数据集，还我行"的函数包成数据源；宿主接自己的 request 客户端时最省事的一条路 */
export function createFunctionSource(
  load: (
    dataset: DatasetSpec,
    ctx: ReportLoadContext,
  ) => Promise<Row[]> | Row[],
): ReportDataSource {
  return { load };
}

export interface RemoteRequest {
  dataset: DatasetSpec;
  params: Record<string, unknown>;
  signal: AbortSignal;
}

export type RemoteFetcher = (request: RemoteRequest) => Promise<unknown>;

export interface RemoteSourceOptions {
  /** 真正发请求的函数；没注入时 load 会抛可诊断错误而不是返回空表 */
  fetcher?: RemoteFetcher;
}

/**
 * 远端数据源：把 `fetcher` 套上"同指纹合并 + 可取消"。
 *
 * 本包**不自己调 fetch**：宿主的 request 客户端带了鉴权、刷新 token、错误码约定，
 * 在这里 new 一个 fetch 等于把那些全绕开。
 */
export function createRemoteSource(
  options: RemoteSourceOptions = {},
): ReportDataSource {
  const coalescer = createRequestCoalescer();
  return {
    load(dataset, ctx) {
      if (!options.fetcher) {
        throw new ReportDataSourceError(
          'fetcher-missing',
          `数据集「${dataset.id}」声明为 remote，但没有注入 fetcher：请在宿主入口调用 configureReport({ fetcher })`,
          dataset.id,
        );
      }
      const fetcher = options.fetcher;
      const params = ctx.params ?? {};
      // 落到 `readRowsAt` 才返回：远端信封（`{code, data:{list}}`）在这里拆，
      // 与静态源同一套 `rowsKey` 口径 —— 否则宿主拿到的是原始 JSON，聚合层直接空表。
      return coalescer
        .run(
          requestKey(dataset.id, params),
          (signal) => fetcher({ dataset, params, signal }),
          ctx.signal,
        )
        .then((payload) => readRowsAt(payload, dataset.rowsKey, dataset.id));
    },
  };
}

/**
 * 组合数据源：按数组顺序依次尝试，第一个**同步给得出结果**的源胜出。
 *
 * 只接同步抛错是刻意的：`createStaticSource` 遇到未知数据集 id 就是同步 throw，
 * 于是"static 里没这张表 → 退到 remote"这条链成立；而已经发出的请求失败（异步 reject）
 * 不回头退 —— 静默退到另一份数据 = 数字对不上账还没人知道（口径 1）。
 * 取消（AbortError）永远直接上抛，不再往下试。
 */
export function createFallbackSource(
  sources: ReportDataSource[],
): ReportDataSource {
  return {
    load(dataset, ctx) {
      const errors: string[] = [];
      for (const source of sources) {
        try {
          return source.load(dataset, ctx);
        } catch (error) {
          if (isAbortError(error)) throw error;
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      throw new ReportDataSourceError(
        'dataset-not-found',
        `没有数据源能提供数据集「${dataset.id}」：${errors.join('；')}`,
        dataset.id,
      );
    },
  };
}
