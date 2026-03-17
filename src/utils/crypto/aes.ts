import type { AesOptions } from './types'
import { sm4 } from 'sm-crypto'

const DEFAULT_KEY = '0123456789abcdeffedcba9876543210'

function padKey(key: string): string {
  if (key.length < 32) {
    return key.padEnd(32, '0')
  }
  return key.slice(0, 32)
}

export function encrypt(data: string, options: AesOptions): string {
  const key = padKey(options.key || DEFAULT_KEY)
  return sm4.encrypt(data, key)
}

export function decrypt(data: string, options: AesOptions): string {
  const key = padKey(options.key || DEFAULT_KEY)
  return sm4.decrypt(data, key)
}

export function encryptObject<T extends Record<string, unknown>>(obj: T, options: AesOptions): string {
  return encrypt(JSON.stringify(obj), options)
}

export function decryptObject<T>(data: string, options: AesOptions): T {
  const decrypted = decrypt(data, options)
  return JSON.parse(decrypted) as T
}
