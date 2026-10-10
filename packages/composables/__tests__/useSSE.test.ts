import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SSEEventType, SSEState } from '../src/sse/types';
import { useSSE } from '../src/sse/useSSE';
import { withSetup } from './helpers/setup';

type Handler = (event: never) => void;

/**
 * 假 EventSource：只实现 useSSE 用到的那几件事
 * （构造、onopen/onmessage/onerror、close），并记录每一轮的 URL 与是否被关闭。
 */
class FakeEventSource {
  static readonly instances: FakeEventSource[] = [];

  closed = false;
  onerror: Handler | null = null;
  onmessage: Handler | null = null;
  onopen: Handler | null = null;
  readyState = 0;

  get latest() {
    return FakeEventSource.instances.at(-1) as FakeEventSource;
  }

  constructor(
    readonly url: string,
    readonly init?: { withCredentials?: boolean },
  ) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emitMessage(data: string, lastEventId = '') {
    this.onmessage?.({
      data,
      lastEventId,
    } as never);
  }

  fail() {
    this.onerror?.({ type: 'error' } as never);
  }

  open() {
    this.readyState = 1;
    this.onopen?.({ type: 'open' } as never);
  }
}

const options = {
  maxReconnectAttempts: 3,
  reconnectInterval: 1000,
  url: '/api/events',
};

describe('useSSE', () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connect 建立连接并推进状态', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    expect(result.isConnected.value).toBe(false);

    result.connect();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(result.isConnecting.value).toBe(true);
    expect(result.readyState.value).toBe(SSEState.Connecting);

    FakeEventSource.instances[0]!.open();
    expect(result.isConnected.value).toBe(true);
    expect(result.readyState.value).toBe(SSEState.Connected);
    unmount();
  });

  it('重复 connect 不会挂第二条连接', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    result.connect();
    result.connect();
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0]!.open();
    result.connect();
    expect(FakeEventSource.instances).toHaveLength(1);
    unmount();
  });

  it('message 事件按 JSON 与否分别派发', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    const typed: unknown[] = [];
    const named: unknown[] = [];
    result.on(SSEEventType.Message, (event) => typed.push(event));
    result.on('event:message', (data) => named.push(data));

    result.connect();
    const es = FakeEventSource.instances[0]!;
    es.open();
    es.emitMessage('plain-text', 'id-1');
    expect(typed).toHaveLength(1);
    expect(named).toEqual(['plain-text']);

    es.emitMessage('{"kind":"notice"}', 'id-2');
    expect(named).toEqual(['plain-text', { kind: 'notice' }]);
    expect(result.lastEventId.value).toBe('id-2');
    unmount();
  });

  it('空 data 直接丢弃，不派发事件', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    const named: unknown[] = [];
    result.on('event:message', (data) => named.push(data));
    result.connect();
    FakeEventSource.instances[0]!.emitMessage('');
    expect(named).toHaveLength(0);
    unmount();
  });

  it('出错时先关掉旧连接再调度重连，重连带上 lastEventId', async () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    result.connect();
    const first = FakeEventSource.instances[0]!;
    first.open();
    first.emitMessage('{"a":1}', 'evt-42');

    first.fail();
    // 关键：浏览器原生 EventSource 自己也会重试，
    // 不先 close 就会出现「我们的重连 + 浏览器的重连」两条连接。
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1]!.url).toBe('/api/events?lastEventId=evt-42');
    expect(result.reconnectAttempts.value).toBe(1);
    unmount();
  });

  it('重连次数用尽后彻底断开', async () => {
    const { result, unmount } = withSetup(() =>
      useSSE({ ...options, reconnectEnabled: true }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    result.connect();
    // 4 次失败才叫「用尽」：前 3 次各换来一次重连，第 4 次命中上限后彻底断开。
    // 每次推进 30s——重连是指数退避（1s → 2s → 4s），按固定 1s 推进会漏掉后几次。
    for (let attempt = 0; attempt < 4; attempt += 1) {
      FakeEventSource.instances.at(-1)!.fail();
      await vi.advanceTimersByTimeAsync(30_000);
    }

    expect(result.isDisconnected.value).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(4);
    expect(result.reconnectAttempts.value).toBe(3);
    warn.mockRestore();
    unmount();
  });

  it('disconnect 发出 close 与状态变更事件', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    const states: unknown[] = [];
    const closes: unknown[] = [];
    result.on(SSEEventType.StateChange, (state) => states.push(state));
    result.on(SSEEventType.Close, (event) => closes.push(event));

    result.connect();
    FakeEventSource.instances[0]!.open();
    result.disconnect();

    expect(FakeEventSource.instances[0]!.closed).toBe(true);
    expect(states).toEqual([
      SSEState.Connecting,
      SSEState.Connected,
      SSEState.Disconnected,
    ]);
    expect(closes).toHaveLength(1);
    unmount();
  });

  it('卸载时自动断开', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    result.connect();
    const es = FakeEventSource.instances[0]!;
    es.open();
    unmount();
    expect(es.closed).toBe(true);
    expect(result.readyState.value).toBe(SSEState.Disconnected);
  });

  it('withCredentials 透传给 EventSource', () => {
    const { result, unmount } = withSetup(() =>
      useSSE({ ...options, withCredentials: true }),
    );
    result.connect();
    expect(FakeEventSource.instances[0]!.init).toEqual({ withCredentials: true });
    unmount();
  });

  it('registerHandlers 返回批量退订函数', () => {
    const { result, unmount } = withSetup(() => useSSE(options));
    const opened = vi.fn();
    const dispose = result.registerHandlers({
      [SSEEventType.Open]: opened,
    });
    result.connect();
    FakeEventSource.instances[0]!.open();
    expect(opened).toHaveBeenCalledTimes(1);

    dispose();
    result.reconnect();
    FakeEventSource.instances.at(-1)!.open();
    expect(opened).toHaveBeenCalledTimes(1);
    unmount();
  });
});
