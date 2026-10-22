import type { AppSetting } from '@antdv/types';

import { PREFERENCE_CSS_VARS } from '@antdv/shared/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyPreferencesToDom,
  clearPreferencesFromDom,
} from '../src/update-css-variables';

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

  /**
   * 变量格式是写侧与读侧的契约：`--primary` 里只能放 HSL 三段，读侧统一 `hsl(var(--primary))`。
   * 把 `rgb(255, 92, 92)` 原样写进去，`hsl(...)` 解析失败，主色在页面上直接消失，
   * 而构建和运行时都不报错 —— 所以这一条必须钉死。
   */
  it('主色写成 shadcn-vue 的 HSL 三段，不再留 --ant-* 兼容层', () => {
    /*
     * `--ant-color-primary` / `--ant-primary-color` / `--ant-border-radius` 曾是
     * 给 antd 兼容层样式用的桥。桥对面的层已经删了，读侧一个都不剩，留着只会造成
     * "偏好写了新值、还在读旧命名的样式没跟上"这种半更新，所以这里反向钉住它不出现。
     */
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      target: html,
    });
    expect(html.style.getPropertyValue('--primary')).toBe('0 100% 68%');
    expect(html.style.getPropertyValue('--primary')).not.toContain('rgb(');
    expect(html.style.getPropertyValue('--ant-color-primary')).toBe('');
    expect(html.style.getPropertyValue('--ant-primary-color')).toBe('');
    expect(html.style.getPropertyValue('--ant-border-radius')).toBe('');
  });

  it('圆角倍率换算成 rem，字号折算成根字号百分比', () => {
    applyPreferencesToDom(prefs({ borderRadius: 0.5, fontSize: 15 }), {
      target: html,
    });
    // 基准 16px（= token 的 `--radius-lg` 档），0.5 档就是 8px = 0.5rem。
    // 单位是 rem 而不是 px：默认根字号下计算值一样，但圆角会跟着 `--font-size` 缩放。
    expect(html.style.getPropertyValue('--radius')).toBe('0.5rem');
    // 15px 正文 ÷ 基准 14px = 107.14%。写 `15px` 是错的：根字号一变，
    // 所有 rem 尺寸（间距、图标、控件高）会跟着文字一起缩。
    expect(html.style.getPropertyValue('--font-size')).toBe('107.14%');
  });

  it('cssVars: false 时只切 class，不写变量', () => {
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      cssVars: false,
      target: html,
    });
    expect(html.style.getPropertyValue('--primary')).toBe('');
    expect(html.style.getPropertyValue('--radius')).toBe('');
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
    expect(html.style.getPropertyValue('--filter')).toBe(html.style.filter);
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
    expect(html.style.getPropertyValue('--radius')).toBe('');
    expect(html.style.getPropertyValue('--font-size')).toBe('');
  });

  it('变量名单 PREFERENCE_CSS_VARS 与真正写入的变量对齐', () => {
    // 名单漏一项的后果是"清不掉"，写侧漏一项是"读侧拿不到"，两边都靠这份名单钉住。
    // 用取色器那种非预设色：`--primary` 只在这一档写（预设档交给 [data-theme] 色板）。
    applyPreferencesToDom(
      prefs({
        colorWeak: true,
        primaryColor: 'rgb(255, 92, 92)',
        theme: 'dark',
      }),
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
 * 这一档最容易出"半更新"：内联写了 `--primary`，预设色板里那版主色（暗色下还提亮过一档）
 * 就被压回去了，表现是切到 violet 只有按钮变色、画布纹丝不动。
 */
describe('data-theme 档位', () => {
  it('预设色只挂档位，不内联主色', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ED1' }), { target: html });
    expect(html.dataset.theme).toBe('violet');
    expect(html.style.getPropertyValue('--primary')).toBe('');
  });

  it('档位与明暗无关：同一颗主色在深色下仍是 violet', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#13c2c2', theme: 'dark' }), {
      target: html,
    });
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.dataset.theme).toBe('deep-green');
  });

  it('大小写与三位简写都认得出预设：识别失败会掉回 custom，整套色板就白写了', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#F5222D' }), { target: html });
    expect(html.dataset.theme).toBe('rose');
    applyPreferencesToDom(prefs({ primaryColor: '#fff' }), { target: html });
    expect(html.dataset.theme).toBe('custom');
  });

  it('非预设色走 custom：档位标上 custom，主色内联写在 html 上', () => {
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      target: html,
    });
    expect(html.dataset.theme).toBe('custom');
    expect(html.style.getPropertyValue('--primary')).toBe('0 100% 68%');
  });

  it('从预设换回自定义要抹掉上一条内联主色，否则自定义色染不到页面上', () => {
    applyPreferencesToDom(prefs({ primaryColor: 'rgb(255, 92, 92)' }), {
      target: html,
    });
    applyPreferencesToDom(prefs({ primaryColor: '#2f54eb' }), { target: html });
    expect(html.dataset.theme).toBe('neutral');
    expect(html.style.getPropertyValue('--primary')).toBe('');
  });

  /**
   * 断言用 `hasAttribute` 而不是 `dataset.theme`。
   * 属性缺席时 DOM 给的是 `undefined`，而 `toBeNull()` 只认 `null` ——
   * 这条在 happy-dom 与 jsdom 下都会红，红的还是"实现是对的"那一侧。
   */
  it('cssVars: false 时连档位一起不写', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ed1' }), {
      cssVars: false,
      target: html,
    });
    expect(Object.hasOwn(html.dataset, 'theme')).toBe(false);
  });

  it('清场时把档位一并摘掉：残留的 data-theme 会让下次打开直接套上旧配色', () => {
    applyPreferencesToDom(prefs({ primaryColor: '#722ed1' }), { target: html });
    clearPreferencesFromDom({ target: html });
    expect(Object.hasOwn(html.dataset, 'theme')).toBe(false);
  });
});
