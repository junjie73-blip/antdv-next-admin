import type { BackendMenu } from '@antdv/types';
import type { RouteRecordRaw } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 「按菜单同步路由注册表」—— 菜单系统里最容易默默坏掉的一环。
 *
 * 背景：文件约定式路由把 `views` 下每个 .vue 都注册成了路由，于是
 * "菜单里没有的页面"照样能通过 URL 打开（巡检时表现为链接是死的、页面却渲染成功）。
 * `syncRouteRegistry` 负责把注册表向菜单树对齐，而这一步有几条不能省的边界，
 * 每一条都对应一次真实故障：
 *
 * 1. 只摘"菜单里根本没收录"的孤儿，**hidden 的照旧注册**（菜单即权限）；
 * 2. 框架路由（布局壳 / 异常页 / 通配兜底 / 显式免鉴权页）必须常驻，摘了是白屏；
 * 3. 目录壳本条不命中但有孩子命中时要留着，摘了会把底下的页面一起带走；
 * 4. 同一个 path 的重复记录只认第一条，否则第二次 addRoute 顶掉带 meta 的那条；
 * 5. 嵌套记录要带 parentName 补回，否则被提到顶层、丢掉布局壳；
 * 6. 比对用的 path 必须是**父级拼接后的完整路径** —— 相对片段直接查菜单永远查不到。
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
      {
        hidden: true,
        menuName: '部门管理',
        name: 'SystemDept',
        path: '/system/dept',
      },
    ],
  },
];

/**
 * 约定路由 + constantRoutes 的混合形状，刻意照真实的两处脾气来写：
 *
 * 1. **嵌套子记录的 `path` 是相对片段**（`user`），完整路径要靠父级拼；
 *    菜单里的 `path` 却是完整的（`/system/user`）。直接拿 `route.path` 去比对，
 *    除了恰好 name 同源的页面，每一页都会被判成"菜单没收录"而摘掉 ——
 *    症状是登录首屏正常、点其他菜单全都跳不动（真实回归过一次）。
 * 2. **文件约定路由生成的 name 和业务菜单 name 不同源**
 *    （`/system/user/` vs `SystemUser`），所以那类页面只能靠 path 命中。
 */
const SNAPSHOT = [
  { name: 'Root', path: '/', children: [] },
  { name: 'Login', path: '/login' },
  { name: 'Error404', path: '/error/404' },
  { name: 'CatchAll', path: '/:pathMatch(.*)*' },
  // 显式免鉴权的框架页：不在菜单里，也不该被裁
  { name: 'Redirect', path: '/redirect/:path(.*)', meta: { requiresAuth: false } },
  // 布局壳：自己不在菜单里，孩子靠相对片段拼出 `/system/user`、`/system/dept`
  {
    children: [
      // 约定路由的 name 与菜单不同源，只有 path 比对能救它
      { name: '/system/user/', path: 'user' },
      // hidden 的菜单页：不进导航，但必须还注册着
      { name: 'SystemDept', path: 'dept' },
    ],
    name: 'SystemShell',
    path: '/system',
  },
  // 与壳里那条拼完是同一个 path（只差结尾斜杠），归一化后是重复记录
  { name: 'SystemUserAlias', path: '/system/user/' },
  // 孤儿：views 下有页面但菜单没写
  { name: 'OrphanPage', path: '/orphan' },
  {
    children: [
      // name 与菜单同源，相对 path 也能靠 name 命中
      { name: 'Analysis', path: 'analysis' },
      { name: 'GhostChild', path: '/dashboard/ghost' },
    ],
    name: 'DashboardShell',
    path: '/dashboard',
  },
] as unknown as RouteRecordRaw[];

interface FakeRouter {
  addRoute: (route: RouteRecordRaw, parentName?: string) => void;
  getRoutes: () => { path: string }[];
  hasRoute: (name: string) => boolean;
  /** 断言用：当前注册表（name → 挂在谁下面） */
  registered: Map<string, string | undefined>;
  removeRoute: (name: string) => void;
  /** 模拟"HMR 把某条路由悄悄注册回来了" */
  seed: (name: string, parentName?: string) => void;
  /** 模拟"某条路由还没注册"（首次装配前的状态） */
  drop: (name: string) => void;
  resolve: (to: { name: string }) => { path: string };
}

