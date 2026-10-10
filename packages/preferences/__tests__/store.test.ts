import type { CacheInstance } from '@antdv/shared/cache';
import type { AppSetting } from '@antdv/types';

import type { PreferencesInstance } from '../src/store';

import { createCache } from '@antdv/shared/cache';
import { configureSharedEnv } from '@antdv/shared/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPreferencesFromDom } from '../src/css-vars';
import { DEFAULT_PREFERENCES, withDefaultPreferences } from '../src/defaults';
import {
  booleanPreferenceKeys,
  createPreferences,
  createToggles,
  PREFERENCES_CACHE_KEY,
} from '../src/store';

const PREFIX = 'unit_pref';
const RAW_KEY = `${PREFIX}_${PREFERENCES_CACHE_KEY}`;
const html = document.documentElement;

/** 落盘的原始 JSON（未加密，因为 production: false） */
function rawSaved(): null | { value: AppSetting } {
  const raw = localStorage.getItem(RAW_KEY);
  return raw ? (JSON.parse(raw) as { value: AppSetting }) : null;
}

function make(options: Parameters<typeof createPreferences>[0] = {}): PreferencesInstance {
  return createPreferences({
    // 单测里不往真实 documentElement 上写，除非用例专门验证 DOM 落地
    applyToDom: false,
    ...options,
  });
}

