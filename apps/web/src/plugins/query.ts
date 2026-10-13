import type { QueryClientConfig } from '@tanstack/vue-query';

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';

/**
 * 传输层重试已由 executor（withRetry + 401 重放）负责，vue-query 不再重试，
 * 避免两层重试叠加放大请求量。
 */
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  },
};

export const queryClient = new QueryClient(queryClientConfig);

export function setupVueQuery(app: Parameters<typeof VueQueryPlugin.install>[0]) {
  app.use(VueQueryPlugin, { queryClient });
}
