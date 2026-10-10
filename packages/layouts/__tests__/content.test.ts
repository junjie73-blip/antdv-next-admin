import { describe, expect, it } from 'vitest';

import {
  clampContentWidth,
  CONTENT_MAX_WIDTH,
  CONTENT_MIN_WIDTH,
  effectiveContentWidth,
  isContentMode,
  resolveContentStyle,
} from '../src/content';

describe('内容区宽度', () => {
  it('流式：占满容器，不写 max-width', () => {
    expect(resolveContentStyle({ mode: 'full' })).toEqual({ width: '100%' });
  });

  it('定宽：max-width + 左右自动外边距实现居中', () => {
    expect(resolveContentStyle({ mode: 'fixed', width: 1000 })).toEqual({
      marginInline: 'auto',
      maxWidth: '1000px',
      width: '100%',
    });
  });

  it('标签页最大化时强制流式，把整屏还给内容', () => {
    expect(
      resolveContentStyle({ maximized: true, mode: 'fixed', width: 1000 }),
    ).toEqual({ width: '100%' });
  });

  it('越界宽度收进合法区间，脏值回落到默认档', () => {
    expect(clampContentWidth(100)).toBe(CONTENT_MIN_WIDTH);
    expect(clampContentWidth(99_999)).toBe(CONTENT_MAX_WIDTH);
    expect(clampContentWidth(1234.6)).toBe(1235);
    expect(clampContentWidth()).toBe(1200);
    expect(clampContentWidth(Number.NaN)).toBe(1200);
    expect(clampContentWidth(Number.POSITIVE_INFINITY)).toBe(1200);
    expect(clampContentWidth('1200' as unknown as number)).toBe(1200);
  });

  it('窄屏定宽时实际宽度受视口约束（两侧留缝）', () => {
    // 视口 900 < 定宽 1200：内容区按视口减两侧留白
    expect(
      effectiveContentWidth(900, { mode: 'fixed', width: 1200 }),
    ).toBe(868);
    // 视口 2000 > 定宽：按定宽
    expect(effectiveContentWidth(2000, { mode: 'fixed', width: 1200 })).toBe(
      1200,
    );
    // 流式：视口多宽内容就多宽
    expect(effectiveContentWidth(1366, { mode: 'full' })).toBe(1366);
  });

  it('内容模式判定只认 fixed / full', () => {
    expect(isContentMode('fixed')).toBe(true);
    expect(isContentMode('full')).toBe(true);
    expect(isContentMode('wide')).toBe(false);
    expect(isContentMode(undefined)).toBe(false);
  });
});
