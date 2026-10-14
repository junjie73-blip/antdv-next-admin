import type { PaginationProps, Recordable } from '../src/types';

import { computed, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { configureTable } from '../src/config';
import { useDataSource } from '../src/hooks/useDataSource';

function makeOptions(overrides: Record<string, any> = {}) {
  const loading = { setLoading: vi.fn() };
  const paginationState: PaginationProps = { current: 1, pageSize: 10, total: 0 };
  const pagination = {
    getPagination: () => paginationState,
    setPagination: (info: Partial<PaginationProps>) => {
      Object.assign(paginationState, info);
    },
  };
  return {
    options: {
      loading,
      pagination,
      rowKey: computed(() => 'id'),
      ...overrides,
    },
    paginationState,
    setLoading: loading.setLoading,
  };
}

/** `immediate` 走的是 `useTimeoutFn(fn, 0)`（宏任务），要放多个宏任务才能稳定等到取数落地 */
const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await nextTick();
};

describe('useDataSource — 无 api 的本地数据模式', () => {
  it('setup 阶段即同步写入，首屏就有数据（静态 dataSource + isTree 的表依赖这点）', () => {
    const { options } = makeOptions({
      dataSource: computed(() => [{ id: 1 }]),
    });
    const hook = useDataSource(options as any);
    expect(hook.dataSourceRef.value).toEqual([{ id: 1 }]);
  });

  it('外部 dataSource 变化会刷新，且 rawDataSource 是深拷贝', async () => {
    const source = ref<Recordable[]>([{ id: 1, name: 'a' }]);
    const { options } = makeOptions({ dataSource: computed(() => source.value) });
    const hook = useDataSource(options as any);

    source.value = [{ id: 1, name: 'b' }];
    await nextTick();
    expect(hook.dataSourceRef.value[0]!.name).toBe('b');
    expect(hook.rawDataSourceRef.value).not.toBe(hook.dataSourceRef.value);
  });

  it('insert / delete / update / find 按 rowKey 定位', () => {
    const { options } = makeOptions({
      dataSource: computed(() => [
        { id: '1', name: 'a' },
        { id: '2', name: 'b' },
      ]),
    });
    const hook = useDataSource(options as any);

    hook.insertTableDataRecord({ id: '3', name: 'c' }, 1);
    expect(hook.dataSourceRef.value.map((r) => r.id)).toEqual([
      '1',
      '3',
      '2',
    ]);

    expect(hook.findTableDataRecord('3')).toMatchObject({ name: 'c' });

    hook.updateTableDataRecord('3', { name: 'cc' });
    expect(hook.findTableDataRecord('3')!.name).toBe('cc');

    hook.deleteTableDataRecord('1');
    expect(hook.dataSourceRef.value.map((r) => r.id)).toEqual(['3', '2']);
  });

  it('函数型 rowKey 同样可用于定位', () => {
    const { options } = makeOptions({
      dataSource: computed(() => [{ code: 'x' }]),
      rowKey: computed(() => (record: Recordable) => record.code),
    });
    const hook = useDataSource(options as any);
    expect(hook.findTableDataRecord('x')).toEqual({ code: 'x' });
  });
});

