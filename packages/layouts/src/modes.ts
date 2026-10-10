import type { LayoutMode } from '@antdv/types';

/**
 * 布局的"区域蓝图"：把 7 种形态各自要渲染哪些外壳区域收敛成一张表。
 *
 * 之前应用里到处是 `isVertical / isHorizontal / isMixed` 三选一的分支，
 * 加第 4 种形态就得把每个组件改一遍。有了蓝图，组件只问"顶栏要不要导航"
 * "侧边栏取哪一层"，新增形态只是在表里加一行。
 */

/**
 * 侧边栏的数据源。
 *
 * 同样注意：注释必须贴在正确的成员上（联合成员是字母序，不是语义序）。
 */
export type SidebarSource =
  /** 当前图标栏选中项的子树（三级及以下） */
  | 'active-rail'
  /** 当前一级菜单的子树（二级及以下） */
  | 'active-top'
  /** 不渲染侧边栏 */
  | 'none'
  /** 完整菜单树 */
  | 'tree';

/**
 * 侧边栏的呈现方式。
 *
 * ⚠️ 联合成员按字母序排列（lint 要求），注释必须跟着成员走，
 * 早先注释挂在错误的成员上，读代码的人会把 drawer 当成"常驻"。
 */
export type SidebarPresentation =
  /** 浮层抽屉：覆盖在内容区之上，可整体收起；窄屏下常驻侧栏也会升级成它 */
  | 'drawer'
  /** 常驻：挤占内容区宽度，跟随 sidebarCollapsed 折叠 */
  | 'inline';

/** 顶栏左侧放什么 */
export type HeaderLead = 'breadcrumb' | 'logo';

export interface LayoutBlueprint {
  /** 内容全屏：隐藏所有导航外壳，只留内容区 */
  chromeless: boolean;
  /** 顶栏横向导航取到第几层：1 = 仅一级；Infinity = 整棵树（叶子也参与高亮） */
  headerNavDepth: number;
  /** 顶栏是否渲染横向导航 */
  headerNavVisible: boolean;
  headerLead: HeaderLead;
  /** 当前分区没有子菜单时，侧边栏让位（把宽度还给内容区） */
  hideSidebarWhenEmpty: boolean;
  /** 是否渲染左侧图标栏（双列形态的第一列） */
  navRailVisible: boolean;
  /** 图标栏取哪一层：1 = 所有一级菜单；2 = 当前一级菜单的孩子 */
  railDepth: 1 | 2;
  sidebarPresentation: SidebarPresentation;
  sidebarSource: SidebarSource;
}

/** 图标栏导航的"整棵树"层级，显式写出来比裸 Infinity 好读 */
export const ALL_MENU_DEPTH = Number.POSITIVE_INFINITY;

export const LAYOUT_BLUEPRINTS: Record<LayoutMode, LayoutBlueprint> = {
  /* 内容全屏：外壳全部隐去，只留一个退出入口 */
  'full-content': {
    chromeless: true,
    headerNavDepth: 0,
    headerNavVisible: false,
    headerLead: 'logo',
    hideSidebarWhenEmpty: true,
    navRailVisible: false,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'none',
  },
  /* 水平：一级到叶子全在顶栏，没有侧边栏 */
  horizontal: {
    chromeless: false,
    headerNavDepth: ALL_MENU_DEPTH,
    headerNavVisible: true,
    headerLead: 'logo',
    hideSidebarWhenEmpty: true,
    navRailVisible: false,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'none',
  },
  /* 混合双列：顶栏管一级，图标栏管二级，侧边栏管三级及以下 */
  'mixed-two-column': {
    chromeless: false,
    headerNavDepth: 1,
    headerNavVisible: true,
    headerLead: 'logo',
    // 后端菜单常常只到二级，此时第三列必然为空——空列不该占掉一栏宽度
    hideSidebarWhenEmpty: true,
    navRailVisible: true,
    railDepth: 2,
    sidebarPresentation: 'inline',
    sidebarSource: 'active-rail',
  },
  /* 混合垂直：顶栏管一级，侧边栏管二级及以下（老的 `mixed`） */
  'mixed-vertical': {
    chromeless: false,
    headerNavDepth: 1,
    headerNavVisible: true,
    headerLead: 'logo',
    // 老行为：当前一级没有子菜单时不挂侧边栏
    hideSidebarWhenEmpty: true,
    navRailVisible: false,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'active-top',
  },
  /*
   * 侧边导航：顶栏通栏只放 Logo 与工具区，完整菜单树常驻左列。
   *
   * 早先这里写的是 `sidebarPresentation: 'drawer'`，于是"选了侧边导航却什么都不出现"
   * —— 菜单躲在一个默认收起的浮层抽屉里，桌面端用户根本找不到它。
   * 这个形态的语义本来就是"用侧边导航"，菜单必须常驻可见可折叠。
   * 与 `vertical` 的区别在顶栏归属：垂直的 Logo 在侧栏顶部、顶栏只压在内容区上方；
   * 侧边导航的顶栏横贯全宽，侧栏从顶栏下一行开始。
   */
  'side-nav': {
    chromeless: false,
    headerNavDepth: 0,
    headerNavVisible: false,
    headerLead: 'logo',
    hideSidebarWhenEmpty: false,
    navRailVisible: false,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'tree',
  },
  /* 双列菜单：左列一级图标，右列其子树，顶栏放面包屑 */
  'two-column': {
    chromeless: false,
    headerNavDepth: 0,
    headerNavVisible: false,
    headerLead: 'breadcrumb',
    hideSidebarWhenEmpty: false,
    navRailVisible: true,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'active-top',
  },
  /* 垂直：一棵完整的树常驻在左侧 */
  vertical: {
    chromeless: false,
    headerNavDepth: 0,
    headerNavVisible: false,
    headerLead: 'breadcrumb',
    hideSidebarWhenEmpty: false,
    navRailVisible: false,
    railDepth: 1,
    sidebarPresentation: 'inline',
    sidebarSource: 'tree',
  },
};

