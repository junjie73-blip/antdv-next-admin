import type { LayoutMode } from '@antdv/types';
import type { MenuConfig, MenuKey } from '@antdv/types';

import type { ComputedRef, Ref } from 'vue';

import { computed } from 'vue';

import {
  attachMenuPaths,
  findMenuChain,
  firstLeafMenu,
  flattenLeafMenus,
  isLeafMenu,
  menuKeyOf,
  normalizeMenuPath,
  visibleMenus,
  visibleMenuTree,
} from '@antdv/shared/menu';

import { getBlueprint } from './modes';

/**
 * 菜单树状态源。
 *
 * 包内不 import pinia、不 import vue-router 的实现：菜单来自一个 getter，
 * 路由只用结构化类型描述（`{ name, path }` + `hasRoute/push`）。
 * 这样同一份逻辑既能跑在应用里，也能在单测里喂一个数组直接验证。
 */

/** 当前路由的最小信息量 */
export interface MenuRouteLike {
  name?: string | symbol;
  path: string;
}

/**
 * 导航所需的最小 router 能力 —— 结构上是 vue-router `Router` 的子集，
 * 用结构化类型而不是 `import type { Router }`，包就不必把 vue-router 变成依赖，
 * 单测里喂一个 20 行的假对象即可覆盖全部分支。
 *
 * ⚠️ 成员一律用「方法签名」而不是「属性 + 函数类型」声明：
 * 前者参数按双变比较，真实的 `Router`（参数是 `RouteLocationRaw`）可以直接传进来；
 * 写成属性时 `strictFunctionTypes` 要求逆变，`push(to: unknown)` 会把 vue-router
 * 的实例判成"不接受 unknown"，消费方只能到处加断言。
 */
export interface MenuRouterLike {
  /**
   * 路由表快照，`attachMenuPaths` 用它把后端写的相对片段（`user`）
   * 反查成可导航的完整路径（`/system/user`）。
   * 缺省时只做 name 反查，单测里喂个 20 行的假对象就够。
   */
  getRoutes?: () => { path: string }[];
  hasRoute(name: string | symbol): boolean;
  push(to: unknown): unknown;
  resolve(to: unknown): { path: string };
}

export interface MenuTreeDeps {
  /** 未补 path 的原始菜单；后端菜单只有 name，这里统一用 router 反查补全 */
  menus: () => MenuConfig[];
  /** 外链新窗口打开，默认退回 console（SSR / 单测里没有 window 也不炸） */
  openExternal?: (url: string) => void;
  route: () => MenuRouteLike;
  router: MenuRouterLike;
}

export interface MenuTreeSource {
  activeLeafKey: ComputedRef<MenuKey | undefined>;
  activeRailChildren: ComputedRef<MenuConfig[]>;
  activeRailKey: ComputedRef<MenuKey | undefined>;
  activeRailMenu: ComputedRef<MenuConfig | undefined>;
  activeTopChildren: ComputedRef<MenuConfig[]>;
  activeTopKey: ComputedRef<MenuKey | undefined>;
  activeTopMenu: ComputedRef<MenuConfig | undefined>;
  currentChain: ComputedRef<MenuConfig[]>;
  currentMenu: ComputedRef<MenuConfig | undefined>;
  hasSubMenus: ComputedRef<boolean>;
  leafMenus: ComputedRef<MenuConfig[]>;
  menus: ComputedRef<MenuConfig[]>;
  openMenu: (menu?: MenuConfig) => Promise<void>;
  openMenuByKey: (key?: MenuKey) => Promise<void> | undefined;
  topMenus: ComputedRef<MenuConfig[]>;
}

function last<T>(list: T[]): T | undefined {
  return list.length > 0 ? list[list.length - 1] : undefined;
}

