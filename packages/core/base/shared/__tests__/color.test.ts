import type { Rgb } from '../src/color/convert';

import { describe, expect, it } from 'vitest';

import {
  mixWithWhite,
  parseColor,
  toHex,
  toRgbString,
} from '../src/color/convert';
import { DEFAULT_PRIMARY_COLOR, DEFAULT_PRIMARY_RGB } from '../src/constants';

describe('parseColor', () => {
  it('解析 6 位十六进制', () => {
    expect(parseColor('#1677FF')).toEqual({ b: 255, g: 119, r: 22 });
    expect(parseColor('1677ff')).toEqual({ b: 255, g: 119, r: 22 });
  });

  it('展开 3 位简写', () => {
    expect(parseColor('#f0a')).toEqual({ b: 170, g: 0, r: 255 });
  });

  it('解析 rgb / rgba（逗号与空格分隔都认）', () => {
    const expected: Rgb = { b: 200, g: 100, r: 10 };
    expect(parseColor('rgb(10, 100, 200)')).toEqual(expected);
    expect(parseColor('rgba(10 100 200 / 0.5)')).toEqual(expected);
  });

  it('无法识别时返回 null，交给调用方决定兜底', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor('hsl(210deg 100% 50%)')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });

  it('接受带小数的通道值并四舍五入', () => {
    expect(parseColor('rgb(10.4, 100.6, 200.5)')).toEqual({
      b: 201,
      g: 101,
      r: 10,
    });
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

  it('解析失败时按默认主色混色', () => {
    expect(mixWithWhite('oops', 0)).toBe(toRgbString(DEFAULT_PRIMARY_RGB));
  });
});
