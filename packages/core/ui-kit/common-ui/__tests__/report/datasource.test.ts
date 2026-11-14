import type { RemoteRequest } from '../../src/report/core/datasource';
import type { DatasetSpec, Row } from '../../src/report/core/types';

import { describe, expect, it, vi } from 'vitest';

import {
  createAbortError,
  createFallbackSource,
  createFunctionSource,
  createRemoteSource,
  createRequestCoalescer,
  createStaticSource,
  fingerprintParams,
  isAbortError,
  readRowsAt,
  ReportDataSourceError,
  requestKey,
} from '../../src/report/core/datasource';

/**
 * 取数层是「报表数字对不对」的上游：这里钉住四条最容易出线上事故的口径 ——
 * 脏信封要报错不要空表（`readRowsAt`）、同指纹并发只打一次（合并）、
 * 取消只影响按下取消的那个人（其余等待者照拿）、分派失败要把每个源的失败原因拼出来。
 * 断言尽量落在「调用了几次 executor / 拿到什么行」上，不依赖内部结构。
 */

function dataset(overrides: Partial<DatasetSpec> = {}): DatasetSpec {
  return {
    fields: [{ key: 'region', kind: 'dimension', label: '区域' }],
    id: 'ds-1',
    name: '销售明细',
    source: 'static',
    ...overrides,
  };
}

const rows: Row[] = [{ region: '华东' }, { region: '华北' }];

describe('参数指纹与请求键', () => {
  it('键序不影响指纹：同参数不同写法是同一个请求', () => {
    expect(fingerprintParams({ a: 1, b: 2 })).toBe(
      fingerprintParams({ b: 2, a: 1 }),
    );
    expect(requestKey('ds-1', { a: 1, b: 2 })).toBe(
      requestKey('ds-1', { b: 2, a: 1 }),
    );
  });

  it('嵌套对象同样排序，undefined 按 null 处理（与 JSON 往返一致）', () => {
    expect(fingerprintParams({ outer: { b: 2, a: 1 } })).toBe(
      fingerprintParams({ outer: { a: 1, b: 2 } }),
    );
    expect(fingerprintParams({ a: undefined })).toBe(
      fingerprintParams({ a: null }),
    );
    expect(fingerprintParams(undefined)).toBe('{}');
  });

  it('数据集不同的同参数不是同一把键', () => {
    expect(requestKey('ds-1', { a: 1 })).not.toBe(requestKey('ds-2', { a: 1 }));
  });
});

describe('readRowsAt：信封拆解只许成功或报错', () => {
  it('本身是数组时原样返回', () => {
    expect(readRowsAt(rows)).toBe(rows);
    expect(readRowsAt([])).toEqual([]);
  });

  it('rowsKey 支持点路径', () => {
    const payload = { code: 0, data: { list: rows, total: 2 } };
    expect(readRowsAt(payload, 'data.list')).toEqual(rows);
  });

  it('给了 rowsKey 却取不到数组：报错并说清取到了什么', () => {
    expect(() =>
      readRowsAt({ data: { list: 'x' } }, 'data.list', 'ds-1'),
    ).toThrow(ReportDataSourceError);
    try {
      readRowsAt({ data: {} }, 'data.list', 'ds-1');
      expect.unreachable('应当抛错');
    } catch (error) {
      const err = error as ReportDataSourceError;
      expect(err.code).toBe('rows-key-missing');
      expect(err.datasetId).toBe('ds-1');
      expect(err.message).toContain('取到的是 undefined');
    }
  });

  it('没给 rowsKey 时认常见包装键，第一个命中算数', () => {
    expect(readRowsAt({ rows })).toEqual(rows);
    expect(readRowsAt({ records: rows })).toEqual(rows);
    expect(readRowsAt({ list: rows })).toEqual(rows);
    expect(readRowsAt({ data: { nope: 1 }, rows })).toEqual(rows);
  });

  it('对象里没有任何可识别包装键：报错而不是空表', () => {
    expect(() => readRowsAt({ code: 0, msg: 'ok' }, undefined, 'ds-1')).toThrow(
      /rowsKey/,
    );
  });

  it('非对象载荷（字符串 / null / 数字）给 shape-unsupported', () => {
    for (const payload of ['nope', 42, null, undefined]) {
      const code = catchCode(() => readRowsAt(payload));
      expect(code).toBe('shape-unsupported');
    }
  });
});

