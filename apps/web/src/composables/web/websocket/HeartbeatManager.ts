import type { HeartbeatConfig } from './types';

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private heartbeatTimer: null | ReturnType<typeof setInterval> = null;
  private isRunning = false;
  private onSend: (message: string) => void;
  private onTimeout?: () => void;
  private timeoutTimer: null | ReturnType<typeof setTimeout> = null;

  constructor(config: HeartbeatConfig, onSend: (message: string) => void) {
    this.config = config;
    this.onSend = onSend;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  onPong(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  reset(): void {
    this.clearTimers();
    if (this.isRunning) {
      this.scheduleHeartbeat();
    }
  }

  setTimeoutCallback(callback: () => void): void {
    this.onTimeout = callback;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleHeartbeat();
  }

  stop(): void {
    this.isRunning = false;
    this.clearTimers();
  }

  updateConfig(config: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.isRunning) {
      this.reset();
    }
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private scheduleHeartbeat(): void {
    if (!this.isRunning) {
      return;
    }

    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();
    }, this.config.interval);
  }

  private sendHeartbeat(): void {
    if (!this.isRunning) {
      return;
    }

    // ⭐ 支持函数形式，每次取最新值
    const raw =
      typeof this.config.message === 'function'
        ? this.config.message()
        : this.config.message;

    const message = typeof raw === 'string' ? raw : JSON.stringify(raw);

    this.onSend(message);

    // 先清旧定时器，防止 pong 未回导致累积
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.timeoutTimer = setTimeout(() => {
      if (this.onTimeout) {
        this.onTimeout();
      }
    }, this.config.timeout);
  }
}
