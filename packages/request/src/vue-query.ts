import type { QueryClientConfig } from '@tanstack/vue-query';

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';

/**
 * vue-query 的默认策略。
 *
 * 传输层重试已由 executor（`withRetry` + 401 重放）负责，vue-query 不再重试，
 * 避免两层重试叠加放大请求量。这一条与 `./executor` 是一对约定，所以放在同一个包里。
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

/**
 * 进程内唯一的 QueryClient：`setupVueQuery` 挂的就是它，页面侧不要再 `new QueryClient()`。
 */
export const queryClient = new QueryClient(queryClientConfig);

/**
 * 安装 vue-query 插件并挂上包里的 `queryClient`。
 *
 * 刻意不进根 barrel（`@antdv/request`）：根入口是给只要 `requestClient` 的页面用的，
 * 不该顺带把整套 vue-query 拉进模块图，口径与 `./sse`、`./websocket` 一致。
 */
export function setupVueQuery(
  app: Parameters<typeof VueQueryPlugin.install>[0],
) {
  app.use(VueQueryPlugin, { queryClient });
}
