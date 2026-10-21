import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useRouteStore } from '@antdv/stores';
import { createPinia, setActivePinia } from 'pinia';

import { flattenMenus, matchEntries } from '../src/menu-search';
import LayoutGlobalSearch from '../src/widgets/global-search/index.vue';

/**
 * 菜单搜索（Ctrl+K）的匹配逻辑测试。
 *
 * 这个功能以前是**假的**：顶栏搜索按钮和快捷键把一个从未渲染过的 ref 置真，
 * 按下去什么也不会发生。修复之后核心风险落在两处 ——
 * 一是"能不能搜到"（拍平与分词），二是"排在前面的是不是用户想去的那个"（打分）。
 * 所以测试全部围绕这两点写，DOM 与跳转交给 e2e 覆盖。
 */

const MENUS: MenuConfig[] = [
  {
    icon: 'carbon:dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    title: '仪表盘',
  },
  {
    name: 'System',
    path: '/system',
    title: '系统管理',
    children: [
      { name: 'SystemUser', path: '/system/user', title: '用户管理' },
      { name: 'SystemRole', path: '/system/role', title: '角色管理' },
      {
        hidden: true,
        name: 'SystemDept',
        path: '/system/dept',
        title: '部门管理',
      },
    ],
  },
  {
    // 纯分组节点：没有 path，不该进入候选
    name: 'Group',
    path: '',
    title: '分组占位',
    children: [
      {
        isExternal: true,
        name: 'Docs',
        path: 'https://antdv.com/components/table-cn',
        title: '组件文档',
      },
    ],
  },
  {
    hidden: true,
    name: 'Profile',
    path: '/profile',
    title: '个人中心',
  },
];

describe('flattenMenus', () => {
  it('只保留可跳转的叶子，并带上父级层级', () => {
    const entries = flattenMenus(MENUS);
    const paths = entries.map((entry) => entry.path);

    expect(paths).toEqual([
      '/dashboard',
      '/system/user',
      '/system/role',
      '/system/dept',
      'https://antdv.com/components/table-cn',
      '/profile',
    ]);
    // 分组占位（无 path）被丢弃，父级节点本身也不该出现在结果里
    expect(paths).not.toContain('/system');
    expect(paths).not.toContain('');
  });

  it('breadcrumb 是"去掉末级"的层级路径', () => {
    const entries = flattenMenus(MENUS);
    const user = entries.find((entry) => entry.path === '/system/user');
    const dashboard = entries.find((entry) => entry.path === '/dashboard');

    expect(user?.breadcrumb).toBe('系统管理');
    // 顶层页面没有父级，breadcrumb 为空串（组件里会退化成显示 path）
    expect(dashboard?.breadcrumb).toBe('');
  });

  it('把 hidden 与外链标记保留下来，供 UI 区分处理', () => {
    const entries = flattenMenus(MENUS);
    expect(entries.find((entry) => entry.path === '/system/dept')?.hidden).toBe(
      true,
    );
    expect(entries.find((entry) => entry.path === '/profile')?.external).toBe(
      false,
    );
    expect(entries.find((entry) => entry.external)?.path).toMatch(
      /^https:\/\//,
    );
  });

  it('空菜单返回空数组，不抛异常', () => {
    expect(flattenMenus([])).toEqual([]);
  });
});

describe('matchEntries', () => {
  const entries = flattenMenus(MENUS);

  it('空关键词时导航可见的排在隐藏页前面', () => {
    const titles = matchEntries(entries, '').map((entry) => entry.title);
    expect(titles[0]).toBe('仪表盘');
    expect(titles).toContain('用户管理');
    // 两个 hidden 项垫到最后，顺序彼此无关紧要
    expect(titles.slice(-2).sort()).toEqual(['个人中心', '部门管理']);
  });

  it('中文标题能命中', () => {
    expect(matchEntries(entries, '用户').map((entry) => entry.path)).toEqual([
      '/system/user',
    ]);
  });

  it('英文路径同样能命中（中英混排后台的基本诉求）', () => {
    expect(matchEntries(entries, 'role').map((entry) => entry.path)).toEqual([
      '/system/role',
    ]);
  });

  it('层级也参与匹配，所以「系统 部门」能找到导航里不显示的页面', () => {
    expect(
      matchEntries(entries, '系统 部门').map((entry) => entry.path),
    ).toEqual(['/system/dept']);
  });

  it('多段关键词是与的关系，任一段不命中就整体排除', () => {
    expect(matchEntries(entries, '用户 角色')).toEqual([]);
  });

  it('标题前缀命中排在标题包含之前', () => {
    const hits = matchEntries(entries, '管理');
    // 「用户管理 / 角色管理 / 部门管理」都是"包含"，得分相同，
    // 此时可见性决定次序：hidden 的部门管理排到最后
    expect(hits.map((entry) => entry.path)).toEqual([
      '/system/user',
      '/system/role',
      '/system/dept',
    ]);

    const prefix = matchEntries(
      [
        { ...entries[1]!, title: '用户中心', path: '/uc' },
        { ...entries[1]!, title: '访问用户管理', path: '/visit' },
      ],
      '用户',
    );
    expect(prefix.map((entry) => entry.path)).toEqual(['/uc', '/visit']);
  });

  it('忽略大小写与首尾空格', () => {
    expect(
      matchEntries(entries, '  Dashboard ').map((entry) => entry.path),
    ).toEqual(['/dashboard']);
  });

  it('limit 截断候选数量', () => {
    expect(matchEntries(entries, '管理', 1)).toHaveLength(1);
  });

  it('无匹配时返回空数组（组件据此展示空态）', () => {
    expect(matchEntries(entries, '不存在的东西')).toEqual([]);
  });
});

