export type ProxyList = [string, string][]

export interface ProxyTarget {
  target: string
  changeOrigin: boolean
  ws: boolean
  rewrite: (path: string) => string
  secure?: boolean
}

export type ProxyTargetList = Record<string, ProxyTarget>

export function createProxy(list: ProxyList = []): ProxyTargetList {
  const ret: ProxyTargetList = {}
  for (const [prefix, target] of list) {
    const httpsRE = /^https:\/\//
    const isHttps = httpsRE.test(target)

    ret[prefix] = {
      target,
      changeOrigin: true,
      ws: true,
      rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
      ...(isHttps ? { secure: false } : {}),
    }
  }
  return ret
}
