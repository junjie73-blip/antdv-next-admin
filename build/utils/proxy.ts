type ProxyList = [string, string][]
interface ProxyTarget {
  target: string
  changeOrigin: boolean
  ws: boolean
  rewrite: (path: string) => string
  secure?: boolean
}
type ProxyTargetList = Record<string, ProxyTarget>
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
