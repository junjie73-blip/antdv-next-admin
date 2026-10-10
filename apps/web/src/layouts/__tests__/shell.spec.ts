import type { LayoutMode, LayoutRegionFlags } from '@antdv/layouts';
import type { MenuConfig } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { defineComponent, effectScope, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { vi } from 'vitest';
import { useAppStore } from '~/stores/modules/app';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

import { useShell } from '../composables/useLayout';

/**
 * 外壳布线的回归测试。
 *
 * 布局形态的差异全部收敛在 `@antdv/layouts` 的蓝图表（那边已有独立单测），
 * 这里验证的是**应用侧接线**：给定「偏好 + 菜单树 + 当前路由」，
 * `useShell()` 是否把区域开关、菜单数据源、内容区样式翻译成正确结果。
 * 换句话说：包负责"规则"，这组用例负责"应用真的按规则接上了"。
 */

type Shell = ReturnType<typeof useShell>;

const TOP_TITLES = ['系统管理', '系统监控', '关于'];

const MENUS: MenuConfig[] = [
  {
    children: [
      {
        children: [
          { name: 'user-list', title: '用户列表' },
          { name: 'user-post', title: '岗位管理' },
        ],
        name: 'user',
        title: '用户管理',
      },
      { name: 'log', title: '操作日志' },
    ],
    name: 'system',
    title: '系统管理',
  },
  {
    children: [{ name: 'online', title: '在线用户' }],
    name: 'monitor',
    title: '系统监控',
  },
  { name: 'about', title: '关于' },
];

function makeRouter() {
  const blank = { render: () => h('div') };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: blank, name: 'dashboard', path: '/' },
      ...['about', 'log', 'online', 'user-list', 'user-post'].map((name) => ({
        component: blank,
        name,
        path: `/${name}`,
      })),
    ],
  });
}

interface SetupOptions {
  layout?: LayoutMode;
  maximized?: boolean;
  routeName?: string;
}

/**
 * 在真实的注入环境（router + pinia）里跑一次 `useShell()`。
 *
 * composable 需要 setup 上下文，所以借一个空壳组件把结果端出来；
 * pinia 同时 `setActivePinia`，方便用例结束后在 setup 外继续读 store。
 */
async function setupShell(options: SetupOptions = {}) {
  const router = makeRouter();
  const pinia = createPinia();
  setActivePinia(pinia);

  let shell!: Shell;
  const Host = defineComponent({
    setup() {
      const appStore = useAppStore();
      const routeStore = useRouteStore();
      const tabsStore = useTabsStore();

      routeStore.menus = MENUS;
      appStore.updateSetting({ layout: options.layout ?? 'vertical' });
      if (options.maximized) tabsStore.maximizedKey = 'user-list';

      shell = useShell();
      return () => h('div');
    },
  });

  await router.push(`/${options.routeName ?? 'user-list'}`);
  await router.isReady();

  const wrapper = mount(Host, { global: { plugins: [pinia, router] } });
  await nextTick();

  return {
    appStore: useAppStore(),
    regions: shell.regions,
    routeStore: useRouteStore(),
    shell,
    tabsStore: useTabsStore(),
    wrapper,
  };
}

/** 只比对用例显式声明的字段，其余字段留给整体快照在失败时打印 */
function expectRegions(regions: LayoutRegionFlags, expected: Record<string, unknown>) {
  const actual: Record<string, unknown> = {
    chromeless: regions.chromeless.value,
    footerVisible: regions.footerVisible.value,
    headerLead: regions.headerLead.value,
    headerNavVisible: regions.headerNavVisible.value,
    headerVisible: regions.headerVisible.value,
    navRailVisible: regions.navRailVisible.value,
    navTracksLeaf: regions.navTracksLeaf.value,
    railActiveKey: regions.railActiveKey.value,
    railMenus: regions.railMenus.value.map((menu) => menu.title),
    sidebarMenus: regions.sidebarMenus.value.map((menu) => menu.title),
    sidebarPresentation: regions.sidebarPresentation.value,
    sidebarVisible: regions.sidebarVisible.value,
    tabsVisible: regions.tabsVisible.value,
  };
  for (const [key, value] of Object.entries(expected)) {
    expect(actual, key).toHaveProperty(key, value);
  }
}

