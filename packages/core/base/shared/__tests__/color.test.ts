import type { Rgb } from '../src/color/convert';

import { describe, expect, it } from 'vitest';

import {
  convertToHsl,
  convertToHslCssVar,
  convertToRgb,
  isValidColor,
  mixWithWhite,
  parseColor,
  toHex,
  toRgbString,
} from '../src/color/convert';
import { generatorColorVariables } from '../src/color/generator';
import { isDarkColor, isLightColor } from '../src/color/readability';
import { DEFAULT_PRIMARY_COLOR, DEFAULT_PRIMARY_RGB } from '../src/constants';

describe('parseColor', () => {
  it('解析 6 位十六进制', () => {
    expect(parseColor('#1677FF')).toEqual({ b: 255, g: 119, r: 22 });
    expect(parseColor('1677ff')).toEqual({ b: 255, g: 119, r: 22 });
  });

  it('展开 3 位简写', () => {
    expect(parseColor('#f0a')).toEqual({ b: 170, g: 0, r: 255 });
  });

  it('解析 rgb（逗号与空格分隔都认）', () => {
    const expected: Rgb = { b: 200, g: 100, r: 10 };
    expect(parseColor('rgb(10, 100, 200)')).toEqual(expected);
    expect(parseColor('rgb(10 100 200)')).toEqual(expected);
  });

  it('委托给 tinycolor 之后，颜色名与 hsl 也能读', () => {
    expect(parseColor('red')).toEqual({ b: 0, g: 0, r: 255 });
    expect(parseColor('hsl(210, 100%, 50%)')).toEqual({
      b: 255,
      g: 127,
      r: 0,
    });
  });

  it('无法识别时返回 null，交给调用方决定兜底', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    /*
     * tinycolor 只认传统语法：带斜杠的 alpha 写法与 `deg`/`%` 混排的现代 hsl 都是 invalid，
     * 偏好里的 primaryColor 因此只能由 toRgbString / toHex 写出去。
     */
    expect(parseColor('rgba(10 100 200 / 0.5)')).toBeNull();
    expect(parseColor('hsl(210deg 100% 50%)')).toBeNull();
  });

  it('全透明不算主题色', () => {
    expect(parseColor('transparent')).toBeNull();
  });

  it('接受带小数的通道值并四舍五入', () => {
    expect(parseColor('rgb(10.4, 100.6, 200.5)')).toEqual({
      b: 201,
      g: 101,
      r: 10,
    });
  });
});

describe('toRgbString', () => {
  it('与偏好面板读写的写法一致', () => {
    expect(toRgbString(DEFAULT_PRIMARY_RGB)).toBe('rgb(22, 119, 255)');
    expect(toRgbString('#1677ff')).toBe('rgb(22, 119, 255)');
  });
});

describe('toHex', () => {
  it('统一成大写 6 位', () => {
    expect(toHex('rgb(22, 119, 255)')).toBe('#1677FF');
    expect(toHex('#f0a')).toBe('#FF00AA');
  });

  it('脏值退回默认主色', () => {
    expect(toHex(undefined)).toBe(DEFAULT_PRIMARY_COLOR.toUpperCase());
    expect(toHex('transparent')).toBe(DEFAULT_PRIMARY_COLOR.toUpperCase());
  });
});

describe('mixWithWhite', () => {
  it('whiteRatio 是白的占比', () => {
    expect(mixWithWhite('#000000', 0)).toBe('rgb(0, 0, 0)');
    expect(mixWithWhite('#000000', 1)).toBe('rgb(255, 255, 255)');
    expect(mixWithWhite('#000000', 0.5)).toBe('rgb(128, 128, 128)');
  });

  it('主色的浅调与旧的逐通道混色公式同解', () => {
    expect(mixWithWhite('#1677ff', 0.3)).toBe('rgb(92, 160, 255)');
    expect(mixWithWhite('#1677ff', 0.9)).toBe('rgb(232, 241, 255)');
  });

  it('解析失败时按默认主色混色', () => {
    expect(mixWithWhite('oops', 0)).toBe(toRgbString(DEFAULT_PRIMARY_RGB));
  });
});

