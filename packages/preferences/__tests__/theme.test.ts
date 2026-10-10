import type { AppSetting, ThemePreset } from '@antdv/types';

import { theme } from 'antdv-next';
import { afterEach, describe, expect, it } from 'vitest';

import { withDefaultPreferences } from '../src/defaults';
import {
  clearThemePresets,
  DEFAULT_LOCALE,
  getAntdTheme,
  getLocaleModule,
  getThemeConfig,
  loadLocale,
  registerThemePreset,
  SUPPORTED_LOCALES,
  themeOverridesFrom,
} from '../src/theme';
import { darkComponents, darkToken } from '../src/theme/dark';
import { lightComponents, lightToken } from '../src/theme/light';

afterEach(() => {
  clearThemePresets();
});

describe('getAntdTheme', () => {
  it('light 用亮色 token、亮色组件覆盖与 defaultAlgorithm', () => {
    const config = getAntdTheme('light');
    expect(config.algorithm).toBe(theme.defaultAlgorithm);
    expect(config.token).toMatchObject({ colorPrimary: lightToken.colorPrimary });
    expect(config.components).toEqual(lightComponents);
  });

  it('dark 用暗色 token 与 darkAlgorithm', () => {
    const config = getAntdTheme('dark');
    expect(config.algorithm).toBe(theme.darkAlgorithm);
    expect(config.token).toMatchObject({ colorPrimary: darkToken.colorPrimary });
    expect(config.components).toEqual(darkComponents);
  });

  it('auto 由系统偏好决定用哪套 token', () => {
    expect(getAntdTheme('auto', true).algorithm).toBe(theme.darkAlgorithm);
    expect(getAntdTheme('auto', false).algorithm).toBe(theme.defaultAlgorithm);
    expect(getAntdTheme('auto', true).token).toMatchObject({
      colorPrimary: darkToken.colorPrimary,
    });
  });

  it('用户覆盖优先级最高', () => {
    const config = getAntdTheme('light', false, {
      borderRadius: 12,
      fontSize: 15,
      primaryColor: '#f5222d',
    });
    expect(config.token).toMatchObject({
      borderRadius: 12,
      colorPrimary: '#f5222d',
      fontSize: 15,
    });
  });

  it('compact 风格叠加 compactAlgorithm', () => {
    const config = getAntdTheme('dark', false, {}, 'compact');
    expect(config.algorithm).toEqual([theme.darkAlgorithm, theme.compactAlgorithm]);
  });

  it('未注册的风格安全回落到 default', () => {
    expect(getAntdTheme('light', false, {}, 'glass').algorithm).toBe(
      theme.defaultAlgorithm,
    );
  });

  it('注册预设后 token / components / algorithm 都被合入', () => {
    const preset: ThemePreset = {
      components: { Button: { controlHeight: 44 } },
      label: '玻璃',
      name: 'glass',
      token: { colorPrimary: '#722ed1', wireframe: true },
    };
    registerThemePreset('glass', preset);

    const config = getAntdTheme('light', false, {}, 'glass');
    expect(config.token).toMatchObject({ colorPrimary: '#722ed1', wireframe: true });
    expect(config.components).toMatchObject({ Button: { controlHeight: 44 } });
    // 预设之外的字段仍来自亮色 token
    expect((config.token as Record<string, unknown>).borderRadiusLG).toBe(
      (lightToken as Record<string, unknown>).borderRadiusLG,
    );

    // 用户覆盖排在预设之后：预设不能盖掉用户选的主色
    const withOverride = getAntdTheme('light', false, { primaryColor: '#13c2c2' }, 'glass');
    expect(withOverride.token).toMatchObject({ colorPrimary: '#13c2c2' });
  });
});

