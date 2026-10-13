import { config } from '@vue/test-utils';

/**
 * 单测环境垫片。
 *
 * jsdom 只提供"能跑 JS 的 DOM"，浏览器里那些观察器/API 是缺的；
 * 布局组件（侧边栏滚动条、菜单溢出测量、图标懒加载）一上来就会问它们。
 * 这里补一层最小可用实现，让组件能在测试里真正挂载，而不是因为环境缺东西而跳过。
 */
import { beforeEach, vi } from 'vitest';
import i18n from '~/locales';
import { configureUiKitRuntimes } from '~/plugins/ui-runtime';

/**
 * `useI18n()` 在没装插件的 app 上会直接抛 "Need to install with `app.use`"，
 * 而布局/外壳组件现在都要取文案。测试环境补一份和 `main.ts` 同一个实例，
 * 免得每个 spec 各自挂一遍、将来又是有的挂有的不挂。
 */
config.global.plugins.push(i18n);

/**
 * `@antdv/layout-ui` / `menu-ui` / `tabs-ui` 的 aria-label 走注入的 `t`。
 * 用例断言的是中文原文（`[aria-label="退出内容全屏"]`），所以这里与 `main.ts`
 * 一样先注入一次，否则渲染出来的是裸 key。
 */
configureUiKitRuntimes();

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
