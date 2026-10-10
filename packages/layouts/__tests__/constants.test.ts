import { describe, expect, it } from 'vitest';

import {
  LAYOUT_FOOTER_HEIGHT,
  LAYOUT_HEADER_HEIGHT,
  LAYOUT_RAIL_WIDTH,
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
  LAYOUT_SIDEBAR_WIDTH,
  LAYOUT_TABS_HEIGHT,
  resolveChromeHeight,
  resolveSidebarWidth,
} from '../src/constants';

describe('外壳高度', () => {
  it('默认三件套齐全时累加顶栏 + 标签页 + 底栏', () => {
    expect(resolveChromeHeight({})).toBe(
      LAYOUT_HEADER_HEIGHT + LAYOUT_TABS_HEIGHT + LAYOUT_FOOTER_HEIGHT,
    );
  });

  it('逐项关掉就少一段高度（内容区高度计算靠它，不能写死）', () => {
    expect(resolveChromeHeight({ footer: false })).toBe(
      LAYOUT_HEADER_HEIGHT + LAYOUT_TABS_HEIGHT,
    );
    expect(resolveChromeHeight({ tabs: false, footer: false })).toBe(
      LAYOUT_HEADER_HEIGHT,
    );
    expect(
      resolveChromeHeight({ footer: false, header: false, tabs: false }),
    ).toBe(0);
  });
});

describe('侧边区域宽度', () => {
  it('未折叠时就是主栏宽度', () => {
    expect(resolveSidebarWidth({})).toBe(LAYOUT_SIDEBAR_WIDTH);
  });

  it('折叠换成窄栏宽度', () => {
    expect(resolveSidebarWidth({ collapsed: true })).toBe(
      LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
    );
  });

  it('双列形态再叠加图标栏，且图标栏不受折叠影响', () => {
    expect(resolveSidebarWidth({ rail: true })).toBe(
      LAYOUT_SIDEBAR_WIDTH + LAYOUT_RAIL_WIDTH,
    );
    expect(resolveSidebarWidth({ collapsed: true, rail: true })).toBe(
      LAYOUT_SIDEBAR_COLLAPSED_WIDTH + LAYOUT_RAIL_WIDTH,
    );
  });

  it('自定义宽度直接采用（偏好项 sidebarWidth / railWidth 的口子）', () => {
    expect(
      resolveSidebarWidth({ rail: true, railWidth: 48, sidebarWidth: 260 }),
    ).toBe(308);
    expect(resolveSidebarWidth({ sidebarWidth: 260 })).toBe(260);
  });
});
