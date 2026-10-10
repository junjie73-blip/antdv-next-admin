import type { LayoutMode, MenuConfig } from '@antdv/types';

import type { Ref } from 'vue';

import type { MenuTreeSource } from '../src/menu-source';

import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  createMenuTreeSource,
  railMenusOf,
  sidebarMenusOf,
  useLayoutRegions,
} from '../src/menu-source';

/**
 * 菜单纯粹是数据，所以测试里不挂组件、不起路由：
 * 一棵数组 + 一个几行的假 router，就能覆盖三种布局共用的选中态推导。
 */
const PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  dept: '/system/dept',
  'external-link': 'https://example.com/docs',
  role: '/system/role',
  system: '/system',
  user: '/system/user-manage',
  'user-list': '/system/user',
};

function createFakeRouter(push?: (to?: unknown) => unknown) {
  const pushImpl = push ?? (() => Promise.resolve());
  return {
    hasRoute: (name: string | symbol) =>
      typeof name === 'string' && name in PATHS,
    push: (to: unknown) => pushImpl(to),
    resolve: (to: unknown) => ({
      path: PATHS[(to as { name?: string }).name ?? ''] ?? '/not-found',
    }),
  };
}

const SOURCE: MenuConfig[] = [
  { name: 'dashboard', path: '', title: '仪表盘' },
  {
    name: 'system',
    path: '',
    title: '系统管理',
    children: [
      {
        name: 'user',
        path: '',
        title: '用户管理',
        children: [{ name: 'user-list', path: '', title: '用户列表' }],
      },
      { name: 'role', path: '', title: '角色管理' },
      { hidden: true, name: 'dept', path: '', title: '部门管理' },
    ],
  },
  { isExternal: true, name: 'external-link', path: '', title: '外部文档' },
];

type TestRoute = { name?: string, path: string };

interface TestSource extends MenuTreeSource {
  route: Ref<TestRoute>;
  router: ReturnType<typeof createFakeRouter>;
}

/** 断言只用 `expect(push)`，所以这里收窄成普通函数签名即可 */
type PushFn = (to?: unknown) => unknown;

function makeSource(
  routeValue: TestRoute = { name: 'user-list', path: '/system/user' },
  options: { openExternal?: (url: string) => void, push?: PushFn } = {},
): TestSource {
  const route = ref<TestRoute>(routeValue);
  const router = createFakeRouter(options.push);
  const source = createMenuTreeSource({
    menus: () => SOURCE,
    openExternal: options.openExternal,
    route: () => route.value,
    router,
  });
  return { ...source, route, router };
}

