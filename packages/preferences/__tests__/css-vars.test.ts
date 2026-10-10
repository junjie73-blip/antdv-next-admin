import type { AppSetting } from '@antdv/types';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyPreferencesToDom,
  clearPreferencesFromDom,
} from '../src/css-vars';
import { DEFAULT_PREFERENCES, withDefaultPreferences } from '../src/defaults';

const html = document.documentElement;

function prefs(patch: Partial<AppSetting> = {}): AppSetting {
  return withDefaultPreferences(patch);
}

beforeEach(() => {
  clearPreferencesFromDom({ target: html });
});

describe('applyPreferencesToDom', () => {
  it('返回解析后的主题，auto 由系统偏好决定', () => {
    expect(applyPreferencesToDom(prefs(), { isSystemDark: true, target: html })).toBe('dark');
    expect(html.classList.contains('dark')).toBe(true);

    expect(applyPreferencesToDom(prefs(), { target: html })).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
  });

  it('显式 light 压过系统深色', () => {
    expect(
      applyPreferencesToDom(prefs({ theme: 'light' }), {
        isSystemDark: true,
        target: html,
      }),
    ).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
  });

  it('darkClass 可定制', () => {
    applyPreferencesToDom(prefs({ theme: 'dark' }), {
      darkClass: 'theme-dark',
      target: html,
    });
    expect(html.classList.contains('theme-dark')).toBe(true);
    expect(html.classList.contains('dark')).toBe(false);
  });

  it('写主色：新旧两套变量名都覆盖', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#f5222d' }), { target: html });
    expect(html.style.getPropertyValue('--ant-color-primary')).toBe('#f5222d');
    // 进度条等旧样式读的是 --ant-primary-color
    expect(html.style.getPropertyValue('--ant-primary-color')).toBe('#f5222d');
  });

  it('圆角倍率换算成 px，字号与侧栏宽度落变量', () => {
    applyPreferencesToDom(
      prefs({ borderRadius: 0.5, fontSize: 15, sidebarWidth: 240 }),
      { target: html },
    );
    expect(html.style.getPropertyValue('--ant-border-radius')).toBe('4px');
    expect(html.style.getPropertyValue('--app-font-size')).toBe('15px');
    expect(html.style.getPropertyValue('--app-sidebar-width')).toBe('240px');
  });

  it('cssVars: false 时只切 class，不写变量', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#faad14' }), {
      cssVars: false,
      target: html,
    });
    expect(html.style.getPropertyValue('--ant-color-primary')).toBe('');
  });

  it('色弱 / 灰色模式：class 与 filter 同时生效', () => {
    applyPreferencesToDom(prefs({ colorWeak: true }), { target: html });
    expect(html.classList.contains('color-weak')).toBe(true);
    expect(html.style.filter).toContain('invert(80%)');

    applyPreferencesToDom(prefs({ grayMode: true }), { target: html });
    expect(html.classList.contains('gray-mode')).toBe(true);
    expect(html.style.filter).toContain('grayscale(100%)');

    applyPreferencesToDom(prefs({ colorWeak: true, grayMode: true }), {
      target: html,
    });
    // 两条滤镜串成一条链，而不是后者覆盖前者
    expect(html.style.filter).toBe('invert(80%) grayscale(100%) grayscale(100%)');
    expect(html.style.getPropertyValue('--app-filter')).toBe(html.style.filter);
  });

  it('colorScheme 跟随解析后的明暗（原生控件与滚动条配色）', () => {
    applyPreferencesToDom(prefs({ theme: 'auto' }), {
      isSystemDark: true,
      target: html,
    });
    expect(html.style.colorScheme).toBe('dark');

    applyPreferencesToDom(prefs({ theme: 'light' }), {
      isSystemDark: true,
      target: html,
    });
    expect(html.style.colorScheme).toBe('light');
  });

  it('两个开关都关掉时 filter 复位为 none', () => {
    applyPreferencesToDom(prefs({ colorWeak: true }), { target: html });
    applyPreferencesToDom(prefs(), { target: html });
    expect(html.style.filter).toBe('none');
    expect(html.classList.contains('color-weak')).toBe(false);
  });

  it('默认偏好不会给 html 留下 dark class', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('auto');
    applyPreferencesToDom(prefs(), { target: html });
    expect(html.classList.contains('dark')).toBe(false);
  });
});

describe('clearPreferencesFromDom', () => {
  it('清掉写过的 class、变量与 filter', () => {
    applyPreferencesToDom(
      prefs({ colorWeak: true, grayMode: true, theme: 'dark' }),
      { target: html },
    );
    clearPreferencesFromDom({ target: html });

    expect(html.classList.contains('dark')).toBe(false);
    expect(html.classList.contains('color-weak')).toBe(false);
    expect(html.classList.contains('gray-mode')).toBe(false);
    expect(html.style.filter).toBe('');
    expect(html.style.colorScheme).toBe('');
    expect(html.style.getPropertyValue('--ant-color-primary')).toBe('');
    expect(html.style.getPropertyValue('--ant-border-radius')).toBe('');
  });
});
