/**
 * 抽屉里的色值换算。
 *
 * 偏好里的 `primaryColor` 历史上由 antd ColorPicker 写入，格式是 `rgb(r, g, b)`
 * （预设色则是 `#RRGGBB`），所以读的时候要同时认这两种写法。
 */
export interface Rgb {
  b: number;
  g: number;
  r: number;
}

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** 解析失败时的兜底：antd 亮色主题的默认主色 */
const DEFAULT_RGB: Rgb = { b: 255, g: 119, r: 22 };

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
  if (!rgb) return '#1677FF';
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** 与白色相混，`whiteRatio` 是白的占比（0=原色，1=纯白） */
export function mixWithWhite(value: string | undefined, whiteRatio: number) {
  const rgb = parseColor(value) ?? DEFAULT_RGB;
  const mix = (channel: number) => clamp(channel + (255 - channel) * whiteRatio);
  return toRgbString({
    b: mix(rgb.b),
    g: mix(rgb.g),
    r: mix(rgb.r),
  });
}