const REGION_MATRIX: Array<{ expected: Record<string, unknown>; mode: LayoutMode }> = [
  {
    mode: 'vertical',
    expected: {
      headerLead: 'breadcrumb',
      headerNavVisible: false,
      headerVisible: true,
      navRailVisible: false,
      railActiveKey: 'system',
      railMenus: TOP_TITLES,
      sidebarMenus: TOP_TITLES,
      sidebarPresentation: 'inline',
      sidebarVisible: true,
      tabsVisible: true,
    },
  },
  {
    // 双列：左列一级图标，右列其子树
    mode: 'two-column',
    expected: {
      headerLead: 'breadcrumb',
      headerNavVisible: false,
      navRailVisible: true,
      railActiveKey: 'system',
      railMenus: TOP_TITLES,
      sidebarMenus: ['用户管理', '操作日志'],
      sidebarVisible: true,
    },
  },
  {
    // 水平：没有侧栏，叶子也参与顶栏高亮
    mode: 'horizontal',
    expected: {
      headerLead: 'logo',
      headerNavVisible: true,
      navRailVisible: false,
      navTracksLeaf: true,
      sidebarMenus: [],
      sidebarVisible: false,
    },
  },
  {
    // 侧边导航：整棵树常驻左列（菜单必须看得见，不再是收起的抽屉）
    mode: 'side-nav',
    expected: {
      headerLead: 'logo',
      headerNavVisible: false,
      sidebarMenus: TOP_TITLES,
      sidebarPresentation: 'inline',
      sidebarVisible: true,
    },
  },
  {
    // 混合垂直：顶栏一级 + 侧栏二级及以下
    mode: 'mixed-vertical',
    expected: {
      headerLead: 'logo',
      headerNavVisible: true,
      navRailVisible: false,
      navTracksLeaf: false,
      sidebarMenus: ['用户管理', '操作日志'],
      sidebarVisible: true,
    },
  },
  {
    // 混合双列：顶栏一级 + 图标栏二级 + 侧栏三级
    mode: 'mixed-two-column',
    expected: {
      headerLead: 'logo',
      headerNavVisible: true,
      navRailVisible: true,
      railActiveKey: 'user',
      railMenus: ['用户管理', '操作日志'],
      sidebarMenus: ['用户列表', '岗位管理'],
      sidebarVisible: true,
    },
  },
  {
    // 内容全屏：外壳整体隐去，只留退出入口
    mode: 'full-content',
    expected: {
      chromeless: true,
      footerVisible: false,
      headerVisible: false,
      navRailVisible: false,
      sidebarMenus: [],
      sidebarVisible: false,
      tabsVisible: false,
    },
  },
];

