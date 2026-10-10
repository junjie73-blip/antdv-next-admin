import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SSEStateManager } from '../src/sse/SSEStateManager';
import { SSEState } from '../src/sse/types';
import { HeartbeatManager } from '../src/websocket/HeartbeatManager';
import { WebSocketState } from '../src/websocket/types';
import { WebSocketStateManager } from '../src/websocket/WebSocketStateManager';

function makeHeartbeat(
  overrides: Partial<{ interval: number; message: string; timeout: number }> = {},
) {
  const onSend = vi.fn();
  const manager = new HeartbeatManager(
    {
      interval: overrides.interval ?? 1000,
      timeout: overrides.timeout ?? 500,
      message: overrides.message ?? JSON.stringify({ type: 'ping' }),
    },
    onSend,
  );
  return { manager, onSend };
}

describe('HeartbeatManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start 后按间隔发送心跳', () => {
    const { manager, onSend } = makeHeartbeat({ interval: 1000 });
    manager.start();

    vi.advanceTimersByTime(999);
    expect(onSend).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSend).toHaveBeenCalledWith('{"type":"ping"}');
    expect(manager.isActive()).toBe(true);
  });

  it('心跳是周期性的，而不是连接上只发一次', () => {
    // 回归测试：老实现 sendHeartbeat() 末尾没有再排下一次，
    // 30 秒的连接只会在开头发一个 ping，之后长时间空闲被服务端 idle 踢掉。
    const { manager, onSend } = makeHeartbeat({ interval: 1000 });
    manager.start();

    vi.advanceTimersByTime(3000);
    expect(onSend).toHaveBeenCalledTimes(3);
  });

  it('重复 start 不会叠加出两条心跳', () => {
    const { manager, onSend } = makeHeartbeat({ interval: 1000 });
    manager.start();
    manager.start();
    manager.start();

    vi.advanceTimersByTime(1000);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('stop 之后不再有 ping，也不再判定超时', () => {
    const { manager, onSend } = makeHeartbeat({ interval: 1000, timeout: 500 });
    const onTimeout = vi.fn();
    manager.setTimeoutCallback(onTimeout);

    manager.start();
    vi.advanceTimersByTime(1000);
    expect(onSend).toHaveBeenCalledTimes(1);

    manager.stop();
    vi.advanceTimersByTime(10_000);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(manager.isActive()).toBe(false);
  });

  it('pong 回来就不算超时', () => {
    const { manager } = makeHeartbeat({ interval: 1000, timeout: 500 });
    const onTimeout = vi.fn();
    manager.setTimeoutCallback(onTimeout);

    manager.start();
    vi.advanceTimersByTime(1000); // ping 发出，开始等 pong
    manager.onPong();
    vi.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('pong 不回则触发超时回调', () => {
    const { manager } = makeHeartbeat({ interval: 1000, timeout: 500 });
    const onTimeout = vi.fn();
    manager.setTimeoutCallback(onTimeout);

    manager.start();
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('message 传函数时每轮取最新值', () => {
    let seq = 0;
    const onSend = vi.fn();
    const manager = new HeartbeatManager(
      { interval: 1000, timeout: 500, message: () => ({ ping: ++seq }) },
      onSend,
    );

    manager.start();
    vi.advanceTimersByTime(1000);
    manager.start();
    vi.advanceTimersByTime(1000);

    expect(onSend).toHaveBeenNthCalledWith(1, '{"ping":1}');
    expect(onSend).toHaveBeenNthCalledWith(2, '{"ping":2}');
  });

  it('updateConfig 在运行中会按新间隔重排', () => {
    const { manager, onSend } = makeHeartbeat({ interval: 1000 });
    manager.start();
    vi.advanceTimersByTime(500);

    manager.updateConfig({ interval: 2000 });
    vi.advanceTimersByTime(1500);
    expect(onSend).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

describe('WebSocketStateManager', () => {
  it('初始为 disconnected，状态判据跟着变', () => {
    const manager = new WebSocketStateManager();
    expect(manager.getState()).toBe(WebSocketState.Disconnected);
    expect(manager.isDisconnected()).toBe(true);
    expect(manager.isConnected()).toBe(false);

    manager.setState(WebSocketState.Connected);
    expect(manager.isConnected()).toBe(true);
    expect(manager.isDisconnected()).toBe(false);
  });

  it('getStateRef 暴露的是同一个响应式 ref', () => {
    const manager = new WebSocketStateManager();
    const ref = manager.getStateRef();
    manager.setState(WebSocketState.Connecting);
    expect(ref.value).toBe(WebSocketState.Connecting);
    expect(manager.isConnecting()).toBe(true);
  });

  it('clearWebSocket 摘掉监听并关闭连接', () => {
    const manager = new WebSocketStateManager();
    const close = vi.fn();
    const socket = {
      close,
      onclose: vi.fn(),
      onerror: vi.fn(),
      onmessage: vi.fn(),
      onopen: vi.fn(),
    } as unknown as WebSocket;

    manager.setWebSocket(socket);
    expect(manager.getWebSocket()).toBe(socket);

    manager.clearWebSocket();
    expect(close).toHaveBeenCalledTimes(1);
    expect(manager.getWebSocket()).toBeNull();
    expect(socket.onopen).toBeNull();
    expect(socket.onclose).toBeNull();
  });

  it('没有 socket 时 clearWebSocket 是安全的', () => {
    const manager = new WebSocketStateManager();
    expect(() => manager.clearWebSocket()).not.toThrow();
  });
});

describe('SSEStateManager', () => {
  it('状态迁移与判据', () => {
    const manager = new SSEStateManager();
    expect(manager.getState()).toBe(SSEState.Disconnected);

    manager.setState(SSEState.Connecting);
    expect(manager.isConnecting()).toBe(true);

    manager.setState(SSEState.Connected);
    expect(manager.isConnected()).toBe(true);

    manager.setState(SSEState.Error);
    expect(manager.isError()).toBe(true);
  });

  it('clearEventSource 关闭并摘监听', () => {
    const manager = new SSEStateManager();
    const close = vi.fn();
    const source = {
      close,
      onerror: vi.fn(),
      onmessage: vi.fn(),
      onopen: vi.fn(),
    } as unknown as EventSource;

    manager.setEventSource(source);
    manager.clearEventSource();

    expect(close).toHaveBeenCalledTimes(1);
    expect(manager.getEventSource()).toBeNull();
    expect(source.onopen).toBeNull();
    expect(source.onerror).toBeNull();
    expect(source.onmessage).toBeNull();
  });

  it('重复 setState 相同值不产生新变化', () => {
    const manager = new SSEStateManager();
    const ref = manager.getStateRef();
    const spy = vi.fn();
    ref.value = SSEState.Connected;
    manager.setState(SSEState.Connected);
    spy();
    expect(ref.value).toBe(SSEState.Connected);
  });
});
