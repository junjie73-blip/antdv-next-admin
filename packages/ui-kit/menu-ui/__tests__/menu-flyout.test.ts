import type { MenuConfig } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import BasicMenu from '../src/BasicMenu.vue';

const tree: MenuConfig[] = [
  {
    children: [
      {
        children: [
          { name: 'BasicForm', path: '/demo/form/basic', title: '基础表单' },
        ],
        name: 'DemoForm',
        path: '',
        title: '表单',
      },
      { name: 'Table', path: '/demo/table', title: '表格' },
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

function flyoutRows() {
  const panel = document.body.querySelector<HTMLElement>(
    '[data-menu-variant="popup"]',
  );
  if (!panel) return null;
  return [...panel.querySelectorAll<HTMLElement>('[data-menu-key]')].map(
    (node) => node.dataset.menuKey ?? '',
  );
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
});

describe('BasicMenu —— 子菜单浮层', () => {
  it('横向形态：hover 一级目录弹出子树，只到二级（更深的交给就地展开）', async () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    const first = wrapper.get('[data-menu-variant="bar"] > li > [data-menu-key="Demo"]');
    expect(document.body.querySelector('[data-menu-variant="popup"]')).toBeNull();

    await hover(first);
    expect(flyoutRows()).toEqual(['DemoForm', 'Table']);
  });

  it('浮层里的目录本身也挂着浮层（三级菜单不会丢）', async () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    const first = wrapper.get('[data-menu-variant="bar"] > li > [data-menu-key="Demo"]');
    await hover(first);

    const panel = document.body.querySelector<HTMLElement>(
      '[data-menu-variant="popup"]',
    );
    expect(panel).toBeTruthy();
    const rows = [...panel!.querySelectorAll<HTMLElement>('[data-menu-key]')];
    expect(rows).toHaveLength(2);
    const nested = rows.find((node) => node.dataset.menuKey === 'DemoForm');
    expect(nested?.dataset.menuMode).toBe('popup');
    // reka 给挂上 HoverCard 的 trigger 打了状态标记，能据此确认它外面确实包了一层浮层
    expect(nested?.dataset.state).toBe('closed');
  });

  it('折叠侧栏：目录改浮层，就地展开容器不出现', async () => {
    const wrapper = mountMenu({ collapsed: true });
    expect(wrapper.find('[data-menu-submenu]').exists()).toBe(false);

    const first = wrapper.get('[data-menu-key="Demo"]');
    await hover(first);
    expect(flyoutRows()).toEqual(['DemoForm', 'Table']);
  });

  it('浮层里的叶子点击后上抛 key；目录点击不改展开状态', async () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    const first = wrapper.get('[data-menu-variant="bar"] > li > [data-menu-key="Demo"]');
    await hover(first);

    const table = document.body.querySelector<HTMLElement>(
      '[data-menu-variant="popup"] [data-menu-key="Table"]',
    );
    expect(table).toBeTruthy();
    table!.click();
    await nextTick();
    expect(wrapper.emitted('select')).toEqual([['Table']]);
    expect(wrapper.emitted('update:openKeys')).toBeUndefined();
  });

  it('浮层缩进从面板第一级重新起算（不会继承外层深度）', async () => {
    const wrapper = mountMenu({ inlineIndent: 16, mode: 'horizontal' });
    const first = wrapper.get('[data-menu-variant="bar"] > li > [data-menu-key="Demo"]');
    await hover(first);

    const panel = document.body.querySelector<HTMLElement>(
      '[data-menu-variant="popup"]',
    );
    const row = panel!.querySelector<HTMLElement>('[data-menu-key="DemoForm"]');
    expect(row?.getAttribute('style')).toContain('padding-left: 16px');
  });
});
