import type { HeartbeatConfig } from './types'

export class HeartbeatManager {
  private config: HeartbeatConfig
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private isRunning = false
  private onSend: (message: string) => void
  private onTimeout?: () => void

  constructor(config: HeartbeatConfig, onSend: (message: string) => void) {
    this.config = config
    this.onSend = onSend
  }

  start(): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.scheduleHeartbeat()
  }

  stop(): void {
    this.isRunning = false
    this.clearTimers()
  }

  private scheduleHeartbeat(): void {
    if (!this.isRunning) {
      return
    }

    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat()
    }, this.config.interval)
  }

  private sendHeartbeat(): void {
    if (!this.isRunning) {
      return
    }

    const message = typeof this.config.message === 'string'
      ? this.config.message
      : JSON.stringify(this.config.message)

    this.onSend(message)

    this.timeoutTimer = setTimeout(() => {
      if (this.onTimeout) {
        this.onTimeout()
      }
    }, this.config.timeout)
  }

  reset(): void {
    this.clearTimers()
    if (this.isRunning) {
      this.scheduleHeartbeat()
    }
  }

  onPong(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  setTimeoutCallback(callback: () => void): void {
    this.onTimeout = callback
  }

  updateConfig(config: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...config }
    if (this.isRunning) {
      this.reset()
    }
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  isActive(): boolean {
    return this.isRunning
  }
}