/* ============================================================
 * 渲染层：弹窗本体（Ctrl+K 的真实入口）
 * ============================================================
 *
 * 上面钉的是"能不能搜到、排得对不对"，这一组钉"搜到以后能不能用"：
 * 弹窗从旧组件库的 Modal 换成封装件 Dialog 以后，最容易丢的是这三件事 ——
 * 打开即聚焦（命令面板的底线）、键盘上下选、Enter 跳转并关掉自己。
 * 断言只用稳定钩子：`data-test` / `data-testid` / `data-active`。
 */

const PATHS = [
  '/dashboard',
  '/system/user',
  '/system/role',
  '/system/dept',
  '/profile',
];

async function mountSearch() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useRouteStore().menus = MENUS;

  const blank = { render: () => h('div') };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: blank, name: 'home', path: '/' },
      ...PATHS.map((path) => ({ component: blank, name: path, path })),
    ],
  });
  await router.push('/');
  await router.isReady();

  const wrapper = mount(
    defineComponent({
      props: { open: { default: false, type: Boolean } },
      setup: (props) => () =>
        h(LayoutGlobalSearch, {
          // 调用方（HeaderWidgets）就是拿 `v-model:open` 驱动它的，这里复刻同一份接线
          'onUpdate:open': (value: boolean) => {
            void wrapper.setProps({ open: value });
          },
          open: props.open,
        }),
    }),
    { global: { plugins: [pinia, router] } },
  );
  await flushPromises();

  // 弹窗内容走 Portal，挂在 body 上而不在 wrapper 子树里
  const q = (selector: string) => document.body.querySelector(selector);
  const qa = (selector: string) =>
    [...document.body.querySelectorAll(selector)] as HTMLElement[];

  async function open() {
    await wrapper.setProps({ open: true });
    await flushPromises();
    await nextTick();
  }

  return { q, qa, router, open, wrapper };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('layoutGlobalSearch —— 弹窗与键盘输入', () => {
  it('未打开时不渲染，`open` 置真后出现弹窗并把焦点交给搜索框', async () => {
    const { open, q, wrapper } = await mountSearch();
    expect(q('[data-testid="menu-search-input"]')).toBeNull();

    await open();
    expect(
      q('[data-test="menu-search-modal"]'),
      'open 后没有渲染弹窗',
    ).not.toBeNull();
    const input = q('[data-testid="menu-search-input"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // 呼出即可打字：焦点必须已经在输入框上，否则 Ctrl+K 只是"弹个窗"
    expect(document.activeElement).toBe(input);
    expect(wrapper.props('open')).toBe(true);
  });

  it('输入关键词就地过滤，命中项按 `data-search-path` 可断言', async () => {
    const { open, q, qa } = await mountSearch();
    await open();

    const input = q('[data-testid="menu-search-input"]') as HTMLInputElement;
    input.value = '用户';
    input.dispatchEvent(new Event('input'));
    await nextTick();

    const items = qa('[data-testid="menu-search-item"]');
    expect(items.map((item) => item.dataset.searchPath)).toEqual([
      '/system/user',
    ]);
    // 键盘默认停在第一项
    expect(items[0]!.dataset.active).toBe('true');
  });

  it('↑ ↓ 移动高亮，Enter 打开高亮项并关掉弹窗', async () => {
    const { open, q, qa, router } = await mountSearch();
    await open();

    const input = q('[data-testid="menu-search-input"]') as HTMLInputElement;
    input.value = '管';
    input.dispatchEvent(new Event('input'));
    await nextTick();
    expect(qa('[data-testid="menu-search-item"]')).toHaveLength(3);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await nextTick();
    const active = qa('[data-testid="menu-search-item"]').filter(
      (item) => item.dataset.active === 'true',
    );
    expect(active).toHaveLength(1);
    expect(active[0]!.dataset.searchPath).toBe('/system/role');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flushPromises();
    await nextTick();
    expect(router.currentRoute.value.path).toBe('/system/role');
    expect(q('[data-testid="menu-search-input"]'), '跳转后弹窗没关').toBeNull();
  });

  it('搜不到时空态可见，且不残留任何条目', async () => {
    const { open, q, qa } = await mountSearch();
    await open();

    const input = q('[data-testid="menu-search-input"]') as HTMLInputElement;
    input.value = '不存在的页面';
    input.dispatchEvent(new Event('input'));
    await nextTick();

    expect(q('[data-testid="menu-search-empty"]')).not.toBeNull();
    expect(qa('[data-testid="menu-search-item"]')).toEqual([]);
  });

  it('escape 关掉弹窗', async () => {
    const { open, q, wrapper } = await mountSearch();
    await open();

    const input = q('[data-testid="menu-search-input"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    await nextTick();

    expect(wrapper.props('open')).toBe(false);
    expect(q('[data-testid="menu-search-input"]')).toBeNull();
  });
});
