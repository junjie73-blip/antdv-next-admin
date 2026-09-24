import type { ReconnectConfig } from './types'

export class ReconnectManager {
  private config: ReconnectConfig
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private currentAttempt = 0
  private onReconnect?: () => void
  private onMaxAttemptsReached?: () => void

  constructor(config: ReconnectConfig) {
    this.config = config
  }

  start(): void {
    if (!this.config.enabled) {
      return
    }

    // ⭐ maxAttempts <= 0 表示无限重试
    if (this.hasReachedMaxAttempts()) {
      if (this.onMaxAttemptsReached) {
        this.onMaxAttemptsReached()
      }
      return
    }

    const delay = this.calculateDelay()

    this.reconnectTimer = setTimeout(() => {
      this.currentAttempt++
      if (this.onReconnect) {
        this.onReconnect()
      }
    }, delay)
  }

  stop(): boolean {
    if (this.config.maxAttempts <= 0) return false
    return this.currentAttempt >= this.config.maxAttempts
  }

  reset(): void {
    this.stop()
    this.currentAttempt = 0
  }

  private calculateDelay(): number {
    const baseDelay = this.config.interval
    const multiplier = this.config.delayMultiplier
    const maxDelay = this.config.maxDelay

    const exponentialDelay = baseDelay * multiplier ** this.currentAttempt

    return Math.min(exponentialDelay, maxDelay)
  }

  getCurrentAttempt(): number {
    return this.currentAttempt
  }

  getMaxAttempts(): number {
    return this.config.maxAttempts
  }

  getNextDelay(): number {
    return this.calculateDelay()
  }

  setReconnectCallback(callback: () => void): void {
    this.onReconnect = callback
  }

  setMaxAttemptsReachedCallback(callback: () => void): void {
    this.onMaxAttemptsReached = callback
  }

  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config }
    this.reset()
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  hasReachedMaxAttempts(): boolean {
    return this.currentAttempt >= this.config.maxAttempts
  }
}
