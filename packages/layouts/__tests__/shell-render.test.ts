import type { LayoutMode } from '../src';
import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { configureLayout } from '@antdv/layout-ui';
import { useAppStore, useRouteStore, useTabsStore } from '@antdv/stores';

import BasicLayout from '../src/basic/layout.vue';

/**
 * 本包不 import vue-i18n，文案一律来自 `configureLayout` 注入的 `t`。
 * 用例断言的是中文 aria-label，所以这里自备一张最小表；
 * 没登记的键会原样返回 key（layout-ui 的默认实现），一眼能看出漏了哪个。
 */
configureLayout({
  t: (key) =>
    (
      ({
        'shell.exitFullContent': '退出内容全屏',
        'shell.restoreTabs': '还原标签页',
      }) as Record<string, string>
    )[key] ?? key,
});

/**
 * 外壳模板的真机渲染测试。
 *
 * `shell.test.ts` 验证"区域开关算得对不对"，`@antdv/layout-ui` 自己的用例验证
 * "壳按开关画 DOM"，这里验证中间那一环：**store 里的偏好有没有接到壳上**。
 * 直接挂载 `BasicLayout`，按形态断言 DOM 里出现/缺席的区域、
 * 面包屑落在哪一行，以及内容全屏与标签页放大态下那个「退出」入口。
 *
 * 区域与小部件全部走真实渲染（`data-layout-region` 是包给出的稳定契约），
 * 只有宿主注入的顶栏插槽留空。
 */

const MENUS: MenuConfig[] = [
  {
    children: [
      {
        children: [
          { name: 'user-list', path: '/user-list', title: '用户列表' },
          { name: 'user-post', path: '/user-post', title: '岗位管理' },
        ],
        name: 'user',
        path: '',
        title: '用户管理',
      },
      { name: 'log', path: '/log', title: '操作日志' },
    ],
    name: 'system',
    path: '',
    title: '系统管理',
  },
  { name: 'about', path: '/about', title: '关于' },
];

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
      return () =>
        h(BasicLayout, { logo: 'logo.png', title: 'Antdv Next Admin' });
    },
  });

  await router.push('/user-list');
  await router.isReady();

  const wrapper = mount(Host, { global: { plugins: [pinia, router] } });
  mounted.push(wrapper);
  await flushPromises();

  return { ...captured, router, wrapper };
}

/**
 * 浮层侧栏走 Teleport，内容挂在 body 上而不在 wrapper 的子树里，
 * 所以判断"菜单进没进浮层"要直接查 document。
 * 常驻那一列在该形态下不渲染，因此 body 里出现的 sidebar 只可能来自浮层。
 */
function overlayState() {
  return {
    hasOverlay: !!document.querySelector('[data-layout-overlay]'),
    hasSidebarInBody: !!document.body.querySelector(
      '[data-layout-region="sidebar"]',
    ),
  };
}

/**
 * 区域 → 定位方式。
 *
 * 五个区域用 `@antdv/layout-ui` 给出的 `data-layout-region` 契约；
 * 标签栏来自 `@antdv/tabs-ui`，它自己的稳定钩子是根节点上的 `.tab-bar`
 * （标签栏容器没有语义化属性，靠 `.tab-list` 的父节点反查太脆）。
 */
const REGION_SELECTOR: Record<string, string> = {
  breadcrumb: '[data-layout-region="breadcrumb"]',
  footer: '[data-layout-region="footer"]',
  header: '[data-layout-region="header"]',
  'nav-rail': '[data-layout-region="nav-rail"]',
  sidebar: '[data-layout-region="sidebar"]',
  tabs: '.tab-bar',
};

function presentRegions(wrapper: {
  find: (selector: string) => { exists: () => boolean };
}) {
  return ['header', 'nav-rail', 'sidebar', 'tabs', 'footer'].filter((region) =>
    wrapper.find(REGION_SELECTOR[region] as string).exists(),
  );
}

/** 面包屑住在哪一行：顶栏里（垂直 / 双列），还是内容列第一行（Logo 系形态） */
function breadcrumbRow(wrapper: {
  find: (selector: string) => { exists: () => boolean };
}) {
  if (!wrapper.find(REGION_SELECTOR.breadcrumb as string).exists()) {
    return 'none';
  }
  return wrapper
    .find('[data-layout-region="header"] [data-layout-region="breadcrumb"]')
    .exists()
    ? 'header'
    : 'content';
}

