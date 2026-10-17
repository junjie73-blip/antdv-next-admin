import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import LayoutShell from '../src/layout.vue';
import { configureLayout } from '../src/layout';
import { menuTree, regions } from './fixtures';

const mounted: Array<{ unmount: () => void }> = [];

function mountShell(
  regionOverrides: Parameters<typeof regions>[0] = {},
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  const wrapper = mount(LayoutShell, {
    attachTo: document.body,
    props: { regions: regions(regionOverrides), ...props },
    slots,
  });
  mounted.push(wrapper);
  return wrapper;
}

const siderProps = { menus: menuTree, title: '控制台' };
const railProps = { menus: menuTree };
const navProps = { menus: menuTree };
/**
 * 面包屑组件住在 `@antdv/layouts`，外壳只给出落脚点。
 * 这里用一段带 `data-layout-region` 的替身，验证的是"壳把插槽放在哪一行、
 * 传的是哪一档 variant"，面包屑自己的显隐与链接由装配层的用例覆盖。
 */
const breadcrumbSlot =
  '<div data-layout-region="breadcrumb" :data-variant="variant" :class="variant === \'content\' ? \'h-9\' : \'\'"></div>';

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
  configureLayout({ t: (key: string) => key });
});

describe('LayoutShell - 顶栏住在哪一行', () => {
  it('headerLead=logo 时顶栏横贯全宽，面包屑退到内容列第一行', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        headerNavVisible: true,
      }),
      { nav: navProps, title: '控制台' },
      { breadcrumb: breadcrumbSlot },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-shell="header-full"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-layout-shell="header-column"]').exists()).toBe(
      false,
    );
    // 独立成行的那一档：外壳把 variant=content 交给插槽
    const row = wrapper.find('[data-layout-region="breadcrumb"]');
    expect(row.attributes('data-variant')).toBe('content');
    expect(row.classes()).toContain('h-9');
  });

  it('headerLead=breadcrumb 时顶栏嵌在内容列里，面包屑住在顶栏那一行', async () => {
    const wrapper = mountShell(
      regions({
        headerVisible: true,
        sidebarVisible: true,
      }),
      { sider: siderProps },
      { breadcrumb: breadcrumbSlot },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-shell="header-column"]').exists()).toBe(
      true,
    );
    const header = wrapper.find('[data-layout-shell="header-column"]');
    expect(header.find('[data-layout-region="breadcrumb"]').exists()).toBe(
      true,
    );
    expect(
      header
        .find('[data-layout-region="breadcrumb"]')
        .attributes('data-variant'),
    ).toBe('header');
    // 不再另起一行
    expect(header.classes()).not.toContain('h-9');
  });

  it('headerVisible 关掉时两处顶栏都不出现', () => {
    expect(
      mountShell(regions(), {}, { breadcrumb: breadcrumbSlot })
        .find('[data-layout-region="header"]')
        .exists(),
    ).toBe(false);
  });

  /**
   * 侧边导航这类形态：Logo 在顶栏，菜单整棵树在左列。
   * 使用方仍会把顶栏那份 `nav` 数据传进来（它同时是菜单数据的载体），
   * 所以这根柱只能由蓝图的 `headerNavVisible` 决定，不能看 menus 空不空。
   */
  it('headerNavVisible=false 时即便传了 nav 也不渲染横向导航柱', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerNavVisible: false,
        headerVisible: true,
        sidebarVisible: true,
      }),
      { nav: navProps, sider: siderProps, title: '控制台' },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-region="header-nav"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-layout-logo="header"]').exists()).toBe(true);
    expect(wrapper.find('[data-layout-region="sidebar"]').exists()).toBe(true);
  });

  it('没有面包屑插槽时不渲染面包屑行，Logo 形态的顶栏照常', () => {
    const wrapper = mountShell(
      regions({ headerLead: 'logo', headerVisible: true }),
      { title: '控制台' },
    );
    expect(wrapper.find('[data-layout-region="breadcrumb"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-layout-logo="header"]').exists()).toBe(true);
  });
});

