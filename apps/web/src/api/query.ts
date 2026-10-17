import type { UseQueryOptions } from '@tanstack/vue-query';

import type { MaybeRefOrGetter } from 'vue';

import type { R } from './request';

import { toValue } from 'vue';

import { useQuery } from '@tanstack/vue-query';
import { http } from '~/composables';

export interface ApiQueryDefinition<T> extends Omit<
  UseQueryOptions<T>,
  'queryFn' | 'queryKey'
> {
  /** 查询串参数；ref / getter 会被追踪，变化即换 key 重查 */
  params?: MaybeRefOrGetter<Record<string, unknown> | undefined>;
  url: MaybeRefOrGetter<string>;
}

/**
 * 把增强后的 fetch（含令牌刷新、去重、重试、qs 序列化）接进 @tanstack/vue-query。
 *
 * - `queryFn` 统一解包 `R<T>` 信封，业务拿到的直接是 `data`；
 * - vue-query 的取消信号透传给 executor，切页/失焦时请求真正 abort；
 * - 传输层重试在 executor 里做，`queryClient` 默认 `retry: false`，两层不叠加。
 */
export function useApiQuery<T = unknown>(
  queryKey: MaybeRefOrGetter<unknown[]>,
  definition: ApiQueryDefinition<T>,
) {
  const { url, params, ...options } = definition;
  return useQuery<T>({
    ...options,
    queryKey: () => [...toValue(queryKey), toValue(params) ?? null],
    queryFn: ({ signal }) =>
      http
        .Get<R<T>>(toValue(url), toValue(params), { signal })
        .then((res) => res.data),
  });
}
