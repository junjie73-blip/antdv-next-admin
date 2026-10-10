import type { Recordable, UseDataSourceOptions } from '../types';

import { ref } from 'vue';

import { useDataSource } from '../hooks/useDataSource';

/**
 * 取数响应形状的契约测试。
 *
 * 这条链路坏过一次，而且坏得很有隐蔽性：**分页总数是对的，表格却永远 No data**。
 * 根因是 `processResponse` 里 list 与 total 走的是两条独立的兜底链 ——
 * `views/system/*` 的适配层返回 `{ items, totalCount }`（.NET 分页习惯），
 * list 的嗅探链里没有 `items`，直接落到空数组；而 total 命中了独立的
 * `res.total` 兜底，于是"共 50 条"照常显示，用户以为后端没给数据。
 *
 * 所以每个用例都同时断言 **list 和 total**：只断言其中一个，就复现不出当初的错位。
 *
 * 覆盖的响应来源都是仓库里真实存在的写法：
 * - `{ list, total }`      → mock 服务（apps/backend-mock）与 `config/project.ts` 的约定
 * - `{ items, totalCount }`→ `views/system/{user,role,online,dept,notice}` 适配层
 * - `{ data: [...] }`      → 直接透传 axios 包装的接口
 * - `{ records, total }`   → MyBatis-Plus 分页
 * - 裸数组                  → 不分页的字典/选项接口
 * - `{ code, data: { list, total } }` → 未解包的完整响应（getRawData 负责剥一层）
 */

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `r${i + 1}` }));

/**
 * total 不在 hook 的返回值里，它唯一的落点是 `pagination.setPagination`。
 * 所以这里挂一个记录型桩，把"总数取对了"变成可断言的调用流水。
 */
function paginationStub(current = 1, pageSize = 10) {
  const calls: Array<{ total: number }> = [];
  return {
    calls,
    pagination: {
      getPagination: () => ({ current, pageSize }),
      setPagination: (value: { total?: number }) => {
        calls.push({ total: value.total ?? 0 });
      },
    },
  };
}

const loadings = () => {
  const values: boolean[] = [];
  return { loading: { setLoading: (v: boolean) => values.push(v) }, values };
};

/**
 * 跑一次取数。
 *
 * `immediate: false` 是必须的：hook 用 `useTimeoutFn` 调度首屏请求，
 * 测试里等它等于把断言交给真实定时器。这里显式 `await fetch()`。
 */
async function fetchOnce(payload: unknown, options: Partial<UseDataSourceOptions> = {}) {
  const { loading, values } = loadings();
  const { calls, pagination } = paginationStub();
  const api = ref(async () => payload);

  const result = useDataSource({
    api,
    immediate: false,
    loading,
    pagination,
    ...options,
  } as UseDataSourceOptions);

  await result.fetch();

  return { loadingValues: values, paginationCalls: calls, result };
}

