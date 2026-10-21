import type { App } from 'vue';

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { describe, expect, it, vi } from 'vitest';

import {
  queryClient,
  queryClientConfig,
  setupVueQuery,
} from '../src/vue-query';

/**
 * 这份默认策略是包与 executor 的约定：传输层重试在 `withRetry` + 401 重放里做，
 * vue-query 这边必须保持 `retry: false`，否则两层重试相乘会把失败请求放大成雪崩。
 * 值一改就等于改了约定，所以用断言钉住。
 */
describe('queryClientConfig', () => {
  it('关掉窗口聚焦重取与组件层重试，只留 30s 新鲜期', () => {
    expect(queryClientConfig.defaultOptions?.queries).toStrictEqual({
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    });
  });
});

describe('queryClient', () => {
  it('是按上面策略建出来的同一个实例', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
    expect(queryClient.getDefaultOptions().queries).toStrictEqual(
      queryClientConfig.defaultOptions?.queries,
    );
  });
});

describe('setupVueQuery', () => {
  it('把包里的 queryClient 挂进 app，而不是新建一个', () => {
    const use = vi.fn();

    setupVueQuery({ use } as unknown as App);

    expect(use).toHaveBeenCalledTimes(1);
    expect(use).toHaveBeenCalledWith(VueQueryPlugin, { queryClient });
  });
});