export function createMenuTreeSource(deps: MenuTreeDeps): MenuTreeSource {
  const { route, router } = deps;

  /*
   * `includeHidden`：这里要的是"完整的一棵树"，可见性交给下游的
   * `visibleMenus` / `buildMenuItems` 去剔。原因是隐藏页也要能反查 path 与祖先链
   * （直达链接、标签页标题、一级导航归属），早先在补 path 这一步就把它丢掉，
   * 等于让整棵树对隐藏页失明。
   */
  const menus = computed(() =>
    attachMenuPaths(
      deps.menus(),
      router as unknown as Parameters<typeof attachMenuPaths>[1],
      { includeHidden: true },
    ),
  );
  const topMenus = computed(() => visibleMenus(menus.value));
  const leafMenus = computed(() => flattenLeafMenus(menus.value));

  /**
   * 当前路由命中的菜单节点：先按 name，再按完整 path 回退。
   *
   * `includeHidden` 是给"直达隐藏页"准备的：导航里不展示的页面（部门管理、
   * 个人中心）用户仍能从地址栏或标签页进来，这时外壳要认出他站在哪，
   * 而不是退回"高亮第一个一级菜单"。
   */
  const currentMenu = computed<MenuConfig | undefined>(() => {
    const current = route();
    const options = { includeHidden: true };
    const byName = findMenuChain(
      menus.value,
      (menu) => !!current.name && menu.name === current.name,
      [],
      options,
    );
    if (byName.length > 0) return last(byName);
    return last(
      findMenuChain(
        menus.value,
        (menu) => !!menu.path && normalizeMenuPath(menu.path) === normalizeMenuPath(current.path),
        [],
        options,
      ),
    );
  });

  /**
   * 当前路由的祖先链（含自身），链首即所属一级菜单。
   *
   * 命中隐藏页时链里会夹着隐藏节点，一级导航只认真实渲染得出来的那一个。
   */
  const currentChain = computed<MenuConfig[]>(() => {
    const menu = currentMenu.value;
    if (!menu) return [];
    const key = menuKeyOf(menu);
    return findMenuChain(menus.value, (item) => menuKeyOf(item) === key, [], {
      includeHidden: true,
    });
  });

  const activeTopMenu = computed<MenuConfig | undefined>(
    () =>
      currentChain.value.find((menu) => !menu.hidden) ??
      topMenus.value[0],
  );

  /** 一级导航的选中 key：路由不在菜单里时回退第一项，避免横向导航全灰 */
  const activeTopKey = computed<MenuKey | undefined>(() =>
    activeTopMenu.value ? menuKeyOf(activeTopMenu.value) : undefined,
  );

  /** 叶子 key：水平布局用它做精准单选 */
  const activeLeafKey = computed<MenuKey | undefined>(() =>
    currentMenu.value ? menuKeyOf(currentMenu.value) : undefined,
  );

  const activeTopChildren = computed<MenuConfig[]>(() =>
    visibleMenus(activeTopMenu.value?.children),
  );
  const hasSubMenus = computed(() => activeTopChildren.value.length > 0);

  /**
   * 混合双列下图标栏（二级）选中的那一项。
   *
   * 依据是当前路由所在链：链里能找到二级节点就用它 —— 即使那个二级本身就是叶子
   * （此时第三列为空，但图标栏的高亮必须留在它身上，否则会把用户以为的"当前分区"
   * 挪到第一项）。找不到就退到第一个二级项，保证第三列永远有内容。
   */
  const activeRailMenu = computed<MenuConfig | undefined>(() => {
    const children = activeTopChildren.value;
    if (children.length === 0) return undefined;
    const keys = new Set(children.map((child) => menuKeyOf(child)));
    const inChain = currentChain.value.find((menu) => keys.has(menuKeyOf(menu)));
    return inChain ?? children[0];
  });

  const activeRailKey = computed<MenuKey | undefined>(() =>
    activeRailMenu.value ? menuKeyOf(activeRailMenu.value) : undefined,
  );

  const activeRailChildren = computed<MenuConfig[]>(() =>
    visibleMenus(activeRailMenu.value?.children),
  );

  function openExternal(url: string) {
    if (deps.openExternal) {
      deps.openExternal(url);
      return;
    }
    if (typeof globalThis.window?.open === 'function') {
      globalThis.window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * 打开菜单节点。
   * 外链 → 新窗口；目录 → 跳到它的第一个可见叶子；叶子 → 按 name 跳路由
   * （name 不在路由表里时用 path 兜底），重复导航的失败直接吞掉。
   */
  function openMenu(menu?: MenuConfig): Promise<void> {
    if (!menu) return Promise.resolve();

    if (menu.isExternal && menu.path) {
      openExternal(menu.path);
      return Promise.resolve();
    }

    if (!isLeafMenu(menu)) return openMenu(firstLeafMenu(menu));

    const { name, path } = menu;
    const target = name && router.hasRoute(name) ? { name } : path;
    if (!target) {
      console.warn('[menu] 无法定位路由:', menu.title, menu);
      return Promise.resolve();
    }
    return Promise.resolve(router.push(target)).then(
      () => undefined,
      () => undefined,
    );
  }

  /** 横向导航点击：key 既可能是一级目录，也可能是叶子 */
  function openMenuByKey(key?: MenuKey) {
    if (!key) return undefined;
    const menu = last(
      findMenuChain(menus.value, (item) => menuKeyOf(item) === key),
    );
    return openMenu(menu);
  }

  return {
    activeLeafKey,
    activeRailChildren,
    activeRailKey,
    activeRailMenu,
    activeTopChildren,
    activeTopKey,
    activeTopMenu,
    currentChain,
    currentMenu,
    hasSubMenus,
    leafMenus,
    menus,
    openMenu,
    openMenuByKey,
    topMenus,
  };
}

/** 图标栏该渲染哪一批菜单（跟随形态切换实时变化） */
export function railMenusOf(
  source: MenuTreeSource,
  railDepth: Ref<1 | 2>,
): ComputedRef<MenuConfig[]> {
  return computed(() =>
    railDepth.value === 2 ? source.activeTopChildren.value : source.topMenus.value,
  );
}

/** 侧边栏该渲染哪一批菜单 */
export function sidebarMenusOf(
  source: MenuTreeSource,
  sidebarSource: Ref<'active-rail' | 'active-top' | 'none' | 'tree'>,
): ComputedRef<MenuConfig[]> {
  return computed(() => {
    switch (sidebarSource.value) {
      case 'active-rail': {
        return source.activeRailChildren.value;
      }
      case 'active-top': {
        return source.activeTopChildren.value;
      }
      case 'none': {
        return [];
      }
      case 'tree': {
        // 全量树（含隐藏页）只用于反查；导航要逐层剔掉隐藏项
        return visibleMenuTree(source.menus.value);
      }
      default: {
        return [];
      }
    }
  });
}

export interface LayoutRegionFlags {
  /** 内容全屏形态：导航外壳整体隐去 */
  chromeless: ComputedRef<boolean>;
  /** 底栏是否渲染 */
  footerVisible: ComputedRef<boolean>;
  /** 顶栏是否渲染（面包屑或 Logo+导航，形态决定内容） */
  headerVisible: ComputedRef<boolean>;
  headerLead: ComputedRef<'breadcrumb' | 'logo'>;
  /** 顶栏里的横向导航 */
  headerNavVisible: ComputedRef<boolean>;
  navRailVisible: ComputedRef<boolean>;
  /** 顶栏导航要不要把叶子也纳入高亮（水平形态） */
  navTracksLeaf: ComputedRef<boolean>;
  /** 图标栏该高亮哪一项：深度 1 = 一级；深度 2 = 当前一级下的二级 */
  railActiveKey: ComputedRef<MenuKey | undefined>;
  railMenus: ComputedRef<MenuConfig[]>;
  sidebarMenus: ComputedRef<MenuConfig[]>;
  sidebarPresentation: ComputedRef<'drawer' | 'inline'>;
  /** 侧栏是否占位（图标栏 / 主栏 / 抽屉） */
  sidebarVisible: ComputedRef<boolean>;
  /** 标签页栏是否渲染 */
  tabsVisible: ComputedRef<boolean>;
}

/**
 * 把"当前布局形态 + 菜单树 + 是否最大化"折叠成外壳真正要用的区域开关。
 *
 * 布局组件只消费这里的结果，不再各自判断 `layout === 'xxx'`：
 * 新增一种形态只需要改 `LAYOUT_BLUEPRINTS` 一张表。
 */
export function useLayoutRegions(options: {
  maximized?: ComputedRef<boolean> | Ref<boolean>;
  mode: ComputedRef<LayoutMode> | Ref<LayoutMode>;
  source: MenuTreeSource;
}): LayoutRegionFlags {
  const { maximized, mode, source } = options;
  const blueprint = computed(() => getBlueprint(mode.value));
  /** 标签页"放大当前页"等价于临时内容全屏 */
  const collapsed = computed(() => blueprint.value.chromeless || !!maximized?.value);

  const sidebarMenus = sidebarMenusOf(
    source,
    computed(() => blueprint.value.sidebarSource),
  );

  /**
   * 侧栏是否占位。
   *
   * "空不空"必须按侧栏真正渲染的那批数据判：`active-rail` 形态看三级菜单，
   * `active-top` 看二级。早先一律用 `hasSubMenus`（永远看一级孩子），
   * 混合双列遇到"二级本身就是叶子"时会留一栏什么都不显示的空白。
   */
  const sidebarVisible = computed(() => {
    const current = blueprint.value;
    if (collapsed.value) return false;
    if (current.sidebarSource === 'none') return false;
    // 浮层形态由用户开合，不依赖"当前分区有没有子菜单"
    if (current.sidebarPresentation === 'drawer') return true;
    return current.hideSidebarWhenEmpty ? sidebarMenus.value.length > 0 : true;
  });

  const navRailVisible = computed(
    () => !collapsed.value && blueprint.value.navRailVisible,
  );

  /**
   * 图标栏的高亮项。
   *
   * 深度 1 时图标栏就是一级菜单，跟着"当前所属一级"高亮；
   * 深度 2 时它是一级的孩子，跟着链上的二级节点高亮（叶子也要保留，
   * 否则点一个二级叶子会把整栏的选中挪回第一项）。
   */
  const railActiveKey = computed<MenuKey | undefined>(() =>
    blueprint.value.railDepth === 2
      ? source.activeRailKey.value
      : source.activeTopKey.value,
  );

  return {
    chromeless: computed(() => blueprint.value.chromeless),
    footerVisible: computed(() => !collapsed.value),
    headerLead: computed(() => blueprint.value.headerLead),
    headerNavVisible: computed(
      () => !collapsed.value && blueprint.value.headerNavVisible,
    ),
    headerVisible: computed(() => !collapsed.value),
    navRailVisible,
    navTracksLeaf: computed(
      () => blueprint.value.headerNavDepth === Number.POSITIVE_INFINITY,
    ),
    railActiveKey,
    railMenus: railMenusOf(
      source,
      computed(() => blueprint.value.railDepth),
    ),
    sidebarMenus,
    sidebarPresentation: computed(() => blueprint.value.sidebarPresentation),
    sidebarVisible,
    tabsVisible: computed(() => !blueprint.value.chromeless),
  };
}
