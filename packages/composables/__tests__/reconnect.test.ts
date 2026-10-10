import type { ReconnectSchedulerConfig } from '../src/internal/reconnect';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReconnectScheduler } from '../src/internal/reconnect';
import { SSEReconnectManager } from '../src/sse/SSEReconnectManager';
import { ReconnectManager } from '../src/websocket/ReconnectManager';

function makeScheduler(overrides: Partial<ReconnectSchedulerConfig> = {}) {
  return new ReconnectScheduler({
    delayMultiplier: 2,
    enabled: true,
    interval: 1000,
    maxAttempts: 5,
    maxDelay: 30_000,
    ...overrides,
  });
}

describe('ReconnectScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('指数退避：1s → 2s → 4s，并受 maxDelay 封顶', () => {
    const manager = makeScheduler({ interval: 1000, maxAttempts: 10 });
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    manager.start();
    vi.advanceTimersByTime(999);
    expect(onReconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // 第二次间隔 = 1000 * 2^1 = 2000
    manager.start();
    vi.advanceTimersByTime(2000);
    expect(onReconnect).toHaveBeenCalledTimes(2);

    // 第三次间隔 = 1000 * 2^2 = 4000
    manager.start();
    vi.advanceTimersByTime(3999);
    expect(onReconnect).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(onReconnect).toHaveBeenCalledTimes(3);
  });

  it('maxDelay 限制退避上限', () => {
    const manager = makeScheduler({
      interval: 1000,
      maxAttempts: 10,
      maxDelay: 1500,
    });
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    expect(manager.getNextDelay()).toBe(1000);

    manager.start();
    vi.runOnlyPendingTimers();
    // 第 2 次理论 2000，被 1500 封顶
    expect(manager.getNextDelay()).toBe(1500);

    manager.start();
    vi.advanceTimersByTime(1499);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(onReconnect).toHaveBeenCalledTimes(2);
    expect(manager.getNextDelay()).toBe(1500);
  });

  it('maxAttempts <= 0 是无限重试：永远不会"达到上限"', () => {
    // 这条是回归测试：老实现的 hasReachedMaxAttempts 写的是
    // currentAttempt >= maxAttempts，传 -1 时 0 >= -1 直接为真，
    // 第一次断线就报失败并且不再重连——通知 WebSocket 用的正是 retries: -1。
    const manager = makeScheduler({ maxAttempts: -1 });
    const onReconnect = vi.fn();
    const onFailed = vi.fn();
    manager.setReconnectCallback(onReconnect);
    manager.setMaxAttemptsReachedCallback(onFailed);

    expect(manager.isUnlimited()).toBe(true);
    expect(manager.hasReachedMaxAttempts()).toBe(false);

    for (let i = 0; i < 8; i++) {
      manager.start();
      vi.runOnlyPendingTimers();
    }

    expect(onReconnect).toHaveBeenCalledTimes(8);
    expect(onFailed).not.toHaveBeenCalled();
    expect(manager.getCurrentAttempt()).toBe(8);
  });

  it('达到上限时回调 onMaxAttemptsReached 并且不再排程', () => {
    const manager = makeScheduler({ maxAttempts: 2 });
    const onReconnect = vi.fn();
    const onFailed = vi.fn();
    manager.setReconnectCallback(onReconnect);
    manager.setMaxAttemptsReachedCallback(onFailed);

    manager.start();
    vi.runOnlyPendingTimers();
    manager.start();
    vi.runOnlyPendingTimers();
    expect(manager.getCurrentAttempt()).toBe(2);
    expect(manager.hasReachedMaxAttempts()).toBe(true);

    manager.start();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onReconnect).toHaveBeenCalledTimes(2);
    vi.runOnlyPendingTimers();
    expect(onReconnect).toHaveBeenCalledTimes(2);
  });

  it('stop() 真的取消待发计时器', () => {
    // 这条也是回归测试：老实现的 stop() 返回的是"是否已达上限"，
    // 根本没 clearTimeout，用户主动断开后还会再多打一次连接。
    const manager = makeScheduler();
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    manager.start();
    manager.stop();
    vi.advanceTimersByTime(10_000);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('reset() 取消计时器并把计数归零（连上之后调用）', () => {
    const manager = makeScheduler({ maxAttempts: 1 });
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    manager.start();
    vi.runOnlyPendingTimers();
    expect(manager.getCurrentAttempt()).toBe(1);

    manager.reset();
    expect(manager.getCurrentAttempt()).toBe(0);
    expect(manager.hasReachedMaxAttempts()).toBe(false);

    manager.start();
    vi.runOnlyPendingTimers();
    expect(onReconnect).toHaveBeenCalledTimes(2);
  });

  it('重复 start() 不叠加计时器', () => {
    const manager = makeScheduler();
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    manager.start();
    manager.start();
    manager.start();
    vi.advanceTimersByTime(1000);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(manager.getCurrentAttempt()).toBe(1);
  });

  it('enabled=false 时什么都不做', () => {
    const manager = makeScheduler({ enabled: false });
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    expect(manager.isEnabled()).toBe(false);
    manager.start();
    vi.advanceTimersByTime(10_000);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('updateConfig 会顺带 reset', () => {
    const manager = makeScheduler({ maxAttempts: 1 });
    const onReconnect = vi.fn();
    manager.setReconnectCallback(onReconnect);

    manager.start();
    vi.runOnlyPendingTimers();
    expect(manager.getCurrentAttempt()).toBe(1);

    manager.updateConfig({ maxAttempts: 10 });
    expect(manager.getCurrentAttempt()).toBe(0);
    expect(manager.getMaxAttempts()).toBe(10);
  });
});

describe('重连管理器的两个别名共用同一实现', () => {
  it('WebSocket 与 SSE 拿到的是同一个类', () => {
    // 两侧曾经各有一份实现，同一处逻辑各自出过 bug，现在收敛为一个构造器。
    expect(ReconnectManager).toBe(SSEReconnectManager);
    expect(ReconnectManager).toBe(ReconnectScheduler);
  });
});
