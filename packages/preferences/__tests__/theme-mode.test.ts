import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSystemDark, resolveThemeMode } from '../src/theme-mode';

/** 可控的 matchMedia 替身：记录订阅数，并能主动"改系统偏好" */
function fakeMediaQueryList(initial = false) {
  let matches = initial;
  const listeners: Array<() => void> = [];

  const mql = {
    addEventListener: (_type: string, callback: () => void) => {
      listeners.push(callback);
    },
    listenerCount: () => listeners.length,
    matches,
    media: '(prefers-color-scheme: dark)',
    removeEventListener: (_type: string, callback: () => void) => {
      const index = listeners.indexOf(callback);
      if (index >= 0) listeners.splice(index, 1);
    },
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
  // 每次读 mql.matches 都要拿到最新值
  Object.defineProperty(mql, 'matches', {
    get: () => matches,
  });

  return mql as unknown as MediaQueryList & {
    listenerCount: () => number;
    setMatches: (next: boolean) => void;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveThemeMode', () => {
  it('折叠 auto：系统深色则暗，否则亮', () => {
    expect(resolveThemeMode('auto', true)).toBe('dark');
    expect(resolveThemeMode('auto', false)).toBe('light');
  });

  it('显式模式不受系统偏好影响', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark');
    expect(resolveThemeMode('light', true)).toBe('light');
  });

  it('缺省参数落到浅色', () => {
    expect(resolveThemeMode(undefined)).toBe('light');
  });
});

describe('createSystemDark', () => {
  it('读取当前系统偏好', () => {
    const mql = fakeMediaQueryList(true);
    const system = createSystemDark({ matchMedia: () => mql });
    expect(system.supported()).toBe(true);
    expect(system.isDark()).toBe(true);

    mql.setMatches(false);
    expect(system.isDark()).toBe(false);
  });

  it('订阅共享一个监听器，全部退订后移除', () => {
    const mql = fakeMediaQueryList(false);
    const system = createSystemDark({ matchMedia: () => mql });

    const seen: boolean[] = [];
    const offA = system.subscribe((isDark) => seen.push(isDark));
    const offB = system.subscribe((isDark) => seen.push(!isDark));
    expect(mql.listenerCount()).toBe(1);

    mql.setMatches(true);
    expect(seen).toEqual([true, false]);

    offA();
    expect(mql.listenerCount()).toBe(1);
    offB();
    expect(mql.listenerCount()).toBe(0);
  });

  it('没人订阅时不占用系统监听，订阅后才挂载', () => {
    const mql = fakeMediaQueryList(false);
    const system = createSystemDark({ matchMedia: () => mql });
    expect(mql.listenerCount()).toBe(0);

    const seen: boolean[] = [];
    const off = system.subscribe((isDark) => seen.push(isDark));
    expect(mql.listenerCount()).toBe(1);

    mql.setMatches(true);
    expect(seen).toEqual([true]);
    off();
    expect(mql.listenerCount()).toBe(0);
  });

  it('老浏览器只有 addListener 时走废弃接口', () => {
    let attached = 0;
    const legacy = {
      addListener: () => {
        attached += 1;
      },
      addEventListener: undefined,
      matches: true,
      media: '(prefers-color-scheme: dark)',
      removeListener: () => {
        attached -= 1;
      },
    } as unknown as MediaQueryList;

    const system = createSystemDark({ matchMedia: () => legacy });
    const off = system.subscribe(() => {});
    expect(attached).toBe(1);
    off();
    expect(attached).toBe(0);
  });

  it('不支持 matchMedia 时降级为浅色而不是抛错', () => {
    const original = window.matchMedia;
    // 模拟 SSR / 极老浏览器：没有 matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });

    try {
      const system = createSystemDark();
      expect(system.supported()).toBe(false);
      expect(system.isDark()).toBe(false);

      const listener = vi.fn();
      const off = system.subscribe(listener);
      off();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: original,
      });
    }
  });
});
