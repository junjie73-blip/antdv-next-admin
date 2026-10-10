import type { ContentMode } from '@antdv/types';

/**
 * 内容区宽度策略：流式跟随视口，或定宽居中留白。
 *
 * 与布局形态无关（7 种形态都能配 流式/定宽），所以单独一层，
 * 由布局外壳把 `style` 绑到内容容器上。
 */

/** 定宽档位的上下限，滑杆与 CSS 兜底共用同一组数 */
export const CONTENT_MIN_WIDTH = 800;
export const CONTENT_MAX_WIDTH = 1600;
export const CONTENT_DEFAULT_WIDTH = 1200;
/** 定宽模式下两侧至少各留出的空隙，避免贴边 */
export const CONTENT_MIN_GAP = 16;

export interface ContentStyleOptions {
  /** 内容区是否处于最大化（标签页放大），此时恒定流式 */
  maximized?: boolean;
  mode: ContentMode;
  width?: number;
}

export interface ContentStyle {
  marginInline?: string;
  maxWidth?: string;
  width?: string;
}

/** 把越界的期望宽度收进 [min, max]，非数字回落到默认档 */
export function clampContentWidth(
  width?: number,
  min = CONTENT_MIN_WIDTH,
  max = CONTENT_MAX_WIDTH,
): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return CONTENT_DEFAULT_WIDTH;
  }
  return Math.min(max, Math.max(min, Math.round(width)));
}

/**
 * 生成内容容器的行内样式。
 *
 * 定宽用的是 `margin-inline: auto` + `max-width`，而不是 `width`：
 * 窄屏时 `max-width` 自然让位于 100% 宽度，不需要额外写媒体查询。
 */
export function resolveContentStyle({
  maximized = false,
  mode,
  width,
}: ContentStyleOptions): ContentStyle {
  if (maximized || mode !== 'fixed') {
    return { width: '100%' };
  }
  return {
    marginInline: 'auto',
    maxWidth: `${clampContentWidth(width)}px`,
    width: '100%',
  };
}

/** 定宽下内容区在超宽屏上的实际占宽，用于判断"要不要显示居中边框" */
export function effectiveContentWidth(
  viewportWidth: number,
  options: ContentStyleOptions,
): number {
  const style = resolveContentStyle(options);
  if (!style.maxWidth) return viewportWidth;
  const limit = Number.parseInt(style.maxWidth, 10);
  return Math.min(
    Number.isFinite(limit) ? limit : viewportWidth,
    Math.max(0, viewportWidth - CONTENT_MIN_GAP * 2),
  );
}

export interface ContentModeOption {
  description: string;
  label: string;
  value: ContentMode;
}

export const CONTENT_MODE_OPTIONS: ContentModeOption[] = [
  { description: '跟随视口宽度，信息密度优先', label: '流式', value: 'full' },
  {
    description: `固定 ${CONTENT_DEFAULT_WIDTH}px 居中，阅读舒适（${CONTENT_MIN_WIDTH}–${CONTENT_MAX_WIDTH}px 可调）`,
    label: '定宽',
    value: 'fixed',
  },
];

export function isContentMode(value: unknown): value is ContentMode {
  return value === 'fixed' || value === 'full';
}
