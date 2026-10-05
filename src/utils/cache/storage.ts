import type { CacheStorage, StorageType } from './types'

/** 内存存储实例（模块级单例，避免 createStorage('memory') 每次调用都新建 Map） */
const memoryStore = new Map<string, string>()

/**
 * 创建内存存储适配器
 */
function createMemoryStorage(): CacheStorage {
  return {
    getItem: (key: string): string | null => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      memoryStore.set(key, value)
    },
    removeItem: (key: string): void => {
      memoryStore.delete(key)
    },
    clear: (): void => {
      memoryStore.clear()
    },
    keys: (): string[] => Array.from(memoryStore.keys()),
  }
}

/**
 * 创建 localStorage 适配器
 */
function createLocalStorage(): CacheStorage {
  return {
    getItem: (key: string): string | null => localStorage.getItem(key),
    setItem: (key: string, value: string): void => localStorage.setItem(key, value),
    removeItem: (key: string): void => localStorage.removeItem(key),
    clear: (): void => localStorage.clear(),
    keys: (): string[] => Object.keys(localStorage),
  }
}

/**
 * 创建 sessionStorage 适配器
 */
function createSessionStorage(): CacheStorage {
  return {
    getItem: (key: string): string | null => sessionStorage.getItem(key),
    setItem: (key: string, value: string): void => sessionStorage.setItem(key, value),
    removeItem: (key: string): void => sessionStorage.removeItem(key),
    clear: (): void => sessionStorage.clear(),
    keys: (): string[] => Object.keys(sessionStorage),
  }
}

/**
 * 创建存储适配器
 */
export function createStorage(type: StorageType): CacheStorage {
  switch (type) {
    case 'local':
      return createLocalStorage()
    case 'session':
      return createSessionStorage()
    case 'memory':
      return createMemoryStorage()
  }
}

export const localStorageAdapter: CacheStorage = createStorage('local')
export const sessionStorageAdapter: CacheStorage = createStorage('session')
export const memoryStorageAdapter: CacheStorage = createStorage('memory')
