/**
 * 主题预设：`[data-theme]` 名单的单一来源。
 *
 * 这里的 `key` 必须与 `@antdv/design/src/token/{default,dark}.css` 的
 * `[data-theme='key']` 块逐一对齐 —— 名字对不上不会报错，只会静默退回基础主题，
 * 用户点了色块却只看到主色变、画布不变。名单由 `design/__tests__/design.test.ts`
 * 与本文件的取值一起被钉住。
 *
 * `color` 存的是**亮色主色**（设置面板的色块就用它）。暗色那一档不在这里重复：
 * 同一个 key 在 `dark.css` 里有自己的完整色板，近中性预设还会把主色提亮一档，
 * 否则深底上就是一块看不清的黑。
 */

/** 自定义取色器走的档位：没有配套色板，只内联一条主色 */
export const CUSTOM_THEME_KEY = 'custom';
/** 没有 `[data-theme]` 标记时的默认档位 */
export const DEFAULT_THEME_KEY = 'default';

export interface ThemePreset {
  /** 写到 html `data-theme` 上的名字 */
  key: string;
  /** 亮色主色，也是设置面板里那颗色块的颜色 */
  color: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { color: '#1677ff', key: DEFAULT_THEME_KEY },
  { color: '#722ed1', key: 'violet' },
  { color: '#eb2f96', key: 'pink' },
  { color: '#faad14', key: 'yellow' },
  { color: '#1890ff', key: 'sky-blue' },
  { color: '#52c41a', key: 'green' },
  { color: '#262626', key: 'zinc' },
  { color: '#13c2c2', key: 'deep-green' },
  { color: '#1d39c4', key: 'deep-blue' },
  { color: '#fa541c', key: 'orange' },
  { color: '#f5222d', key: 'rose' },
  { color: '#2f54eb', key: 'neutral' },
  { color: '#1f2937', key: 'slate' },
  { color: '#374151', key: 'gray' },
];

/** 预设色块之间的比对只看十六进制本身，大小写与 `#FFF` 简写都算同一颗 */
function normalizeHex(value: string): string | undefined {
  const match = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(value.trim());
  if (!match) return undefined;
  const hex = value.trim().slice(1);
  const full =
    hex.length === 3 ? [...hex].map((char) => `${char}${char}`).join('') : hex;
  return `#${full.toLowerCase()}`;
}

/**
 * 由当前主色反查预设档位。
 *
 * 匹配不上（取色器选的任意颜色、`rgb()` 串）一律回 `custom`：
 * 那一档不覆盖色板，运行时把主色内联写在 html 上，派生色靠 `hsl(var(--primary))` 跟上。
 */
export function themeKeyByColor(color?: string): string {
  const hex = color ? normalizeHex(color) : undefined;
  if (!hex) return CUSTOM_THEME_KEY;
  return (
    THEME_PRESETS.find((preset) => normalizeHex(preset.color) === hex)?.key ??
    CUSTOM_THEME_KEY
  );
}
