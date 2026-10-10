import type { LayoutMode } from '@antdv/types';

import { describe, expect, it } from 'vitest';

import {
  ALL_MENU_DEPTH,
  getBlueprint,
  isLayoutMode,
  LAYOUT_BLUEPRINTS,
  LAYOUT_MODE_OPTIONS,
  normalizeLayoutMode,
  showsHeaderNav,
  showsNavRail,
  showsSidebar,
} from '../src/modes';

const ALL_MODES = Object.keys(LAYOUT_BLUEPRINTS) as LayoutMode[];

describe('布局蓝图', () => {
  it('每种形态都有蓝图，且选择器顺序与形态集合一一对应', () => {
    expect(ALL_MODES).toHaveLength(7);
    expect(LAYOUT_MODE_OPTIONS.map((item) => item.value)).toEqual(
      expect.arrayContaining(ALL_MODES),
    );
    expect(LAYOUT_MODE_OPTIONS).toHaveLength(ALL_MODES.length);
    // UI 顺序：垂直 / 双列菜单 / 水平 / 侧边导航 / 混合垂直 / 混合双列 / 内容全屏
    expect(LAYOUT_MODE_OPTIONS.map((item) => item.label)).toEqual([
      '垂直',
      '双列菜单',
      '水平',
      '侧边导航',
      '混合垂直',
      '混合双列',
      '内容全屏',
    ]);
  });

  it('垂直：一棵完整树 + 顶栏面包屑', () => {
    const blueprint = LAYOUT_BLUEPRINTS.vertical;
    expect(blueprint.sidebarSource).toBe('tree');
    expect(blueprint.sidebarPresentation).toBe('inline');
    expect(blueprint.headerNavVisible).toBe(false);
    expect(blueprint.headerLead).toBe('breadcrumb');
    expect(blueprint.navRailVisible).toBe(false);
  });

  it('水平：所有层级进顶栏，没有侧边栏', () => {
    const blueprint = LAYOUT_BLUEPRINTS.horizontal;
    expect(blueprint.headerNavVisible).toBe(true);
    expect(blueprint.headerNavDepth).toBe(ALL_MENU_DEPTH);
    expect(blueprint.sidebarSource).toBe('none');
  });

  it('双列菜单：图标栏取一级，侧栏取当前一级子树', () => {
    const blueprint = LAYOUT_BLUEPRINTS['two-column'];
    expect(blueprint.navRailVisible).toBe(true);
    expect(blueprint.railDepth).toBe(1);
    expect(blueprint.sidebarSource).toBe('active-top');
    expect(blueprint.headerNavVisible).toBe(false);
  });

  /**
   * 侧边导航 = 常驻侧栏，不是浮层。
   *
   * 回归：这里曾配成 `drawer`，于是该形态下默认什么都看不到（菜单躲在收起的抽屉里），
   * 用户反馈"侧边导航下侧边菜单没有出现"。菜单必须常驻可见，抽屉只留给窄屏。
   */
  it('侧边导航：整棵树常驻左列，顶栏通栏放 Logo', () => {
    const blueprint = LAYOUT_BLUEPRINTS['side-nav'];
    expect(blueprint.sidebarPresentation).toBe('inline');
    expect(blueprint.sidebarSource).toBe('tree');
    expect(blueprint.headerLead).toBe('logo');
    expect(blueprint.hideSidebarWhenEmpty).toBe(false);
    expect(blueprint.chromeless).toBe(false);
  });

  it('混合垂直：顶栏管一级、侧栏管子树，且无子菜单时让位', () => {
    const blueprint = LAYOUT_BLUEPRINTS['mixed-vertical'];
    expect(blueprint.headerNavDepth).toBe(1);
    expect(blueprint.sidebarSource).toBe('active-top');
    expect(blueprint.hideSidebarWhenEmpty).toBe(true);
    expect(blueprint.navRailVisible).toBe(false);
  });

  it('混合双列：顶栏一级 + 图标栏二级 + 侧栏三级', () => {
    const blueprint = LAYOUT_BLUEPRINTS['mixed-two-column'];
    expect(blueprint.headerNavDepth).toBe(1);
    expect(blueprint.railDepth).toBe(2);
    expect(blueprint.sidebarSource).toBe('active-rail');
    // 后端菜单常常只到二级，此时第三列必然为空 —— 空列该让位给内容区。
    // 前提：sidebarVisible 的"空不空"按侧栏自己那批数据（三级）判，不是按一级孩子判。
    expect(blueprint.hideSidebarWhenEmpty).toBe(true);
  });

  it('内容全屏：chromeless 为真，其余区域全关', () => {
    const blueprint = LAYOUT_BLUEPRINTS['full-content'];
    expect(blueprint.chromeless).toBe(true);
    expect(showsHeaderNav('full-content')).toBe(false);
    expect(showsSidebar('full-content')).toBe(false);
    expect(showsNavRail('full-content')).toBe(false);
  });

  it('只有水平形态让叶子参与顶栏高亮', () => {
    for (const mode of ALL_MODES) {
      const tracksLeaf = getBlueprint(mode).headerNavDepth === ALL_MENU_DEPTH;
      expect(tracksLeaf).toBe(mode === 'horizontal');
    }
  });

  it('除内容全屏外，声明了侧栏数据源的形态都算"有侧栏"', () => {
    for (const mode of ALL_MODES) {
      const blueprint = LAYOUT_BLUEPRINTS[mode];
      expect(showsSidebar(mode)).toBe(
        !blueprint.chromeless && blueprint.sidebarSource !== 'none',
      );
    }
  });
});

describe('历史值与脏值', () => {
  it('旧缓存里的 mixed 迁移为混合垂直', () => {
    expect(normalizeLayoutMode('mixed')).toBe('mixed-vertical');
    expect(normalizeLayoutMode('split-vertical')).toBe('two-column');
  });

  it('当前值原样通过', () => {
    for (const mode of ALL_MODES) {
      expect(normalizeLayoutMode(mode)).toBe(mode);
      expect(isLayoutMode(mode)).toBe(true);
    }
  });

  it('无法识别的值退回垂直布局，而不是抛错或返回 undefined', () => {
    expect(normalizeLayoutMode('no-such-layout')).toBe('vertical');
    expect(normalizeLayoutMode('')).toBe('vertical');
    expect(normalizeLayoutMode(undefined)).toBe('vertical');
    expect(normalizeLayoutMode(null)).toBe('vertical');
    expect(normalizeLayoutMode(123)).toBe('vertical');
    expect(normalizeLayoutMode({})).toBe('vertical');
  });

  it('getBlueprint 对脏值也总能拿到一张完整蓝图', () => {
    const blueprint = getBlueprint('mixed');
    expect(blueprint).toBe(LAYOUT_BLUEPRINTS['mixed-vertical']);
    expect(getBlueprint(Symbol('x')).sidebarSource).toBe('tree');
  });
});
