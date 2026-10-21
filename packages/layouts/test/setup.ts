/**
 * 单测环境垫片。
 *
 * jsdom 只提供"能跑 JS 的 DOM"，浏览器里那些观察器与 API 是缺的；
 * 外壳一上来就要它们：`useMobile` 问 `matchMedia`，侧栏滚动条与菜单溢出测尺寸，
 * 偏好从 localStorage 读。这里补一层最小可用实现，让组件能在测试里真正挂载。
 */
import { beforeEach, vi } from 'vitest';

interface FakeMediaQueryList extends MediaQueryList {
  addListener: (callback: (e: MediaQueryListEvent) => void) => void;
  removeListener: (callback: (e: MediaQueryListEvent) => void) => void;
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  const instance = {
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    matches: false,
    media: '',
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as FakeMediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => instance),
    writable: true,
  });
}

/** 观察器：布局组件用它测尺寸，测试里只需要"能注册、能断开" */
class FakeObserver {
  disconnect() {}
  observe() {}
  takeRecords(): [] {
    return [];
  }
  unobserve() {}
}

for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
  const Ctor = (window as unknown as Record<string, unknown>)[name];
  if (typeof Ctor !== 'function') {
    Object.defineProperty(window, name, {
      configurable: true,
      value: FakeObserver,
      writable: true,
    });
  }
}

/** 每个用例从干净的偏好存储出发，避免上一个用例写死的布局偏好串味 */
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// reka 的浮层定位与菜单溢出判定会用到这两样，jsdom 都没有
if (globalThis.CSS === undefined) {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: {
      escape: (value: string) =>
        String(value).replaceAll(/[^\w-]/g, (c) => `\\${c}`),
    },
  });
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/** jsdom 里元素没有布局盒，溢出滚动与宽度断言全靠这几个尺寸 */
if (!HTMLElement.prototype.getBoundingClientRect) {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 100,
    height: 20,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON() {},
  });
}
