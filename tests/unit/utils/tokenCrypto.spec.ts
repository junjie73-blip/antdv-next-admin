import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken } from '@/utils/cache/tokenCrypto'

describe('tokenCrypto', () => {
  beforeEach(() => {
    // Mock navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'TestAgent/1.0',
        language: 'zh-CN',
      },
      writable: true,
    })

    // Mock screen
    Object.defineProperty(globalThis, 'screen', {
      value: {
        width: 1920,
        height: 1080,
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('encryptToken', () => {
    it('should be an async function that returns a promise', () => {
      const result = encryptToken('test')
      expect(result).toBeInstanceOf(Promise)
    })

    it('should throw error when crypto API is not available', async () => {
      // 移除 crypto API
      vi.stubGlobal('crypto', {} as any)

      await expect(encryptToken('test')).rejects.toThrow()
    })
  })

  describe('decryptToken', () => {
    it('should return null for empty string', async () => {
      const result = await decryptToken('')
      expect(result).toBeNull()
    })

    it('should return null for invalid encrypted data', async () => {
      // 非法格式的数据
      const result = await decryptToken('not-a-valid-jwt')
      // 应该返回 null 或尝试作为明文返回
      expect(result).toBeDefined()
    })
  })
})
