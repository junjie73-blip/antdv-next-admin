import type { MenuConfig } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import BasicMenu from '../src/BasicMenu.vue';
import { configureMenu } from '../src/config';

const tree: MenuConfig[] = [
  {
    children: [
      { name: 'DemoList', path: '/demo/list', title: '列表' },
      { name: 'DemoForm', path: '/demo/form', title: '表单' },
    ],
    icon: 'carbon:apps',
    name: 'Demo',
    path: '',
    title: '组件示例',
  },
  { name: 'Dashboard', path: '/dashboard', title: '分析面板' },
];

const mounted: Array<{ unmount: () => void }> = [];

function mountMenu(props: Record<string, unknown> = {}) {
  const wrapper = mount(BasicMenu, {
    attachTo: document.body,
    props: { menus: tree, ...props },
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  configureMenu({ t: (key: string) => key });
});

/** reka 的 Collapsible 首帧会关掉动画（避免挂载即播放），动画开关要等一帧才就位 */
const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve(null));
  });

/** reka 的 HoverCard 有 60ms openDelay，等一拍再看 body 里的浮层 */
async function hover(row: {
  trigger: (event: string, options?: Record<string, unknown>) => Promise<void>;
}) {
  await row.trigger('pointerenter', { pointerType: 'mouse' });
  await new Promise((resolve) => {
    setTimeout(resolve, 150);
  });
  await nextTick();
}

describe('basicMenu —— 动效', () => {
  /**
   * 就地展开的子树必须是 reka 的 Collapsible 容器：高度动画的尺寸由它算，
   * 类名里的 `animate-collapsible-*` 是动画生效的唯一开关（CSS 侧没有兜底规则）。
   */
  it('展开的目录走 Collapsible，带上下收放的动画类', async () => {
    const wrapper = mountMenu();
    await nextFrame();
    await wrapper.setProps({ openKeys: ['Demo'] });
    await nextTick();

    expect(wrapper.find('[data-slot="collapsible"]').exists()).toBe(true);
    const content = wrapper.find('[data-menu-submenu]');
    expect(content.attributes('data-state')).toBe('open');
    expect(content.classes()).toContain('overflow-hidden');
    expect(
      content.classes().some((c) => c.includes('animate-collapsible-down')),
    ).toBe(true);
    expect(
      content.classes().some((c) => c.includes('animate-collapsible-up')),
    ).toBe(true);
  });

  /**
   * 收起时容器留在 DOM 里（靠 `hidden` 隐藏），子项整体卸载 —— 键盘遍历和读屏
   * 都读不到隐藏项。卸载发生在离场动画结束后，所以这里断言初始未展开态。
   */
  it('未展开时子项不留在 DOM 里，键盘遍历读不到隐藏项', () => {
    const wrapper = mountMenu();
    const submenu = wrapper.find('[data-menu-submenu]');
    expect(submenu.attributes('data-state')).toBe('closed');
    expect(submenu.attributes('hidden')).toBeDefined();
    expect(submenu.findAll('[data-menu-key]')).toHaveLength(0);
    expect(
      wrapper
        .findAll('[data-menu-key]')
        .map((row) => row.attributes('data-menu-key')),
    ).toEqual(['Demo', 'Dashboard']);
  });

  it('折叠态只留图标，标题节点整体退出（淡出由 Transition 负责）', () => {
    const expanded = mountMenu({ openKeys: ['Demo'] });
    const row = expanded
      .findAll('[data-menu-key]')
      .find((r) => r.attributes('data-menu-key') === 'Demo')!;
    expect(row.find('[data-menu-label]').exists()).toBe(true);
    expect(row.find('[data-menu-icon]').exists()).toBe(true);

    const collapsed = mountMenu({ collapsed: true });
    const iconRow = collapsed
      .findAll('[data-menu-key]')
      .find((r) => r.attributes('data-menu-key') === 'Demo')!;
    expect(iconRow.find('[data-menu-label]').exists()).toBe(false);
    expect(iconRow.find('[data-menu-icon]').exists()).toBe(true);
  });

  it('箭头随展开态旋转，且带 transform 过渡', () => {
    const collapsedMenu = mountMenu();
    const arrow = collapsedMenu
      .findAll('[data-menu-key]')
      .find((r) => r.attributes('data-menu-key') === 'Demo')!
      .find('[data-menu-arrow]')!;
    expect(arrow.classes().join(' ')).toContain('transition-transform');
    expect(arrow.attributes('style') ?? '').not.toContain('rotate(180deg)');

    const opened = mountMenu({ openKeys: ['Demo'] });
    const openedArrow = opened
      .findAll('[data-menu-key]')
      .find((r) => r.attributes('data-menu-key') === 'Demo')!
      .find('[data-menu-arrow]')!;
    expect(openedArrow.attributes('style') ?? '').toContain('rotate(180deg)');
  });

  it('浮层面板带进出场动画类（HoverCard 的 fade/zoom/slide）', async () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    const row = wrapper
      .findAll('[data-menu-key]')
      .find((r) => r.attributes('data-menu-key') === 'Demo')!;
    await hover(row);

    const panel = document.querySelector('[data-slot="hover-card-content"]');
    expect(panel).toBeTruthy();
    const cls = (panel as HTMLElement).className;
    expect(cls).toContain('data-[state=open]:animate-in');
    expect(cls).toContain('data-[state=closed]:animate-out');
  });
});