describe('LayoutShell - 三列的嵌套顺序', () => {
  it('图标栏、侧栏、内容列是同一行的兄弟节点', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'breadcrumb',
        headerVisible: true,
        navRailVisible: true,
        sidebarVisible: true,
      }),
      { rail: railProps, sider: siderProps },
    );
    await nextTick();
    const rail = wrapper.find('[data-layout-region="nav-rail"]');
    const sider = wrapper.find('[data-layout-region="sidebar"]');
    const content = wrapper.find('[data-layout-region="content"]');
    expect(rail.exists()).toBe(true);
    expect(sider.exists()).toBe(true);
    // 图标栏与侧栏同父，父节点是那一行横向 flex；内容列是它的第三个孩子
    const row = rail.element.parentNode as Element;
    expect(sider.element.parentNode).toBe(row);
    expect(row.children).toHaveLength(3);
    expect(row.lastElementChild?.contains(content.element)).toBe(true);
  });

  it('只有图标栏时侧栏让位，内容列仍然满宽跟随', () => {
    const wrapper = mountShell(regions({ navRailVisible: true }), {
      rail: railProps,
    });
    expect(wrapper.find('[data-layout-region="nav-rail"]').exists()).toBe(true);
    expect(wrapper.find('[data-layout-region="sidebar"]').exists()).toBe(false);
  });

  it('rail 数据没给时不渲染空图标栏', () => {
    const wrapper = mountShell(regions({ navRailVisible: true }), {
      sider: siderProps,
    });
    expect(wrapper.find('[data-layout-region="nav-rail"]').exists()).toBe(
      false,
    );
  });
});

describe('LayoutShell - 常驻侧栏与浮层的互斥', () => {
  it('overlaySidebar 时常驻那一列消失，抽屉改由遮罩 + 面板承载', async () => {
    const wrapper = mountShell(
      regions({
        headerVisible: true,
        overlaySidebar: true,
        sidebarVisible: true,
      }),
      { overlayOpen: true, sider: siderProps },
    );
    await nextTick();
    const inline = wrapper
      .findAll('[data-layout-region="sidebar"]')
      .filter(
        (node) => node.attributes('data-layout-sider-overlay') === 'false',
      );
    expect(inline).toHaveLength(0);
    expect(document.body.querySelector('[data-layout-overlay]')).not.toBeNull();
    const panel = document.body.querySelector('[data-layout-overlay-panel]');
    expect(
      panel?.querySelector('[data-layout-region="sidebar"]'),
    ).not.toBeNull();
  });

  it('浮层形态下图标栏也一起让位（同一时间只有一列菜单）', () => {
    const wrapper = mountShell(
      regions({
        navRailVisible: true,
        overlaySidebar: true,
        sidebarVisible: true,
      }),
      { rail: railProps },
    );
    expect(wrapper.find('[data-layout-region="nav-rail"]').exists()).toBe(
      false,
    );
  });

  it('overlayOpen=false 时浮层不出现，但常驻列也不出现', () => {
    mountShell(regions({ overlaySidebar: true, sidebarVisible: true }), {
      overlayOpen: false,
      sider: siderProps,
    });
    expect(document.body.querySelector('[data-layout-overlay]')).toBeNull();
  });

  it('点遮罩把开合交回使用方', async () => {
    const wrapper = mountShell(
      regions({ overlaySidebar: true, sidebarVisible: true }),
      { overlayOpen: true, sider: siderProps },
    );
    document.querySelector<HTMLElement>('[data-layout-overlay-mask]')?.click();
    await nextTick();
    expect(wrapper.emitted('update:overlayOpen')?.[0]).toEqual([false]);
  });
});

describe('LayoutShell - 侧栏触发按钮的位置', () => {
  it('常驻侧栏在场时顶栏不再重复一个入口（折叠条住在列底）', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        sidebarVisible: true,
      }),
      { nav: navProps, sider: siderProps },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-sidebar-trigger]').exists()).toBe(false);
    expect(wrapper.find('[data-layout-sidebar-collapse]').exists()).toBe(true);
  });

  it('浮层形态下入口回到顶栏，图标反映抽屉开合', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        overlaySidebar: true,
        sidebarVisible: true,
      }),
      { nav: navProps, overlayOpen: false, sider: siderProps },
    );
    await nextTick();
    const trigger = wrapper.find('[data-layout-sidebar-trigger]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes('aria-label')).toBe('header.expandMenu');
    await wrapper.setProps({ overlayOpen: true });
    expect(
      wrapper.find('[data-layout-sidebar-trigger]').attributes('aria-label'),
    ).toBe('header.collapseMenu');
  });

  it('只剩图标栏、侧栏因空分区让位时，入口也在顶栏', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        navRailVisible: true,
      }),
      { nav: navProps, rail: railProps },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-sidebar-trigger]').exists()).toBe(true);
  });

  it('点顶栏入口发 toggleSidebar', async () => {
    const wrapper = mountShell(
      regions({
        headerVisible: true,
        overlaySidebar: true,
        sidebarVisible: true,
      }),
      { sider: siderProps },
    );
    await nextTick();
    await wrapper.find('[data-layout-sidebar-trigger]').trigger('click');
    expect(wrapper.emitted('toggleSidebar')).toHaveLength(1);
  });
});

