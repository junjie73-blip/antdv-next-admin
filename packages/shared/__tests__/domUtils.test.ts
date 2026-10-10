import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addClass,
  getBoundingClientRect,
  getViewportOffset,
  hackCss,
  hasClass,
  off,
  on,
  once,
  removeClass,
  useRafThrottle,
} from '../src/domUtils';

function el(className = '') {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

describe('class 操作', () => {
  it('hasClass 判断单个类', () => {
    const node = el('a b');
    expect(hasClass(node, 'a')).toBe(true);
    expect(hasClass(node, 'c')).toBe(false);
    expect(hasClass(node, '')).toBe(false);
  });

  it('hasClass 对含空格的类名报错（调用方用法错误要尽早暴露）', () => {
    expect(() => hasClass(el('a'), 'a b')).toThrow(
      'className should not contain space.',
    );
  });

  it('addClass 支持空格分隔的多个类且幂等', () => {
    const node = el('a');
    addClass(node, 'b c');
    expect(node.className).toBe('a b c');
    addClass(node, 'b  b');
    expect(node.className).toBe('a b c');
    addClass(node, '');
    expect(node.className).toBe('a b c');
  });

  it('removeClass 移除存在的类，保留其余', () => {
    const node = el('a b c');
    removeClass(node, 'b c');
    expect(node.className).toBe('a');
    removeClass(node, 'zzz');
    expect(node.className).toBe('a');
    removeClass(node, '');
    expect(node.className).toBe('a');
  });

  it('没有 classList 时退化为 className 字符串操作', () => {
    // 模拟老浏览器：classList 为 falsy
    const legacy = { className: 'a b', classList: undefined } as unknown as Element;
    expect(hasClass(legacy, 'a')).toBe(true);
    expect(hasClass(legacy, 'ab')).toBe(false);
    addClass(legacy, 'c');
    expect(legacy.className).toBe('a b c');
    addClass(legacy, 'a');
    expect(legacy.className).toBe('a b c');
    removeClass(legacy, 'b');
    expect(legacy.className).toBe('a c');
  });
});

describe('getBoundingClientRect', () => {
  it('非元素入参返回 0 而不是抛异常', () => {
    expect(getBoundingClientRect(null as unknown as Element)).toBe(0);
    expect(getBoundingClientRect({} as unknown as Element)).toBe(0);
  });

  it('真实元素返回 DOMRect', () => {
    const rect = getBoundingClientRect(el());
    expect(typeof rect).toBe('object');
    expect((rect as DOMRect).width).toBeGreaterThanOrEqual(0);
  });
});

describe('getViewportOffset', () => {
  it('返回六个方向的偏移量', () => {
    const node = el();
    document.body.append(node);
    const offset = getViewportOffset(node);
    expect(Object.keys(offset).sort()).toEqual(
      [
        'bottom',
        'bottomIncludeBody',
        'left',
        'right',
        'rightIncludeBody',
        'top',
      ].sort(),
    );
    for (const value of Object.values(offset)) {
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value)).toBe(true);
    }
    node.remove();
  });
});

describe('hackCss', () => {
  it('生成主流浏览器前缀并保留标准属性', () => {
    expect(hackCss('user-select', 'none')).toEqual({
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      OTUserSelect: 'none',
      'user-select': 'none',
    });
  });
});

describe('on / off / once', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on 绑定、off 解绑', () => {
    const node = el();
    const spy = vi.fn();
    on(node, 'click', spy);
    node.click();
    expect(spy).toHaveBeenCalledTimes(1);
    off(node, 'click', spy);
    node.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('入参缺失时静默忽略', () => {
    const node = el();
    const spy = vi.fn();
    expect(() => on(node, '', spy)).not.toThrow();
    expect(() => off(node, 'click', undefined as unknown as () => void)).not.toThrow();
  });

  it('once 只触发一次并自动解绑', () => {
    const node = el();
    const spy = vi.fn();
    once(node, 'click', spy);
    node.click();
    node.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('useRafThrottle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('一帧内多次调用合并为一次执行', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    const spy = vi.fn();
    const throttled = useRafThrottle(spy);
    const flush = () => {
      const pending = frames.splice(0, frames.length);
      for (const cb of pending) cb(0);
    };

    throttled(1);
    throttled(2);
    throttled(3);
    expect(spy).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    flush();
    // 合并语义：一帧内只跑一次，用的是首次调用的参数
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);

    throttled(4);
    expect(frames).toHaveLength(1);
    flush();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(4);
  });
});
