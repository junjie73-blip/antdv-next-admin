import { getColors } from 'theme-colors';

import { convertToHslCssVar, TinyColor } from './convert';

export interface ColorItem {
  /** 除了 `--{name}-{档位}` 之外再挂一组别名，并让 `--{name}` 直接等于 500 档 */
  alias?: string;
  color: string;
  name: string;
}

/**
 * 把若干主色铺成 50~950 档，产出可直接写进 CSS 的 `{ '--主色名-500': '210 100% 50%' }` 表。
 *
 * 值取 HSL 三段而不是完整颜色：Tailwind / 设计 token 侧的用法是 `hsl(var(--x-500))`，
 * 变量里只能放通道值，放完整颜色会让外层再套一层 `hsl()`。
 *
 * `getColors` 按"去掉 `#` 后两位一切"解析，喂 `rgb(...)` 会得到 `#ANF8FF` 这种不报错的废值，
 * 所以入参必须先归一成 hex。
 */
export function generatorColorVariables(
  colorItems: ColorItem[],
): Record<string, string> {
  const colorVariables: Record<string, string> = {};

  colorItems.forEach(({ alias, color, name }) => {
    if (!color) {
      return;
    }

    const colorsMap = getColors(new TinyColor(color).toHexString());
    let mainColor = colorsMap['500'];

    Object.keys(colorsMap).forEach((key) => {
      const colorValue = colorsMap[key];
      if (!colorValue) {
        return;
      }

      const hslColor = convertToHslCssVar(colorValue);
      colorVariables[`--${name}-${key}`] = hslColor;
      if (alias) {
        colorVariables[`--${alias}-${key}`] = hslColor;
        if (key === '500') {
          mainColor = hslColor;
        }
      }
    });

    if (alias && mainColor) {
      colorVariables[`--${alias}`] = mainColor;
    }
  });

  return colorVariables;
}
