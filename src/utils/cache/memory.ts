export class MemoryCache {
  private store = new Map<string, { value: string, expire?: number }>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  set(key: string, value: string, expire?: number): void {
    this.delete(key)

    this.store.set(key, { value, expire })

    if (expire && expire > 0) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, expire * 1000)
      this.timers.set(key, timer)
    }
  }

  get(key: string): string | null {
    const item = this.store.get(key)
    if (!item)
      return null

    if (item.expire && Date.now() > item.expire) {
      this.delete(key)
      return null
    }

    return item.value
  }

  delete(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.store.delete(key)
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
    this.store.clear()
  }

  keys(): string[] {
    return Array.from(this.store.keys())
  }
}

export const memoryCache = new MemoryCache()
