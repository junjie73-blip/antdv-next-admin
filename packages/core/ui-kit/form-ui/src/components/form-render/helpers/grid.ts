import type { CSSProperties } from 'vue';

import type { ColEx } from '../schema';

/** 栅格总数：`colProps.span`、行分组、动作区宽度都以 24 为单位 */
export const GRID_TOTAL = 24;

/** `gutter` 没给垂直分量时的行间距 */
export const DEFAULT_ROW_GAP_PX = 16;

/** 水平间距的兜底值（antd 的 `gutter` 默认 24） */
export const DEFAULT_GUTTER_PX = 24;

/**
 * 按视口给列数（Tailwind 约定）。
 *
 * `< 640px → 1 列`、`< 768px → 2 列`、`< 1280px → 3 列`、`≥ 1280px → 4 列`。
 * 把判断收成一个纯函数，是为了让"外部显式传了 `grid.cols` 就优先用外部配置"
 * 这条规则在调用方一眼可见，而不是埋在断点判断里。
 */
export function pickResponsiveCols(
  smaller: (breakpoint: 'md' | 'sm' | 'xl') => boolean,
): number {
  if (smaller('sm')) return 1;
  if (smaller('md')) return 2;
  if (smaller('xl')) return 3;
  return 4;
}

/** `gutter` 支持单值与 `[水平, 垂直]`，这里取水平分量 */
export function resolveGutterPx(
  gutter: [number, number] | number | undefined,
): number {
  if (Array.isArray(gutter)) return gutter[0] ?? DEFAULT_GUTTER_PX;
  return gutter ?? DEFAULT_GUTTER_PX;
}

/** 垂直分量只在写成数组时才有，缺省兜一个行间距，避免两行贴死 */
export function resolveRowGapPx(
  gutter: [number, number] | number | undefined,
): number {
  return (Array.isArray(gutter) ? gutter[1] : undefined) ?? DEFAULT_ROW_GAP_PX;
}

/**
 * 行容器样式。
 *
 * gutter 走"负边距 + 子项自带 padding"的老办法：行左右各外扩半个 gutter，
 * `FormField` 再各吃掉半个，字段之间的净间距就正好是一个 gutter。
 * `baseRowStyle` 展开在最后，调用方能覆盖以上任何一项。
 */
export function buildRowStyle(options: {
  baseRowStyle?: Record<string, any>;
  gap: number;
  gutter: number;
}): CSSProperties {
  const { baseRowStyle, gap, gutter } = options;
  return {
    display: 'flex',
    flexWrap: 'wrap',
    // 行内换行后的行间距，与行和行之间的间距同一个值
    marginBottom: `${gap}px`,
    marginLeft: `-${gutter / 2}px`,
    marginRight: `-${gutter / 2}px`,
    rowGap: `${gap}px`,
    ...baseRowStyle,
  };
}

/** 标签列：`labelWidth` 优先于 `labelCol`，两者都没给时按 4/24 */
export function resolveLabelCol(props: {
  labelCol?: Partial<ColEx>;
  labelWidth?: number | string;
}): Partial<ColEx> {
  const labelWidth = props.labelWidth;
  if (labelWidth) {
    return { style: { width: `${labelWidth}px` } };
  }
  return props.labelCol || { span: 4 };
}

/** 内容列：没给时按 18/24 */
export function resolveWrapperCol(props: {
  wrapperCol?: Partial<ColEx>;
}): Partial<ColEx> {
  return props.wrapperCol || { span: 18 };
}
