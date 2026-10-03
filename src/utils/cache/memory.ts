/**
 * 内存缓存实现（带过期时间）
 *
 * 说明：
 *  - 不依赖 Vue / vueuse，保持框架无关性
 *  - 定时器在 delete / clear 时会被清理，避免内存泄漏
 */

/** 存储项 */
interface MemoryItem {
  value: string
  /** 过期时间戳（毫秒），不设置表示永不过期 */
  expire?: number
}

export class MemoryCache {
  private store = new Map<string, MemoryItem>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * 写入值
   *
   * @param expire - 过期时间（秒），不传或 <= 0 表示永不过期
   */
  set(key: string, value: string, expire?: number): void {
    // 先清理同 key 的旧定时器和值
    this.delete(key)

    const expireAt = expire && expire > 0 ? Date.now() + expire * 1000 : undefined

    this.store.set(key, { value, expire: expireAt })

    if (expireAt !== undefined) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, expire! * 1000)
      this.timers.set(key, timer)
    }
  }

  /**
   * 读取值，过期自动清理
   */
  get(key: string): string | null {
    const item = this.store.get(key)
    if (!item) return null

    if (item.expire !== undefined && Date.now() > item.expire) {
      this.delete(key)
      return null
    }

    return item.value
  }

  /**
   * 删除值并清理对应定时器
   */
  delete(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.store.delete(key)
  }

  /**
   * 判断 key 是否存在且未过期
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * 清空所有值，清理全部定时器
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.store.clear()
  }

  /**
   * 列出所有 key
   */
  keys(): string[] {
    return Array.from(this.store.keys())
  }
}

export const memoryCache = new MemoryCache()
