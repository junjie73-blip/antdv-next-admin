import type { AppSetting } from '@antdv/types';

import { PREFERENCE_CSS_VARS } from '@antdv/shared/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyPreferencesToDom,
  clearPreferencesFromDom,
} from '../src/css-vars';

const html = document.documentElement;

/**
 * 只铺 `applyPreferencesToDom` 真正读到的那几个字段。
 * 这里刻意不 import `@antdv/preferences`：那个包依赖本包，测试反过来依赖它就成了环。
 */
function prefs(patch: Partial<AppSetting> = {}): AppSetting {
  return {
    borderRadius: 0.5,
    colorWeak: false,
    fontSize: 14,
    grayMode: false,
    primaryColor: '#1677ff',
    sidebarWidth: 200,
    theme: 'auto',
    ...patch,
  } as AppSetting;
}

beforeEach(() => {
  clearPreferencesFromDom({ target: html });
});

describe('applyPreferencesToDom', () => {
  it('返回解析后的主题，auto 由系统偏好决定', () => {
    expect(
      applyPreferencesToDom(prefs(), { isSystemDark: true, target: html }),
    ).toBe('dark');
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
    expect(html.style.filter).toBe(
      'invert(80%) grayscale(100%) grayscale(100%)',
    );
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
    expect(prefs().theme).toBe('auto');
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

  it('变量名单 PREFERENCE_CSS_VARS 与真正写入的变量对齐', () => {
    // 名单漏一项的后果是"清不掉"，写侧漏一项是"读侧拿不到"，两边都靠这份名单钉住。
    // 用取色器那种非预设色：`--app-primary` 只在这一档写（预设档交给 [data-theme] 色板）。
    applyPreferencesToDom(
      prefs({ colorWeak: true, primaryColor: 'rgb(255, 92, 92)', theme: 'dark' }),
      { target: html },
    );
    for (const name of PREFERENCE_CSS_VARS) {
      expect(html.style.getPropertyValue(name)).not.toBe('');
    }

    clearPreferencesFromDom({ target: html });
    for (const name of PREFERENCE_CSS_VARS) {
      expect(html.style.getPropertyValue(name)).toBe('');
    }
  });
});

/**
 * 主题档位：预设主题在 `@antdv/design` 里各带一整套 `[data-theme]` 色板，
 * 运行时只负责把档位名挂到 `<html>` 上。
 * 这一档最容易出"半更新"：内联写了 `--app-primary`，预设色板里那版主色（暗色下还提亮过一档）
 * 就被压回去了，表现是切到 violet 只有按钮变色、画布纹丝不动。
 */
describe('data-theme 档位', () => {
  it('预设色只挂档位，不内联主色', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ED1' }), { target: html });
    expect(html.getAttribute('data-theme')).toBe('violet');
    expect(html.style.getPropertyValue('--app-primary')).toBe('');
  });

  it('档位与明暗无关：同一颗主色在深色下仍是 violet', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#13c2c2', theme: 'dark' }), {
      target: html,
    });
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.getAttribute('data-theme')).toBe('deep-green');
  });

  it('大小写与三位简写都认得出预设：识别失败会掉回 custom，整套色板就白写了', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#F5222D' }), { target: html });
    expect(html.getAttribute('data-theme')).toBe('rose');
    applyPreferencesToDom(prefs({ primaryColor: '#fff' }), { target: html });
    expect(html.getAttribute('data-theme')).toBe('custom');
  });

  it('非预设色走 custom：档位标上 custom，主色内联写在 html 上', () => {
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      target: html,
    });
    expect(html.getAttribute('data-theme')).toBe('custom');
    expect(html.style.getPropertyValue('--app-primary')).toBe('rgb(255, 92, 92)');
  });

  it('从预设换回自定义要抹掉上一条内联主色，否则自定义色染不到页面上', () => {
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      target: html,
    });
    applyPreferencesToDom(prefs({ primaryColor: '#2f54eb' }), { target: html });
    expect(html.getAttribute('data-theme')).toBe('neutral');
    expect(html.style.getPropertyValue('--app-primary')).toBe('');
  });

  it('cssVars: false 时连档位一起不写', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ed1' }), {
      cssVars: false,
      target: html,
    });
    expect(html.getAttribute('data-theme')).toBeNull();
  });

  it('清场时把档位一并摘掉：残留的 data-theme 会让下次打开直接套上旧配色', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ed1' }), { target: html });
    clearPreferencesFromDom({ target: html });
    expect(html.getAttribute('data-theme')).toBeNull();
  });
});