describe('LayoutShell - 品牌位只出现一次', () => {
  it('图标栏在场时侧栏不再画 Logo', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'breadcrumb',
        headerVisible: true,
        navRailVisible: true,
        sidebarVisible: true,
      }),
      { logo: '/logo.svg', rail: railProps, sider: siderProps },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-logo="rail"]').exists()).toBe(true);
    expect(wrapper.find('[data-layout-logo="sidebar"]').exists()).toBe(false);
  });

  it('顶栏带 Logo 的形态下侧栏也不画 Logo', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        sidebarVisible: true,
      }),
      { logo: '/logo.svg', sider: siderProps },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-logo="header"]').exists()).toBe(true);
    expect(wrapper.find('[data-layout-logo="sidebar"]').exists()).toBe(false);
  });

  it('垂直形态（Logo 不在顶栏也不在图标栏）时侧栏自己画', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'breadcrumb',
        headerVisible: true,
        sidebarVisible: true,
      }),
      { logo: '/logo.svg', sider: siderProps },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-logo="sidebar"]').exists()).toBe(true);
  });

  it('使用方显式传 showLogo 时以它为准', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'breadcrumb',
        headerVisible: true,
        navRailVisible: true,
        sidebarVisible: true,
      }),
      {
        logo: '/logo.svg',
        rail: railProps,
        sider: { ...siderProps, showLogo: true },
      },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-logo="sidebar"]').exists()).toBe(true);
  });
});

describe('LayoutShell - 标签页、底栏与沉浸视角', () => {
  it('tabsVisible 决定标签页插槽是否落在内容列里，并给出 tabs 区域钩子', () => {
    const on = mountShell(
      regions({ tabsVisible: true }),
      {},
      { tabs: '<div data-mark="tabs">tabs</div>' },
    );
    expect(on.find('[data-mark="tabs"]').exists()).toBe(true);
    // 这一行的 DOM 契约与其余区域同源（此前只能靠 .tab-bar 这个内部类名定位）
    expect(on.find('[data-layout-region="tabs"]').exists()).toBe(true);
    const off = mountShell(
      regions({ tabsVisible: false }),
      {},
      { tabs: '<div data-mark="tabs">tabs</div>' },
    );
    expect(off.find('[data-mark="tabs"]').exists()).toBe(false);
    expect(off.find('[data-layout-region="tabs"]').exists()).toBe(false);
  });

  it('底栏可见性由区域开关决定', () => {
    const withFooter = mountShell(regions({ footerVisible: true }), {
      footer: { year: 2026 },
    });
    expect(withFooter.find('[data-layout-region="footer"]').exists()).toBe(
      true,
    );
    expect(withFooter.text()).toContain('2026');
    expect(
      mountShell(regions()).find('[data-layout-region="footer"]').exists(),
    ).toBe(false);
  });

  it('内容全屏（chromeless）时只剩内容区与退出入口', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        shellHidden: true,
      }),
      { nav: navProps, rail: railProps, sider: siderProps },
      { tabs: '<div data-mark="tabs">tabs</div>' },
    );
    await nextTick();
    // 顶栏由壳自己按 shellHidden 拦住，图标栏/侧栏/底栏/标签页由区域开关让位
    expect(wrapper.find('[data-layout-region="header"]').exists()).toBe(false);
    expect(wrapper.find('[data-layout-region="nav-rail"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-layout-region="sidebar"]').exists()).toBe(false);
    expect(wrapper.find('[data-layout-region="footer"]').exists()).toBe(false);
    expect(wrapper.find('[data-mark="tabs"]').exists()).toBe(false);
    expect(document.body.querySelector('[data-layout-overlay]')).toBeNull();
    expect(wrapper.find('[data-layout-region="content"]').exists()).toBe(true);
    // 沉浸视角不留内边距：深色大屏四周不该被围出一圈白边（padding 挂在滚动视图上）
    expect(wrapper.find('.scrollbar__view').classes()).not.toContain('p-4');
    expect(
      wrapper.find('[data-layout-exit-full]').attributes('aria-label'),
    ).toBe('shell.exitFullContent');
  });

  it('标签页放大时标签栏留在原位，好让用户能点回来', () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        shellHidden: true,
        tabsVisible: true,
      }),
      { maximized: true, sider: siderProps },
      { tabs: '<div data-mark="tabs">tabs</div>' },
    );
    expect(wrapper.find('[data-mark="tabs"]').exists()).toBe(true);
    expect(wrapper.find('[data-layout-region="header"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-layout-exit-full]').attributes('aria-label'),
    ).toBe('shell.restoreTabs');
  });

  it('点退出入口发 exit', async () => {
    const wrapper = mountShell(regions({ shellHidden: true }));
    await wrapper.find('[data-layout-exit-full]').trigger('click');
    expect(wrapper.emitted('exit')).toHaveLength(1);
  });

  it('注入 locale 后退出入口跟着换文案', () => {
    configureLayout({ t: (key) => `tr:${key}` });
    const wrapper = mountShell(regions({ shellHidden: true }));
    expect(wrapper.find('[data-layout-exit-full]').text()).toBe(
      'tr:shell.exitFullContent',
    );
  });
});

