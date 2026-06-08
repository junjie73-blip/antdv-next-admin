/**
 * 缓存数据加密工具 (SM4)
 *
 * 使用国密 SM4 算法对缓存数据进行加密保护。
 * 密钥从环境变量读取，并使用设备指纹进行增强，
 * 避免硬编码密钥带来的安全风险。
 */

import { sm4 } from 'sm-crypto'

/**
 * 从环境变量获取基础密钥
 * 生产环境必须配置 VITE_CACHE_ENCRYPT_KEY，否则会警告
 */
function getBaseKey(): string {
  const envKey = import.meta.env.VITE_CACHE_ENCRYPT_KEY as string | undefined

  if (!envKey) {
    // 开发环境使用默认值（仅开发用）
    if (import.meta.env.DEV) {
      console.warn(
        '[encrypt] 未配置 VITE_CACHE_ENCRYPT_KEY，使用开发环境默认密钥。'
        + '生产环境请务必设置此环境变量！',
      )
      return 'antdv-next-admin-dev-cache-key'
    }

    // 生产环境必须配置，抛出错误
    throw new Error(
      '[encrypt] 生产环境未配置 VITE_CACHE_ENCRYPT_KEY 环境变量！'
      + '请在 .env.production 中设置一个随机的 32 字符密钥。',
    )
  }

  return envKey
}

/**
 * 使用 PBKDF2 风格的简单密钥派生（兼容性优先）
 * 将基础密钥与设备特征混合，生成最终密钥
 */
async function deriveKey(baseKey: string): Promise<string> {
  try {
    // 收集设备指纹因子
    const factors = [
      navigator.userAgent,
      navigator.language,
      screen.width.toString(),
      screen.height.toString(),
      new Date().getTimezoneOffset().toString(),
    ]

    const fingerprint = factors.join('|')

    // 使用 Web Crypto API 进行哈希派生
    const data = new TextEncoder().encode(`${baseKey}:${fingerprint}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // 转换为十六进制字符串
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  catch {
    // Web API 不可用时降级为基础密钥
    return baseKey
  }
}

/** 密钥缓存（避免重复计算） */
let derivedKeyCache: string | null = null

/**
 * 获取或计算派生密钥
 */
async function getDerivedKey(): Promise<string> {
  if (!derivedKeyCache) {
    derivedKeyCache = await deriveKey(getBaseKey())
  }
  return derivedKeyCache
}

/**
 * 将密钥填充/截断到 SM4 要求的 32 字符长度
 */
function padKey(key: string): string {
  if (key.length < 32) {
    return key.padEnd(32, '0')
  }
  return key.slice(0, 32)
}

/**
 * 加密字符串值
 *
 * @param value - 要加密的明文
 * @param key - 可选的自定义密钥（不推荐，默认使用派生密钥）
 * @returns SM4 加密后的十六进制字符串
 */
export async function encryptValue(value: string, key?: string): Promise<string> {
  const finalKey = key ? padKey(key) : padKey(await getDerivedKey())
  return sm4.encrypt(value, finalKey)
}

/**
 * 解密字符串值
 *
 * @param value - SM4 加密的十六进制字符串
 * @param key - 可选的自定义密钥（需与加密时一致）
 * @returns 解密后的明文
 */
export async function decryptValue(value: string, key?: string): Promise<string> {
  const finalKey = key ? padKey(key) : padKey(await getDerivedKey())
  return sm4.decrypt(value, finalKey)
}

/**
 * 同步版本加密（向后兼容，不使用派生密钥）
 *
 * @deprecated 建议使用异步版本的 encryptValue
 */
export function encryptValueSync(value: string, key?: string): string {
  const finalKey = padKey(key || getBaseKey())
  return sm4.encrypt(value, finalKey)
}

/**
 * 同步版本解密（向后兼容，不使用派生密钥）
 *
 * @deprecated 建议使用异步版本的 decryptValue
 */
export function decryptValueSync(value: string, key?: string): string {
  const finalKey = padKey(key || getBaseKey())
  return sm4.decrypt(value, finalKey)
}

/**
 * 判断当前是否应该启用加密
 * 仅在生产环境启用
 */
export function shouldEncrypt(): boolean {
  return import.meta.env.PROD
}
