import type { NormalizeOptions } from './matcher';
import type { FixtureSet, MockReply } from './types';

import { dynamicRoutes } from './dynamic';
/** fixtures 只被这个懒加载模块静态引用，开关关掉时主包里一行都不进 */
import { fixtures as generatedFixtures } from './fixtures';
import { matchRoute, normalizeRequest } from './matcher';
import { createOverlay } from './overlay';

/**
 * 模拟网络延迟：真实请求不会 0ms 返回，全 0 延迟会让 loading / 骨架屏一闪而过，
 * 生产预览里看不出交互节奏，也照不出并发请求的竞态。
 */
const LATENCY_MAX_MS = 60;
const LATENCY_MIN_MS = 20;

export interface MockFetchDeps {
  /** 页面地址：相对 URL 的解析基准，也是同源判定的基准 */
  baseUrl?: string;
  latency?: () => number;
  /** 真实 fetch：未命中的请求原路透传 */
  nativeFetch?: typeof fetch;
  /** 接口前缀；缺省读 `VITE_APP_BASE_API`（生产构建没配时是空串，请求本身不带前缀） */
  prefix?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toResponse(reply: MockReply): Response {
  // `Response.json` 自带 `content-type: application/json`，正是 `afterFetch` 判断
  // 「要不要按业务信封解包」所依赖的那一位
  return Response.json(reply.body, { status: reply.status, statusText: 'OK' });
}

export function createMockFetch(
  fixtures: FixtureSet,
  deps: MockFetchDeps = {},
): typeof fetch {
  const nativeFetch = deps.nativeFetch ?? globalThis.fetch;
  // `VITE_APP_BASE_API` 不在 env-parse 生成的 `ImportMetaEnv` 里（只有 .env.development 定义了它），
  // 生产配了才有，所以按 Record 读、拿不到就当空串 —— 请求本身就不带前缀。
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const normalizeOptions: NormalizeOptions = {
    baseUrl: deps.baseUrl ?? window.location.href,
    prefix: deps.prefix ?? env.VITE_APP_BASE_API ?? '',
  };
  const latency =
    deps.latency ??
    (() =>
      Math.round(
        LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS),
      ));
  const overlay = createOverlay(fixtures);
  /**
   * 快照 + 现造接口一起参与匹配。
   *
   * 现造那几条（上传）不在 fixtures 里：multipart 抓不了、也抓不出"每次唯一"的返回值，
   * 少了这一步，产物里点上传就是一次没人接的真网络请求（静态部署下 404）。
   */
  const routes = [...fixtures.routes, ...dynamicRoutes];

  const passthrough = (input: RequestInfo | URL, init?: RequestInit) =>
    nativeFetch.call(globalThis, input, init);

  return async (input, init) => {
    const request = normalizeRequest(input, init ?? {}, normalizeOptions);
    if (!request) return passthrough(input, init);

    const matched = matchRoute(routes, request.method, request.path);
    const reply = matched
      ? overlay.handle(matched.route, request, matched.params)
      : null;
    if (!reply) return passthrough(input, init);

    await sleep(latency());
    return toResponse(reply);
  };
}

let uninstall: (() => void) | null = null;

/**
 * 把拦截器装到 `globalThis.fetch` 上 —— 应用所有请求最终都汇到这一个出口
 * （请求层的 `createFetch`、令牌刷新里裸写的 `fetch`、上传组件用的都是它）。
 *
 * 幂等：重复安装（HMR 重跑入口）直接返回已有的卸载函数，不再套一层拦截。
 */
export function installBrowserMock(
  deps: MockFetchDeps & { fixtures?: FixtureSet } = {},
): () => void {
  if (uninstall) return uninstall;
  const nativeFetch = deps.nativeFetch ?? globalThis.fetch;
  globalThis.fetch = createMockFetch(deps.fixtures ?? generatedFixtures, {
    ...deps,
    nativeFetch,
  });
  uninstall = () => {
    globalThis.fetch = nativeFetch;
    uninstall = null;
  };
  return uninstall;
}
