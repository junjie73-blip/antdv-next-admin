import type { LayoutMode } from '@antdv/layouts';
import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '~/stores/modules/app';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

import DefaultLayout from '../index.vue';

/**
 * 外壳模板的真机渲染测试。
 *
 * `shell.spec.ts` 验证"区域开关算得对不对"，这里验证"开关有没有真的接到模板上"：
 * 直接挂载 `layouts/index.vue`，按形态断言 DOM 里出现/缺席的区域，
 * 以及内容全屏与标签页放大态下那个「退出」入口。
 */

const MENUS: MenuConfig[] = [
  {
    children: [
      {
        children:
          [
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
  { name: 'about', title: '关于' },
];

const regionStub = (region: string) =>
  defineComponent({
    name: `Stub_${region}`,
    setup: (_, { slots }) => () =>
      h('div', { 'data-region': region }, slots.default?.()),
  });

/**
 * 外壳的子组件各有十几层依赖（图标、抽屉、滚动条、设置面板…），
 * 这里只关心"该形态下这一列渲染了没有"，所以全部换成占位桩；
 * 真身各自的渲染另有测试，混在一起只会让失败原因难以判断。
 * `Icon` 在应用里由 main.ts 全局注册，测试环境补一个桩免掉解析告警。
 */
const STUBS: Record<string, unknown> = {
  Icon: defineComponent({
    name: 'StubIcon',
    props: { icon: { default: '', type: String } },
    setup: () => () => h('i', { 'data-icon': 'stub' }),
  }),
  LayoutBreadcrumb: regionStub('breadcrumb'),
  LayoutFooter: regionStub('footer'),
  LayoutHeader: regionStub('header'),
  LayoutNavRail: regionStub('nav-rail'),
  LayoutSidebar: regionStub('sidebar'),
  LayoutTabs: regionStub('tabs'),
  PageLoading: regionStub('page-loading'),
  PageTransition: defineComponent({
    name: 'StubPageTransition',
    setup: (_, { slots }) => () => h('div', slots.default?.()),
  }),
  RouteLoadingBar: defineComponent({
    name: 'StubRouteLoadingBar',
    setup: () => () => null,
  }),
};

/** mount 时 onMounted 会去拉字典，测试环境没有后端，桩掉避免 401 冒泡成未处理拒绝 */
vi.mock('~/stores', () => ({
  useDictStore: () => ({ fetchAllDicts: vi.fn() }),
}));

interface Captured {
  appStore: ReturnType<typeof useAppStore>;
  tabsStore: ReturnType<typeof useTabsStore>;
}

const mounted: { unmount: () => void }[] = [];

async function mountLayout(options: { layout?: LayoutMode } = {}) {
  const blank = { render: () => h('div', 'page') };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: blank, name: 'dashboard', path: '/' },
      ...['about', 'log', 'user-list', 'user-post'].map((name) => ({
        component: blank,
        name,
        path: `/${name}`,
      })),
    ],
  });
  const pinia = createPinia();
  setActivePinia(pinia);

  let captured!: Captured;
  /**
   * store 必须在 setup 上下文里取：app store 内部会 `theme.useToken()`，
   * 而 useToken 依赖 inject 拿 ConfigProvider，脱离组件作用域就是 undefined。
   */
  const Host = defineComponent({
    setup() {
      const appStore = useAppStore();
      const tabsStore = useTabsStore();
      useRouteStore().menus = MENUS;
      appStore.updateSetting({ layout: options.layout ?? 'vertical' });
      captured = { appStore, tabsStore };
      return () => h(DefaultLayout);
    },
  });

  await router.push('/user-list');
  await router.isReady();

  const wrapper = mount(Host, {
    global: { plugins: [pinia, router], stubs: STUBS as never },
  });
  mounted.push(wrapper);
  await flushPromises();

  return { ...captured, router, wrapper };
}

/**
 * 抽屉的内容走 Teleport 挂到 body 上，不在 wrapper 的子树里，
 * 所以判断"菜单进没进抽屉"要直接查 document。
 * 常驻侧栏在该形态下不渲染，因此 body 里出现的 sidebar 只可能来自抽屉。
 */
function drawerState() {
  return {
    hasDrawer: !!document.querySelector('[class*=drawer]'),
    hasSidebarInBody: !!document.body.querySelector('[data-region=sidebar]'),
  };
}

function presentRegions(wrapper: {
  find: (selector: string) => { exists: () => boolean };
}) {
  return [
    'header',
    'nav-rail',
    'sidebar',
    'breadcrumb',
    'tabs',
    'footer',
  ].filter((region) => wrapper.find(`[data-region="${region}"]`).exists());
}

/**
 * 卸载在前、清 body 兜底：抽屉是 Teleport 出去的，直接 innerHTML='' 会让 Vue
 * 回收节点时报 "node to be removed is not a child of this node"。
 */
