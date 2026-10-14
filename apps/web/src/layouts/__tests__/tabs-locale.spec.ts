import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import i18n from '~/locales';
import { useAppStore } from '~/stores/modules/app';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';

import { useTabs } from '../composables/useTabs';
import LocaleSwitcher from '../widgets/LocaleSwitcher.vue';

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
  i18n.global.locale.value = 'zh-CN';
});

describe('标签页标题 —— 与面包屑同一个语言来源', () => {
  it('中文下显示后端原文', async () => {
    const { wrapper } = await mountTabs();
    expect(rendered(wrapper)).toEqual(['分析面板']);
  });

  it('切到英文后，标签标题跟着换，与菜单译文一致', async () => {
    const { wrapper } = await mountTabs();
    i18n.global.locale.value = 'en-US';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics']);
  });

  it('文案表里没有的菜单退回后端原文，而不是显示 menu.LegacyPage 这种 key', async () => {
    const { router, wrapper } = await mountTabs();
    i18n.global.locale.value = 'en-US';
    await router.push('/system/user');
    await router.push('/legacy');
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics', 'Users', '未翻译的页面']);
  });

  it('store 里存的仍是后端原文：译文只活在渲染层，不写进持久化状态', async () => {
    const { wrapper } = await mountTabs();
    i18n.global.locale.value = 'en-US';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['Analytics']);
    expect(useTabsStore().tabs.map((tab) => tab.title)).toEqual(['分析面板']);
  });

  it('切回中文立刻恢复，缓存里没被英文污染', async () => {
    const { wrapper } = await mountTabs();
    i18n.global.locale.value = 'en-US';
    await flushPromises();
    i18n.global.locale.value = 'zh-CN';
    await flushPromises();

    expect(rendered(wrapper)).toEqual(['分析面板']);
  });
});

/* ============================================================
 * 语言切换下拉（顶栏那个入口本体）
 * ============================================================
 *
 * 上面钉的是"译文只活在渲染层"，这一组钉"改语言的开关还灵不灵"：
 * 下拉从旧菜单组件换成封装件以后，选项仍然只来自文案表里已注册的语言，
 * 点一项就是把偏好写进 app store，不该多出第二个写入口。
 * 菜单项是 Portal 出去的，所以断言直接查 document。
 */

async function mountSwitcher() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(
    defineComponent({ setup: () => () => h(LocaleSwitcher) }),
    { global: { plugins: [pinia] } },
  );
  await flushPromises();
  return { appStore: useAppStore(), wrapper };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LocaleSwitcher —— 选项与写入偏好', () => {
  it('触发器显示当前语言，展开后列出已注册的语言并标出当前项', async () => {
    const { wrapper } = await mountSwitcher();

    const trigger = wrapper.get('[data-testid="locale-switcher"]');
    expect(trigger.text()).toContain('简体中文');

    await trigger.trigger('click');
    await nextTick();

    const codes = [...document.body.querySelectorAll('[data-testid^="locale-option-"]')].map(
      (node) => (node as HTMLElement).dataset.testid,
    );
    // 选项跟着文案表走：两门语言都在，且没有多余的第三门
    expect(codes).toEqual(['locale-option-en-US', 'locale-option-zh-CN']);

    const current = document.body.querySelector(
      '[data-testid="locale-option-zh-CN"]',
    ) as HTMLElement | null;
    expect(current?.getAttribute('aria-current')).toBe('true');
    expect(
      document
        .body.querySelector('[data-testid="locale-option-en-US"]')
        ?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('选 English 只写偏好：locale 落到 app store，组件不直接改 i18n', async () => {
    const { appStore, wrapper } = await mountSwitcher();
    await wrapper.get('[data-testid="locale-switcher"]').trigger('click');
    await nextTick();

    (
      document.body.querySelector(
        '[data-testid="locale-option-en-US"]',
      ) as HTMLElement
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    // 写偏好是唯一的出口：语言包、`<html lang>`、dayjs 由 `useLocaleSync` 统一展开
    expect(appStore.locale).toBe('en-US');
    expect(i18n.global.locale.value).toBe('zh-CN');
  });
});
