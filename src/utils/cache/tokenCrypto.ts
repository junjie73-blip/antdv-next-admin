/**
 * Token 安全存储工具
 *
 * 使用 AES-256-GCM 加密算法保护敏感数据（Token、用户信息等）
 * 相比原有的 SM4 对称加密，提供更高的安全性：
 * - 256 位密钥长度（vs SM4 的 128 位）
 * - GCM 认证模式（同时提供机密性和完整性校验）
 * - 每次加密使用随机 IV（防止模式分析攻击）
 * - 密钥从用户指纹派生（即使源码泄露也难以解密其他用户的 Token）
 */

import { EncryptJWT, jwtDecrypt } from 'jose'

const TOKEN_ENCRYPTION_KEY = 'antdv-next-token-protection-key-v2'
const ALGORITHM = 'A256GCMKW'
const ENCRYPTION_ALGO = 'A256GCM'

/**
 * 从浏览器环境生成设备指纹作为密钥派生因子
 * 这样即使攻击者获取了源码和某个用户的加密 Token，
 * 也无法解密其他用户的 Token
 */
async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
  ]

  // 使用 Web Crypto API 进行简单哈希
  const data = new TextEncoder().encode(components.join('|'))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 获取加密密钥（从设备指纹派生）
 */
async function getEncryptionKey(): Promise<Uint8Array> {
  const fingerprint = await getDeviceFingerprint()
  const keyMaterial = new TextEncoder().encode(TOKEN_ENCRYPTION_KEY + fingerprint)

  // 使用 PBKDF2 派生密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('antdv-next-token-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  )

  return new Uint8Array(derivedBits)
}

/**
 * 加密 Token 或敏感数据
 *
 * @param data - 要加密的数据（通常是 Token 字符串）
 * @returns 加密后的 JWT 格式字符串
 * @throws 当 Web Crypto API 不可用时抛出异常
 */
export async function encryptToken(data: string): Promise<string> {
  // 检查 Web Crypto API 可用性
  if (!crypto || !crypto.subtle) {
    throw new Error('Web Crypto API 不可用，无法加密 Token')
  }

  try {
    const key = await getEncryptionKey()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      ALGORITHM,
      true,
      ['encrypt'],
    )

    return new EncryptJWT({ data })
      .setProtectedHeader({ alg: 'dir', enc: ENCRYPTION_ALGO })
      .setIssuedAt()
      .setExpirationTime('7d') // Token 加密密文有效期 7 天
      .encrypt(cryptoKey)
  }
  catch (error) {
    console.error('[TokenCrypto] 加密失败:', error)
    throw new Error(`Token 加密失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 解密 Token 或敏感数据
 *
 * @param encryptedData - 加密后的字符串
 * @returns 解密后的原始数据，如果解密失败返回 null
 */
export async function decryptToken(encryptedData: string): Promise<string | null> {
  // 检查 Web Crypto API 可用性
  if (!crypto || !crypto.subtle) {
    console.warn('[TokenCrypto] Web Crypto API 不可用，返回原始数据')
    return encryptedData
  }

  try {
    const key = await getEncryptionKey()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      ALGORITHM,
      true,
      ['decrypt'],
    )

    const { payload } = await jwtDecrypt(encryptedData, cryptoKey)

    if (typeof payload.data === 'string') {
      return payload.data
    }

    // 兼容旧格式（直接存储的明文 Token）
    return encryptedData
  }
  catch (error) {
    // 解密失败可能是因为：
    // 1. 数据不是加密格式（可能是旧版本明文存储）
    // 2. 设备指纹变化（浏览器升级、硬件变更等）
    // 3. 数据被篡改
    console.warn('[TokenCrypto] 解密失败，尝试降级处理:', error)

    // 尝试作为明文返回（向后兼容）
    if (encryptedData && !encryptedData.includes('.')) {
      return encryptedData
    }

    return null
  }
}