/** 取 `ReportDataSourceError.code`，不是这个类型就给 `null`，方便断言"错在哪一类" */
function catchCode(run: () => unknown): null | string {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ReportDataSourceError ? error.code : null;
  }
}

describe('createStaticSource', () => {
  it('命中数据集就直接给行，数组与异步工厂都支持', async () => {
    const source = createStaticSource({
      'ds-1': rows,
      'ds-async': () => Promise.resolve(rows),
    });
    await expect(source.load(dataset(), {})).resolves.toEqual(rows);
    await expect(source.load(dataset({ id: 'ds-async' }), {})).resolves.toEqual(
      rows,
    );
  });

  it('未知数据集 id：同步抛错，并把已注册的 id 写进 message', () => {
    // 同步抛（而不是返回 rejected promise）是 `createFallbackSource` 能退到下一个源的前提
    const source = createStaticSource({ 'ds-a': [], 'ds-b': [] });
    expect(() => source.load(dataset({ id: 'nope' }), {})).toThrow(
      /ds-a, ds-b/,
    );
    expect(() => createStaticSource({}).load(dataset(), {})).toThrow(/（空）/);
  });

  it('静态表也可以是包裹对象，按 rowsKey 拆', async () => {
    const source = createStaticSource({ 'ds-1': { data: { list: rows } } });
    await expect(
      source.load(dataset({ rowsKey: 'data.list' }), {}),
    ).resolves.toEqual(rows);
  });
});

describe('createFunctionSource', () => {
  it('同步返回行也行：适配层不强迫宿主异步', () => {
    const seen: string[] = [];
    const source = createFunctionSource((specDataset, ctx) => {
      seen.push(`${specDataset.id}:${JSON.stringify(ctx.params ?? null)}`);
      return rows;
    });
    expect(source.load(dataset(), { params: { p: 1 } })).toEqual(rows);
    expect(seen).toEqual(['ds-1:{"p":1}']);
  });
});

describe('createRequestCoalescer', () => {
  it('同键并发只执行一次，两个调用方拿到同一个结果', async () => {
    const coalescer = createRequestCoalescer();
    const executor = vi.fn(
      () => new Promise<number>((resolve) => setTimeout(() => resolve(7), 5)),
    );
    const [a, b] = await Promise.all([
      coalescer.run('k', executor),
      coalescer.run('k', executor),
    ]);
    expect(a).toBe(7);
    expect(b).toBe(7);
    expect(executor).toHaveBeenCalledTimes(1);
    // 落定后索引清空：再来一次是新请求
    expect(coalescer.inflight()).toEqual([]);
    await coalescer.run('k', executor);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('不同键各跑一次，inflight 看得见', async () => {
    const coalescer = createRequestCoalescer();
    let release = (): void => {};
    const pending = new Promise<number>((resolve) => {
      release = () => resolve(1);
    });
    const first = coalescer.run('a', () => pending);
    const second = coalescer.run('b', () => pending);
    expect(coalescer.inflight().toSorted()).toEqual(['a', 'b']);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 1]);
    expect(coalescer.inflight()).toEqual([]);
  });

  it('调用方自己的 signal 取消：只拒绝这一路，共享请求继续给其他等待者', async () => {
    const coalescer = createRequestCoalescer();
    let release = (): void => {};
    const executor = () =>
      new Promise<number>((resolve) => {
        release = () => resolve(9);
      });
    const controller = new AbortController();
    const mine = coalescer.run('k', executor, controller.signal);
    const theirs = coalescer.run('k', executor);
    controller.abort();
    await expect(mine).rejects.toSatisfy(isAbortError);
    release();
    await expect(theirs).resolves.toBe(9);
  });

  it('abortAll 掐掉全部在途：连没传 signal 的等待者也一起失败', async () => {
    const coalescer = createRequestCoalescer();
    // 一个永不落定的 executor：只能靠 abort 把它摘掉
    const hung = coalescer.run('k', () => new Promise<number>(() => {}));
    expect(coalescer.inflight()).toEqual(['k']);
    coalescer.abortAll('页面已卸载');
    const error = await hung.catch((error: unknown) => error);
    expect((error as Error).message).toContain('页面已卸载');
    expect(isAbortError(error)).toBe(true);
    // 索引清空：abortAll 之后同键可以重新发起
    expect(coalescer.inflight()).toEqual([]);
  });

  it('失败也要清索引：否则失败的键会永远卡在 pending 里', async () => {
    const coalescer = createRequestCoalescer();
    const boom = vi.fn(() => Promise.reject(new Error('500')));
    await expect(coalescer.run('k', boom)).rejects.toThrow('500');
    await expect(coalescer.run('k', boom)).rejects.toThrow('500');
    expect(boom).toHaveBeenCalledTimes(2);
    expect(coalescer.inflight()).toEqual([]);
  });

  it('请求已完成后再取消调用方：结果照常拿到，不会翻车', async () => {
    const coalescer = createRequestCoalescer();
    const controller = new AbortController();
    const job = coalescer.run('k', () => Promise.resolve(3), controller.signal);
    await expect(job).resolves.toBe(3);
    controller.abort();
    await expect(job).resolves.toBe(3);
  });
});

