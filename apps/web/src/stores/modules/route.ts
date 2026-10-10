import type { MenuPathRouter } from '@antdv/shared/menu';
import type { BackendMenu, MenuConfig } from '@antdv/types';

import type { RouteRecordRaw } from 'vue-router';

import { ref } from 'vue';

import {
  attachMenuPaths,
  collectMenuKeys,
  isBuiltinMenuName,
  isBuiltinMenuPath,
  joinMenuPath,
  normalizeMenuPath,
} from '@antdv/shared/menu';
// stores/modules/route.ts
import { defineStore } from 'pinia';
import { http } from '~/composables';

/**
 * 菜单可见性的本地覆盖：`{ [菜单 name]: true/false }`。
 *
 * 后端的 `hidden` 决定"默认进不进导航"，但菜单管理页那个开关必须能落地，
 * 刷新一下就弹回去等于没做。这里把它单独存一个 key —— 不塞进偏好设置，
 * 那份配置是"界面外观"，混进菜单权限数据会把 diff 同步带偏。
 */
const MENU_HIDDEN_OVERRIDES_KEY = 'xy-menu-hidden-overrides';

function readOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MENU_HIDDEN_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    // 手工改坏的 localStorage 不该让整站起不来
    return {};
  }
}

function writeOverride(name: string, hidden: boolean) {
  const overrides = readOverrides();
  overrides[name] = hidden;
  try {
    localStorage.setItem(MENU_HIDDEN_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* 隐私模式 / 配额满：本次会话内仍然生效，只是不持久 */
  }
}

export const useRouteStore = defineStore('route', () => {
  const backendMenus = ref<BackendMenu[]>([]);
  const menus = ref<MenuConfig[]>([]);
  /** 允许访问的路由 name 集合（用于权限判断） */
  const allowedNames = ref(new Set<string>());
  /**
   * 允许访问的 path 集合。
   *
   * 文件约定式路由的 name 由框架生成（`/system/user/`），和业务菜单的
   * `SystemUser` 不同源；只按 name 判权限会把合法页面判成 403。
   * 于是把"菜单解析出来的完整 path"也作为授权依据。
   */
  const allowedPaths = ref(new Set<string>());
  const isLoaded = ref(false);
  const loading = ref(false);

  /**
   * 装配守卫时注入的 router。裁剪、补回路由都要用它，
   * 但 store 不主动 import 全局 router —— 否则 router → guards → store → router 闭环。
   */
  let routerRef: MenuPathRouter | undefined;
  /**
   * 路由表的全量快照（首次装配时留下），"把某个菜单重新显示出来"要按这张表补回。
   * 只存这一份不可变快照，注册与摘除全部以它为准比对，避免多处各自推导。
   */
  let routeSnapshot: RouteRecordRaw[] = [];
  /** 已经注册到 router 上的路由 name，用于算"该补哪些 / 该摘哪些" */
  const registeredNames = ref(new Set<string>());

  /**
   * 后端菜单 → 前端菜单，仅做字段映射。
   *
   * **隐藏节点照样保留**：`hidden` 的语义是"不在导航里出现"，不是"没权限"。
   * 直接过滤掉会带来一串副作用 —— 页面失去授权（直达链接变 403）、标签页查不到
   * 菜单（标题退化成路径）、keep-alive 配置丢失。剔掉隐藏项是渲染侧的事
   * （`@antdv/shared/menu` 的 `visibleMenus` / `attachMenuPaths` 默认就会做）。
   */
  function normalize(list: BackendMenu[]): MenuConfig[] {
    return list
      .filter((m) => m && typeof m === 'object')
      .map((m) => ({
        name: m.name,
        title: m.menuName ?? m.name ?? '',
        icon: m.icon,
        hidden: m.hidden,
        isExternal: m.isExternal,
        path: m.path ?? '', // 外链用；内链由 attachMenuPaths 补全
        keepAlive: m.keepAlive,
        children: m.children?.length ? normalize(m.children) : undefined,
      })) as MenuConfig[];
  }

  /** 把解析好的菜单树摊平成授权集合 */
  function collectAccess(list: MenuConfig[]) {
    for (const menu of list) {
      if (menu.name) allowedNames.value.add(menu.name);
      const path = normalizeMenuPath(menu.path);
      // 外链不是本站路由，不参与 path 授权
      if (path && !menu.isExternal) allowedPaths.value.add(path);
      if (menu.children?.length) collectAccess(menu.children);
    }
  }

  async function fetchBackendMenus(): Promise<BackendMenu[]> {
    const res = await http.Get<{ code: number; data: { list: BackendMenu[] } }>(
      '/menus',
    );
    return res.data.list;
  }

  /** 在源树上按 name 找回节点（写回 hidden 用） */
  function findBackendNode(
    list: BackendMenu[],
    name: string,
  ): BackendMenu | undefined {
    for (const item of list) {
      if (item.name === name) return item;
      const hit = item.children?.length
        ? findBackendNode(item.children, name)
        : undefined;
      if (hit) return hit;
    }
    return undefined;
  }

  /** 把本地覆盖套到源树上，让"开关拨过一次就一直是那个样子" */
  function applyOverrides(list: BackendMenu[]) {
    const overrides = readOverrides();
    for (const [name, hidden] of Object.entries(overrides)) {
      const node = findBackendNode(list, name);
      if (node) node.hidden = hidden;
    }
  }

  /**
   * 只重建派生数据（菜单树 + 授权集合），不碰导航注册。
   *
   * 授权集合按"历史并集"合并：目录节点的 path 是靠路由表反查出来的，
   * 上一轮被摘掉的路由这一轮就反查不回来了 —— 直接采用新集合会把已经
   * granted 的隐藏页算成无权限（表现是"隐藏 A，B 变 404"）。
   * 只增不减在这里是对的：收回权限由 `resetRoutes`（登出）负责，
   * 导航可见性不是权限开关。
   */
  function collectDerivedTree() {
    const grantedPaths = new Set(allowedPaths.value);
    const grantedNames = new Set(allowedNames.value);
    const tree = normalize(backendMenus.value);
    menus.value = routerRef
      ? attachMenuPaths(tree, routerRef, { includeHidden: true })
      : tree;
    allowedNames.value = grantedNames;
    allowedPaths.value = grantedPaths;
    collectAccess(menus.value);
  }

  /**
   * 把"路由表"与"菜单树"对齐一次：菜单里根本没收录的页面不再注册，
   * 菜单里重新出现的页面按快照补回来。
   *
   * 注意这里用的是**全量树**（含 hidden）摊出来的 key 集合，不是可见菜单：
   * `hidden` 只表示"导航里不出现"，隐藏页仍然要能直达（菜单即权限）。
   * 真正被裁掉的是"菜单里没有、却因为在 views 下而被约定路由注册进来"的那些
   * 孤儿页面 —— 巡检时它们表现为"链接是死的、页面却渲染成功"。
   *
   * 四条不能省的边界，都是这一轮巡检踩过的：
   * - **框架路由必须常驻**：登录/重定向/异常页/通配兜底不在菜单里，
   *   一起裁掉会直接白屏（Root 被摘 = 没有任何布局壳）。异常页的文件约定
   *   name 是 `Error404` 而不是 `error-404`，所以除 name 外还要按 path 兜一层。
   * - **无 name 的目录记录跟着孩子走**：`/dashboard`、`/system` 这类文件约定
   *   路由生成的父记录没有 name，它孩子的 path 又写成绝对路径、挂在它下面；
   *   整条摘掉会把底下的真实页面一起带走（表现是首页 404 但一级导航看着正常）。
   *   判据改成"本条不命中 **且** 没有任何孩子命中"才摘。
   * - **显式声明免鉴权的路由不参与裁剪**：`meta.requiresAuth === false` 是
   *   路由自己的声明（`constantRoutes` 全量这么标），不该被菜单数据覆盖掉。
   * - **path 重复只认第一次注册**：文件约定路由会把同一个 path 同时给到嵌套父记录
   *   和顶层记录，第二次 `addRoute` 会顶掉第一次的 meta。
   *
   * 增量改：只摘不该在的、只补缺席的，不做 clearRoutes ——
   * 后者会把当前正在渲染的路由一起清掉，页面直接白屏。
   */
  function syncRouteRegistry() {
    const router = routerRef;
    if (!router?.addRoute || !router.removeRoute || !routeSnapshot.length) return;
    /**
     * 先把方法取成局部常量再用：`walk` 是递归闭包，TS 不会把"属性判过非空"
     * 带进闭包里，直接写 `router.addRoute(...)` 会一路报 possibly undefined。
     * `createRouter` 返回的是对象字面量、方法都是闭包（不依赖 this），解构安全。
     */
    const { addRoute, removeRoute } = router;

    const keys = collectMenuKeys(menus.value);
    /** 同一批 path 只认第一条：后面的重复记录不再注册，避免顶掉带 meta 的那条 */
    const claimedPaths = new Set<string>();
    const nextRegistered = new Set<string>();

    /** 这条记录本身是否被菜单命中，或属于不该被菜单管辖的框架路由 */
    const selfAllowed = (route: RouteRecordRaw, fullPath: string): boolean => {
      const name = route.name == null ? '' : String(route.name);
      if (isBuiltinMenuName(name) || isBuiltinMenuPath(fullPath)) return true;
      // 显式免鉴权 = 应用自己的静态页（登录/重定向/首页跳转），菜单管不着
      if (
        (route as { meta?: { requiresAuth?: boolean } }).meta?.requiresAuth === false
      )
        return true;
      if (name && keys.byName.has(name)) return true;
      return keys.byPath.has(fullPath);
    };

    /**
     * `parentPath` 不是可选的装饰参数，是这条逻辑的前提：
     * 文件约定路由给子记录的 path 是**相对片段**（`user`），而菜单里的 path 是
     * 完整路径（`/system/user`）。直接拿 `route.path` 去查 `byPath`，
     * 除了恰好带 name 的页面（菜单 name 与路由 name 同源的那些），
     * 其余每一页都会被判成"菜单里没收录"而从注册表里摘掉 ——
     * 表现是登录首屏正常（首页恰好有 name），点任何其他菜单都跳不过去。
     */
    const walk = (
      list: RouteRecordRaw[],
      parentPath: string,
      parentName?: string,
    ) => {
      for (const route of list) {
        const name = route.name == null ? '' : String(route.name);
        const path = joinMenuPath(parentPath, route.path);
        // 先算孩子：本条不命中但有孩子命中时，父壳（目录/布局）必须留着
        const sizeBefore = nextRegistered.size;
        if (route.children?.length) walk(route.children, path, name || parentName);
        const keep = selfAllowed(route, path) || nextRegistered.size > sizeBefore;

        /**
         * path 重复：文件约定路由会把同一个 path 同时给到嵌套父记录和顶层记录，
         * 第二次 `addRoute` 会顶掉第一次的 meta。谁先注册算谁的，其余不再注册。
         */
        const duplicated = !!path && claimedPaths.has(path);
        if (path && !duplicated) claimedPaths.add(path);

        if (!keep || duplicated) {
          if (name && router.hasRoute(name)) removeRoute(name);
          continue;
        }

        if (name && !router.hasRoute(name)) {
          // 嵌套记录必须带 parentName 注册，否则会被提到顶层、丢掉布局壳
          const holder =
            parentName && router.hasRoute(parentName) ? parentName : undefined;
          if (holder) addRoute(route, holder);
          else addRoute(route);
        }
        nextRegistered.add(name || path);
      }
    };

    walk(routeSnapshot, '');
    registeredNames.value = nextRegistered;
  }

  /** 派生数据（树 + 授权 + 注册表）全量重算 */
  function recompute() {
    collectDerivedTree();
    syncRouteRegistry();
  }

  /**
   * 只对齐路由注册表，不重建菜单树。
   *
   * 给守卫的自愈钩子用：那条路径每次导航都会跑，若走 `recompute()` 就会每跳一次
   * 重新赋值一次 `menus`（新数组身份），连带触发所有 `watch(() => store.menus)`
   * 与导航层重渲染 —— 菜单管理页会因此把整张表重铺一遍。
   * 派生树只有在菜单数据变了（`initRoutes` / `setMenuHidden`）时才需要重算。
   */
  function syncRoutes() {
    syncRouteRegistry();
  }

  /**
   * 装配守卫时调用：注入 router 与路由表全量快照。
   *
   * 快照只在**第一次**注入时留下，之后不再覆盖 —— 裁剪过的注册表不能再当"全量"，
   * 否则第二次同步时"该补回来的路由"已经从源头消失了，隐藏过的页面永远出不来。
   */
  function registerRouteSource(router: MenuPathRouter, routes: RouteRecordRaw[]) {
    routerRef = router;
    if (!routeSnapshot.length) routeSnapshot = routes;
  }

  /**
   * @param router 由调用方（路由守卫的装配处）注入，store 不 import router，
   * 否则 router → guards → store → router 会形成循环依赖。
   * 传入时按路由表把后端相对片段补成完整 path，菜单与标签页共用同一份结果。
   * @param routes 同一处注入的路由表全量快照，导航裁剪以它为准。
   *
   * `includeHidden` 是给隐藏页的：它们的 path 也要参与授权与标签页反查，
   * 补全之后再交给渲染层，渲染层自己会把不可见的剔掉。
   */
  async function initRoutes(router?: MenuPathRouter, routes?: RouteRecordRaw[]) {
    if (router) registerRouteSource(router, routes ?? []);
    if (loading.value) return;
    loading.value = true;
    try {
      const list = await fetchBackendMenus();
      applyOverrides(list);
      backendMenus.value = list;
      recompute();
      isLoaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 改某个菜单的导航可见性：菜单管理页的「导航显示」开关走这里。
   *
   * 顺序有讲究 —— 改源树 → 重算授权 → 同步注册表 → 落本地覆盖，
   * 中间任何一步反了，拿到的都是上一轮的树或路由表。
   */
  function setMenuHidden(name: string, hidden: boolean) {
    const node = findBackendNode(backendMenus.value, name);
    if (!node) return false;
    node.hidden = hidden;
    writeOverride(name, hidden);
    recompute();
    return true;
  }

  /** 是否可访问某个路由 name */
  function canAccess(name?: string) {
    if (!name) return true;
    return allowedNames.value.has(name);
  }

  /** 是否可访问某个 path（结尾斜杠差异已在归一化里抹平） */
  function canAccessPath(path?: string) {
    if (!path) return false;
    return allowedPaths.value.has(normalizeMenuPath(path));
  }

  function resetRoutes() {
    backendMenus.value = [];
    menus.value = [];
    allowedNames.value = new Set();
    allowedPaths.value = new Set();
    registeredNames.value = new Set();
    isLoaded.value = false;
  }

  return {
    backendMenus,
    menus,
    allowedNames,
    allowedPaths,
    registeredNames,
    isLoaded,
    loading,
    registerRouteSource,
    initRoutes,
    recompute,
    syncRoutes,
    setMenuHidden,
    canAccess,
    canAccessPath,
    resetRoutes,
  };
});