describe('createMenuTreeSource', () => {
  it('补全后端菜单缺失的 path；树里保留 hidden，可见性由 topMenus / leafMenus 负责剔', () => {
    /**
     * 「隐藏」的语义是"不在导航里出现"，不是"这个页面不存在"。
     * 所以补 path 这一步不能顺手把 hidden 剪掉 —— 直达链接、标签页标题、
     * 一级导航归属都还要在这棵树上反查。真正渲染导航的三个出口（topMenus /
     * sidebarMenus / buildMenuItems）各自会再过滤一次，两侧都在测试里钉住。
     */
    const { menus } = makeSource();
    expect(menus.value.map((menu) => menu.path)).toEqual([
      '/dashboard',
      '/system',
      'https://example.com/docs',
    ]);
    expect(menus.value[1]?.children?.map((child) => [child.name, child.path])).toEqual([
      ['user', '/system/user-manage'],
      ['role', '/system/role'],
      ['dept', '/system/dept'],
    ]);

    // 出口一：一级导航不含隐藏顶级
    expect(makeSource().topMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    // 出口二：叶子遍历不含隐藏项（dept 在，但 role 之外没有它）
    expect(makeSource().leafMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'user-list',
      'role',
      'external-link',
    ]);
    // 出口三：侧边栏那批子菜单里没有部门管理
    expect(
      (makeSource().activeTopChildren.value ?? []).map((child) => child.name),
    ).toEqual(['user', 'role']);
  });

  it('直达隐藏页时，一级导航仍归属到它可见的父级，而不是退回第一项', () => {
    /**
     * 用户从地址栏 / 标签页进 /system/dept（导航里根本没有这一项）时，
     * 外壳必须认得出"他在系统管理下"。早先这里查不到菜单就 `topMenus[0]` 兜底，
     * 表现是侧边栏突然跳到仪表盘，用户以为被登出了。
     */
    const source = makeSource({ path: '/system/dept' });
    expect(source.currentMenu.value?.name).toBe('dept');
    expect(source.activeTopKey.value).toBe('system');
    expect(source.currentChain.value.map((menu) => menu.name)).toEqual([
      'system',
      'dept',
    ]);
    // 但侧栏渲染的还是可见的那批：隐藏的部门管理不会因此冒出来
    expect(source.activeTopChildren.value.map((child) => child.name)).toEqual([
      'user',
      'role',
    ]);
  });

  it('隐藏顶级下的页面没有任何可见父级时，仍兜到第一个一级菜单', () => {
    const source = makeSource({ path: '/not-in-menu' });
    expect(source.currentMenu.value).toBeUndefined();
    expect(source.activeTopKey.value).toBe('dashboard');
  });

  it('当前路由 → 一级 / 叶子 / 祖先链 用的是同一套 key', () => {
    const source = makeSource();
    expect(source.activeTopKey.value).toBe('system');
    expect(source.activeLeafKey.value).toBe('user-list');
    expect(source.currentChain.value.map((menu) => menu.name)).toEqual([
      'system',
      'user',
      'user-list',
    ]);
    expect(source.topMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    expect(source.leafMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'user-list',
      'role',
      'external-link',
    ]);
  });

  it('按 name 找不到时退回按 path 匹配', () => {
    const source = makeSource({ path: '/system/role' });
    expect(source.activeLeafKey.value).toBe('role');
    expect(source.activeTopKey.value).toBe('system');
  });

  it('路由不在菜单里时，一级高亮回落到第一项而不是全灰', () => {
    const source = makeSource({ path: '/nowhere' });
    expect(source.currentMenu.value).toBeUndefined();
    expect(source.activeTopMenu.value?.name).toBe('dashboard');
    expect(source.hasSubMenus.value).toBe(false);
  });

  it('外链节点没有子节点，算叶子', () => {
    const source = makeSource();
    const external = source.leafMenus.value.find(
      (menu) => menu.name === 'external-link',
    );
    expect(external?.path).toBe('https://example.com/docs');
  });

  it('混合双列：图标栏选中项取祖先链里的二级，取不到就退到第一个', () => {
    const source = makeSource();
    expect(source.activeRailMenu.value?.name).toBe('user');
    expect(source.activeRailChildren.value.map((menu) => menu.name)).toEqual([
      'user-list',
    ]);

    // 当前二级本身就是叶子（角色管理）：图标栏高亮它，第三列为空
    const leafRoute = makeSource({ name: 'role', path: '/system/role' });
    expect(leafRoute.activeRailMenu.value?.name).toBe('role');
    expect(leafRoute.activeRailChildren.value).toEqual([]);
  });

  it('一级菜单没有子节点时不虚构图标栏选中项', () => {
    const source = makeSource({ name: 'dashboard', path: '/dashboard' });
    expect(source.activeRailMenu.value).toBeUndefined();
    expect(source.activeRailKey.value).toBeUndefined();
  });
});