describe('useDataSource — api 取数', () => {
  it('默认 pageNum / pageSize 字段与 list/total 解析', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 42 }));
    const { options, paginationState } = makeOptions({ api });
    const hook = useDataSource(options as any);
    await flush();

    expect(hook.dataSourceRef.value).toEqual([{ id: 1 }]);
    expect(paginationState.total).toBe(42);
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ pageNum: 1, pageSize: 10 }),
    );
  });

  it('响应形状嗅探：list → items → data → records → 裸数组，且只认 Array', async () => {
    const shapes: Array<[any, number]> = [
      [{ items: [{ id: 1 }, { id: 2 }], totalCount: 99 }, 2],
      [{ data: [{ id: 1 }] }, 1],
      [{ records: [{ id: 1 }] }, 1],
      [[{ id: 1 }], 1],
      [{ list: null, items: [{ id: 1 }] }, 1],
    ];
    for (const [body, length] of shapes) {
      const api = vi.fn(async () => body);
      const { options, paginationState } = makeOptions({ api });
      const hook = useDataSource(options as any);
      await flush();
      expect(hook.dataSourceRef.value).toHaveLength(length);
      // 有 total 字段时用字段，没有时退化成条数
      expect(paginationState.total).toBe(body.totalCount ?? body.total ?? length);
    }
  });

  it('外层 data 包装会被解开', async () => {
    const api = vi.fn(async () => ({
      code: 0,
      data: { list: [{ id: 5 }], total: 5 },
      msg: '',
    }));
    const { options } = makeOptions({ api });
    const hook = useDataSource(options as any);
    await flush();
    expect(hook.dataSourceRef.value).toEqual([{ id: 5 }]);
  });

  it('total 是字符串也能用；解析不出（退化成 0 条）时不覆盖已有总数', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: '50' }));
    const { options, paginationState } = makeOptions({ api });
    useDataSource(options as any);
    await flush();
    expect(paginationState.total).toBe(50);

    const dirty = vi.fn(async () => ({ list: [], total: 'abc' }));
    const dirtyOptions = makeOptions({ api: dirty });
    dirtyOptions.paginationState.total = 7;
    const hook = useDataSource(dirtyOptions.options as any);
    await flush();
    expect(hook.dataSourceRef.value).toEqual([]);
    // total<=0 不写回，避免把分页器打回 0
    expect(dirtyOptions.paginationState.total).toBe(7);
  });

  it('自定义 fetchSetting 字段名', async () => {
    const api = vi.fn(async () => ({ rows: [{ id: 1 }], count: 3 }));
    const { options, paginationState } = makeOptions({
      api,
      fetchSetting: {
        listField: 'rows',
        pageField: 'page',
        sizeField: 'size',
        totalField: 'count',
      },
    });
    useDataSource(options as any);
    await flush();
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, size: 10 }),
    );
    expect(paginationState.total).toBe(3);
  });

  it('params / searchInfo 合并进请求，且 searchInfo 会被记住', async () => {
    const api = vi.fn(async () => ({ list: [], total: 0 }));
    const { options } = makeOptions({
      api,
      params: computed(() => ({ tenant: 't1' })),
    });
    const hook = useDataSource(options as any);
    await flush();

    await hook.fetch({ searchInfo: { keyword: 'abc' } });
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'abc', tenant: 't1' }),
    );

    // 后续不带条件的 reload 沿用上一次条件
    await hook.reload();
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'abc' }),
    );
  });

  it('setSearchInfo 只改记忆不取数（重置表单不自动查询的场景）', async () => {
    const api = vi.fn(async () => ({ list: [], total: 0 }));
    const { options } = makeOptions({ api });
    const hook = useDataSource(options as any);
    await hook.fetch({ searchInfo: { keyword: 'abc' } });
    api.mockClear();

    hook.setSearchInfo({});
    expect(api).not.toHaveBeenCalled();

    await hook.reload();
    expect(api).toHaveBeenCalledWith(expect.not.objectContaining({ keyword: 'abc' }));
  });

  it('reload 回到第一页', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 30 }));
    const { options, paginationState } = makeOptions({ api });
    const hook = useDataSource(options as any);
    await flush();
    paginationState.current = 3;

    await hook.reload();
    expect(paginationState.current).toBe(1);
  });

  it('fields 透传给接口（列字段裁剪）', async () => {
    const api = vi.fn(async () => ({ list: [], total: 0 }));
    const { options } = makeOptions({
      api,
      fields: computed(() => ['name', 'age']),
    });
    useDataSource(options as any);
    await flush();
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ fields: ['name', 'age'] }),
    );
  });

  it('beforeFetch 返回 false 时不发请求', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 1 }));
    const { options } = makeOptions({ api, beforeFetch: () => false });
    useDataSource(options as any);
    await flush();
    expect(api).not.toHaveBeenCalled();
  });

  it('beforeFetch 可改写参数', async () => {
    const api = vi.fn(async () => ({ list: [], total: 0 }));
    const { options } = makeOptions({
      api,
      beforeFetch: (params: any) => ({ ...params, injected: true }),
    });
    useDataSource(options as any);
    await flush();
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ injected: true }));
  });

  it('afterFetch 加工列表', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 1 }));
    const { options } = makeOptions({
      api,
      afterFetch: (data: Recordable[]) =>
        data.map((item) => ({ ...item, name: 'processed' })),
    });
    const hook = useDataSource(options as any);
    await flush();
    expect(hook.dataSourceRef.value[0]!.name).toBe('processed');
  });

  it('loading 开关成对出现', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 1 }));
    const { options, setLoading } = makeOptions({ api });
    useDataSource(options as any);
    await flush();
    expect(setLoading.mock.calls[0]![0]).toBe(true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('immediate: false 不自动取数', async () => {
    const api = vi.fn(async () => ({ list: [{ id: 1 }], total: 1 }));
    const { options } = makeOptions({ api, immediate: false });
    const hook = useDataSource(options as any);
    await flush();
    expect(api).not.toHaveBeenCalled();
    expect(hook.dataSourceRef.value).toEqual([]);
  });

  it('过期响应被丢弃（只落地最新一次）', async () => {
    let call = 0;
    const api = vi.fn(
      () =>
        new Promise<any>((resolve) => {
          call += 1;
          const mine = call;
          // 先发的请求反而更慢到
          setTimeout(() => resolve({ list: [{ id: mine }], total: mine }), mine === 1 ? 30 : 5);
        }),
    );
    const { options } = makeOptions({ api, immediate: false });
    const hook = useDataSource(options as any);
    await Promise.all([hook.fetch(), hook.fetch()]);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(hook.dataSourceRef.value).toEqual([{ id: 2 }]);
  });

  it('异常走注入的错误通道，并关闭 loading', async () => {
    const notifyError = vi.fn();
    const resolveErrorMessage = vi.fn(() => '接口炸了');
    configureTable({ notifyError, resolveErrorMessage });
    try {
      const api = vi.fn(async () => {
        throw new Error('boom');
      });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { options, setLoading } = makeOptions({ api });
      useDataSource(options as any);
      await flush();
      expect(resolveErrorMessage).toHaveBeenCalled();
      expect(notifyError).toHaveBeenCalledWith('接口炸了');
      expect(setLoading).toHaveBeenLastCalledWith(false);
      spy.mockRestore();
    } finally {
      configureTable({
        notifyError: (c: string) => c,
        resolveErrorMessage: (e: unknown, f: string) =>
          e instanceof Error ? e.message : f,
      });
    }
  });

  it('主动 abort 不弹错误提示', async () => {
    const notifyError = vi.fn();
    configureTable({ notifyError });
    const api = vi.fn(
      () =>
        new Promise<any>((_resolve, reject) => {
          setTimeout(() => {
            const err = new Error('canceled');
            err.name = 'AbortError';
            reject(err);
          }, 5);
        }),
    );
    const { options } = makeOptions({ api });
    const hook = useDataSource(options as any);
    await flush();
    hook.abort();
    await new Promise((r) => setTimeout(r, 30));
    expect(notifyError).not.toHaveBeenCalled();
  });
});