afterEach(async () => {
  while (mounted.length) mounted.pop()!.unmount();
  await flushPromises();
  document.body.innerHTML = '';
});

describe('布局外壳渲染 —— 各形态的区域构成', () => {
  it('垂直：顶栏 + 侧栏 + 标签页 + 底栏，没有图标栏', async () => {
    const { wrapper } = await mountLayout({ layout: 'vertical' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'sidebar',
      'tabs',
      'footer',
    ]);
  });

  it('双列菜单：多一列图标栏，侧栏仍在', async () => {
    const { wrapper } = await mountLayout({ layout: 'two-column' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'nav-rail',
      'sidebar',
      'tabs',
      'footer',
    ]);
  });

  it('水平：只剩顶栏，侧栏与图标栏都不占位，面包屑退到内容列首行', async () => {
    const { wrapper } = await mountLayout({ layout: 'horizontal' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'breadcrumb',
      'tabs',
      'footer',
    ]);
  });

  it('混合双列：顶栏 + 图标栏 + 侧栏三列并存，面包屑同属顶栏外壳', async () => {
    const { wrapper } = await mountLayout({ layout: 'mixed-two-column' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'nav-rail',
      'sidebar',
      'breadcrumb',
      'tabs',
      'footer',
    ]);
  });

  /**
   * 侧边导航曾经配成"浮层抽屉 + 默认收起"，选中后左列是空的，
   * 看起来就像菜单没出现。现在它必须与垂直一样常驻渲染。
   */
  it('侧边导航：整棵菜单常驻左列，图标栏缺席', async () => {
    const { appStore, wrapper } = await mountLayout({ layout: 'side-nav' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'sidebar',
      'breadcrumb',
      'tabs',
      'footer',
    ]);
    expect(wrapper.find('[data-region=nav-rail]').exists()).toBe(false);
    expect(appStore.sidebarOverlayOpen).toBe(false);
    // 常驻栏在文档流里，不该同时再从抽屉门户长出一份
    expect(drawerState().hasSidebarInBody).toBe(false);
  });

  it('内容全屏：只剩内容区与退出入口', async () => {
    const { wrapper } = await mountLayout({ layout: 'full-content' });
    expect(presentRegions(wrapper)).toEqual([]);
    const exit = wrapper.get('button[aria-label="退出内容全屏"]');
    expect(exit.text()).toContain('退出内容全屏');
  });

  it('放大标签页：同样收起外壳，但按钮语义是还原', async () => {
    const { tabsStore, wrapper } = await mountLayout({ layout: 'vertical' });
    tabsStore.maximizedKey = 'user-list';
    await flushPromises();

    expect(presentRegions(wrapper)).toEqual(['tabs']);
    expect(wrapper.find('[data-region=header]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="还原标签页"]').exists()).toBe(true);
  });

  it('退出内容全屏会回到进入之前的形态，而不是重置成垂直', async () => {
    const { appStore, wrapper } = await mountLayout({ layout: 'two-column' });
    appStore.updateSetting({ layout: 'full-content' });
    await flushPromises();

    wrapper.get('button[aria-label="退出内容全屏"]').trigger('click');
    await flushPromises();
    expect(appStore.layout).toBe('two-column');
  });

  /**
   * 浮层抽屉现在只由视口决定：手机尺寸再常驻一栏 210px，内容区基本没法用。
   *
   * `useMobile` 在第一次注册监听时读 `matchMedia`，而每个用例卸载后监听计数归零，
   * 下一次挂载会重新注册 —— 所以想让它判定为窄屏，必须在 mount 之前换掉 matchMedia，
   * 并在用例结束后还原，免得把"窄屏"留给后面的用例。
   */
  it('窄屏：常驻侧栏升级为抽屉，切路由后自动收起', async () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: true,
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    try {
      const { appStore, router, wrapper } = await mountLayout({
        layout: 'vertical',
      });
      expect(wrapper.find('[data-region=sidebar]').exists()).toBe(false);

      appStore.updateSetting({ sidebarOverlayOpen: true });
      await flushPromises();
      expect(drawerState()).toEqual({ hasDrawer: true, hasSidebarInBody: true });

      await router.push('/about');
      await flushPromises();
      expect(appStore.sidebarOverlayOpen).toBe(false);
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: original,
        writable: true,
      });
    }
  });

  it('定宽内容把 max-width 与居中绑到内容容器上', async () => {
    const { appStore, wrapper } = await mountLayout({ layout: 'vertical' });
    appStore.updateSetting({ contentMode: 'fixed', contentWidth: 1200 });
    await flushPromises();

    const styled = wrapper
      .findAll('.ant-layout-content')
      .map((node) => node.attributes('style') ?? '')
      .find((style) => style.includes('max-width'));
    expect(styled).toContain('max-width: 1200px');
    expect(styled).toContain('margin-inline: auto');
  });
});
