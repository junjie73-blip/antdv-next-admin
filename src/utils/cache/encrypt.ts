import { sm4 } from 'sm-crypto'

const DEFAULT_KEY = 'antdv-next-admin-cache-key'

function padKey(key: string): string {
  if (key.length < 32) {
    return key.padEnd(32, '0')
  }
  return key.slice(0, 32)
}

export function encryptValue(value: string, key?: string): string {
  const finalKey = padKey(key || DEFAULT_KEY)
  return sm4.encrypt(value, finalKey)
}

export function decryptValue(value: string, key?: string): string {
  const finalKey = padKey(key || DEFAULT_KEY)
  return sm4.decrypt(value, finalKey)
}

export function shouldEncrypt(): boolean {
  return import.meta.env.PROD
}