/** 取蓝图；传入未知值时退回垂直布局而不是抛错（缓存里的脏值不该白屏） */
export function getBlueprint(mode?: unknown): LayoutBlueprint {
  return LAYOUT_BLUEPRINTS[normalizeLayoutMode(mode)] ?? LAYOUT_BLUEPRINTS.vertical;
}

export function isLayoutMode(value: unknown): value is LayoutMode {
  return typeof value === 'string' && value in LAYOUT_BLUEPRINTS;
}

/**
 * 旧版本存在 localStorage 里的形态名。
 *
 * `'mixed'` 在扩展成"混合垂直 / 混合双列"后被重命名；这里做读时迁移，
 * 下一次落盘就会写成新值，避免用户升级后布局凭空变回默认值。
 */
export const LEGACY_LAYOUT_MODES: Record<string, LayoutMode> = {
  mixed: 'mixed-vertical',
  'split-vertical': 'two-column',
};

export function normalizeLayoutMode(mode?: unknown): LayoutMode {
  if (typeof mode !== 'string') return 'vertical';
  if (isLayoutMode(mode)) return mode;
  const migrated = LEGACY_LAYOUT_MODES[mode];
  return migrated ?? 'vertical';
}

export interface LayoutModeOption {
  description: string;
  label: string;
  value: LayoutMode;
}

/**
 * 布局选择器要展示的 7 个形态（顺序即 UI 顺序），文案与图示一致：
 * 垂直 / 双列菜单 / 水平 / 侧边导航 / 混合垂直 / 混合双列 / 内容全屏。
 */
export const LAYOUT_MODE_OPTIONS: LayoutModeOption[] = [
  {
    description: '一棵完整菜单树常驻左侧，顶栏放面包屑',
    label: '垂直',
    value: 'vertical',
  },
  {
    description: '左列一级图标 + 右列其子树',
    label: '双列菜单',
    value: 'two-column',
  },
  {
    description: '所有层级收进顶栏，内容区最宽',
    label: '水平',
    value: 'horizontal',
  },
  {
    description: '顶栏通栏，整棵菜单树常驻左侧并可折叠',
    label: '侧边导航',
    value: 'side-nav',
  },
  {
    description: '顶栏管一级，侧边栏管二级及以下',
    label: '混合垂直',
    value: 'mixed-vertical',
  },
  {
    description: '顶栏管一级，图标栏管二级，侧边栏管三级',
    label: '混合双列',
    value: 'mixed-two-column',
  },
  {
    description: '隐藏全部导航外壳，只留内容区',
    label: '内容全屏',
    value: 'full-content',
  },
];

/** 需要顶栏承载一级导航的形态，供"要不要显示 Logo"这类派生判断复用 */
export function showsHeaderNav(mode: LayoutMode): boolean {
  return LAYOUT_BLUEPRINTS[mode].headerNavVisible;
}

export function showsSidebar(mode: LayoutMode): boolean {
  const blueprint = LAYOUT_BLUEPRINTS[mode];
  return !blueprint.chromeless && blueprint.sidebarSource !== 'none';
}

export function showsNavRail(mode: LayoutMode): boolean {
  const blueprint = LAYOUT_BLUEPRINTS[mode];
  return !blueprint.chromeless && blueprint.navRailVisible;
}
