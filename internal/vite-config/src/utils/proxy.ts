type ProxyList = [string, string][]
interface ProxyTarget {
  target: string
  changeOrigin: boolean
  ws: boolean
  rewrite: (path: string) => string
  secure?: boolean
}
type ProxyTargetList = Record<string, ProxyTarget>

/** Nitro Mock 服务默认端口，与 apps/backend-mock/nitro.config.ts 保持一致 */
export const MOCK_SERVER_PORT = 5320
/** 接口前缀，与 VITE_APP_BASE_API 保持一致 */
export const API_PREFIX = '/api'

export function createProxy(list: ProxyList = []): ProxyTargetList {
  const ret: ProxyTargetList = {}
  for (const [prefix, target] of list) {
    // oxlint-disable-next-line unicorn/prefer-string-starts-ends-with
    const isHttps = /^https:\/\//.test(target)
    ret[prefix] = {
      target,
      changeOrigin: true,
      ws: target.startsWith('ws'),
      rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
      ...(isHttps ? { secure: false } : {}),
    }
  }
  return ret
}

/**
 * Mock 代理：VITE_MOCK 打开时，把 `/api/*` 原样转发到 Nitro Mock 服务。
 *
 * Nitro 的 `server/api` 目录天然挂在 `/api` 下，所以这里不做 rewrite，
 * 前端 `VITE_APP_BASE_API=/api` 与 mock handler 路径一一对应。
 */
export function createMockProxy(envConfig: Record<string, any>): ProxyTargetList {
  if (String(envConfig.VITE_MOCK).toLowerCase() !== 'true') return {}

  const target = envConfig.VITE_MOCK_SERVER ?? `http://localhost:${MOCK_SERVER_PORT}`
  return {
    [API_PREFIX]: {
      target,
      changeOrigin: true,
      ws: false,
      rewrite: (path: string) => path,
    },
  }
}

/** 合并用户自定义代理与 Mock 代理，Mock 代理优先 */
export function createServerProxy(
  envConfig: Record<string, any>,
  proxyList?: ProxyList,
): ProxyTargetList {
  return { ...createProxy(proxyList), ...createMockProxy(envConfig) }
}
