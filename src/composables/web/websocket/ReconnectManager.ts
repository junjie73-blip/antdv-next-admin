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

    if (this.currentAttempt >= this.config.maxAttempts) {
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

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
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
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  hasReachedMaxAttempts(): boolean {
    return this.currentAttempt >= this.config.maxAttempts
  }
}
