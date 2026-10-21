import { describe, expect, it } from 'vitest';

import { REM_BASE_PX } from '../src/constants/theme';
import { radiusToRem } from '../src/utils/radius';

/**
 * 全站圆角只认 rem 一种单位，这里是那条规则的唯一换算出口。
 * 断言取的是"计算值不变"这条：默认根字号 16px 下 1rem 就是 16px，
 * 所以改成 rem 不是重设尺度，只是让半径跟着根字号一起缩放。
 */
describe('radiusToRem', () => {
  it('偏好里的四个倍率档位换算成整档 rem', () => {
    expect(radiusToRem(0)).toBe('0rem');
    expect(radiusToRem(4)).toBe('0.25rem');
    expect(radiusToRem(8)).toBe('0.5rem');
    expect(radiusToRem(12)).toBe('0.75rem');
    expect(radiusToRem(16)).toBe('1rem');
  });

  it('非整档的像素值按 4 位小数收敛，不吐长串浮点', () => {
    expect(radiusToRem(10)).toBe('0.625rem');
    expect(radiusToRem(5)).toBe('0.3125rem');
    expect(radiusToRem(1)).toBe('0.0625rem');
    expect(radiusToRem(1)).not.toContain('0.06250');
  });

  it('字符串原样透传，便于写 var() 与 calc()', () => {
    expect(radiusToRem('var(--radius)')).toBe('var(--radius)');
    expect(radiusToRem('9999px')).toBe('9999px');
  });

  it('rem 锚点与圆角基准同为 16，倍率 1 换算后仍是 1rem', () => {
    expect(REM_BASE_PX).toBe(16);
    expect(radiusToRem(REM_BASE_PX)).toBe('1rem');
  });
});
