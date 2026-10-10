import { isEnvEnabled } from './env';

type ProxyList = [string, string][];
interface ProxyTarget {
  target: string;
  changeOrigin: boolean;
  ws: boolean;
  rewrite: (path: string) => string;
  secure?: boolean;
}
type ProxyTargetList = Record<string, ProxyTarget>;

/** Nitro Mock 服务默认端口，与 apps/backend-mock/nitro.config.ts 保持一致 */
export const MOCK_SERVER_PORT = 5320;
/** 接口前缀，与 VITE_APP_BASE_API 保持一致 */
export const API_PREFIX = '/api';

export function createProxy(list: ProxyList = []): ProxyTargetList {
  const ret: ProxyTargetList = {};
  for (const [prefix, target] of list) {
    // oxlint-disable-next-line unicorn/prefer-string-starts-ends-with
    const isHttps = /^https:\/\//.test(target);
    ret[prefix] = {
      target,
      changeOrigin: true,
      ws: target.startsWith('ws'),
      rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
      ...(isHttps ? { secure: false } : {}),
    };
  }
  return ret;
}

/**
 * Mock 代理：VITE_MOCK 打开时，把 `/api/*` 原样转发到 Nitro Mock 服务。
 *
 * Nitro 的 `server/api` 目录天然挂在 `/api` 下，所以这里不做 rewrite，
 * 前端 `VITE_APP_BASE_API=/api` 与 mock handler 路径一一对应。
 */
export function createMockProxy(
  envConfig: Record<string, any>,
): ProxyTargetList {
  // 判定条件与 plugins/index.ts 里 nitro-mock 的挂载条件保持一致（同一个 isEnvEnabled），
  // 否则会出现"代理开着但内嵌 mock 没起"或反过来的半开状态
  if (!isEnvEnabled(envConfig.VITE_MOCK)) return {};

  const target =
    envConfig.VITE_MOCK_SERVER ?? `http://localhost:${MOCK_SERVER_PORT}`;
  return {
    [API_PREFIX]: {
      target,
      changeOrigin: true,
      ws: false,
      rewrite: (path: string) => path,
    },
  };
}

/**
 * Mock 服务端口。
 *
 * 优先级：`VITE_MOCK_PORT` → `VITE_MOCK_SERVER` 里写的端口 → 默认 5320。
 *
 * 一定要返回有限数字：nitro-mock 插件会拿它做端口探测并 `server.listen(port)`，
 * 之前这里直接把 `Number(envConfig.VITE_MOCK_PORT)` 传下去 —— 项目里根本没定义这个变量，
 * `Number(undefined)` 得到 NaN，`NaN || 默认值` 又因为调用方是"显式传参"而失效，
 * dev server 启动时抛 `ERR_SOCKET_BAD_PORT: options.port should be >= 0 and < 65536`。
 * 代理目标与 mock 端口都必须从同一份环境变量推导，否则会出现"代理指 5320、
 * 内嵌服务起在别的端口"的对不上情况。
 */
export function resolveMockPort(envConfig: Record<string, any>): number {
  const isUsable = (port: number) =>
    Number.isFinite(port) && port > 0 && port < 65_536;

  const fromEnv = Number(envConfig.VITE_MOCK_PORT);
  if (isUsable(fromEnv)) return fromEnv;

  const server = envConfig.VITE_MOCK_SERVER;
  if (typeof server === 'string' && server) {
    try {
      // `http://localhost:5320` 这类写法里 port 是字符串；没写端口时是空串
      const fromUrl = Number(new URL(server).port);
      if (isUsable(fromUrl)) return fromUrl;
    } catch {
      // 非法 URL 不猜，直接回落到默认端口
    }
  }

  return MOCK_SERVER_PORT;
}

/** 合并用户自定义代理与 Mock 代理，Mock 代理优先 */
export function createServerProxy(
  envConfig: Record<string, any>,
  proxyList?: ProxyList,
): ProxyTargetList {
  return { ...createProxy(proxyList), ...createMockProxy(envConfig) };
}
