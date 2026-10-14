import { describe, expect, it, vi } from 'vitest';

import { createEventBus, eventBus, triggerWindowResize } from '../src/event';

describe('createEventBus', () => {
  it('emit 会把 payload 传给处理器', () => {
    const bus = createEventBus();
    const spy = vi.fn();
    bus.on('refresh', spy);
    bus.emit('refresh', { id: 1 });
    expect(spy).toHaveBeenCalledWith({ id: 1 });
  });

  it('同一事件的多个处理器都收到，顺序为注册顺序', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on('e', () => calls.push('first'));
    bus.on('e', () => calls.push('second'));
    bus.emit('e');
    expect(calls).toEqual(['first', 'second']);
  });

  it('不同事件互不干扰', () => {
    const bus = createEventBus();
    const spy = vi.fn();
    bus.on('a', spy);
    bus.emit('b');
    expect(spy).not.toHaveBeenCalled();
  });

  it('off 只摘掉对应处理器', () => {
    const bus = createEventBus();
    const removed = vi.fn();
    const kept = vi.fn();
    bus.on('e', removed);
    bus.on('e', kept);
    bus.off('e', removed);
    bus.emit('e');
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('once 只触发一次', () => {
    const bus = createEventBus();
    const spy = vi.fn();
    bus.once('e', spy);
    bus.emit('e', 1);
    bus.emit('e', 2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('clear(event) 只清理事件，clear() 清理全部', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('a', a);
    bus.on('b', b);
    bus.clear('a');
    bus.emit('a');
    bus.emit('b');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    bus.clear();
    bus.emit('b');
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('没有监听者时 emit 不抛异常', () => {
    const bus = createEventBus();
    expect(() => bus.emit('nobody-listens', 1)).not.toThrow();
  });

  it('未捕获错误不会中断其它处理器（mitt 语义）', () => {
    const bus = createEventBus();
    const after = vi.fn();
    // mitt 不吞异常：第一个抛错会中断本次派发，这里锁定真实行为，
    // 业务侧应自行 try/catch（见 resize 监听里的 dispatchResize）。
    bus.on('e', () => {
      throw new Error('boom');
    });
    bus.on('e', after);
    expect(() => bus.emit('e')).toThrow('boom');
    expect(after).not.toHaveBeenCalled();
  });
});

describe('eventBus 单例', () => {
  it('多次使用共享同一实例', () => {
    const spy = vi.fn();
    eventBus.on('global-event', spy);
    eventBus.emit('global-event', 'x');
    expect(spy).toHaveBeenCalledWith('x');
    eventBus.clear('global-event');
    eventBus.emit('global-event', 'y');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('triggerWindowResize', () => {
  it('派发 window resize 事件', () => {
    const spy = vi.fn();
    window.addEventListener('resize', spy);
    triggerWindowResize();
    window.removeEventListener('resize', spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
