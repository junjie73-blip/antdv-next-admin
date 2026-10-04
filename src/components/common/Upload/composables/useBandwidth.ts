import { sleep } from '../utils'

export interface BandwidthLimiter {
  /** 记录本次上传的字节数 */
  record(bytes: number): Promise<void>
  /** 动态调整速率 */
  setLimit(bytesPerSecond: number): void
  /** 当前速率 */
  readonly bytesPerSecond: number
}

/**
 * 客户端令牌桶限速器
 * - 每次上传前调 `await limiter.record(chunkSize)` 等令牌
 * - 不传 bytesPerSecond 或 <= 0 → 不限速
 */
export function createBandwidthLimiter(bytesPerSecond: number = 0, burstSize?: number): BandwidthLimiter {
  let bps = Math.max(0, bytesPerSecond)
  const burst = burstSize ?? bps
  let tokens = burst
  let lastRefill = Date.now()

  function refill() {
    if (bps <= 0) return
    const now = Date.now()
    const elapsed = (now - lastRefill) / 1000
    if (elapsed > 0) {
      tokens = Math.min(burst, tokens + elapsed * bps)
      lastRefill = now
    }
  }

  return {
    get bytesPerSecond() {
      return bps
    },

    setLimit(next: number) {
      bps = Math.max(0, next)
      tokens = Math.min(burst, tokens)
      lastRefill = Date.now()
    },

    async record(bytes: number) {
      if (bps <= 0) return

      const remaining = bytes
      while (remaining > 0) {
        refill()
        if (tokens >= remaining) {
          tokens -= remaining
          return
        }
        const need = remaining - tokens
        const waitMs = Math.ceil((need / bps) * 1000)
        tokens = 0
        await sleep(Math.max(1, waitMs))
      }
    },
  }
}
