import type { MenuConfig } from '@antdv/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { PREFERENCES_CACHE_KEY } from '@antdv/preferences';
import { cache } from '@antdv/shared/cache';
import dayjs from '@antdv/shared/dayjs';
import { createPinia } from 'pinia';
import { useLocale, useLocaleSync } from '~/composables/web/useLocale';
import i18n from '~/locales';
import enUS from '~/locales/lang/en-US';
import zhCN from '~/locales/lang/zh-CN';
import { localizeMenus } from '~/locales/menu';
import { getPreferences } from '~/settings';
import { useAppStore } from '~/stores/modules/app';

/**
 * locale 的接入与切换。
 *
 * 这一轮的缺陷根源是"两个真相"：偏好里的 `locale`（管 antd / dayjs）和
 * vue-i18n 的全局 locale（管文案）各写各的存储，切一次语言只有一半界面跟着变。
 * 所以测试全部围绕"写一处、五处跟着动"来写：
 * i18n 文案、antd 语言包、dayjs、`<html lang>`、持久化。
 */

/** 挂载用的壳：`useLocaleSync` 要有组件作用域才挂得上 watch */
const Harness = defineComponent({
  name: 'LocaleHarness',
  setup() {
    const antdLocale = useLocaleSync();
    const { locale, setLocale, t } = useLocale();
    return { antdLocale, locale, setLocale, t };
  },
  render: () => h('div'),
});

/** i18n 由 `test/setup.ts` 全局装好（与 main.ts 同一个实例），这里只补 pinia */
function mountHarness() {
  const pinia = createPinia();
  const wrapper = mount(Harness, { global: { plugins: [pinia] } });
  return { appStore: useAppStore(pinia), wrapper };
}

/** 后端菜单里真实存在的几条（`apps/backend-mock` 的 name + 中文 menuName） */
const BACKEND_MENUS: MenuConfig[] = [
  { name: 'Dashboard', path: '/dashboard', title: '仪表盘' },
  {
    children: [
      { name: 'SystemUser', path: '/system/user', title: '用户管理' },
      { name: 'SystemRole', path: '/system/role', title: '角色管理' },
    ],
    name: 'SystemManage',
    path: '/system',
    title: '系统管理',
  },
  { name: 'BrandNewPage', path: '/brand-new', title: '全新页面' },
];

const translate = (key: string) =>
  i18n.global.te(key) ? i18n.global.t(key) : undefined;

/** 摊平 `menu` 命名空间下的键，供两侧对齐检查用 */
function menuKeys(messages: Record<string, unknown>): string[] {
  const menu = (messages as { menu: Record<string, unknown> }).menu;
  return Object.keys(menu).sort();
}

beforeEach(() => {
  // 偏好实例是模块级单例，用例之间会串；每条都从项目默认值（zh-CN）重新开始
  getPreferences().reset();
  i18n.global.locale.value = 'zh-CN';
});