describe('useDataSource —— 响应形状嗅探', () => {
  it('{ list, total }：默认 listField 命中', async () => {
    const { result } = await fetchOnce({ list: rows(3), total: 42 });

    expect(result.dataSourceRef.value).toHaveLength(3);
    expect(result.dataSourceRef.value[0]).toMatchObject({ id: 1 });
  });

  it('{ items, totalCount }：适配层写法也要认（曾经的 No data 事故）', async () => {
    const { result } = await fetchOnce({ items: rows(5), totalCount: 50 });

    expect(result.dataSourceRef.value).toHaveLength(5);
  });

  it('{ data, total }：数组直出', async () => {
    const { result } = await fetchOnce({ data: rows(2), total: 9 });

    expect(result.dataSourceRef.value).toHaveLength(2);
  });

  it('{ records, total }：MyBatis-Plus 分页', async () => {
    const { result } = await fetchOnce({ records: rows(4), total: 77 });

    expect(result.dataSourceRef.value).toHaveLength(4);
  });

  it('裸数组：整体当列表', async () => {
    const { result } = await fetchOnce(rows(6));

    expect(result.dataSourceRef.value).toHaveLength(6);
  });

  it('{ code, data: { list, total } }：外层包装先剥掉再嗅探', async () => {
    const { result } = await fetchOnce({
      code: 200,
      data: { list: rows(3), total: 31 },
    });

    expect(result.dataSourceRef.value).toHaveLength(3);
  });

  it('自定义 listField 优先于内置嗅探链', async () => {
    const { result } = await fetchOnce(
      { rows: rows(7), total: 70 },
      { fetchSetting: { listField: 'rows', totalField: 'total' } },
    );

    expect(result.dataSourceRef.value).toHaveLength(7);
  });

  it('listField 指到的字段不是数组时继续往下找，而不是把脏值带下去', async () => {
    const { result } = await fetchOnce({ list: null, items: rows(2), total: 2 });

    expect(result.dataSourceRef.value).toHaveLength(2);
  });

  it('空响应不炸：拿不到列表就是空数组', async () => {
    for (const payload of [{}, null, undefined, { list: [] }]) {
      const { result } = await fetchOnce(payload);
      expect(result.dataSourceRef.value).toEqual([]);
    }
  });
});

describe('useDataSource —— 总数字段', () => {
  it.each([
    [{ list: rows(1), total: 42 }, 42],
    [{ items: rows(1), totalCount: 50 }, 50],
    [{ records: rows(1), total: 77 }, 77],
    // total 被序列化成字符串是 .NET / JSON 大数的常见写法
    [{ list: rows(1), total: '42' }, 42],
  ])('%o 的 total 取 %i', async (payload, expected) => {
    const { paginationCalls, result } = await fetchOnce(payload);

    expect(result.dataSourceRef.value).toHaveLength(1);
    expect(result.rawDataSourceRef.value).toHaveLength(1);
    // total 通过 pagination.setPagination 落地，所以用桩接住它
    expect(paginationCalls).toEqual([{ total: expected }]);
  });

  it('total 为 0 时不写回分页（避免把已有分页清成 0 页）', async () => {
    const { paginationCalls, result } = await fetchOnce({ list: [], total: 0 });

    expect(paginationCalls).toEqual([]);
  });

  it('完全没有 total 字段时退化成当前页条数', async () => {
    const { paginationCalls, result } = await fetchOnce({ list: rows(8) });

    expect(paginationCalls).toEqual([{ total: 8 }]);
  });

  it('裸数组响应用数组长度当总数', async () => {
    const { paginationCalls, result } = await fetchOnce(rows(4));

    expect(paginationCalls).toEqual([{ total: 4 }]);
  });
});

