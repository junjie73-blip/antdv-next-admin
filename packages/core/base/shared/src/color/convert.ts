/**
 * 色值换算：把"一个字符串"变成另一种写法，不做任何主题判断。
 *
 * 解析与换算全部委托 `@ctrl/tinycolor`。住在 shared 而不是偏好面板里，是因为写这些值的地方
 * 不止一处（`<input type=color>` 只吃 `#RRGGBB`、主色派生的浅色调、进度条与图表取色、
 * CSS 变量要的是 HSL 三段），同一个兼容规则抄第二遍就会出现"面板认得、图表认不得"的分裂。
 */

import { TinyColor } from '@ctrl/tinycolor';

import { DEFAULT_PRIMARY_COLOR } from '../constants';

export interface Rgb {
  b: number;
  g: number;
  r: number;
}

/** tinycolor 的 `isValid` 不看透明度，`transparent` 是合法的 `rgba(0,0,0,0)` */
const toOpaque = (value: string | undefined): null | TinyColor => {
  const color = new TinyColor((value ?? '').trim());
  return color.isValid && color.getAlpha() > 0 ? color : null;
};

/**
 * `primaryColor` 历史上由取色器写入，格式是 `rgb(r, g, b)`，预设色则是 `#RRGGBB`，
 * 所以读的时候要同时认这两种写法。
 *
 * tinycolor 只认传统语法：带斜杠的 alpha 写法（`rgba(10 100 200 / 0.5)`）与
 * `hsl(210deg 100% 50%)` 这类现代写法 `isValid` 为 false。
 */
export function parseColor(value: string | undefined): null | Rgb {
  const color = toOpaque(value);
  if (!color) {
    return null;
  }
  const { b, g, r } = color.toRgb();
  return { b, g, r };
}

export function toRgbString(value: Rgb | string): string {
  return new TinyColor(value).toRgbString();
}

/** `<input type="color">` 只接受 `#RRGGBB`，脏值退回默认主色 */
export function toHex(value: string | undefined): string {
  // `toHexString` 的入参是"允许缩写成 3 位"的开关，传任何真值都会缩写，取色器不认
  return (
    toOpaque(value)?.toHexString().toUpperCase() ??
    DEFAULT_PRIMARY_COLOR.toUpperCase()
  );
}

/** 与白色相混，`whiteRatio` 是白的占比（0=原色，1=纯白） */
export function mixWithWhite(
  value: string | undefined,
  whiteRatio: number,
): string {
  const color = toOpaque(value) ?? new TinyColor(DEFAULT_PRIMARY_COLOR);
  // tinycolor 的 `tint(amount)` 里 amount 是 0~100 的百分比，不是占比
  return color.tint(whiteRatio * 100).toRgbString();
}

/**
 * HSL 完整写法，例如 `hsl(210 100% 50%)`；带 alpha 时补一段 `0.5`。
 * 给需要"一个能直接用的颜色值"的调用方（内联样式、canvas）。
 */
export function convertToHsl(color: string): string {
  const { a, h, l, s } = new TinyColor(color).toHsl();
  const hsl = `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  return a < 1 ? `${hsl} ${a}` : hsl;
}

/**
 * 只留 HSL 三段（`210 100% 50%`），供 `hsl(var(--x))` 这种"变量里只存通道值"的写法使用。
 * 设计 token 想被 `hsl()` / `color-mix()` 二次组合时必须是这个形状，含 `hsl(` 前缀反而拼不进去。
 */
export function convertToHslCssVar(color: string): string {
  const { a, h, l, s } = new TinyColor(color).toHsl();
  const hsl = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  return a < 1 ? `${hsl} / ${a}` : hsl;
}

/**
 * tinycolor 解析不了带单位的 hsl（`hsl(231deg 98% 65%)` 会变成 `rgb(0, 0, 0)`），
 * 所以先把单位去掉再转；无效值同样得到 `rgb(0, 0, 0)`，由调用方自己判断。
 */
export function convertToRgb(str: string): string {
  return new TinyColor(str.replaceAll(/deg|grad|rad|turn/g, '')).toRgbString();
}

export function isValidColor(color?: string): boolean {
  if (!color) {
    return false;
  }
  return new TinyColor(color).isValid;
}

export { TinyColor };
