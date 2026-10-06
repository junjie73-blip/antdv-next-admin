import type { ReconnectConfig } from './types';

export class SSEReconnectManager {
  private config: ReconnectConfig;
  private currentAttempt = 0;
  private onMaxAttemptsReached?: () => void;
  private onReconnect?: () => void;
  private reconnectTimer: null | ReturnType<typeof setTimeout> = null;

  constructor(config: ReconnectConfig) {
    this.config = config;
  }

  getCurrentAttempt(): number {
    return this.currentAttempt;
  }

  getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  getNextDelay(): number {
    return this.calculateDelay();
  }

  hasReachedMaxAttempts(): boolean {
    return this.currentAttempt >= this.config.maxAttempts;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  reset(): void {
    this.stop();
    this.currentAttempt = 0;
  }

  setMaxAttemptsReachedCallback(callback: () => void): void {
    this.onMaxAttemptsReached = callback;
  }

  setReconnectCallback(callback: () => void): void {
    this.onReconnect = callback;
  }

  start(): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.currentAttempt >= this.config.maxAttempts) {
      if (this.onMaxAttemptsReached) {
        this.onMaxAttemptsReached();
      }
      return;
    }

    const delay = this.calculateDelay();

    this.reconnectTimer = setTimeout(() => {
      this.currentAttempt++;
      if (this.onReconnect) {
        this.onReconnect();
      }
    }, delay);
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private calculateDelay(): number {
    const baseDelay = this.config.interval;
    const multiplier = this.config.delayMultiplier;
    const maxDelay = this.config.maxDelay;

    const exponentialDelay = baseDelay * multiplier ** this.currentAttempt;

    return Math.min(exponentialDelay, maxDelay);
  }
}
