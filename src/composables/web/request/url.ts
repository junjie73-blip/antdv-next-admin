import { isNil } from 'es-toolkit'

export function buildUrl(url: string, params?: Record<string, any>): string {
  if (!params) return url

  const keys = Object.keys(params)
  if (keys.length === 0) return url

  const parts: string[] = []
  for (const key of keys) {
    if (isNil(params[key])) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  }

  const query = parts.join('&')
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}
