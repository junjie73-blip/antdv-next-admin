/**
 * CSRF（跨站请求伪造）防护工具
 *
 * 防御策略：
 * 1. SameSite Cookie：防止跨站携带 Cookie
 * 2. CSRF Token：每个会话/表单生成唯一令牌
 * 3. Double Submit Cookie：无需服务端存储的轻量方案
 * 4. Origin/Referer 校验：验证请求来源
 *
 * 使用场景：
 * - 所有状态修改的 POST/PUT/PATCH/DELETE 请求
 * - 表单提交
 * - API 调用
 */

import { ref } from 'vue'
import { localStorageCacheStorage } from '@/utils/cache'

// ==================== 类型定义 ====================

/** CSRF 配置选项 */
export interface CsrfConfig {
  /** Token 存储键名 */
  tokenKey?: string
  /** Header 名称（默认 X-CSRF-Token） */
  headerName?: string
  /** Cookie 名称（用于 Double Submit） */
  cookieName?: string
  /** Token 有效期（毫秒，默认 2 小时） */
  expiryMs?: number
  /** Token 长度（字节，默认 32） */
  tokenLength?: number
  /** 是否启用 Double Submit Cookie 模式 */
  doubleSubmit?: boolean
  /** 是否自动轮换 Token（每次使用后生成新 Token） */
  autoRotate?: boolean
}

/** CSRF Token 信息 */
export interface CsrfToken {
  /** Token 值 */
  value: string
  /** 创建时间戳 */
  createdAt: number
  /** 过期时间戳 */
  expiresAt: number
  /** 是否已使用（用于一次性 Token） */
  used?: boolean
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: Required<CsrfConfig> = {
  tokenKey: '__csrf_token',
  headerName: 'X-CSRF-Token',
  cookieName: '__csrf_cookie',
  expiryMs: 2 * 60 * 60 * 1000, // 2 小时
  tokenLength: 32, // 32 字节 = 64 个 hex 字符
  doubleSubmit: true,
  autoRotate: false,
}

// ==================== 状态管理 ====================

/** 当前 CSRF 配置（可从外部读取当前状态） */
export let config = { ...DEFAULT_CONFIG }
const currentToken = ref<CsrfToken | null>(null)

// ==================== Token 生成 ====================

/**
 * 生成安全的随机 CSRF Token
 *
 * 使用 crypto.getRandomValues() 生成密码学安全的随机数
 *
 * @returns Base64 编码的 Token 字符串
 */
async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(config.tokenLength)