describe('createRemoteSource', () => {
  it('没注入 fetcher：报可诊断错误，而不是静默空表', () => {
    const source = createRemoteSource();
    expect(() => source.load(dataset({ source: 'remote' }), {})).toThrow(
      /configureReport/,
    );
  });

  it('把 dataset / params / signal 交给 fetcher，并把信封拆成行', async () => {
    const seen: RemoteRequest[] = [];
    const source = createRemoteSource({
      fetcher: (request) => {
        seen.push(request);
        return Promise.resolve({ data: { list: rows } });
      },
    });
    const controller = new AbortController();
    const loaded = await source.load(
      dataset({ rowsKey: 'data.list', source: 'remote' }),
      {
        params: { month: '2026-11' },
        signal: controller.signal,
      },
    );
    expect(loaded).toEqual(rows);
    expect(seen[0]?.params).toEqual({ month: '2026-11' });
    expect(seen[0]?.dataset.id).toBe('ds-1');
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('同数据集同参数并发只发一次请求（一张报表多个 widget 复用）', async () => {
    const fetcher = vi.fn(() => Promise.resolve(rows));
    const source = createRemoteSource({ fetcher });
    const spec = dataset({ source: 'remote' });
    const [a, b] = await Promise.all([
      source.load(spec, { params: { p: 1 } }),
      source.load(spec, { params: { p: 1 } }),
    ]);
    expect(a).toEqual(rows);
    expect(b).toEqual(rows);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await source.load(spec, { params: { p: 2 } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fetcher 报错原样上抛（空表不是错误的一种）', async () => {
    const source = createRemoteSource({
      fetcher: () => Promise.reject(new Error('网关 502')),
    });
    await expect(
      source.load(dataset({ source: 'remote' }), {}),
    ).rejects.toThrow('网关 502');
  });
});

describe('createFallbackSource', () => {
  it('第一个源给不出这个数据集时退到第二个', () => {
    const fallback = createFallbackSource([
      createStaticSource({ 'ds-other': rows }),
      createFunctionSource(() => rows),
    ]);
    expect(fallback.load(dataset(), {})).toEqual(rows);
  });

  it('全部失败：把每个源的失败原因都拼进 message', () => {
    const fallback = createFallbackSource([
      createStaticSource({}),
      createFunctionSource(() => {
        throw new Error('接口挂了');
      }),
    ]);
    expect(() => fallback.load(dataset(), {})).toThrow(
      /静态源里没有数据集.*接口挂了/s,
    );
  });

  it('取消是硬停：不继续往下一个源退', () => {
    const second = vi.fn(() => rows);
    const fallback = createFallbackSource([
      createFunctionSource(() => {
        throw createAbortError();
      }),
      createFunctionSource(second),
    ]);
    let caught: unknown;
    try {
      fallback.load(dataset(), {});
      expect.unreachable('应当抛取消');
    } catch (error) {
      caught = error;
    }
    expect(isAbortError(caught)).toBe(true);
    expect(second).not.toHaveBeenCalled();
  });

  it('空源数组：给可诊断错误而不是静默空表', () => {
    expect(() => createFallbackSource([]).load(dataset(), {})).toThrow(
      /没有数据源能提供数据集/,
    );
  });
});

describe('取消的表示', () => {
  it('自造错误时不依赖 DOMException 也认得出 AbortError', () => {
    const error = createAbortError('不要了');
    expect(error.name).toBe('AbortError');
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('普通错误'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
  });
});
