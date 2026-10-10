/**
 * 断线重连调度器：WebSocket 与 SSE 共用。
 *
 * 两侧原本各有一份几乎一样的实现，结果同一处逻辑各自出 bug——
 * 一份的 stop() 忘了 clearTimeout，另一份的"无限重试"判断写反。
 * 收敛成一份，规则只在一个地方维护。
 */

export interface ReconnectSchedulerConfig {
  /** 指数退避倍数，默认 2 */
  delayMultiplier: number;
  /** 关掉就完全不重连 */
  enabled: boolean;
  /** 基础延迟（ms） */
  interval: number;
  /** 最大重试次数；<= 0 表示无限重试 */
  maxAttempts: number;
  /** 延迟上限（ms） */
  maxDelay: number;
}

export class ReconnectScheduler {
  private config: ReconnectSchedulerConfig;
  private currentAttempt = 0;
  private onMaxAttemptsReached?: () => void;
  private onReconnect?: () => void;
  private timer: null | ReturnType<typeof setTimeout> = null;

  constructor(config: ReconnectSchedulerConfig) {
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
    if (this.isUnlimited()) return false;
    return this.currentAttempt >= this.config.maxAttempts;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** <= 0 是「无限重试」的约定值（调用方常传 -1） */
  isUnlimited(): boolean {
    return this.config.maxAttempts <= 0;
  }

  /** 连接成功后调用：清待发定时器 + 计数归零 */
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

    if (this.hasReachedMaxAttempts()) {
      this.onMaxAttemptsReached?.();
      return;
    }

    // 同一时刻只保留一个待发计时器，避免重复 start 叠加出并发重连
    this.clearTimer();

    const delay = this.calculateDelay();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.currentAttempt++;
      this.onReconnect?.();
    }, delay);
  }

  /** 取消待发的重连（语义就是"停"，不是"是否已达上限"） */
  stop(): void {
    this.clearTimer();
  }

  updateConfig(config: Partial<ReconnectSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    this.reset();
  }

  private calculateDelay(): number {
    const { interval, delayMultiplier, maxDelay } = this.config;
    const exponentialDelay = interval * delayMultiplier ** this.currentAttempt;
    return Math.min(exponentialDelay, maxDelay);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