describe('区域取数', () => {
  const source = makeSource();

  it('侧栏数据源四选一', () => {
    const tree = sidebarMenusOf(source, ref<'tree'>('tree'));
    expect(tree.value.map((m) => m.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    /**
     * 整棵树直出的形态（垂直布局 / 侧边导航）没有下一道过滤，所以隐藏项必须在这里
     * 就逐层剔掉。`source.menus` 本身仍是全量树（权限、标签页、面包屑要靠它反查），
     * 两者的差别就是这个用例存在的原因。
     */
    expect(
      (tree.value[1]?.children ?? []).map((child) => child.name),
    ).toEqual(['user', 'role']);
    expect(source.menus.value[1]?.children).toHaveLength(3);

    expect(
      sidebarMenusOf(source, ref<'active-top'>('active-top')).value.map(
        (m) => m.name,
      ),
    ).toEqual(['user', 'role']);
    expect(
      sidebarMenusOf(source, ref<'active-rail'>('active-rail')).value.map(
        (m) => m.name,
      ),
    ).toEqual(['user-list']);
    expect(sidebarMenusOf(source, ref<'none'>('none')).value).toEqual([]);
  });

  it('图标栏按层级取一级或二级', () => {
    expect(railMenusOf(source, ref<1>(1)).value.map((m) => m.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    expect(railMenusOf(source, ref<2>(2)).value.map((m) => m.name)).toEqual([
      'user',
      'role',
    ]);
  });
});

describe('useLayoutRegions', () => {
  function setup(modeValue: LayoutMode = 'vertical') {
    const source = makeSource();
    const mode = ref<LayoutMode>(modeValue);
    const maximized = ref(false);
    const regions = useLayoutRegions({ maximized, mode, source });
    return { maximized, mode, regions, source };
  }

  it('垂直：侧栏出整棵树，顶栏没有导航', () => {
    const { regions } = setup('vertical');
    expect(regions.sidebarVisible.value).toBe(true);
    expect(regions.sidebarMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    expect(regions.headerNavVisible.value).toBe(false);
    expect(regions.headerLead.value).toBe('breadcrumb');
    expect(regions.navRailVisible.value).toBe(false);
    expect(regions.navTracksLeaf.value).toBe(false);
  });

  it('水平：顶栏导航接管全部层级，侧栏与图标栏都不出', () => {
    const { regions } = setup('horizontal');
    expect(regions.headerNavVisible.value).toBe(true);
    expect(regions.navTracksLeaf.value).toBe(true);
    expect(regions.sidebarVisible.value).toBe(false);
    expect(regions.navRailVisible.value).toBe(false);
    expect(regions.headerLead.value).toBe('logo');
  });

  it('混合垂直：当前一级没有子菜单时侧栏让位', () => {
    const { regions } = setup('mixed-vertical');
    expect(regions.sidebarVisible.value).toBe(true);
    expect(regions.sidebarMenus.value.map((menu) => menu.name)).toEqual([
      'user',
      'role',
    ]);

    // 当前分区换成没有子菜单的仪表盘 → 侧栏收起，把宽度还给内容区
    const empty = setup('mixed-vertical');
    empty.source.route.value = { name: 'dashboard', path: '/dashboard' };
    expect(empty.regions.sidebarVisible.value).toBe(false);
  });

  it('双列菜单：图标栏一级 + 侧栏二级', () => {
    const { regions } = setup('two-column');
    expect(regions.navRailVisible.value).toBe(true);
    expect(regions.railMenus.value.map((menu) => menu.name)).toEqual([
      'dashboard',
      'system',
      'external-link',
    ]);
    expect(regions.sidebarMenus.value.map((menu) => menu.name)).toEqual([
      'user',
      'role',
    ]);
    expect(regions.headerNavVisible.value).toBe(false);
  });

  it('混合双列：图标栏二级 + 侧栏三级，顶栏仍管一级', () => {
    const { regions } = setup('mixed-two-column');
    expect(regions.railMenus.value.map((menu) => menu.name)).toEqual([
      'user',
      'role',
    ]);
    expect(regions.sidebarMenus.value.map((menu) => menu.name)).toEqual([
      'user-list',
    ]);
    expect(regions.sidebarVisible.value).toBe(true);
    expect(regions.headerNavVisible.value).toBe(true);
    expect(regions.navTracksLeaf.value).toBe(false);
  });

  it('混合双列：图标栏选中的二级本身就是叶子时，空的第三列让位', () => {
    // /system/role 是二级叶子，没有三级 → 侧栏不该占一条空栏
    const leaf = setup('mixed-two-column');
    leaf.source.route.value = { name: 'role', path: '/system/role' };
    expect(leaf.regions.sidebarMenus.value).toEqual([]);
    expect(leaf.regions.sidebarVisible.value).toBe(false);
    // 图标栏的高亮必须留在被点中的那一项上，不能跳回第一项
    expect(leaf.regions.railActiveKey.value).toBe('role');
  });

  it('图标栏高亮跟随形态深度：一级形态看顶级，二级形态看链上的二级', () => {
    const oneLevel = setup('two-column');
    expect(oneLevel.regions.railActiveKey.value).toBe('system');

    const twoLevel = setup('mixed-two-column');
    expect(twoLevel.regions.railActiveKey.value).toBe('user');
  });

  it('侧边导航：整棵树常驻左列，占位不依赖当前分区有没有子菜单', () => {
    const { regions } = setup('side-nav');
    expect(regions.sidebarPresentation.value).toBe('inline');
    expect(regions.sidebarVisible.value).toBe(true);
    expect(regions.sidebarMenus.value.length).toBeGreaterThan(0);
    expect(regions.headerLead.value).toBe('logo');
    expect(regions.headerNavVisible.value).toBe(false);
  });

  it('内容全屏：外壳区域全部隐藏', () => {
    const { regions } = setup('full-content');
    expect(regions.chromeless.value).toBe(true);
    expect(regions.headerVisible.value).toBe(false);
    expect(regions.sidebarVisible.value).toBe(false);
    expect(regions.navRailVisible.value).toBe(false);
    expect(regions.tabsVisible.value).toBe(false);
    expect(regions.footerVisible.value).toBe(false);
  });

  it('标签页最大化把外壳收起，但形态本身没变', () => {
    const { maximized, mode, regions } = setup('vertical');
    maximized.value = true;
    expect(mode.value).toBe('vertical');
    expect(regions.headerVisible.value).toBe(false);
    expect(regions.sidebarVisible.value).toBe(false);
    expect(regions.chromeless.value).toBe(false);
    // 标签页栏自己不受影响：它就是"退出最大化"的入口
    expect(regions.tabsVisible.value).toBe(true);
  });

  it('切换形态是响应式的，区域开关与数据源跟着换', () => {
    const { mode, regions } = setup('vertical');
    expect(regions.sidebarMenus.value).toHaveLength(3);
    mode.value = 'mixed-vertical';
    expect(regions.sidebarMenus.value).toHaveLength(2);
    expect(regions.headerNavVisible.value).toBe(true);
    mode.value = 'horizontal';
    expect(regions.sidebarVisible.value).toBe(false);
    mode.value = 'mixed-two-column';
    expect(regions.railMenus.value).toHaveLength(2);
  });

  it('不传 maximized 时按未最大化处理', () => {
    const source = makeSource();
    const regions = useLayoutRegions({
      mode: ref<LayoutMode>('vertical'),
      source,
    });
    expect(regions.headerVisible.value).toBe(true);
  });
});

describe('导航动作', () => {
  it('叶子且有同名路由 → 按 name 跳', () => {
    const push = vi.fn(() => Promise.resolve());
    const source = makeSource(undefined, { push });
    const system = source.topMenus.value.find((menu) => menu.name === 'system');
    void source.openMenu(
      system?.children?.find((menu) => menu.name === 'role'),
    );
    expect(push).toHaveBeenCalledWith({ name: 'role' });
  });

  it('菜单 name 不在路由表里时用 path 兜底', () => {
    const push = vi.fn(() => Promise.resolve());
    const source = makeSource(undefined, { push });
    void source.openMenu({ name: 'ghost', path: '/ghost', title: '幽灵页' });
    expect(push).toHaveBeenCalledWith('/ghost');
  });

  it('目录跳到它的第一个可见叶子', () => {
    const push = vi.fn(() => Promise.resolve());
    const source = makeSource(undefined, { push });
    const system = source.menus.value.find((menu) => menu.name === 'system');
    void source.openMenu(system);
    expect(push).toHaveBeenCalledWith({ name: 'user-list' });
  });

  it('外链走 openExternal，不动路由', () => {
    const push = vi.fn(() => Promise.resolve());
    const openExternal = vi.fn();
    const source = makeSource(undefined, { openExternal, push });
    const external = source.topMenus.value.find(
      (menu) => menu.name === 'external-link',
    );
    void source.openMenu(external);
    expect(openExternal).toHaveBeenCalledWith('https://example.com/docs');
    expect(push).not.toHaveBeenCalled();
  });

  it('既没有 name 也没有 path 时只告警，不抛错', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = makeSource();
    void source.openMenu({ path: '', title: '占位' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('导航失败（重复跳转）被吞掉，不会变成未处理 rejection', async () => {
    const push = vi.fn(() => Promise.reject(new Error('duplicated')));
    const source = makeSource(undefined, { push });
    await expect(
      source.openMenu({ name: 'role', path: '/system/role', title: '角色管理' }),
    ).resolves.toBeUndefined();
  });

  it('openMenuByKey 用统一 key 找回节点后跳转', () => {
    const push = vi.fn(() => Promise.resolve());
    const source = makeSource(undefined, { push });
    void source.openMenuByKey('role');
    expect(push).toHaveBeenCalledWith({ name: 'role' });
    expect(source.openMenuByKey(undefined)).toBeUndefined();
  });
});