describe('useLocaleSync —— locale 的唯一出口', () => {
  it('默认是中文，首屏就把五处都对上', async () => {
    const { wrapper } = mountHarness();
    await settle();

    expect(wrapper.vm.locale).toBe('zh-CN');
    expect(i18n.global.locale.value).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(dayjs.locale()).toBe('zh-cn');
    expect(wrapper.vm.t('header.logout')).toBe('退出登录');
  });

  it('写偏好（唯一的写入点）就带动 i18n / antd / dayjs / html lang / 存储', async () => {
    const { appStore, wrapper } = mountHarness();

    appStore.updateSetting({ locale: 'en-US' });
    await nextTick();
    await settle();

    expect(i18n.global.locale.value).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(dayjs.locale()).toBe('en');
    // 文案跟着换：证明 i18n 不是"装了没用"
    expect(wrapper.vm.t('header.logout')).toBe('Sign Out');
    // 持久化只有一份：落在偏好的快照里，不再有独立的 locale 键
    expect(
      cache.getItem<{ locale: string }>(PREFERENCES_CACHE_KEY)?.locale,
    ).toBe('en-US');
    expect(window.localStorage.getItem('app_cache_locale')).toBeNull();
  });

  it('configProvider 拿到的 antd 语言包跟着切换', async () => {
    const { appStore, wrapper } = mountHarness();
    // 语言包是动态 import（要走模块加载，不止一个微任务），按状态等而不是拍脑袋 sleep
    await vi.waitFor(() => expect(wrapper.vm.antdLocale?.locale).toBe('zh-cn'));
    const zh = wrapper.vm.antdLocale;

    appStore.updateSetting({ locale: 'en-US' });
    await nextTick();
    await vi.waitFor(() => expect(wrapper.vm.antdLocale?.locale).toBe('en'));

    // 切换后必须是换成英文那份，而不是留着中文
    expect(wrapper.vm.antdLocale).not.toBe(zh);
    expect(wrapper.vm.antdLocale?.Pagination?.items_per_page).toBe('/ page');
  });

  it('setLocale 与 updateSetting 两条路互不漂移', async () => {
    const { appStore, wrapper } = mountHarness();

    wrapper.vm.setLocale('en-US');
    await nextTick();
    await settle();

    // 走 composable 写 → store 与 i18n 同时到位（不是只改了 i18n）
    expect(appStore.locale).toBe('en-US');
    expect(wrapper.vm.locale).toBe('en-US');
    expect(i18n.global.locale.value).toBe('en-US');

    // 反过来走 store 写 → composable 与 i18n 一起跟上
    appStore.updateSetting({ locale: 'zh-CN' });
    await nextTick();
    await settle();

    expect(wrapper.vm.locale).toBe('zh-CN');
    expect(i18n.global.locale.value).toBe('zh-CN');
  });
});

describe('localizeMenus —— 菜单标题的翻译层', () => {
  it('按菜单 name 命中译文，中文与英文都翻得出来', () => {
    i18n.global.locale.value = 'en-US';
    const [dashboard, system] = localizeMenus(BACKEND_MENUS, translate);
    expect(dashboard?.title).toBe('Dashboard');
    expect(system?.title).toBe('System');
    expect(system?.children?.[0]?.title).toBe('Users');

    i18n.global.locale.value = 'zh-CN';
    const [zhDashboard] = localizeMenus(BACKEND_MENUS, translate);
    expect(zhDashboard?.title).toBe('仪表盘');
  });

  it('文案表里没有的菜单退回后端原文，而不是渲染一个 key', () => {
    i18n.global.locale.value = 'en-US';
    const [unmapped] = localizeMenus(
      BACKEND_MENUS.filter((menu) => menu.name === 'BrandNewPage'),
      translate,
    );
    expect(unmapped?.title).toBe('全新页面');
  });

  it('只改标题，path / name / 选中态依赖的字段原样保留', () => {
    const [localized] = localizeMenus(BACKEND_MENUS, translate);
    expect(localized).toMatchObject({
      name: 'Dashboard',
      path: '/dashboard',
    });
  });
});

describe('文案表对齐', () => {
  it('menu 命名空间在两侧完全对称（少一个键英文界面就会漏翻译）', () => {
    expect(menuKeys(enUS)).toEqual(menuKeys(zhCN));
  });

  it('后端菜单的每一个 name 都有对应译文键', () => {
    const names = ['Dashboard', 'SystemManage', 'SystemUser', 'SystemRole'];
    for (const name of names) {
      expect(Object.keys((zhCN as never as { menu: object }).menu)).toContain(
        name,
      );
      expect(Object.keys((enUS as never as { menu: object }).menu)).toContain(
        name,
      );
    }
  });
});

/** 语言包是动态 import，等一次微任务队列 */
async function settle() {
  await nextTick();
  await flushPromises();
}
