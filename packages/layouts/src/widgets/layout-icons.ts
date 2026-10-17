import type { LayoutMode } from '@antdv/types';

import type { IconPaletteSet } from './layout-icon-palette';

/**
 * 布局示意图的图形数据。
 *
 * 迁移前每个形态一个 `.tsx` 函数、手写十来个 `<rect>`，靠 `theme.useToken()` 取色，
 * 于是这个纯图示组件既带不进单测（要起 antd 的 StyleProvider），也带不进别的包。
 * 现在只剩一份数据表 + 一个渲染器：形态差异是矩形坐标，本来就适合用数据描述，
 * 新增一种布局只需在这里加一组矩形。
 *
 * 画布统一 48×36（4:3），所有坐标沿用迁移前的取值，避免"顺手改一改"造成的视觉漂移。
 */

/** 画布尺寸：外层容器用 `aspect-4/3` 与它对齐 */
export const LAYOUT_ICON_VIEWBOX = { height: 36, width: 48 };

/** 矩形填充指向调色板的槽位，而不是具体颜色：明暗与选中态由调色板决定 */
export type IconFillSlot = keyof IconPaletteSet;

export interface IconRect {
  fill: IconFillSlot;
  height: number;
  rx?: number;
  width: number;
  x: number;
  y: number;
}

/** 示意图种类：7 个布局形态 + 两个与形态正交的内容宽度 */
export type LayoutIconType = 'content-fixed' | 'content-full' | LayoutMode;

const rect = (
  fill: IconFillSlot,
  x: number,
  y: number,
  width: number,
  height: number,
  rx?: number,
): IconRect => ({ fill, height, rx, width, x, y });

/** 内容区宽度示意（流式铺满 / 定宽居中留白），`fixed` 决定两侧是否让出空白 */
function contentWidthRects(fixed: boolean): IconRect[] {
  const inset = fixed ? 10 : 0;
  const contentX = fixed ? 13 : 3;
  const bars: IconRect[] = fixed
    ? [rect('panelSoft', 40, 0, 8, 36, 1), rect('panelSoft', 0, 0, 8, 36, 1)]
    : [];

  return [
    rect('panelSoft', 0, 0, 48, 36, 1),
    rect('surface', inset, 0, fixed ? 28 : 48, 36, 1),
    rect('stripe', contentX, 6, 12, 2, 0.5),
    rect('stripeSoft', contentX, 12, 18, 2, 0.5),
    rect('stripeSoft', contentX, 16, 14, 2, 0.5),
    ...bars,
  ];
}

/**
 * 每个形态对应的矩形组。
 *
 * `side-nav` 复用迁移前的 `SplitIcon`（左上 Logo + 左下菜单），
 * `mixed-vertical` 复用 `MixedIcon`；未知取值走 `LAYOUT_ICON_FALLBACK`。
 */