describe('LayoutShell - 事件上抛', () => {
  it('侧栏、图标栏、顶栏导航的点击统一成 navigate(key)', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerNavVisible: true,
        headerVisible: true,
        navRailVisible: true,
        sidebarVisible: true,
      }),
      {
        nav: {
          menus: [{ name: 'Analysis', path: '/analysis', title: '分析面板' }],
        },
        rail: railProps,
        sider: siderProps,
      },
    );
    await nextTick();
    await wrapper
      .find('[data-rail-item][data-menu-key="System"]')
      .trigger('click');
    await wrapper
      .find('[data-layout-region="sidebar"] [data-menu-key="Analysis"]')
      .trigger('click');
    await wrapper
      .find('[data-layout-region="header-nav"] [data-menu-key="Analysis"]')
      .trigger('click');
    const keys = (wrapper.emitted('navigate') ?? []).map(
      (args) => args[0] as string,
    );
    expect(keys).toEqual(['System', 'Analysis', 'Analysis']);
  });

  it('侧栏折叠与展开集的变化原样转给使用方', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'breadcrumb',
        headerVisible: true,
        sidebarVisible: true,
      }),
      { sider: siderProps },
    );
    await nextTick();
    await wrapper.find('[data-layout-sidebar-collapse]').trigger('click');
    expect(wrapper.emitted('toggleCollapse')).toHaveLength(1);
    await wrapper
      .find('[data-layout-region="sidebar"] [data-menu-key="System"]')
      .trigger('click');
    expect(wrapper.emitted('update:openKeys')?.at(-1)?.[0]).toContain('System');
  });
});

describe('LayoutShell - 配色与插槽的分发', () => {
  it('同一份 tone 发给各区域，深色侧栏偏好只影响左那一列', async () => {
    const wrapper = mountShell(
      regions({
        headerLead: 'logo',
        headerVisible: true,
        sidebarVisible: true,
      }),
      { sider: siderProps, tone: { sidebarDark: true } },
    );
    await nextTick();
    expect(wrapper.find('[data-layout-region="sidebar"]').classes()).toContain(
      'bg-gray-900',
    );
    expect(wrapper.find('[data-layout-region="header"]').classes()).toContain(
      'bg-white',
    );
  });

  it('内容、工具区、用户区、内容遮罩都落在该落的那一行', async () => {
    const wrapper = mountShell(
      regions({ headerLead: 'logo', headerVisible: true }),
      {},
      {
        default: '<div data-mark="page">正文</div>',
        'content-overlay': '<div data-mark="mask">加载</div>',
        tools: '<button data-mark="tools">工具</button>',
        user: '<span data-mark="user">我</span>',
      },
    );
    await nextTick();
    expect(wrapper.find('[data-mark="page"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-layout-region="content"]')
        .find('[data-mark="mask"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[data-layout-region="header"]')
        .find('[data-mark="tools"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[data-layout-region="header"]')
        .find('[data-mark="user"]')
        .exists(),
    ).toBe(true);
  });
});