describe('useShell —— 七种布局形态的区域开关', () => {
  it.each(REGION_MATRIX.map(({ expected, mode }) => [mode, expected]))(
    '%s 形态',
    async (mode, expected) => {
      const { regions } = await setupShell({ layout: mode });
      expectRegions(regions, expected);
    },
  );

  it('图标栏高亮按形态深度取值：一级形态看顶级，二级形态看链上的二级', async () => {
    const oneLevel = await setupShell({ layout: 'two-column' });
    expect(oneLevel.regions.railActiveKey.value).toBe('system');

    const twoLevel = await setupShell({ layout: 'mixed-two-column' });
    expect(twoLevel.regions.railActiveKey.value).toBe('user');
  });

  /**
   * 浮层抽屉只由窄屏触发。
   *
   * 侧边导航曾经直接配成抽屉，桌面端选中后菜单躲在一个默认收起的浮层里，
   * 看起来就是"侧边菜单没出现"；现在它是常驻列，只有视口过窄才升级成浮层。
   * `useMobile` 的 `isMobile` 是模块级共享状态（全站一份监听），
   * 所以改完 matchMedia 要手动同步一次，并在用例结束时还原，别污染后面的用例。
   */
  it('桌面宽度下主栏一律常驻，窄屏才升级成浮层抽屉', async () => {
    const { useLayout } = await import('../composables/useLayout');
    const desktop = await setupShell({ layout: 'side-nav' });
    expect(desktop.regions.sidebarPresentation.value).toBe('inline');
    expect(desktop.shell.overlaySidebar.value).toBe(false);

    const probe = (narrow: boolean) => {
      const original = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => ({
          addEventListener: vi.fn(),
          matches: narrow,
          removeEventListener: vi.fn(),
        })),
        writable: true,
      });
      // checkMobile 读的是模块级 isMobile，必须在 effect scope 里调，
      // 否则 useMobile 的 onScopeDispose 会告警
      const scope = effectScope();
      scope.run(() => useLayout().checkMobile());
      scope.stop();
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: original,
        writable: true,
      });
    };

    probe(true);
    expect(desktop.shell.overlaySidebar.value).toBe(true);

    probe(false);
    expect(desktop.shell.overlaySidebar.value).toBe(false);
  });

  it('标签页放大等价于临时内容全屏：外壳区域全收，标签栏保留', async () => {
    const { regions } = await setupShell({ layout: 'two-column', maximized: true });
    expectRegions(regions, {
      chromeless: false,
      footerVisible: false,
      headerVisible: false,
      navRailVisible: false,
      sidebarVisible: false,
      tabsVisible: true,
    });
  });

  it('混合垂直在当前一级没有子菜单时不挂侧栏（保留旧行为）', async () => {
    const withChildren = await setupShell({ layout: 'mixed-vertical' });
    expect(withChildren.regions.sidebarVisible.value).toBe(true);

    const leafOnly = await setupShell({ layout: 'mixed-vertical', routeName: 'about' });
    expect(leafOnly.regions.sidebarVisible.value).toBe(false);
    expect(leafOnly.regions.headerNavVisible.value).toBe(true);
  });

  it('顶栏精准选中：水平布局拿到叶子 key，其余形态只有一级 key', async () => {
    const horizontal = await setupShell({ layout: 'horizontal' });
    expect(horizontal.shell.source.activeLeafKey.value).toBe('user-list');
    expect(horizontal.shell.source.activeTopKey.value).toBe('system');

    const vertical = await setupShell({ layout: 'vertical' });
    expect(vertical.shell.source.activeLeafKey.value).toBe('user-list');
    expect(vertical.regions.navTracksLeaf.value).toBe(false);
  });

  it('隐藏菜单不进任何区域，换路由时区域数据源实时跟随', async () => {
    const { regions, routeStore } = await setupShell({ layout: 'vertical' });
    routeStore.menus = [
      ...MENUS,
      { hidden: true, name: 'secret', title: '隐藏项' },
    ] as MenuConfig[];
    await nextTick();
    expect(regions.sidebarMenus.value.map((menu) => menu.title)).toEqual(TOP_TITLES);
  });
});

describe('useShell —— 内容区样式', () => {
  it('流式内容占满宽度，定宽内容居中并受 max-width 约束', async () => {
    const { appStore, shell } = await setupShell({ layout: 'vertical' });

    appStore.updateSetting({ contentMode: 'full' });
    await nextTick();
    expect(shell.contentStyle.value).toEqual({ width: '100%' });

    appStore.updateSetting({ contentMode: 'fixed', contentWidth: 1200 });
    await nextTick();
    expect(shell.contentStyle.value).toEqual({
      marginInline: 'auto',
      maxWidth: '1200px',
      width: '100%',
    });
  });

  it('放大态下即便设置了定宽也把宽度还给内容区', async () => {
    const { appStore, shell, tabsStore } = await setupShell({
      layout: 'vertical',
      maximized: true,
    });
    appStore.updateSetting({ contentMode: 'fixed', contentWidth: 1000 });
    await nextTick();
    expect(tabsStore.isMaximized).toBe(true);
    expect(shell.contentStyle.value).toEqual({ width: '100%' });
  });

  it('定宽超出允许区间时按边界夹紧', async () => {
    const { appStore, shell } = await setupShell({ layout: 'vertical' });
    appStore.updateSetting({ contentMode: 'fixed', contentWidth: 10_000 });
    await nextTick();
    expect(shell.contentStyle.value.maxWidth).toBe('1600px');
  });

  it('旧的 mixed / split-vertical 偏好读进来会归一到新形态名', async () => {
    const legacy = await setupShell({ layout: 'mixed' as LayoutMode });
    expect(legacy.regions.headerNavVisible.value).toBe(true);
    expect(legacy.regions.navRailVisible.value).toBe(false);

    const split = await setupShell({ layout: 'split-vertical' as LayoutMode });
    expect(split.regions.navRailVisible.value).toBe(true);
    expect(split.regions.headerLead.value).toBe('breadcrumb');
  });

  it('未知形态名退回垂直布局而不是白屏', async () => {
    const { regions } = await setupShell({ layout: 'nope' as LayoutMode });
    expect(regions.headerLead.value).toBe('breadcrumb');
    expect(regions.sidebarVisible.value).toBe(true);
  });
});
