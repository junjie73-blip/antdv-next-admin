import { describe, expect, it, vi } from 'vitest';

import { SSEEventManager } from '../src/sse/SSEEventManager';
import { SSEEventType } from '../src/sse/types';
import { EventManager } from '../src/websocket/EventManager';
import { WebSocketEventType } from '../src/websocket/types';

describe('WebSocket EventManager', () => {
  it('on 注册、emit 派发、返回的函数取消订阅', () => {
    const manager = new EventManager();
    const spy = vi.fn();
    const off = manager.on(WebSocketEventType.Message, spy);

    manager.emit(WebSocketEventType.Message, 'a');
    expect(spy).toHaveBeenCalledWith('a');

    off();
    manager.emit(WebSocketEventType.Message, 'b');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(manager.hasListeners(WebSocketEventType.Message)).toBe(false);
  });

  it('同一个回调重复注册只生效一次（Set 语义）', () => {
    const manager = new EventManager();
    const spy = vi.fn();
    manager.on(WebSocketEventType.Open, spy);
    manager.on(WebSocketEventType.Open, spy);

    manager.emit(WebSocketEventType.Open, undefined);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(manager.getListenerCount(WebSocketEventType.Open)).toBe(1);
  });

  it('once 只触发一次并自动摘除', () => {
    const manager = new EventManager();
    const spy = vi.fn();
    manager.once(WebSocketEventType.Close, spy);

    manager.emit(WebSocketEventType.Close, 1);
    manager.emit(WebSocketEventType.Close, 2);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(manager.getListenerCount(WebSocketEventType.Close)).toBe(0);
  });

  it('某个回调抛错不影响其它回调', () => {
    const manager = new EventManager();
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const good = vi.fn();

    manager.on(WebSocketEventType.Message, () => {
      throw new Error('boom');
    });
    manager.on(WebSocketEventType.Message, good);

    manager.emit(WebSocketEventType.Message, 'x');

    expect(good).toHaveBeenCalledWith('x');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('off(eventType) 清空该类型，off(eventType, cb) 只摘一个', () => {
    const manager = new EventManager();
    const a = vi.fn();
    const b = vi.fn();
    manager.on(WebSocketEventType.Error, a);
    manager.on(WebSocketEventType.Error, b);

    manager.off(WebSocketEventType.Error, a);
    manager.emit(WebSocketEventType.Error, 'e');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith('e');

    manager.off(WebSocketEventType.Error);
    expect(manager.getListenerCount(WebSocketEventType.Error)).toBe(0);
  });

  it('registerHandlers 一次性注册并在返回的卸载函数里全部摘掉', () => {
    const manager = new EventManager();
    const onMessage = vi.fn();
    const onOpen = vi.fn();

    const dispose = manager.registerHandlers({
      [WebSocketEventType.Message]: onMessage,
      [WebSocketEventType.Open]: onOpen,
    });

    manager.emit(WebSocketEventType.Message, 'm');
    manager.emit(WebSocketEventType.Open, undefined);
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);

    dispose();
    manager.emit(WebSocketEventType.Message, 'm2');
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('removeAllListeners 支持按类型和全清', () => {
    const manager = new EventManager();
    manager.on(WebSocketEventType.Message, vi.fn());
    manager.on(WebSocketEventType.Open, vi.fn());

    manager.removeAllListeners(WebSocketEventType.Message);
    expect(manager.getListenerCount(WebSocketEventType.Message)).toBe(0);
    expect(manager.getListenerCount(WebSocketEventType.Open)).toBe(1);

    manager.removeAllListeners();
    expect(manager.getListenerCount(WebSocketEventType.Open)).toBe(0);
  });

  it('emit 未注册的类型是安全的空操作', () => {
    const manager = new EventManager();
    expect(() =>
      manager.emit(WebSocketEventType.StateChange, 'connected'),
    ).not.toThrow();
  });
});

describe('SSE EventManager', () => {
  it('event: 前缀走命名事件通道，与普通类型互不干扰', () => {
    const manager = new SSEEventManager();
    const typed = vi.fn();
    const named = vi.fn();

    manager.on(SSEEventType.Message, typed);
    manager.on('event:message', named);

    manager.emit(SSEEventType.Message, 'raw');
    expect(typed).toHaveBeenCalledTimes(1);
    expect(named).not.toHaveBeenCalled();

    manager.emit('event:message', { hello: 1 });
    expect(named).toHaveBeenCalledWith({ hello: 1 });
    expect(typed).toHaveBeenCalledTimes(1);
  });

  it('命名事件的监听数、取消与清空', () => {
    const manager = new SSEEventManager();
    const spy = vi.fn();
    const off = manager.on('event:notice', spy);

    expect(manager.getListenerCount('event:notice')).toBe(1);
    expect(manager.hasListeners('event:notice')).toBe(true);

    manager.emit('event:notice', 'a');
    off();
    manager.emit('event:notice', 'b');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(manager.getListenerCount('event:notice')).toBe(0);
  });

  it('off("event:x") 不带回调时清掉整个命名通道', () => {
    const manager = new SSEEventManager();
    manager.on('event:x', vi.fn());
    manager.on('event:x', vi.fn());
    expect(manager.getListenerCount('event:x')).toBe(2);

    manager.off('event:x');
    expect(manager.getListenerCount('event:x')).toBe(0);
  });

  it('命名事件回调抛错被吞掉并记录，后续回调继续执行', () => {
    const manager = new SSEEventManager();
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const good = vi.fn();

    manager.on('event:y', () => {
      throw new Error('bad');
    });
    manager.on('event:y', good);

    manager.emitNamedEvent('y', 1);

    expect(good).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('removeAllListeners 会同时清掉两种通道', () => {
    const manager = new SSEEventManager();
    manager.on(SSEEventType.Open, vi.fn());
    manager.on('event:z', vi.fn());

    manager.removeAllListeners();
    expect(manager.getListenerCount(SSEEventType.Open)).toBe(0);
    expect(manager.getListenerCount('event:z')).toBe(0);
  });
});