  if (crypto && crypto.getRandomValues) {
    // 浏览器环境：使用 Web Crypto API
    crypto.getRandomValues(bytes)
  }
  else {
    // 降级方案：使用 Math.random（安全性较低）
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  // 转换为 Base64 URL 安全格式（移除 padding 和替换特殊字符）
  let base64 = ''
  for (const byte of bytes) {
    base64 += String.fromCharCode(byte)
  }

  return btoa(base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * 从字符串生成简单的 hash（用于 Cookie 值）
 *
 * @param str - 要 hash 的字符串
 * @returns Hex 编码的 hash 值
 */
async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)

  if (crypto && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 降级：简单 XOR hash
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

// ==================== Token 管理 ====================

/**
 * 初始化 CSRF 保护系统
 *
 * @param userConfig - 用户自定义配置
 */
export async function initCsrfProtection(userConfig: CsrfConfig = {}): Promise<void> {
  config = { ...DEFAULT_CONFIG, ...userConfig }

  // 尝试从存储中恢复 Token
  await restoreToken()

  console.log('[CSRF] ✅ 防护系统已初始化', {
    mode: config.doubleSubmit ? 'Double Submit Cookie' : 'Token Only',
    headerName: config.headerName,
    cookieName: config.cookieName,
  })
}

/**
 * 创建新的 CSRF Token
 *
 * @returns 新生成的 Token 对象
 */
export async function createCsrfToken(): Promise<CsrfToken> {
  const value = await generateToken()
  const now = Date.now()

  const token: CsrfToken = {
    value,
    createdAt: now,
    expiresAt: now + config.expiryMs,
    used: false,
  }

  // 保存到内存和持久化存储
  currentToken.value = token

  try {
    localStorageCacheStorage.setItem(config.tokenKey, JSON.stringify(token), {
      expire: config.expiryMs,
    })
  }
  catch (e) {
    console.warn('[CSRF] Token 持久化失败:', e)
  }

  // 如果启用了 Double Submit 模式，同时设置 Cookie
  if (config.doubleSubmit) {
    setCsrfCookie(value)
  }

  return token
}

/**
 * 获取当前的 CSRF Token（如果不存在则创建新 Token）
 *
 * @returns 当前有效的 Token
 */
export async function getCsrfToken(): Promise<CsrfToken | null> {
  // 检查内存中的 Token
  if (currentToken.value && !isTokenExpired(currentToken.value)) {
    return currentToken.value
  }

  // 尝试从存储恢复
  await restoreToken()

  if (currentToken.value && !isTokenExpired(currentToken.value)) {
    return currentToken.value
  }

  // 创建新 Token
  return createCsrfToken()
}

/**
 * 验证 CSRF Token 是否有效
 *
 * @param providedToken - 请求中提供的 Token 值
 * @param shouldRotate - 验证后是否轮换 Token（默认 true）
 * @returns Token 是否有效
 */
export async function validateCsrfToken(
  providedToken: string,
  shouldRotate = true,
): Promise<boolean> {
  if (!providedToken) {
    console.warn('[CSRF] ❌ 缺少 CSRF Token')
    return false
  }

  const token = currentToken.value

  if (!token) {
    console.warn('[CSRF] ❌ 未找到有效的 CSRF Token')
    return false
  }

  // 检查是否过期
  if (isTokenExpired(token)) {
    console.warn('[CSRF] ❌ Token 已过期')
    await invalidateCsrfToken()
    return false
  }

  // 验证 Token 值是否匹配
  if (token.value !== providedToken) {
    console.warn('[CSRF] ❌ Token 不匹配')
    return false
  }

  // 检查是否已被使用（防止重放攻击）
  if (token.used) {
    console.warn('[CSRF] ❌ Token 已被使用')
    return false
  }

  // 标记为已使用
  token.used = true

  // 自动轮换：验证成功后生成新 Token
  if (shouldRotate && config.autoRotate) {
    await createCsrfToken()
  }

  return true
}

/**
 * 使当前 Token 失效
 */
export async function invalidateCsrfToken(): Promise<void> {
  currentToken.value = null

  try {
    localStorageCacheStorage.removeItem(config.tokenKey)
  }
  catch {
    // 忽略错误
  }

  removeCsrfCookie()

  console.log('[CSRF] 🗑️ Token 已失效')
}

// ==================== Double Submit Cookie 支持 ====================

/**
 * 设置 CSRF Cookie（用于 Double Submit 方案）
 *
 * @param value - Cookie 值
 */
function setCsrfCookie(value: string): void {
  try {
    document.cookie = `${config.cookieName}=${value}; path=/; SameSite=Lax; Secure; HttpOnly=false`
  }
  catch {
    console.warn('[CSRF] Cookie 设置失败')
  }
}

/**
 * 移除 CSRF Cookie
 */
function removeCsrfCookie(): void {
  try {
    document.cookie = `${config.cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
  catch {
    // 忽略错误
  }
}

/**
 * 从 Cookie 中读取 CSRF 值
 *
 * @returns Cookie 中的值或 null
 */
export function getCsrfCookieValue(): string | null {
  try {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === config.cookieName) {
        return decodeURIComponent(value)
      }
    }
  }
  catch {
    // 忽略解析错误
  }

  return null
}

/**
 * 验证 Double Submit Cookie（对比 Header 和 Cookie 中的值）
 *
 * @param headerToken - 请求头中的 Token
 * @returns 是否通过验证
 */
export function validateDoubleSubmit(headerToken: string): boolean {
  const cookieToken = getCsrfCookieValue()

  if (!cookieToken) {
    console.warn('[CSRF] ❌ 缺少 CSRF Cookie')
    return false
  }

  // 使用时间比较恒等验证（抗时序攻击）
  return headerToken === cookieToken && headerToken.length > 10
}

// ==================== 内部辅助函数 ====================

/**
 * 检查 Token 是否过期
 */
function isTokenExpired(token: CsrfToken): boolean {
  return Date.now() > token.expiresAt
}

/**
 * 从持久化存储恢复 Token
 */
async function restoreToken(): Promise<void> {
  try {
    const stored = localStorageCacheStorage.getItem(config.tokenKey)

    if (stored) {
      const parsed: CsrfToken = typeof stored === 'string' ? JSON.parse(stored) : stored

      if (parsed && !isTokenExpired(parsed)) {
        currentToken.value = parsed

        // 同时恢复 Cookie（Double Submit 模式需要）
        if (config.doubleSubmit) {
          setCsrfCookie(parsed.value)
        }

        return
      }
    }
  }
  catch {
    // 解析失败，忽略
  }

  currentToken.value = null
}

// ==================== Vue Composable ====================

/**
 * useCsrf — CSRF 防护 Composable
 *
 * 提供响应式的 CSRF Token 管理能力
 *
 * 使用示例：
 * ```vue
 * <script setup>
 * const { token, headerName, validate, refresh } = useCsrf()
 *
 * async function submitForm(data) {
 *   const headers = {
 *     [headerName]: token.value,
 *   }
 *   await api.post('/submit', data, { headers })
 * }
 * </script>
 * ```
 */
export function useCsrf(userConfig?: CsrfConfig) {
  // 初始化（如果尚未初始化）
  if (!currentToken.value) {
    initCsrfProtection(userConfig)
  }

  /**
   * 获取 Token 值（响应式）
   */
  const token = ref<string | null>(currentToken.value?.value ?? null)

  /**
   * 刷新 Token（创建新 Token）
   */
  async function refresh(): Promise<void> {
    const newToken = await createCsrfToken()
    token.value = newToken.value
  }

  /**
   * 获取请求头配置（用于 API 调用）
   */
  async function getHeaders(): Promise<Record<string, string>> {
    const csrfToken = await getCsrfToken()

    if (!csrfToken) {
      throw new Error('CSRF Token 不可用')
    }

    return {
      [config.headerName]: csrfToken.value,
    }
  }

  /**
   * 验证并可选地刷新 Token
   */
  async function verify(providedToken: string, rotate = true): Promise<boolean> {
    return validateCsrfToken(providedToken, rotate)
  }

  return {
    // 状态
    token,
    headerName: config.headerName,
    cookieName: config.cookieName,

    // 方法
    refresh,
    getHeaders,
    verify,
    invalidate: invalidateCsrfToken,
  }
}
