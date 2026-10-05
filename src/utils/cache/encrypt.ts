/**
 * 缓存数据加密工具 (SM4)
 *
 * 使用国密 SM4 算法对缓存数据进行加密保护。
 * 密钥从环境变量读取，并使用设备指纹进行增强，
 * 避免硬编码密钥带来的安全风险。
 */

import { isString } from 'es-toolkit'
import { sm4 } from 'sm-crypto'

/** 开发环境默认密钥（生产环境应通过 VITE_CACHE_ENCRYPT_KEY 覆盖） */
const DEV_FALLBACK_KEY = 'dev-only-cache-key-0123456789abcdef'

/** 最小密钥长度 */
const MIN_KEY_LENGTH = 16

/** SM4 要求的密钥长度（字符） */
const SM4_KEY_LENGTH = 32

/**
 * 从环境变量获取基础密钥
 *
 * @throws 生产环境未配置 VITE_CACHE_ENCRYPT_KEY 时抛出
 */
function getBaseKey(): string {
  const envKey = import.meta.env.VITE_CACHE_ENCRYPT_KEY as string | undefined

  if (isString(envKey) && envKey.length >= MIN_KEY_LENGTH) {
    return envKey
  }

  if (import.meta.env.DEV) {
    console.warn(
      '[encrypt] 使用开发默认密钥，生产环境请配置 VITE_CACHE_ENCRYPT_KEY',
    )
    return DEV_FALLBACK_KEY
  }

  throw new Error('生产环境必须配置 VITE_CACHE_ENCRYPT_KEY（至少 16 位）')
}

/**
 * 采集设备指纹因子（用于密钥派生增强）
 */
function collectFingerprintFactors(): string[] {
  return [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(new Date().getTimezoneOffset()),
  ]
}

/**
 * 将字节数组转换为十六进制字符串
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * 使用 PBKDF2 风格的简单密钥派生（兼容性优先）
 * 将基础密钥与设备特征混合，生成最终密钥
 */
async function deriveKey(baseKey: string): Promise<string> {
  try {
    const fingerprint = collectFingerprintFactors().join('|')
    const data = new TextEncoder().encode(`${baseKey}:${fingerprint}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return bytesToHex(new Uint8Array(hashBuffer))
  } catch {
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
  if (key.length < SM4_KEY_LENGTH) {
    return key.padEnd(SM4_KEY_LENGTH, '0')
  }
  return key.slice(0, SM4_KEY_LENGTH)
}

/**
 * 加密字符串值（异步，使用派生密钥）
 *
 * @param value - 要加密的明文
 * @param key - 可选的自定义密钥（不推荐）
 * @returns SM4 加密后的十六进制字符串
 */
export async function encryptValue(
  value: string,
  key?: string,
): Promise<string> {
  const finalKey = key ? padKey(key) : padKey(await getDerivedKey())
  return sm4.encrypt(value, finalKey)
}

/**
 * 解密字符串值（异步，使用派生密钥）
 *
 * @param value - SM4 加密的十六进制字符串
 * @param key - 可选的自定义密钥（需与加密时一致）
 * @returns 解密后的明文
 */
export async function decryptValue(
  value: string,
  key?: string,
): Promise<string> {
  const finalKey = key ? padKey(key) : padKey(await getDerivedKey())
  return sm4.decrypt(value, finalKey)
}

/**
 * 同步版本加密（向后兼容，不使用派生密钥）
 *
 * @deprecated 建议使用异步版本的 `encryptValue`
 */
export function encryptValueSync(value: string, key?: string): string {
  return sm4.encrypt(value, padKey(key || getBaseKey()))
}

/**
 * 同步版本解密（向后兼容，不使用派生密钥）
 *
 * @deprecated 建议使用异步版本的 `decryptValue`
 */
export function decryptValueSync(value: string, key?: string): string {
  return sm4.decrypt(value, padKey(key || getBaseKey()))
}

/**
 * 判断当前是否应该启用加密
 * 仅在生产环境启用
 */
export function shouldEncrypt(): boolean {
  return import.meta.env.PROD
}

/**
 * 清空派生密钥缓存（一般仅用于测试）
 */
export function resetDerivedKeyCache(): void {
  derivedKeyCache = null
}
