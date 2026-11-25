type ProxyList = [string, string][];
interface ProxyTarget {
  target: string;
  changeOrigin: boolean;
  ws: boolean;
  rewrite: (path: string) => string;
  secure?: boolean;
}
type ProxyTargetList = Record<string, ProxyTarget>;

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
 * 用户配置的代理表。
 *
 * Mock 已改由各应用自己接入 `nitro/vite` 官方插件，与前端共用同一个 dev server，
 * 这里不再注入 `/api → 5320` 的反向代理，避免出现"插件已接管但请求又被转走"的双路径。
 */
export function createServerProxy(
  _envConfig: Record<string, any>,
  proxyList?: ProxyList,
): ProxyTargetList {
  return createProxy(proxyList);
}
