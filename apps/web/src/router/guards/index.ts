import type { AppRouteRecordRaw } from '@antdv/types';
import type { RouteRecordRaw, Router } from 'vue-router';

import { applyRouterGuards } from '@antdv/router';
import {
  findMenuByPath,
  firstLeafMenu,
  normalizeMenuPath,
} from '@antdv/shared/menu';
import NProgress from 'nprogress';
import { HOME_PATH, LOGIN_PATH, WHITE_LIST } from '~/config/constants';
import { useRouteStore } from '~/stores';
import { useUserStore } from '~/stores/modules/user';

/**
 * 进度条样式与阈值属于应用（换 UI 库不必改包），
 * 守卫的"何时 start/done"属于 @antdv/router。
 */
NProgress.configure({
  minimum: 0.1,
  showSpinner: false,
  trickleSpeed: 200,
});

/**
 * 守卫逻辑全部在 `@antdv/router` 里，这里只做依赖注入：
 * 包不认识 pinia / nprogress / import.meta.env，状态由应用现取现给。
 *
 * store 一律在回调里惰性获取——注册时 pinia 未必已经就绪，
 * 而每次导航取到的也一定是当前实例（热更新 / 测试重置都不会拿到脏引用）。
 *
 * @param appRoutes 路由表全量快照（装配处给出，裁剪以它为准，见 `router/index.ts`）
 */
export function setupRouterGuards(
  router: Router,
  appRoutes: AppRouteRecordRaw[],
) {
  applyRouterGuards(router, {
    // 1. 进度条最先注册：后续守卫可能直接重定向，先起条才有"在加载"的反馈
    progress: {
      done: () => NProgress.done(),
      onError: (error) => {
        console.error('[router] 导航异常', error);
      },
      // 必须是块作用域（返回 void）：箭头直出会把 NProgress 实例当导航结果返回
      start: () => {
        NProgress.start();
      },
    },
    // 2. 登录校验
    auth: {
      homePath: HOME_PATH,
      isLoggedIn: () => useUserStore().isLoggedIn,
      loginPath: LOGIN_PATH,
      whiteList: WHITE_LIST,
    },
    // 3. 动态菜单注册（loadRoutes 抛错会被守卫兜住并放行，避免死循环）
    dynamicRoutes: {
      // name 或 path 任一命中菜单即放行：
      // 文件约定式路由生成的 name（`/system/user/`）与业务菜单 name
      // （`SystemUser`）不同源，只按 name 判会把合法页面判成 403。
      canAccess: ({ name, path }) => {
        const store = useRouteStore();
        return store.canAccess(name) || store.canAccessPath(path);
      },
      // 路由表里 403 页面在 /error/403，旧的 `/403` 是个不存在的落点
      forbiddenPath: '/error/403',
      homePath: HOME_PATH,
      isLoggedIn: () => useUserStore().isLoggedIn,
      isRoutesLoaded: () => useRouteStore().isLoaded,
      // router 与路由表快照由装配处注入（store 不能 import router，否则循环依赖）：
      // 菜单里后端写的相对片段要靠路由表反查成完整 path，
      // 同一份快照也是"按菜单裁剪路由"的比对基准。
      loadRoutes: () =>
        useRouteStore().initRoutes(
          router,
          appRoutes as unknown as RouteRecordRaw[],
        ),
      loginPath: LOGIN_PATH,
      /**
       * 菜单里的目录节点（`/dashboard`、`/system`）没有自己的页面，而登录成功后
       * 默认就跳 `/dashboard` —— 表现是"顶栏侧栏都在，内容区一片空白"。
       * 这里把目录落到它的第一个可见叶子（外链不参与）。
       */
      resolveDirectory: (path) => {
        const store = useRouteStore();
        const leaf = firstLeafMenu(findMenuByPath(store.menus, path));
        if (!leaf || leaf.isExternal) return undefined;
        const target = normalizeMenuPath(leaf.path);
        return target && target !== normalizeMenuPath(path) ? target : undefined;
      },
      onError: (error) => {
        console.error('[router] 菜单加载失败', error);
      },
      whiteList: WHITE_LIST,
    },
    // 4. 标题（afterEach）
    title: {
      baseTitle: import.meta.env.VITE_APP_TITLE || 'Admin',
    },
    onNavigate: (to, from) => {
      console.log(
        `%c[nav]%c ${from.fullPath} → ${to.fullPath}`,
        'color:#4c9aff',
        'color:inherit',
      );
    },
    onError: (error) => {
      console.error('[router] 导航异常', error);
    },
  });

  /**
   * 导航注册表自愈：每次导航按当前菜单再对齐一次。
   *
   * 必须有一条这样的"事后对齐"：dev 下约定路由的 HMR（`handleHotUpdate`）会把
   * 整张路由表重新 `addRoute` 一遍，我们按菜单做的裁剪会被它悄悄撤销 ——
   * 表现是"隐藏了菜单项，刷新后它又回来了，而且不是偶发"。
   * 幂等、成本是一次 O(路由数) 的集合比对，菜单没加载完之前不执行
   * （否则会把整张表裁成只剩框架路由，白屏）。
   *
   * 只调 `syncRoutes()`（对齐注册表），不调 `recompute()`：后者会重建派生菜单树，
   * 每次导航都换一次 `menus` 的数组身份，`watch(() => store.menus)` 的页面
   * （菜单管理）就会跟着把整张表重铺一遍。树只在菜单数据真的变了时才需要重算。
   *
   * 注册在 `applyRouterGuards` 之后：守卫按注册顺序执行，这条不返回重定向结果，
   * 只把注册表扶正，不参与本次导航的放行判断。
   */
  router.beforeEach(() => {
    const store = useRouteStore();
    if (store.isLoaded) store.syncRoutes();
  });
}