/** 把快照摊成"name → 父 name"，用于按真实启动顺序铺初值 */
function flattenSnapshot(list: RouteRecordRaw[], parentName?: string) {
  const out: { name: string; parentName?: string }[] = [];
  for (const route of list) {
    const name = route.name == null ? '' : String(route.name);
    if (name) out.push({ name, parentName });
    if (route.children?.length)
      out.push(...flattenSnapshot(route.children, name || parentName));
  }
  return out;
}

/**
 * 初值取"快照全量已注册"，和 `createRouter` 启动后的状态一致：
 * 约定路由是一次性把整棵树注册进去的，`syncRouteRegistry` 做的是**减法**
 * （外加把被 HMR 撤销的减法再做一遍）。
 */
function createFakeRouter(): FakeRouter {
  const registered = new Map<string, string | undefined>();
  const router: FakeRouter = {
    addRoute: (route: RouteRecordRaw, parentName?: string) => {
      registered.set(String(route.name), parentName);
    },
    drop: (name: string) => {
      registered.delete(name);
    },
    getRoutes: () => SNAPSHOT.map((route) => ({ path: route.path })),
    hasRoute: (name: string) => registered.has(name),
    registered,
    removeRoute: (name: string) => {
      registered.delete(name);
    },
    resolve: (to: { name: string }) => ({
      path:
        SNAPSHOT.find((route) => String(route.name) === to.name)?.path ??
        `/${to.name}`,
    }),
    seed: (name: string, parentName?: string) => {
      registered.set(name, parentName);
    },
  };
  for (const item of flattenSnapshot(SNAPSHOT))
    router.seed(item.name, item.parentName);
  return router;
}

vi.mock('~/composables', () => ({
  http: {
    Get: async () => ({ data: { list: MENUS } }),
  },
}));

async function load(router: FakeRouter, routes = SNAPSHOT) {
  setActivePinia(createPinia());
  const store = useRouteStore();
  await store.initRoutes(router as never, routes);
  return store;
}

beforeEach(() => {
  localStorage.clear();
});

