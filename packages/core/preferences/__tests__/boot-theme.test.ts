import { buildStorageKey } from '@antdv/shared/cache';
import { configureSharedEnv } from '@antdv/shared/utils/env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildBootThemeSnapshot,
  clearBootThemeCache,
  readBootThemeCache,
  writeBootThemeCache,
} from '../src/boot-theme';
import { DEFAULT_PREFERENCES } from '../src/config';
import { BOOT_THEME_CACHE_KEY } from '../src/constants';
import { createPreferences } from '../src/preferences';
import { clearPreferencesFromDom } from '../src/update-css-variables';

const PREFIX = 'unit_boot';
// 前缀由 beforeEach 注入，键名只能用时再算（模块求值时 configureSharedEnv 还没跑）
const rawKey = () => buildStorageKey(BOOT_THEME_CACHE_KEY);

function make(
  options: Parameters<typeof createPreferences>[0] = {},
): ReturnType<typeof createPreferences> {
  return createPreferences({ applyToDom: false, ...options });
}

function rawSnapshot(): null | Record<string, unknown> {
  const raw = localStorage.getItem(rawKey());
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

beforeEach(() => {
  configureSharedEnv({ cachePrefix: PREFIX, production: false });
  localStorage.clear();
  clearPreferencesFromDom({ target: document.documentElement });
});

afterEach(() => {
  clearBootThemeCache();
});

describe('writeBootThemeCache', () => {
  it('落在带应用前缀的独立键上，而且是明文 JSON', () => {
    writeBootThemeCache({ ...DEFAULT_PREFERENCES });

    // 首屏脚本跑在应用代码之前，没有解密能力 —— 这条快照必须明文可读。
    // 同时它不能和完整偏好共用一个键：那份里含标题、水印等整套设置。
    expect(localStorage.getItem(rawKey())).toContain('"theme"');
    expect(rawSnapshot()?.theme).toBe('auto');
  });

  it('实例创建时就写一条，首次访问也有可读的首屏快照', () => {
    make();
    expect(readBootThemeCache()?.themeKey).toBe('default');
  });

  it('预设主色记档位，取色器颜色记 custom', () => {
    writeBootThemeCache({ ...DEFAULT_PREFERENCES, primaryColor: '#fa541c' });
    expect(readBootThemeCache()?.themeKey).toBe('orange');

    writeBootThemeCache({ ...DEFAULT_PREFERENCES, primaryColor: '#123456' });
    expect(readBootThemeCache()?.themeKey).toBe('custom');
  });

  it('theme 存原始值、mode 存当次解析结果，auto 不把系统偏好冻在快照里', () => {
    writeBootThemeCache({ ...DEFAULT_PREFERENCES, theme: 'auto' }, true);
    const snapshot = readBootThemeCache();
    expect(snapshot?.theme).toBe('auto');
    expect(snapshot?.mode).toBe('dark');

    // 同一份"跟随系统"的偏好，系统换成浅色后重新落盘
    writeBootThemeCache({ ...DEFAULT_PREFERENCES, theme: 'auto' }, false);
    expect(readBootThemeCache()?.mode).toBe('light');
  });

  it('改主色会同步刷新快照（写侧排在 applyDom 之后）', () => {
    const preferences = make();
    preferences.patch({ primaryColor: '#123456' });
    expect(readBootThemeCache()?.themeKey).toBe('custom');
  });

  it('色弱与灰色开关进快照，首屏不必等应用起来才染上滤镜', () => {
    writeBootThemeCache({ ...DEFAULT_PREFERENCES, colorWeak: true });
    expect(readBootThemeCache()?.colorWeak).toBe(true);
  });

  it('没有样式表时 vars 是空串而不是抛错', () => {
    const snapshot = buildBootThemeSnapshot({ ...DEFAULT_PREFERENCES });
    expect(Object.keys(snapshot.vars).sort()).toEqual([
      'background',
      'foreground',
      'primary',
    ]);
    for (const value of Object.values(snapshot.vars)) {
      expect(typeof value).toBe('string');
    }
  });

  it('clearBootThemeCache 只清这一条，不动完整偏好', () => {
    localStorage.setItem(buildStorageKey('appSetting'), '{}');
    writeBootThemeCache({ ...DEFAULT_PREFERENCES });
    clearBootThemeCache();

    expect(readBootThemeCache()).toBeNull();
    expect(localStorage.getItem(buildStorageKey('appSetting'))).toBe('{}');
  });
});