/**
 * 卸载在前、清 body 兜底：浮层是 Teleport 出去的，直接 innerHTML='' 会让 Vue
 * 回收节点时报 "node to be removed is not a child of this node"。
 */
afterEach(async () => {
  while (mounted.length > 0) mounted.pop()!.unmount();
  await flushPromises();
  document.body.innerHTML = '';
});

describe('布局外壳渲染 —— 各形态的区域构成', () => {
  it('垂直：顶栏 + 侧栏 + 标签页 + 底栏，没有图标栏，面包屑在顶栏里', async () => {
    const { wrapper } = await mountLayout({ layout: 'vertical' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'sidebar',
      'tabs',
      'footer',
    ]);
    expect(breadcrumbRow(wrapper)).toBe('header');
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
    expect(breadcrumbRow(wrapper)).toBe('header');
  });

  it('水平：只剩顶栏，侧栏与图标栏都不占位，面包屑退到内容列首行', async () => {
    const { wrapper } = await mountLayout({ layout: 'horizontal' });
    expect(presentRegions(wrapper)).toEqual(['header', 'tabs', 'footer']);
    expect(breadcrumbRow(wrapper)).toBe('content');
  });

  it('混合双列：顶栏 + 图标栏 + 侧栏三列并存，面包屑同属顶栏外壳', async () => {
    const { wrapper } = await mountLayout({ layout: 'mixed-two-column' });
    expect(presentRegions(wrapper)).toEqual([
      'header',
      'nav-rail',
      'sidebar',
      'tabs',
      'footer',
    ]);
    expect(breadcrumbRow(wrapper)).toBe('content');
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
      'tabs',
      'footer',
    ]);
    expect(wrapper.find('[data-layout-region="nav-rail"]').exists()).toBe(
      false,
    );
    expect(appStore.sidebarOverlayOpen).toBe(false);
    // 常驻栏在文档流里，不该同时再从浮层门户长出一份
    expect(overlayState().hasSidebarInBody).toBe(false);
  });

  it('内容全屏：只剩内容区与退出入口', async () => {
    const { wrapper } = await mountLayout({ layout: 'full-content' });
    expect(presentRegions(wrapper)).toEqual([]);
    expect(breadcrumbRow(wrapper)).toBe('none');
    const exit = wrapper.get('button[aria-label="退出内容全屏"]');
    expect(exit.text()).toContain('退出内容全屏');
  });

  it('放大标签页：同样收起外壳，但按钮语义是还原', async () => {
    const { tabsStore, wrapper } = await mountLayout({ layout: 'vertical' });
    tabsStore.maximizedKey = 'user-list';
    await flushPromises();

    expect(presentRegions(wrapper)).toEqual(['tabs']);
    expect(wrapper.find('[data-layout-region="header"]').exists()).toBe(false);
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
  it('窄屏：常驻侧栏升级为浮层，切路由后自动收起', async () => {
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
      expect(wrapper.find('[data-layout-region="sidebar"]').exists()).toBe(
        false,
      );

      appStore.updateSetting({ sidebarOverlayOpen: true });
      await flushPromises();
      expect(overlayState()).toEqual({
        hasOverlay: true,
        hasSidebarInBody: true,
      });

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

  /**
   * 偏好里的显隐开关必须真的接到壳上：
   * 蓝图只回答"这种形态有没有标签栏 / 底栏"，`showTabs` / `showFooter` 是用户权利。
   */
  it('关掉标签页与底栏偏好后，对应区域从 DOM 里消失', async () => {
    const { appStore, wrapper } = await mountLayout({ layout: 'vertical' });
    appStore.updateSetting({ showFooter: false, showTabs: false });
    await flushPromises();

    expect(presentRegions(wrapper)).toEqual(['header', 'sidebar']);
  });

  it('定宽内容把 max-width 与居中绑到内容容器上', async () => {
    const { appStore, wrapper } = await mountLayout({ layout: 'vertical' });
    appStore.updateSetting({ contentMode: 'fixed', contentWidth: 1200 });
    await flushPromises();

    const style = wrapper
      .find('[data-layout-region="content"]')
      .attributes('style');
    expect(style).toContain('max-width: 1200px');
    expect(style).toContain('margin-inline: auto');
  });
});
