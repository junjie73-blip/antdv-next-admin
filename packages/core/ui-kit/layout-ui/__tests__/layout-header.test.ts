import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import LayoutHeader from '../src/components/layout-header/index.vue';
import { configureLayout, LAYOUT_HEADER_ROW_STYLE } from '../src/layout';
import { menuTree } from './fixtures';

const mounted: Array<{ unmount: () => void }> = [];

function mountHeader(props: Record<string, unknown> = {}) {
  const wrapper = mount(LayoutHeader, {
    attachTo: document.body,
    props,
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  configureLayout({ t: (key: string) => key });
});

describe('LayoutHeader - 形态由 lead 决定', () => {
  it('lead=breadcrumb：左侧留给面包屑，不出现 Logo 与横向导航', () => {
    const wrapper = mountHeader({
      lead: 'breadcrumb',
      nav: { menus: menuTree },
    });
    expect(wrapper.find('[data-layout-logo="header"]').exists()).toBe(false);
    expect(wrapper.find('[data-layout-region="header-nav"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-layout-region="header"]').exists()).toBe(true);
  });

  it('lead=logo：品牌位在场，导航有数据才渲染', async () => {
    const wrapper = mountHeader({
      lead: 'logo',
      nav: { menus: menuTree },
      title: '控制台',
    });
    await nextTick();
    expect(wrapper.find('[data-layout-logo="header"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('控制台');
    // 导航区域挂在容器上而不是菜单根节点：箭头与渐隐也算它的一部分
    expect(wrapper.find('[data-layout-region="header-nav"]').exists()).toBe(
      true,
    );
  });

  it('导航没有数据时整块让位，品牌位不再带分隔线', () => {
    const wrapper = mountHeader({ lead: 'logo', nav: { menus: [] } });
    expect(wrapper.find('[data-layout-region="header-nav"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-layout-logo="header"]').classes()).not.toContain(
      'border-r',
    );
  });

  it('高度由 inline style 给出，避免被组件库的默认行高顶掉', () => {
    expect(mountHeader().attributes('style')).toContain(
      `height: ${LAYOUT_HEADER_ROW_STYLE.height}`,
    );
  });
});

describe('LayoutHeader - 侧栏触发按钮', () => {
  it('默认不渲染，只有使用方明确要求时才出现', () => {
    expect(
      mountHeader({ lead: 'breadcrumb' })
        .find('[data-layout-sidebar-trigger]')
        .exists(),
    ).toBe(false);
  });

  it('点了只发 toggleSidebar，开合状态由使用方保管', async () => {
    const wrapper = mountHeader({
      lead: 'breadcrumb',
      showSidebarTrigger: true,
    });
    await wrapper.find('[data-layout-sidebar-trigger]').trigger('click');
    expect(wrapper.emitted('toggleSidebar')).toHaveLength(1);
  });

  it('aria-label 说明"点了会变成什么"，与侧栏底部折叠条同一套 key', () => {
    expect(
      mountHeader({
        lead: 'breadcrumb',
        showSidebarTrigger: true,
        sidebarOpen: true,
      })
        .find('[data-layout-sidebar-trigger]')
        .attributes('aria-label'),
    ).toBe('header.collapseMenu');
    expect(
      mountHeader({
        lead: 'breadcrumb',
        showSidebarTrigger: true,
        sidebarOpen: false,
      })
        .find('[data-layout-sidebar-trigger]')
        .attributes('aria-label'),
    ).toBe('header.expandMenu');
  });

  it('注入 locale 后按钮文案跟着换', () => {
    configureLayout({ t: (key) => `tr:${key}` });
    expect(
      mountHeader({ lead: 'breadcrumb', showSidebarTrigger: true })
        .find('[data-layout-sidebar-trigger]')
        .attributes('aria-label'),
    ).toBe('tr:header.collapseMenu');
  });
});

describe('LayoutHeader - 导航配色与事件', () => {
  it('深色顶栏偏好把横向导航切成 dark 主题', async () => {
    const wrapper = mountHeader({
      lead: 'logo',
      nav: { menus: menuTree },
      tone: { headerDark: true },
    });
    await nextTick();
    expect(wrapper.find('[data-menu-root]').attributes('data-menu-theme')).toBe(
      'dark',
    );
  });

  it('浅色模式默认 light，整体深色才 dark', async () => {
    const light = mountHeader({ lead: 'logo', nav: { menus: menuTree } });
    await nextTick();
    expect(light.find('[data-menu-root]').attributes('data-menu-theme')).toBe(
      'light',
    );
    const dark = mountHeader({
      lead: 'logo',
      nav: { menus: menuTree },
      tone: { dark: true },
    });
    await nextTick();
    expect(dark.find('[data-menu-root]').attributes('data-menu-theme')).toBe(
      'dark',
    );
  });

  it('导航点击把 key 交给使用方', async () => {
    const wrapper = mountHeader({
      lead: 'logo',
      nav: {
        menus: [{ name: 'Analysis', path: '/analysis', title: '分析面板' }],
      },
    });
    await nextTick();
    await wrapper.find('[data-menu-key="Analysis"]').trigger('click');
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['Analysis']);
  });

  it('小部件容器无条件存在（与迁移前一致），插槽内容落在它里面', () => {
    const wrapper = mount(LayoutHeader, {
      props: { lead: 'breadcrumb' },
      slots: {
        tools: '<button data-testid="w">x</button>',
        user: '<span>me</span>',
      },
    });
    mounted.push(wrapper);
    const pill = wrapper.find('.rounded-xl');
    expect(pill.exists()).toBe(true);
    expect(pill.find('[data-testid="w"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('me');
  });
});