describe('useRouteStore —— 按菜单同步路由注册表', () => {
  it('菜单收录的页面都注册着（含 hidden），孤儿页面被摘掉', async () => {
    const router = createFakeRouter();
    await load(router);

    // 这条是"相对 path 必须先拼接"的回归保护：它的 name（`/system/user/`）
    // 在菜单里根本不存在，只有把 `user` 拼成 `/system/user` 才能命中
    expect(router.registered.has('/system/user/')).toBe(true);
    // hidden 只影响导航，页面必须还能直达 —— 这条被误删过，
    // 症状是"隐藏了 A，直达 A 变 404、标签页标题退化成路径"
    expect(router.registered.has('SystemDept')).toBe(true);
    expect(router.registered.has('Analysis')).toBe(true);
    expect(router.registered.has('OrphanPage')).toBe(false);
    expect(router.registered.has('GhostChild')).toBe(false);
  });

  it('框架路由常驻：布局壳、异常页、通配兜底、显式免鉴权页一个都不动', async () => {
    const router = createFakeRouter();
    await load(router);

    // Login / Error404 不在菜单里，靠内置名单豁免；
    // Redirect 靠 `meta.requiresAuth === false` 豁免 —— 两条判据都要生效
    for (const name of ['Root', 'Login', 'Error404', 'CatchAll', 'Redirect']) {
      expect(router.registered.has(name)).toBe(true);
    }
  });

  it('目录壳本条不命中，但有孩子命中就留着，孩子挂回原处', async () => {
    const router = createFakeRouter();
    await load(router);

    // `/dashboard` 自己不在菜单里；整条摘掉会连底下的页面一起带走，
    // 表现是"一级导航看着正常、首页却 404"
    expect(router.registered.has('DashboardShell')).toBe(true);
    expect(router.registered.get('Analysis')).toBe('DashboardShell');
    // `/system` 在菜单里，壳与孩子都原样留着
    expect(router.registered.has('SystemShell')).toBe(true);
    expect(router.registered.get('SystemDept')).toBe('SystemShell');
  });

  it('同一 path 的重复记录只认第一次注册', async () => {
    const router = createFakeRouter();
    await load(router);

    // 壳里 `user` 拼出来是 `/system/user`，顶层别名是 `/system/user/`，
    // 归一化后同一条：先走到的（带布局壳的嵌套记录）算数，
    // 第二次 addRoute 会顶掉第一次的 meta，所以别名直接出局
    expect(router.registered.has('/system/user/')).toBe(true);
    expect(router.registered.has('SystemUserAlias')).toBe(false);
  });

  it('菜单里重新出现的页面按快照补回来，且带上父级', async () => {
    const router = createFakeRouter();
    await load(router);

    // 模拟"这条路由不知为何没在表上"（首次装配前 / 被别处摘掉）
    router.drop('/system/user/');
    router.drop('SystemDept');
    expect(router.hasRoute('/system/user/')).toBe(false);

    router.seed('SystemShell');
    // 拿当前 pinia 实例上的 store，保证和上面 drop 的是同一张表
    useRouteStore().syncRoutes();

    expect(router.registered.has('/system/user/')).toBe(true);
    // 嵌套记录必须带 parentName 补回，否则被提到顶层、丢掉布局壳
    expect(router.registered.get('SystemDept')).toBe('SystemShell');
  });

  it('setMenuHidden 往返：导航即时变化，隐藏页仍可直达，且刷新后保持', async () => {
    const router = createFakeRouter();
    const store = await load(router);
    /** 「系统管理」在源树的第二项，按 name 取而不是背下标 */
    const systemOf = (list: typeof store.menus) =>
      list.find((menu) => menu.name === 'SystemManage');

    expect(store.setMenuHidden('SystemUser', true)).toBe(true);
    expect(router.registered.has('/system/user/')).toBe(true);
    expect(store.canAccessPath('/system/user')).toBe(true);
    expect(localStorage.getItem('xy-menu-hidden-overrides')).toContain(
      '"SystemUser":true',
    );

    // 重新登录/刷新：本地覆盖套到源树上，"拨过一次就一直是那个样子"
    const again = createFakeRouter();
    const reloaded = await load(again);
    expect(
      systemOf(reloaded.menus)?.children?.find((m) => m.name === 'SystemUser')
        ?.hidden,
    ).toBe(true);

    // 再拨回来：导航恢复
    expect(reloaded.setMenuHidden('SystemUser', false)).toBe(true);
    expect(
      systemOf(reloaded.menus)?.children?.find((m) => m.name === 'SystemUser')
        ?.hidden,
    ).toBe(false);
    // 找不到节点时给出 false，让调用方能提示"数据已变化"而不是静默失败
    expect(reloaded.setMenuHidden('NotAMenu', true)).toBe(false);
  });

  it('快照只留一份：第二次装配传进更小的表也不会覆盖首次快照', async () => {
    const router = createFakeRouter();
    const store = await load(router);
    expect(router.registered.has('OrphanPage')).toBe(false);

    // dev 下约定路由 HMR 会把整表重新 addRoute，靠 syncRoutes 再扶正一次
    router.seed('OrphanPage');
    store.syncRoutes();
    expect(router.registered.has('OrphanPage')).toBe(false);

    // 再来一次装配：只给一条记录，若快照被覆盖，其余路由就"从全量表里消失了"
    await store.initRoutes(router as never, [
      { name: '/system/user/', path: 'user' },
    ] as unknown as RouteRecordRaw[]);
    store.syncRoutes();
    expect(router.registered.has('Root')).toBe(true);
    expect(router.registered.has('/system/user/')).toBe(true);
  });

  it('菜单没加载完之前不动注册表（否则会把整表裁空、白屏）', async () => {
    const router = createFakeRouter();
    setActivePinia(createPinia());
    const store = useRouteStore();
    store.registerRouteSource(router as never, SNAPSHOT);

    // 只装配不拉菜单：此时 menus 是空的，守卫的自愈钩子必须跳过
    expect(store.isLoaded).toBe(false);
    expect(router.registered.has('OrphanPage')).toBe(true);
    expect(router.registered.has('Root')).toBe(true);
  });
});