export const LAYOUT_ICON_SHAPES: Record<LayoutIconType, IconRect[]> = {
  'content-fixed': contentWidthRects(true),
  'content-full': contentWidthRects(false),
  'full-content': [
    rect('stripe', 0, 0, 48, 36, 1),
    rect('surface', 1.5, 1.5, 45, 33, 1),
    rect('stripe', 4, 6, 14, 2, 0.5),
    rect('stripeSoft', 4, 12, 24, 2, 0.5),
    rect('stripeSoft', 4, 16, 20, 2, 0.5),
    rect('stripeSoft', 4, 20, 22, 2, 0.5),
  ],
  horizontal: [
    rect('panel', 0, 0, 48, 6, 1),
    rect('line', 3, 2, 4, 2, 0.5),
    rect('lineSoft', 14, 2, 6, 2, 0.5),
    rect('lineSoft', 22, 2, 6, 2, 0.5),
    rect('lineSoft', 30, 2, 6, 2, 0.5),
    rect('surface', 0, 6, 48, 30),
    rect('stripe', 3, 10, 12, 2, 0.5),
    rect('stripeSoft', 3, 14, 8, 2, 0.5),
    rect('stripeSoft', 3, 18, 10, 2, 0.5),
  ],
  'mixed-two-column': [
    rect('panel', 0, 0, 48, 6, 1),
    rect('line', 3, 2, 4, 2, 0.5),
    rect('lineSoft', 20, 2, 6, 2, 0.5),
    rect('lineSoft', 28, 2, 6, 2, 0.5),
    rect('panel', 0, 6, 6, 30),
    rect('line', 1.5, 10, 3, 1.5, 0.5),
    rect('lineSoft', 1.5, 13, 3, 1.5, 0.5),
    rect('panelSoft', 6, 6, 10, 30),
    rect('stripe', 8, 10, 6, 1.5, 0.5),
    rect('stripeSoft', 8, 13, 5, 1.5, 0.5),
    rect('surface', 16, 6, 32, 30),
    rect('stripe', 19, 10, 10, 2, 0.5),
  ],
  'mixed-vertical': [
    rect('panel', 0, 0, 48, 6, 1),
    rect('line', 3, 2, 4, 2, 0.5),
    rect('lineSoft', 20, 2, 6, 2, 0.5),
    rect('lineSoft', 28, 2, 6, 2, 0.5),
    rect('panelSoft', 0, 6, 10, 30),
    rect('stripe', 2, 10, 6, 1.5, 0.5),
    rect('stripeSoft', 2, 13, 5, 1.5, 0.5),
    rect('surface', 10, 6, 38, 30),
    rect('stripe', 13, 10, 10, 2, 0.5),
  ],
  'side-nav': [
    rect('panel', 0, 0, 10, 10, 1),
    rect('line', 3, 4, 4, 2, 0.5),
    rect('panelSoft', 0, 10, 10, 26, 1),
    rect('stripe', 2, 14, 6, 1.5, 0.5),
    rect('stripeSoft', 2, 17, 5, 1.5, 0.5),
    rect('stripeSoft', 2, 20, 6, 1.5, 0.5),
    rect('stripeSoft', 2, 23, 4, 1.5, 0.5),
    rect('surface', 10, 0, 38, 36),
    rect('stripe', 13, 4, 12, 2, 0.5),
    rect('stripeSoft', 13, 8, 8, 2, 0.5),
    rect('stripeSoft', 13, 12, 10, 2, 0.5),
  ],
  'two-column': [
    rect('panel', 0, 0, 6, 36, 1),
    rect('line', 1.5, 4, 3, 1.5, 0.5),
    rect('lineSoft', 1.5, 7, 3, 1.5, 0.5),
    rect('panelSoft', 6, 0, 12, 36),
    rect('stripe', 8, 4, 8, 2, 0.5),
    rect('stripeSoft', 8, 8, 6, 1.5, 0.5),
    rect('stripeSoft', 8, 11, 7, 1.5, 0.5),
    rect('stripeSoft', 8, 14, 5, 1.5, 0.5),
    rect('surface', 18, 0, 30, 36),
    rect('stripe', 21, 4, 12, 2, 0.5),
    rect('stripeSoft', 21, 8, 8, 2, 0.5),
    rect('stripeSoft', 21, 12, 10, 2, 0.5),
  ],
  vertical: [
    rect('panel', 0, 0, 10, 36),
    rect('line', 2, 4, 6, 1.5, 0.5),
    rect('lineSoft', 2, 7, 5, 1.5, 0.5),
    rect('panel', 10, 0, 38, 6),
    rect('line', 13, 2, 6, 2, 0.5),
    rect('surface', 10, 6, 38, 30),
    rect('stripe', 13, 10, 12, 2, 0.5),
    rect('stripeSoft', 13, 14, 8, 2, 0.5),
    rect('stripeSoft', 13, 18, 10, 2, 0.5),
  ],
};

/** 未识别的形态退回"经典"（左上 Logo + 顶部菜单 + 左侧菜单），与迁移前的 default 分支一致 */
export const LAYOUT_ICON_FALLBACK: IconRect[] = [
  rect('panel', 0, 0, 10, 6),
  rect('line', 3, 2, 4, 2, 0.5),
  rect('panel', 10, 0, 38, 6),
  rect('lineSoft', 13, 2, 6, 2, 0.5),
  rect('lineSoft', 21, 2, 6, 2, 0.5),
  rect('panelSoft', 0, 6, 10, 30),
  rect('stripe', 2, 10, 6, 1.5, 0.5),
  rect('stripeSoft', 2, 13, 5, 1.5, 0.5),
  rect('stripeSoft', 2, 16, 6, 1.5, 0.5),
  rect('surface', 10, 6, 38, 30),
  rect('stripe', 13, 10, 12, 2, 0.5),
  rect('stripeSoft', 13, 14, 8, 2, 0.5),
];

/** 取某个形态的矩形组；脏值（旧缓存里的形态名）落回 fallback 而不是抛错 */
export function layoutIconRects(type: LayoutIconType): IconRect[] {
  return LAYOUT_ICON_SHAPES[type] ?? LAYOUT_ICON_FALLBACK;
}