/** 可控 matchMedia 替身 */
function fakeMediaQueryList(initial = false) {
  let matches = initial;
  const listeners: Array<() => void> = [];
  const mql = {
    addEventListener: (_type: string, callback: () => void) => {
      listeners.push(callback);
    },
    listenerCount: () => listeners.length,
    removeEventListener: (_type: string, callback: () => void) => {
      const index = listeners.indexOf(callback);
      if (index >= 0) listeners.splice(index, 1);
    },
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
  Object.defineProperty(mql, 'matches', { get: () => matches });
  return mql as unknown as MediaQueryList & {
    listenerCount: () => number;
    setMatches: (next: boolean) => void;
  };
}

beforeEach(() => {
  configureSharedEnv({ cachePrefix: PREFIX, production: false });
  localStorage.clear();
  // 上一个用例写到 documentElement 上的偏好要清干净，否则"创建时即应用"这类断言会假阳性
  clearPreferencesFromDom({ target: html });
});

describe('createPreferences 读取与合并', () => {
  it('无缓存时用默认值，并带上应用注入的 defaults', () => {
    const preferences = make({
      defaults: { watermarkContent: 'Acme 控制台' },
    });
    expect(preferences.get().watermarkContent).toBe('Acme 控制台');
    expect(preferences.get().theme).toBe('auto');
    expect(preferences.get().tabStyle).toBe('card');
  });

  it('旧缓存缺字段时逐项兜底', () => {
    const store = createCache<Partial<AppSetting>>({ prefix: PREFIX, type: 'local' });
    store.setItem(PREFERENCES_CACHE_KEY, { primaryColor: '#f5222d' });

    const preferences = make();
    expect(preferences.get().primaryColor).toBe('#f5222d');
    expect(preferences.get().fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
  });

  it('缓存里的未知键与脏类型不会污染状态，也不会被写回', () => {
    localStorage.setItem(
      RAW_KEY,
      JSON.stringify({
        createTime: Date.now(),
        expire: 0,
        value: { legacyField: 'x', primaryColor: 123, showTabs: true },
      }),
    );

    const preferences = make();
    expect(preferences.get().showTabs).toBe(true);
    expect(preferences.get().primaryColor).toBe(DEFAULT_PREFERENCES.primaryColor);
    expect('legacyField' in preferences.get()).toBe(false);

    preferences.patch({ fontSize: 16 });
    expect(rawSaved()?.value).not.toHaveProperty('legacyField');
  });

  it('缓存读取抛错时降级为默认值（存储被禁用 / 密钥变更）', () => {
    const preferences = make({
      cache: {
        getItem: () => {
          throw new Error('decrypt failed');
        },
        setItem: () => {},
      } as unknown as CacheInstance<AppSetting>,
    });
    expect(preferences.get().theme).toBe('auto');
  });

  it('写盘失败不影响内存态', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    const preferences = make({
      cache: { getItem: () => null, setItem } as unknown as CacheInstance<AppSetting>,
    });
    expect(() => preferences.patch({ primaryColor: '#faad14' })).not.toThrow();
    expect(preferences.get().primaryColor).toBe('#faad14');
  });
});

describe('createPreferences 写入', () => {
  it('patch 合并、持久化，并保留其它字段', () => {
    const preferences = make();
    preferences.patch({ grayMode: true, primaryColor: '#eb2f96' });

    expect(preferences.get().grayMode).toBe(true);
    expect(preferences.get().primaryColor).toBe('#eb2f96');
    expect(rawSaved()?.value.primaryColor).toBe('#eb2f96');
    expect(preferences.pick('showTabs')).toBe(true);
  });

  it('set 写单项，类型由键推导', () => {
    const preferences = make();
    preferences.set('sidebarWidth', 260);
    preferences.set('tabStyle', 'rounded');
    expect(preferences.get().sidebarWidth).toBe(260);
    expect(preferences.get().tabStyle).toBe('rounded');
  });

  it('toggle 翻转布尔项', () => {
    const preferences = make();
    const before = preferences.get().showTabs;
    preferences.toggle('showTabs');
    expect(preferences.get().showTabs).toBe(!before);
    preferences.toggle('showTabs');
    expect(preferences.get().showTabs).toBe(before);
  });

  it('replace 整体覆盖：未提供的键回到默认', () => {
    const preferences = make();
    preferences.patch({ fontSize: 20 });
    preferences.replace({ primaryColor: '#13c2c2' });
    expect(preferences.get().fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
    expect(preferences.get().primaryColor).toBe('#13c2c2');
  });

  it('reset 回到默认并落盘', () => {
    const preferences = make({ defaults: { copyrightIcp: '京ICP备00000000号' } });
    preferences.patch({ theme: 'dark' });
    preferences.reset();
    expect(preferences.get().theme).toBe('auto');
    // 应用侧 defaults 属于"这个项目的新默认值"，reset 不应丢
    expect(preferences.get().copyrightIcp).toBe('京ICP备00000000号');
    expect(rawSaved()?.value.theme).toBe('auto');
  });

  it('save 手动落盘当前状态', () => {
    const preferences = make();
    preferences.save();
    expect(localStorage.getItem(RAW_KEY)).toBeTruthy();
  });

  it('reload 取回其它标签页写入的新值', () => {
    const preferences = make();
    const other = createCache<AppSetting>({ prefix: PREFIX, type: 'local' });
    other.setItem(PREFERENCES_CACHE_KEY, {
      ...withDefaultPreferences(),
      locale: 'en-US',
    });
    expect(preferences.get().locale).toBe('zh-CN');
    preferences.reload();
    expect(preferences.get().locale).toBe('en-US');
  });
});

describe('订阅与派生状态', () => {
  it('subscribe 收到 next / prev，取消后不再通知', () => {
    const preferences = make();
    const listener = vi.fn();
    const off = preferences.subscribe(listener);

    preferences.patch({ fontSize: 18 });
    expect(listener).toHaveBeenCalledTimes(1);
    const [next, previous] = listener.mock.calls[0]!;
    expect(next.fontSize).toBe(18);
    expect(previous.fontSize).toBe(DEFAULT_PREFERENCES.fontSize);

    off();
    preferences.patch({ fontSize: 20 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preferences 是响应式的', async () => {
    const { isRef } = await import('vue');
    const preferences = make();
    expect(isRef(preferences.preferences)).toBe(true);
    // 用当前有效的布局名：`'mixed'` 是历史别名，已被 `'mixed-vertical'` 取代，
    // 读时迁移由 @antdv/layouts 的 normalizeLayoutMode 负责，偏好层不负责改名。
    preferences.patch({ layout: 'mixed-vertical' });
    expect(preferences.preferences.value.layout).toBe('mixed-vertical');
  });

  it('resolvedTheme 把 auto 折叠成明暗', () => {
    const preferences = make({ isSystemDark: () => true });
    expect(preferences.get().theme).toBe('auto');
    expect(preferences.resolvedTheme.value).toBe('dark');

    preferences.patch({ theme: 'light' });
    expect(preferences.resolvedTheme.value).toBe('light');
  });
});

describe('跟随系统主题', () => {
  it('auto 模式下系统切深色会更新派生状态并通知订阅者', () => {
    const mql = fakeMediaQueryList(false);
    const preferences = make({ matchMedia: () => mql });
    const listener = vi.fn();
    preferences.subscribe(listener);

    expect(preferences.resolvedTheme.value).toBe('light');
    mql.setMatches(true);
    expect(preferences.isSystemDark.value).toBe(true);
    expect(preferences.resolvedTheme.value).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('非 auto 模式忽略系统变化', () => {
    const mql = fakeMediaQueryList(false);
    const preferences = make({ matchMedia: () => mql });
    preferences.patch({ theme: 'light' });
    const listener = vi.fn();
    preferences.subscribe(listener);

    mql.setMatches(true);
    expect(preferences.resolvedTheme.value).toBe('light');
    expect(listener).not.toHaveBeenCalled();
  });

  it('destroy 后不再监听系统变化', () => {
    const mql = fakeMediaQueryList(false);
    const preferences = make({ matchMedia: () => mql });
    expect(mql.listenerCount()).toBe(1);
    preferences.destroy();
    expect(mql.listenerCount()).toBe(0);
    mql.setMatches(true);
    expect(preferences.isSystemDark.value).toBe(false);
  });
});

describe('createToggles', () => {
  it('按默认值实际内容生成布尔开关，新增偏好自动获得', () => {
    const preferences = make();
    const toggles = createToggles(preferences);
    const keys = booleanPreferenceKeys();

    expect(keys.length).toBeGreaterThan(20);
    expect(keys.every((key) => typeof DEFAULT_PREFERENCES[key] === 'boolean')).toBe(true);
    expect(Object.keys(toggles)).toEqual(keys);
  });

  it('翻转对应偏好并落盘', () => {
    const preferences = make();
    const toggles = createToggles(preferences);
    const before = preferences.get().showFooter;

    toggles.showFooter();
    expect(preferences.get().showFooter).toBe(!before);
    expect(rawSaved()?.value.showFooter).toBe(!before);
  });
});

describe('DOM 落地', () => {
  it('创建时即应用当前偏好', () => {
    make({ applyToDom: true, defaults: { primaryColor: '#fa541c' } });
    expect(html.style.getPropertyValue('--ant-color-primary')).toBe('#fa541c');
  });

  it('patch 后 class 与变量同步更新', () => {
    const preferences = make({
      applyToDom: true,
      matchMedia: () => fakeMediaQueryList(true),
    });
    preferences.patch({ colorWeak: true, theme: 'auto' });
    expect(html.classList.contains('color-weak')).toBe(true);
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.style.filter).toContain('invert(80%)');
  });

  it('applyToDom: false 时完全不碰 documentElement', () => {
    make();
    expect(html.style.filter).toBe('');
    expect(html.classList.contains('dark')).toBe(false);
  });

  it('自定义 cacheKey 与 expire', () => {
    const preferences = createPreferences({
      applyToDom: false,
      cacheKey: 'themeSetting',
      expire: 60,
    });
    preferences.patch({ theme: 'dark' });
    const raw = localStorage.getItem(`${PREFIX}_themeSetting`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).expire).toBeGreaterThan(Date.now());
  });
});