/**
 * 换主题色要**真的换色**。
 *
 * 原缺陷：`light|dark` 的 token 与组件层把主色系的一整批键按 Tailwind 蓝写死了
 * （`colorPrimaryHover / colorPrimaryBg / controlItemBgActive / Menu.itemSelectedColor /
 * Tabs.inkBarColor / Button.defaultHoverColor`……）。`ConfigProvider` 拿到的种子确实是
 * 用户挑的颜色，可这些常量排在种子之后仍然会覆盖上去，于是换了主色：
 * 菜单选中态还是蓝的、`type="link"` 按钮还是蓝的、输入框聚焦光晕还是蓝的。
 *
 * 修法只有一条：派生键交还给算法（`defaultAlgorithm / darkAlgorithm` 会按种子生成十档色板）。
 * 所以断言也得盯这件事本身，而不是盯某个具体色值 —— 否则下次谁再钉一个键，测试还是绿的。
 */
const PRIMARY_DERIVED_KEYS = [
  'colorPrimaryHover',
  'colorPrimaryActive',
  'colorPrimaryBg',
  'colorPrimaryBgHover',
  'colorPrimaryBorder',
  'colorPrimaryBorderHover',
  'colorPrimaryText',
  'colorPrimaryTextHover',
  'colorPrimaryTextActive',
  'colorLinkHover',
  'colorLinkActive',
  'controlItemBgActive',
  'controlItemBgActiveHover',
  'controlOutline',
] as const;

describe('主色派生链', () => {
  it('token 常量里不钉死主色派生键（钉了就等于掐断换色链路）', () => {
    for (const token of [lightToken, darkToken]) {
      for (const key of PRIMARY_DERIVED_KEYS) {
        expect(token as Record<string, unknown>).not.toHaveProperty(key);
      }
    }
  });

  it('组件常量里跟主色走的那批键也不钉死', () => {
    const pinned: Array<[keyof (typeof darkComponents & typeof lightComponents), string]> = [
      ['Menu', 'itemSelectedBg'],
      ['Menu', 'itemSelectedColor'],
      ['Menu', 'itemActiveBg'],
      ['Menu', 'subMenuItemSelectedColor'],
      ['Menu', 'horizontalItemHoverColor'],
      ['Menu', 'horizontalItemSelectedColor'],
      ['Menu', 'darkItemSelectedBg'],
      ['Button', 'defaultHoverColor'],
      ['Button', 'defaultHoverBorderColor'],
      ['Button', 'defaultActiveColor'],
      ['Button', 'defaultActiveBorderColor'],
      ['Input', 'activeBorderColor'],
      ['Input', 'hoverBorderColor'],
      ['Select', 'optionSelectedBg'],
      ['Tabs', 'inkBarColor'],
      ['Tabs', 'itemSelectedColor'],
    ];
    for (const components of [lightComponents, darkComponents]) {
      for (const [component, key] of pinned) {
        expect(
          components[component] as Record<string, unknown>,
          `${component}.${key} 应该交还给 antd`,
        ).not.toHaveProperty(key);
      }
    }
  });

  it('亮色：换主色后解析出的派生色全部跟着变，且链接色一起跟', () => {
    const base = theme.getDesignToken(getAntdTheme('light'));
    const red = theme.getDesignToken(getAntdTheme('light', false, { primaryColor: '#f5222d' }));

    expect(red.colorPrimary).toBe('#f5222d');
    // antd 把 colorLink 绑在自己的 #1677ff 上，不显式接主色就永远不跟主题
    expect(base.colorLink).toBe(lightToken.colorLink);
    expect(red.colorLink).toBe('#f5222d');

    for (const key of PRIMARY_DERIVED_KEYS) {
      if (key === 'colorLinkHover' || key === 'colorLinkActive') continue;
      expect(red[key], key).not.toBe(base[key]);
    }
  });

  it('亮色：派生结果与"只给种子色"的算法答案一致（说明没有半只手在钉）', () => {
    const ours = theme.getDesignToken(getAntdTheme('light', false, { primaryColor: '#f5222d' }));
    const bare = theme.getDesignToken({
      token: { colorLink: '#f5222d', colorPrimary: '#f5222d' },
    });
    for (const key of PRIMARY_DERIVED_KEYS) {
      expect(ours[key], key).toBe(bare[key]);
    }
  });

  it('暗色同样跟随：主色换成红色后链接与选中底色不再是蓝', () => {
    const red = theme.getDesignToken(getAntdTheme('dark', false, { primaryColor: '#f5222d' }));
    const blue = theme.getDesignToken(getAntdTheme('dark'));

    expect(red.colorLink).not.toBe(blue.colorLink);
    expect(red.controlItemBgActive).not.toBe(blue.controlItemBgActive);
    /**
     * `darkAlgorithm` 会替深底另挑一档（`#f5222d` → `#d32029`），所以不能断言"原样输出"；
     * 能断言的是**色相族没变**：红主色在暗色下仍然是红占优，而不是掉回蓝。
     */
    expect(redDominant(red.colorPrimary)).toBe(true);
    expect(redDominant(red.colorLink)).toBe(true);
    expect(redDominant(blue.colorPrimary)).toBe(false);
  });

  it('整条偏好链路（getThemeConfig）也把 colorLink 带下去', () => {
    const config = getThemeConfig(prefs({ primaryColor: '#13c2c2' }));
    expect(config.token).toMatchObject({ colorLink: '#13c2c2', colorPrimary: '#13c2c2' });
  });
});

