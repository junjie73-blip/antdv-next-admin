import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { configureLayout } from '@antdv/layout-ui';
import { useRouteStore, useTabsStore } from '@antdv/stores';
import { createPinia, setActivePinia } from 'pinia';

import { useTabs } from '../src/hooks/use-tabs';

/**
 * 标签页标题的语言跟随。
 *
 * 语言切换以前是"半套"的：菜单和面包屑走 `useLocalizedMenus()` 的翻译层，
 * 标签页却显示导航那一刻从后端菜单抄下来的中文原文 —— 切到英文后
 * 面包屑写着 Analytics、标签仍写着「分析面板」，同一个页面两个名字。
 *
 * 这里钉住两件事：
 * 1. 显示标题跟着语言走（与面包屑同源）；
 * 2. store 里存的仍是后端原文 —— 标签状态要落本地缓存，把译文写进去，
 *    切回中文后缓存里会留着英文。
 *
 * 本包不 import vue-i18n，所以用例自备宿主那一层的最小替身：
 * 一张按语言分组的表 + 一个可响应的"当前语言"，与真实 i18n 一样让 computed 追到语言变化。
 */

const MENUS: MenuConfig[] = [
  {
    children: [
      { name: 'Analysis', path: '/dashboard/analysis', title: '分析面板' },
    ],
    name: 'Dashboard',
    path: '/dashboard',
    title: '仪表盘',
  },
  {
    children: [{ name: 'SystemUser', path: '/system/user', title: '用户管理' }],
    name: 'System',
    path: '/system',
    title: '系统管理',
  },
  {
    // 文案表里故意没有这个 name：应当退回后端原文，而不是渲染出 key
    children: [{ name: 'LegacyPage', path: '/legacy', title: '未翻译的页面' }],
    name: 'Legacy',
    path: '/legacy-group',
    title: '遗留',
  },
];

const TABLE: Record<string, Record<string, string>> = {
  'en-US': {
    'menu.Analysis': 'Analytics',
    'menu.SystemUser': 'Users',
  },
  'zh-CN': {},
};

const locale = ref('zh-CN');
configureLayout({
  translateMenu: (key) => TABLE[locale.value]?.[key],
});

const PATHS = ['/dashboard/analysis', '/system/user', '/legacy'];

async function mountTabs(startPath = '/dashboard/analysis') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...PATHS.map((path) => ({
        component: { render: () => h('div') },
        name: path,
        path,
      })),
      {
        component: { render: () => h('div') },
        name: 'fallback',
        path: '/:all(.*)',
      },
    ],
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  useRouteStore().menus = MENUS;

  const Host = defineComponent({
    setup() {
      const api = useTabs();
      return () =>
        h(
          'ul',
          { class: 'tabs' },
          api.tabs.value.map((tab) =>
            h('li', { key: tab.key, 'data-path': tab.key }, tab.title),
          ),
        );
    },
  });

  await router.push(startPath);
  await router.isReady();

  const wrapper = mount(Host, { global: { plugins: [pinia, router] } });
  await flushPromises();

  return { router, wrapper };
}

function rendered(wrapper: {
  findAll: (s: string) => Array<{ text: () => string }>;
}): string[] {
  return wrapper.findAll('li').map((li) => li.text());
}

afterEach(() => {
  locale.value = 'zh-CN';
});

describe('标签页标题 —— 与面包屑同一个语言来源', () => {
  it('中文下显示后端原文', async () => {
    const { wrapper } = await mountTabs();
    expect(rendered(wrapper)).toEqual(['分析面板']);
  });

  it('切到英文后，标签标题跟着换，与菜单译文一致', async () => {
    const { wrapper } = await mountTabs();
    locale.value = 'en-US';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics']);
  });

  it('文案表里没有的菜单退回后端原文，而不是显示 menu.LegacyPage 这种 key', async () => {
    const { router, wrapper } = await mountTabs();
    locale.value = 'en-US';
    await router.push('/system/user');
    await router.push('/legacy');
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics', 'Users', '未翻译的页面']);
  });

  it('store 里存的仍是后端原文：译文只活在渲染层，不写进持久化状态', async () => {
    const { wrapper } = await mountTabs();
    locale.value = 'en-US';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics']);
    expect(useTabsStore().tabs.map((tab) => tab.title)).toEqual(['分析面板']);
  });

  it('切回中文立刻恢复，缓存里没被英文污染', async () => {
    const { wrapper } = await mountTabs();
    locale.value = 'en-US';
    await flushPromises();
    locale.value = 'zh-CN';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['分析面板']);
  });
});
