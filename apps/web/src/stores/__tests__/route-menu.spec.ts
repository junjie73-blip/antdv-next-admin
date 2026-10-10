import type { BackendMenu } from '@antdv/types';

import { visibleMenuTree } from '@antdv/shared/menu';
import { createPinia, setActivePinia } from 'pinia';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 「菜单即权限」里 `hidden` 的那一半语义。
 *
 * 需求把导航精简成四类（仪表盘 / 系统管理三项 / 组件示例 / 微前端），
 * 个人中心改由头像下拉 + 抽屉承载。最容易踩的坑是**把记录直接删掉**：
 * 这份菜单同时是权限来源，删了就等于关页面 ——
 * 部门管理、数据字典的直达链接会变 403，标签页只剩一串路径，keep-alive 也失效。
 * 所以后端标 `hidden: true`，前端"看不见但进得去"，这条不变量必须钉住。
 */

const MENUS: BackendMenu[] = [
  {
    menuName: '仪表盘',
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      { menuName: '分析面板', name: 'Analysis', path: '/dashboard/analysis' },
    ],
  },
  {
    menuName: '系统管理',
    name: 'SystemManage',
    path: '/system',
    children: [
      { menuName: '用户管理', name: 'SystemUser', path: '/system/user' },
      // 导航里不再展示，但页面还在
      { hidden: true, menuName: '部门管理', name: 'SystemDept', path: '/system/dept' },
    ],
  },
  {
    hidden: true,
    menuName: '个人中心',
    name: 'Account',
    path: '/account',
    children: [
      { menuName: '个人主页', name: 'AccountCenter', path: '/account/center' },
      { menuName: '账户设置', name: 'AccountSettings', path: '/account/settings' },
    ],
  },
  // 外链只开新窗口，不该出现在站内授权集合里
  { isExternal: true, menuName: '组件文档', name: 'ExternalDocs', path: 'https://antdv-next.com/' },
];

/** `attachMenuPaths` 只用到这三个能力，喂一个按 path 命中的假路由表即可 */
const fakeRouter = {
  getRoutes: () =>
    ['/dashboard', '/dashboard/analysis', '/system', '/system/user', '/system/dept', '/account', '/account/center', '/account/settings'].map(
      (path) => ({ path }),
    ),
  hasRoute: (name: string) =>
    ['Account', 'AccountCenter', 'AccountSettings', 'Analysis', 'Dashboard', 'SystemDept', 'SystemManage', 'SystemUser'].includes(
      name,
    ),
  resolve: (to: { name: string }) => ({
    path: `/${to.name
      .replace(/([a-z])([A-Z])/g, '$1/$2')
      .toLowerCase()}`,
  }),
};

async function load(router = fakeRouter) {
  setActivePinia(createPinia());
  const store = useRouteStore();
  await store.initRoutes(router as never);
  return store;
}

vi.mock('~/composables', () => ({
  http: {
    Get: async () => ({ data: { list: MENUS } }),
  },
}));
describe('useRouteStore —— 隐藏菜单仍有权限', () => {
  it('隐藏节点留在树上，并照样补全 path', async () => {
    const store = await load();

    const dept = store.menus
      .flatMap((menu) => menu.children ?? [])
      .find((menu) => menu.name === 'SystemDept');
    expect(dept?.hidden).toBe(true);
    expect(dept?.path).toBe('/system/dept');
  });

  it('隐藏页的 name 与 path 都进了授权集合（直达不是 403）', async () => {
    const store = await load();

    expect(store.canAccess('SystemDept')).toBe(true);
    expect(store.canAccessPath('/system/dept')).toBe(true);
    // 整棵隐藏的「个人中心」子树同样放行：抽屉之外还能直达 /account/settings
    expect(store.canAccessPath('/account/settings')).toBe(true);
    expect(store.canAccess('AccountCenter')).toBe(true);
  });

  it('导航出口只看得到四类：隐藏顶级与其整棵子树都不出现', async () => {
    const store = await load();
    const tree = visibleMenuTree(store.menus);
    const topTitles = tree.map((menu) => menu.title);

    expect(topTitles).toEqual(['仪表盘', '系统管理', '组件文档']);
    const system = tree[1];
    expect((system?.children ?? []).map((child) => child.title)).toEqual([
      '用户管理',
    ]);
  });

  it('外链节点授权 name 但不进 path 集合', async () => {
    const store = await load();

    expect(store.canAccess('ExternalDocs')).toBe(true);
    expect([...store.allowedPaths]).not.toContain('https://antdv-next.com/');
  });

  it('重复 initRoutes 会重建集合，不往上叠加', async () => {
    const store = await load();
    const before = [...store.allowedPaths].sort();

    await store.initRoutes(fakeRouter as never);
    expect([...store.allowedPaths].sort()).toEqual(before);

    // 退出登录走的是这条：清干净，下次导航重新按新账号拉菜单
    store.resetRoutes();
    expect(store.allowedPaths.size).toBe(0);
    expect(store.canAccessPath('/system/dept')).toBe(false);
    expect(store.isLoaded).toBe(false);
  });
});
