import type { CacheStorage, StorageType } from './types'

export function createStorage(type: StorageType): CacheStorage {
  switch (type) {
    case 'local':
      return {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => localStorage.setItem(key, value),
        removeItem: (key: string) => localStorage.removeItem(key),
        clear: () => {
          localStorage.clear()
        },
        keys: () => Object.keys(localStorage),
      }
    case 'session':
      return {
        getItem: (key: string) => sessionStorage.getItem(key),
        setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
        removeItem: (key: string) => sessionStorage.removeItem(key),
        clear: () => {
          sessionStorage.clear()
        },
        keys: () => Object.keys(sessionStorage),
      }
    case 'memory':
      return createMemoryStorage()
  }
}

function createMemoryStorage(): CacheStorage {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    keys: () => Array.from(store.keys()),
  }
}

export const localStorageAdapter = createStorage('local')
export const sessionStorageAdapter = createStorage('session')
export const memoryStorageAdapter = createStorage('memory')