describe('themeOverridesFrom', () => {
  it('圆角倍率乘基准 8px', () => {
    expect(themeOverridesFrom(prefs({ borderRadius: 1 })).borderRadius).toBe(8);
    expect(themeOverridesFrom(prefs({ borderRadius: 0 })).borderRadius).toBe(0);
    expect(themeOverridesFrom(prefs({ borderRadius: 0.5 })).borderRadius).toBe(4);
  });

  it('脏值回到 antd 基准，不让整棵组件树字号塌陷', () => {
    expect(themeOverridesFrom(prefs({ fontSize: 0 })).fontSize).toBe(16);
    expect(themeOverridesFrom(prefs({ fontSize: Number.NaN })).fontSize).toBe(16);
    expect(themeOverridesFrom(prefs({ borderRadius: Number.NaN })).borderRadius).toBe(8);
    expect(themeOverridesFrom(prefs({ borderRadius: -1 })).borderRadius).toBe(8);
  });
});

describe('getThemeConfig', () => {
  it('偏好直接换算成 ConfigProvider 配置', () => {
    const config = getThemeConfig(
      prefs({ borderRadius: 0.75, fontSize: 15, primaryColor: '#eb2f96', theme: 'dark' }),
    );
    expect(config.algorithm).toBe(theme.darkAlgorithm);
    expect(config.token).toMatchObject({
      borderRadius: 6,
      colorPrimary: '#eb2f96',
      fontSize: 15,
    });
  });

  it('auto + 系统深色会真的切到暗色算法', () => {
    const preferences = prefs({ theme: 'auto' });
    expect(getThemeConfig(preferences, true).algorithm).toBe(theme.darkAlgorithm);
    expect(getThemeConfig(preferences, false).algorithm).toBe(theme.defaultAlgorithm);
  });
});

describe('locale 加载', () => {
  it('已知语言返回对应 loader，未知语言回落到默认语言', () => {
    expect(SUPPORTED_LOCALES).toContain('en-US');
    expect(getLocaleModule('en-US')).toBeTypeOf('function');
    expect(getLocaleModule('fr-FR')).toBe(getLocaleModule(DEFAULT_LOCALE));
  });

  it('loadLocale 拿到 antd locale 对象', async () => {
    const zh = await loadLocale('zh-CN');
    expect(zh).toBeTruthy();
    expect((zh as { locale: string }).locale).toBe('zh-cn');

    const en = await loadLocale('en-US');
    expect((en as { locale: string }).locale).toBe('en');
  });

  it('未知语言回落到中文而不是报错', async () => {
    const value = await loadLocale('de-DE');
    expect((value as { locale: string }).locale).toBe('zh-cn');
  });
});

/** `#rrggbb` 里红通道是否占优（用来判"还在红族"，不依赖算法挑了哪一档） */
function redDominant(hex: string): boolean {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return r > g && r > b;
}

function prefs(patch: Partial<AppSetting> = {}) {
  return withDefaultPreferences(patch);
}