describe('convertToHsl / convertToHslCssVar', () => {
  it('完整写法给内联样式，三段写法给 hsl(var(--x))', () => {
    expect(convertToHsl('#1677ff')).toBe('hsl(215 100% 54%)');
    expect(convertToHslCssVar('#1677ff')).toBe('215 100% 54%');
  });

  it('带 alpha 时保留 alpha', () => {
    expect(convertToHslCssVar('rgba(0, 0, 0, 0.5)')).toBe('0 0% 0% / 0.5');
    expect(convertToHsl('rgba(0, 0, 0, 0.5)')).toBe('hsl(0 0% 0%) 0.5');
  });

  it('纯白落在 0 色相 0 饱和度', () => {
    expect(convertToHslCssVar('#fff')).toBe('0 0% 100%');
  });
});

describe('convertToRgb', () => {
  it('去掉角度单位，现代 hsl 写法也能转', () => {
    expect(convertToRgb('hsl(231deg 98% 65%)')).toBe('rgb(78, 105, 253)');
  });

  it('无效值不抛，得到黑；是否需要兜底由调用方判断', () => {
    expect(convertToRgb('oops')).toBe('rgb(0, 0, 0)');
  });
});

describe('isValidColor', () => {
  it('空值与脏值都是 false', () => {
    expect(isValidColor()).toBe(false);
    expect(isValidColor('')).toBe(false);
    expect(isValidColor('oops')).toBe(false);
  });

  it('认得的颜色写法都是 true', () => {
    expect(isValidColor('#1677ff')).toBe(true);
    expect(isValidColor('rgb(22, 119, 255)')).toBe(true);
    expect(isValidColor('red')).toBe(true);
  });
});

describe('isDarkColor / isLightColor', () => {
  it('按 WCAG 相对亮度判定，两个口径互补', () => {
    expect(isDarkColor('#1677ff')).toBe(true);
    expect(isLightColor('#1677ff')).toBe(false);
    expect(isDarkColor('#ffffff')).toBe(false);
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isDarkColor('#000000')).toBe(true);
  });
});

describe('generatorColorVariables', () => {
  it('一个主色铺成 50~950 档，值是可组合的 HSL 三段', () => {
    const vars = generatorColorVariables([
      { alias: 'app-primary', color: '#1677ff', name: 'ant-primary' },
    ]);

    expect(vars['--ant-primary-500']).toBe('215 100% 54%');
    /* 钉死一档非 500 的值：色阶由 theme-colors 生成，不是本地换算出来的 */
    expect(vars['--ant-primary-50']).toBe('215 100% 98%');
    expect(Object.keys(vars)).toHaveLength(23);
  });

  it('alias 额外挂一组同名档位，并让裸名等于 500 档', () => {
    const vars = generatorColorVariables([
      { alias: 'app-primary', color: 'rgb(22, 119, 255)', name: 'ant-primary' },
    ]);

    expect(vars['--app-primary-500']).toBe(vars['--ant-primary-500']);
    expect(vars['--app-primary']).toBe('215 100% 54%');
  });

  it('入参写法不影响结果：rgb 字符串先归一成 hex 再铺档', () => {
    const fromRgb = generatorColorVariables([
      { color: 'rgb(22, 119, 255)', name: 'p' },
    ]);
    const fromHex = generatorColorVariables([{ color: '#1677ff', name: 'p' }]);
    expect(fromRgb).toEqual(fromHex);
  });

  it('没有 alias 就只出 name 那一组，空色值整条跳过', () => {
    const vars = generatorColorVariables([
      { color: '#1677ff', name: 'p' },
      { alias: 'empty', color: '', name: 'e' },
    ]);

    expect(Object.keys(vars)).toHaveLength(11);
    expect(vars['--p-500']).toBe('215 100% 54%');
    expect(vars['--empty-500']).toBeUndefined();
  });

  it('多个主色各自成组，互不覆盖', () => {
    const vars = generatorColorVariables([
      { color: '#1677ff', name: 'blue' },
      { color: '#f5222d', name: 'red' },
    ]);

    expect(vars['--blue-500']).toBe('215 100% 54%');
    expect(vars['--red-500']).not.toBe(vars['--blue-500']);
  });
});
