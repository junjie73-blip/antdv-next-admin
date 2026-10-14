/**
 * 色值换算：把"一个字符串"变成另一种写法，不做任何主题判断。
 *
 * 住在 shared 而不是偏好面板里，是因为写这些值的地方不止一处：偏好面板（`<input type=color>`
 * 只吃 `#RRGGBB`）、主色派生的浅色调、进度条与图表的取色。同一个 `rgb()`/`#RGB` 兼容规则
 * 抄第二遍，就会出现"面板认得、图表认不得"的分裂。
 */

import { DEFAULT_PRIMARY_COLOR, DEFAULT_PRIMARY_RGB } from '../constants';

export interface Rgb {
  b: number;
  g: number;
  r: number;
}

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/**
 * `primaryColor` 历史上由 antd ColorPicker 写入，格式是 `rgb(r, g, b)`
 * （预设色则是 `#RRGGBB`），所以读的时候要同时认这两种写法。
 */
export function parseColor(value: string | undefined): null | Rgb {
  const input = (value ?? '').trim();
  const hex = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(input);
  if (hex) {
    let body = hex[1]!;
    if (body.length === 3) body = [...body].map((c) => c.repeat(2)).join('');
    return {
      b: Number.parseInt(body.slice(4, 6), 16),
      g: Number.parseInt(body.slice(2, 4), 16),
      r: Number.parseInt(body.slice(0, 2), 16),
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+\s*([\d.]+)[\s,]+\s*([\d.]+)/i.exec(
    input,
  );
  if (rgb) {
    const [r, g, b] = rgb.slice(1).map(Number);
    return { b: clamp(b!), g: clamp(g!), r: clamp(r!) };
  }
  return null;
}

export function toRgbString({ b, g, r }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** `<input type="color">` 只接受 `#RRGGBB`，脏值退回默认主色 */
export function toHex(value: string | undefined): string {
  const rgb = parseColor(value);
  if (!rgb) return DEFAULT_PRIMARY_COLOR.toUpperCase();
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** 与白色相混，`whiteRatio` 是白的占比（0=原色，1=纯白） */
export function mixWithWhite(value: string | undefined, whiteRatio: number) {
  const rgb = parseColor(value) ?? DEFAULT_PRIMARY_RGB;
  const mix = (channel: number) =>
    clamp(channel + (255 - channel) * whiteRatio);
  return toRgbString({
    b: mix(rgb.b),
    g: mix(rgb.g),
    r: mix(rgb.r),
  });
}
