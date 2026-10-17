import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import LayoutNavRail from '../src/components/layout-sidebar/nav-rail.vue';
import { LAYOUT_RAIL_WIDTH } from '../src/layout';
import { menuTree } from './fixtures';

const mounted: Array<{ unmount: () => void }> = [];

function mountRail(props: Record<string, unknown> = {}) {
  const wrapper = mount(LayoutNavRail, {
    attachTo: document.body,
    props: { menus: menuTree, ...props },
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('LayoutNavRail - 列表与高亮', () => {
  it('每一项都带 key 钩子，宽度默认取图标栏常量', async () => {
    const wrapper = mountRail();
    await nextTick();
    expect(wrapper.attributes('style')).toContain(
      `width: ${LAYOUT_RAIL_WIDTH}px`,
    );
    const keys = wrapper
      .findAll('[data-rail-item]')
      .map((item) => item.attributes('data-menu-key'));
    expect(keys).toEqual(['System', 'Demo', 'Analysis']);
  });

  it('高亮只认使用方传进来的 key，并给出左侧指示条与 aria-current', async () => {
    const wrapper = mountRail({ activeKey: 'Demo' });
    await nextTick();
    const active = wrapper
      .findAll('[data-rail-item]')
      .find((item) => item.attributes('data-menu-key') === 'Demo');
    expect(active?.attributes('aria-current')).toBe('page');
    expect(active?.find('[data-rail-active-bar]').exists()).toBe(true);
    const other = wrapper
      .findAll('[data-rail-item]')
      .find((item) => item.attributes('data-menu-key') === 'System');
    expect(other?.attributes('aria-current')).toBeUndefined();
    expect(other?.find('[data-rail-active-bar]').exists()).toBe(false);
  });

  it('路由不在图标栏里（activeKey 缺省）时不会亮好几项', async () => {
    const wrapper = mountRail();
    await nextTick();
    expect(wrapper.findAll('[data-rail-active-bar]')).toHaveLength(0);
  });

  it('点击把 key 交给使用方，禁用项不参与', async () => {
    const wrapper = mountRail({
      menus: [
        { name: 'Analysis', path: '/analysis', title: '分析面板' },
        { disabled: true, name: 'Locked', path: '/locked', title: '锁住' },
      ],
    });
    await nextTick();
    await wrapper
      .find('[data-rail-item][data-menu-key="Analysis"]')
      .trigger('click');
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['Analysis']);
    expect(
      wrapper
        .find('[data-rail-item][data-menu-key="Locked"]')
        .attributes('disabled'),
    ).toBeDefined();
  });
});

describe('LayoutNavRail - 品牌位与配色', () => {
  it('图标栏形态下品牌位住在这一列', async () => {
    const wrapper = mountRail({ logo: '/logo.svg', title: '控制台' });
    await nextTick();
    const logo = wrapper.find('[data-layout-logo="rail"]');
    expect(logo.exists()).toBe(true);
    expect(logo.find('img')?.attributes('src')).toBe('/logo.svg');
    expect(logo.find('img')?.attributes('alt')).toBe('控制台');
  });

  it('没有 logo 图片时用占位图标，不留空白格', async () => {
    const wrapper = mountRail();
    await nextTick();
    expect(wrapper.find('[data-layout-logo="rail"]').find('img').exists()).toBe(
      false,
    );
  });

  it('深色侧栏偏好下选中项仍然只用主色淡底 + 主色文字', async () => {
    const wrapper = mountRail({
      activeKey: 'System',
      tone: { sidebarDark: true },
    });
    await nextTick();
    const active = wrapper
      .findAll('[data-rail-item]')
      .find((item) => item.attributes('data-menu-key') === 'System');
    expect(active?.find('span').classes()).toContain('bg-primary/12');
    expect(wrapper.attributes('class')).toContain('bg-gray-900');
  });
});