describe('useDataSource —— 取数流程', () => {
  it('afterFetch 能改写嗅探出来的列表', async () => {
    const { result } = await fetchOnce(
      { items: rows(3), total: 3 },
      { afterFetch: (data: Recordable[]) => data.map((r) => ({ ...r, name: 'x' })) },
    );

    expect(result.dataSourceRef.value.map((r) => r.name)).toEqual(['x', 'x', 'x']);
  });

  it('beforeFetch 返回 false 时不发请求', async () => {
    const calls: unknown[] = [];
    const { loading } = loadings();
    const result = useDataSource({
      api: async (p: unknown) => {
        calls.push(p);
        return { list: rows(1), total: 1 };
      },
      beforeFetch: () => false,
      immediate: false,
      loading,
    } as unknown as UseDataSourceOptions);

    await result.fetch();

    expect(calls).toHaveLength(0);
    expect(result.dataSourceRef.value).toEqual([]);
  });

  it('分页参数按 pageField / sizeField 注入请求', async () => {
    let seen: Recordable = {};
    const { loading } = loadings();
    const result = useDataSource({
      api: async (p: Recordable) => {
        seen = p;
        return { list: rows(1), total: 30 };
      },
      immediate: false,
      loading,
      pagination: {
        getPagination: () => ({ current: 3, pageSize: 20 }),
        setPagination: () => {},
      },
    } as unknown as UseDataSourceOptions);

    await result.fetch();

    expect(seen.pageNum).toBe(3);
    expect(seen.pageSize).toBe(20);
  });

  it('searchInfo 会被摊平进请求参数', async () => {
    let seen: Recordable = {};
    const { loading } = loadings();
    const result = useDataSource({
      api: async (p: Recordable) => {
        seen = p;
        return { list: rows(1), total: 1 };
      },
      immediate: false,
      loading,
      params: { searchInfo: { keyword: 'abc' } },
    } as unknown as UseDataSourceOptions);

    await result.fetch();

    expect(seen.keyword).toBe('abc');
    expect(seen.searchInfo).toBeUndefined();
  });

  /**
   * 搜索条件的"记忆"。
   *
   * 业务页的固定套路是 `查询 → 编辑某一行 → 保存 → reload()`，
   * 而 `reload()` 与翻页走的都是不带条件的取数。以前条件只存在于搜索那一次的入参里，
   * 结果保存之后列表直接退回全量第一页 —— 用户刚改完那条记录就"消失"了，
   * 看起来像编辑没生效。这几个用例钉住的是：条件一旦生效，就该活到下次显式改变它为止。
   */
  describe('搜索条件会被记住，不会在 reload / 翻页时丢失', () => {
    /** 每次调用记下入参，返回一条永远匹配的行，方便断言"第几次请求带了什么" */
    function spyApi() {
      const calls: Recordable[] = [];
      return {
        calls,
        api: async (p: Recordable) => {
          calls.push(p);
          return { list: rows(1), total: 1 };
        },
      };
    }

    async function setup() {
      const { loading } = loadings();
      const { api, calls } = spyApi();
      const result = useDataSource({
        api,
        immediate: false,
        loading,
      } as unknown as UseDataSourceOptions);
      return { calls, result };
    }

    it('reload() 沿用最近一次搜索条件', async () => {
      const { calls, result } = await setup();

      await result.fetch({ searchInfo: { keyword: 'abc' } });
      await result.reload();

      expect(calls).toHaveLength(2);
      expect(calls[1]!.keyword).toBe('abc');
      expect(calls[1]!.searchInfo).toBeUndefined();
    });

    it('不带条件的取数（翻页走的就是这条）同样保留条件', async () => {
      const { calls, result } = await setup();

      await result.fetch({ searchInfo: { status: 1 } });
      await result.fetch();

      expect(calls[1]!.status).toBe(1);
    });

    it('后一次搜索覆盖前一次，不会把旧条件叠上去', async () => {
      const { calls, result } = await setup();

      await result.fetch({ searchInfo: { keyword: '甲' } });
      await result.fetch({ searchInfo: { keyword: '乙' } });
      await result.reload();

      expect(calls[1]!.keyword).toBe('乙');
      expect(calls[2]!.keyword).toBe('乙');
    });

    it('setSearchInfo({}) 清掉记忆，之后的 reload 回到无条件', async () => {
      const { calls, result } = await setup();

      await result.fetch({ searchInfo: { keyword: 'abc' } });
      result.setSearchInfo({});
      await result.reload();

      expect(calls[1]!.keyword).toBeUndefined();
    });

    it('只换分页不改条件时，条件与页码各走各的', async () => {
      const { calls, result } = await setup();

      await result.fetch({ searchInfo: { keyword: 'abc' }, page: 2 });
      await result.fetch({ page: 3 });

      expect(calls[1]!.keyword).toBe('abc');
      expect(calls[1]!.page).toBe(3);
    });
  });

  it('接口报错时清空不了旧数据，但要收掉 loading', async () => {
    const { loading, values } = loadings();
    const result = useDataSource({
      api: async () => {
        throw new Error('boom');
      },
      immediate: false,
      loading,
    } as unknown as UseDataSourceOptions);

    await expect(result.fetch()).resolves.toBeUndefined();

    expect(result.dataSourceRef.value).toEqual([]);
    expect(values.at(-1)).toBe(false);
  });
});
