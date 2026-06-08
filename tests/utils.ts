/**
 * 测试工具函数
 *
 * 提供测试中常用的辅助函数和 mock 对象
 */

import type { ComponentPublicInstance } from 'vue'
import { mount } from '@vue/test-utils'

/**
 * 创建模拟的 Modal 实例方法
 */
export function createMockModalMethods() {
  return {
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }
}

/**
 * 创建模拟的 Form 实例方法
 */
export function createMockFormMethods() {
  const values: Record<string, any> = {}

  return {
    setFieldsValue: vi.fn((newValues: Record<string, any>) => {
      Object.assign(values, newValues)
    }),
    clearValidate: vi.fn(),
    validate: vi.fn().mockResolvedValue(values),
    getFieldsValue: vi.fn(() => ({ ...values })),
    resetFields: vi.fn(() => {
      Object.keys(values).forEach(key => delete values[key])
    }),
    _values: values,
  }
}

/**
 * 创建模拟的 Table 实例方法
 */
export function createMockTableMethods() {
  return {
    value: {
      reload: vi.fn(),
      getDataSource: vi.fn(() => []),
      setLoading: vi.fn(),
      setSelectedRowKeys: vi.fn(),
      clearSelection: vi.fn(),
    },
  }
}

/**
 * 创建模拟的用户记录
 */
export function createMockUserRecord(overrides?: Partial<UserRecord>): UserRecord {
  return {
    id: 1,
    key: '1',
    username: 'testuser',
    nickname: 'Test User',
    email: 'test@example.com',
    phone: '13800138000',
    status: 1,
    createTime: '2024-01-01 00:00:00',
    ...overrides,
  }
}

/** 用户记录类型 */
interface UserRecord {
  id: number | string
  key: string | number
  username: string
  nickname: string
  email: string
  phone: string
  status: number
  createTime: string
}

/**
 * 等待异步操作完成
 */
export async function waitFor(ms = 0): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 模拟 crypto API（用于 tokenCrypto 测试）
 */
export function mockCryptoAPI() {
  const originalSubtle = globalThis.crypto.subtle

  // Mock digest
  globalThis.crypto.subtle.digest = vi.fn().mockImplementation(async (_algo: string, data: Uint8Array) => {
    // 返回固定长度的假哈希值 (32 bytes for SHA-256)
    return new ArrayBuffer(32)
  })

  // Mock importKey
  globalThis.crypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey)

  // Mock deriveBits
  globalThis.crypto.subtle.deriveBits = vi.fn().mockImplementation(async () => {
    // 返回 256 bits (32 bytes) 的密钥
    const buffer = new ArrayBuffer(32)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < 32; i++) view[i] = i
    return buffer
  })

  return {
    restore: () => {
      globalThis.crypto.subtle = originalSubtle
    },
  }
}
