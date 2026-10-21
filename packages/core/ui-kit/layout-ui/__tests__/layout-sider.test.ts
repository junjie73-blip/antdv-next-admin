import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import LayoutSider from '../src/components/layout-sidebar/index.vue';
import {
  configureLayout,
  LAYOUT_DRAWER_WIDTH,
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
  LAYOUT_SIDEBAR_WIDTH,
} from '../src/layout';
import { menuTree } from './fixtures';

/**
 * BasicMenu 的浮层与滚动容器会往 body 上留东西，只 unmount 外壳不会清干净，
 * 于是统一登记后收尾卸载（与 menu-ui 的测试同一手法）。
 */
const mounted: Array<{ unmount: () => void }> = [];

function mountSider(props: Record<string, unknown> = {}) {
  const wrapper = mount(LayoutSider, {
    attachTo: document.body,
    props: { menus: menuTree, ...props },
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  configureLayout({ t: (key: string) => key });
});

describe('layoutSider - 宽度与折叠', () => {
  it('默认用偏好里的展开宽度', () => {
    expect(mountSider().attributes('style')).toContain(
      `width: ${LAYOUT_SIDEBAR_WIDTH}px`,
    );
  });

  it('折叠后只留图标栏宽度，并把状态写进数据钩子', () => {
    const wrapper = mountSider({ collapsed: true });
    expect(wrapper.attributes('style')).toContain(
      `width: ${LAYOUT_SIDEBAR_COLLAPSED_WIDTH}px`,
    );
    expect(wrapper.attributes('data-layout-sider-collapsed')).toBe('true');
  });

  it('自定义宽度优先于默认值', () => {
    expect(mountSider({ width: 260 }).attributes('style')).toContain(
      'width: 260px',
    );
  });

  it('浮层（抽屉）里永远展开且用抽屉宽度，不渲染底部折叠条', () => {
    const wrapper = mountSider({ collapsed: true, overlay: true });
    expect(wrapper.attributes('data-layout-sider-overlay')).toBe('true');
    expect(wrapper.attributes('data-layout-sider-collapsed')).toBe('false');
    expect(wrapper.attributes('style')).toContain(
      `width: ${LAYOUT_DRAWER_WIDTH}px`,
    );
    expect(wrapper.find('[data-layout-sidebar-collapse]').exists()).toBe(false);
  });

  it('点底部折叠条只发事件，折叠状态由使用方保管', async () => {
    const wrapper = mountSider();
    await wrapper.find('[data-layout-sidebar-collapse]').trigger('click');
    expect(wrapper.emitted('toggleCollapse')).toHaveLength(1);
    // 没传 collapsed=false 之外的 props，自己不会变成折叠态
    expect(wrapper.attributes('data-layout-sider-collapsed')).toBe('false');
  });

  it('折叠入口的文案说明"点了会变成什么"', () => {
    const bar = mountSider().find('[data-layout-sidebar-collapse]');
    expect(bar.attributes('aria-label')).toBe('header.collapseMenu');
    expect(bar.attributes('aria-expanded')).toBe('true');
    expect(
      mountSider({ collapsed: true })
        .find('[data-layout-sidebar-collapse]')
        .attributes('aria-label'),
    ).toBe('header.expandMenu');
  });

  it('注入 locale 后同一句文案换成真翻译', () => {
    configureLayout({ t: (key) => `tr:${key}` });
    expect(
      mountSider()
        .find('[data-layout-sidebar-collapse]')
        .attributes('aria-label'),
    ).toBe('tr:header.collapseMenu');
  });
});

describe('layoutSider - Logo 位', () => {
  it('showLogo 关掉时整格不渲染，避免与图标栏/顶栏重复占高', () => {
    expect(
      mountSider({ logo: '/logo.svg', showLogo: false, title: '控制台' })
        .find('[data-layout-logo="sidebar"]')
        .exists(),
    ).toBe(false);
  });

  it('既没有 logo 也没有 title 时没有内容可放，整格让位', () => {
    expect(mountSider().find('[data-layout-logo="sidebar"]').exists()).toBe(
      false,
    );
  });

  it('展开显示标题，折叠只剩图标', async () => {
    const wrapper = mountSider({ title: '控制台' });
    expect(wrapper.find('[data-layout-logo="sidebar"]').text()).toContain(
      '控制台',
    );
    await wrapper.setProps({ collapsed: true });
    await nextTick();
    expect(wrapper.find('[data-layout-logo="sidebar"]').text()).not.toContain(
      '控制台',
    );
  });
});

describe('layoutSider - 菜单交互', () => {
  it('叶子点击向上抛 navigate，key 与菜单同源', async () => {
    const wrapper = mountSider({
      menus: [{ name: 'Analysis', path: '/analysis', title: '分析面板' }],
    });
    await nextTick();
    const item = wrapper.find('[data-menu-key="Analysis"]');
    expect(item.exists()).toBe(true);
    await item.trigger('click');
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['Analysis']);
  });

  it('展开集是受控的：子树开合只发 update:openKeys', async () => {
    const wrapper = mountSider();
    await nextTick();
    const submenu = wrapper
      .findAll('[data-menu-key]')
      .find((node) => node.attributes('data-menu-key') === 'System');
    await submenu?.trigger('click');
    const emitted = wrapper.emitted('update:openKeys');
    expect(emitted).toBeTruthy();
    expect(emitted?.at(-1)?.[0]).toContain('System');
    // 包内不自己记状态：没传 openKeys 时下一帧仍然按 props 渲染
    expect(wrapper.props('openKeys')).toEqual([]);
  });

  it('深色侧栏偏好把菜单切成 dark 主题', () => {
    const wrapper = mountSider({ tone: { sidebarDark: true } });
    expect(wrapper.html()).toContain('data-menu-theme="dark"');
  });
});
