import type { BackendMenu } from '@antdv/types';

import { createPinia, setActivePinia } from 'pinia';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';
import { useUserStore } from '~/stores/modules/user';

/**
 * 退出登录要清干净"会话态三件套"：凭证 / 页面缓存 / 授权与标签页。
 *
 * 之前只清了前两样，`route.isLoaded` 与 `tabs` 留在原处。因为退出→再登录是同一个
 * 页面会话（hash 路由，没有整页刷新），守卫看到 `isLoaded === true` 就跳过
 * `loadRoutes()`，于是新账号沿用旧账号的菜单与 `allowedNames/allowedPaths`：
 * 换个权限更小的账号进来，要么菜单不对，要么把本来有权的页面判成 403。
 * 这条不变量只能靠测试钉住 —— 它不在任何一个组件的渲染结果里。
 */

const MENU: BackendMenu[] = [
  {
    children: [
      { name: 'SystemUser', path: '/system/user', title: '用户管理' },
    ] as unknown as BackendMenu[],
    name: 'System',
    path: '/system',
    title: '系统管理',
  },
];

function seedSession() {
  setActivePinia(createPinia());
  const user = useUserStore();
  const route = useRouteStore();
  const tabs = useTabsStore();

  user.token = 'a-token';
  user.userInfo = {
    avatar: '',
    email: '',
    id: 1,
    nickname: '管理员',
    permissions: ['*'],
    phone: '',
    roles: ['admin'],
    username: 'admin',
  } as never;

  // 直接写 store 状态，不去 mock /menus 接口：这里要验的是"清了没有"，不是"怎么来的"
  route.backendMenus = MENU;
  route.menus = [
    {
      children: [{ name: 'SystemUser', path: '/system/user', title: '用户管理' }],
      name: 'System',
      path: '/system',
      title: '系统管理',
    },
  ] as never;
  route.allowedNames = new Set(['System', 'SystemUser']);
  route.allowedPaths = new Set(['/system/user']);
  route.isLoaded = true;

  tabs.tabs = [
    { closable: false, key: '/dashboard/analysis', path: '/dashboard/analysis', title: '分析页' },
    { closable: true, key: '/system/user', path: '/system/user', title: '用户管理' },
  ] as never;

  return { route, tabs, user };
}

describe('useUserStore.logout —— 会话态清理', () => {
  it('清掉凭证与用户信息', () => {
    const { user } = seedSession();
    user.logout();

    expect(user.token).toBeNull();
    expect(user.userInfo).toBeNull();
    expect(user.isLoggedIn).toBe(false);
  });

  it('重置路由 store，下次导航会重新拉菜单', () => {
    const { route, user } = seedSession();
    user.logout();

    expect(route.isLoaded).toBe(false);
    expect(route.menus).toEqual([]);
    expect(route.backendMenus).toEqual([]);
    expect([...route.allowedNames]).toEqual([]);
    expect([...route.allowedPaths]).toEqual([]);
  });

  it('`isLoaded === false` 是守卫重新加载的开关', () => {
    const { route, user } = seedSession();
    expect(route.isLoaded).toBe(true);

    user.logout();
    // 守卫的 dynamicRoutes 分支就是读这个值：true 就跳过 loadRoutes()
    expect(route.isLoaded).toBe(false);
  });

  it('清空标签页，不给新账号留上一个账号的入口', () => {
    const { tabs, user } = seedSession();
    user.logout();

    expect(tabs.tabs).toEqual([]);
  });

  it('重复退出不该炸（守卫重定向与用户点两次都可能连着调）', () => {
    const { route, tabs, user } = seedSession();
    user.logout();
    expect(() => user.logout()).not.toThrow();

    expect(route.isLoaded).toBe(false);
    expect(tabs.tabs).toEqual([]);
  });
});
