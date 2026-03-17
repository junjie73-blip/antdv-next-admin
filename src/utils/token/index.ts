import { TOKEN_KEY } from '@/config/constants'
import { cache } from '../cache'

export interface UserInfo {
  userId: string
  username: string
  role: string
  permissions: string[]
}

export function getToken(): string | null {
  const token = cache.getItem(TOKEN_KEY)
  return typeof token === 'string' ? token : null
}

export function setToken(token: string, expire?: number): void {
  cache.setItem(TOKEN_KEY, token, expire)
}

export function removeToken(): void {
  cache.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
  return cache.hasItem(TOKEN_KEY)
}

export function clearAuth(): void {
  removeToken()
  cache.removeItem('auth-store')
  cache.removeItem('user-info')
}
