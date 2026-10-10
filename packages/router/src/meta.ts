import type { RouteLocationNormalized } from 'vue-router';

/** 路由 meta 是应用自定义的，包内不假定增强，取值一律走这里的窄化读取 */
export function metaValue<T>(
  to: RouteLocationNormalized,
  key: string,
): T | undefined {
  return (to.meta as Record<string, unknown>)[key] as T | undefined;
}

/** 默认约定：没显式写 `requiresAuth: false` 的页面都要登录 */
export function requiresAuth(to: RouteLocationNormalized): boolean {
  return metaValue<boolean>(to, 'requiresAuth') !== false;
}

export function routeTitle(to: RouteLocationNormalized): string | undefined {
  const title = metaValue<unknown>(to, 'title');
  return typeof title === 'string' && title.length > 0 ? title : undefined;
}

export function isOneOf(paths: readonly string[], path: string): boolean {
  return paths.includes(path);
}

/** 登录/注册这类"只给未登录用户看的页面"的默认集合 */
export const GUEST_ONLY_PATHS = ['/register'] as const;

export interface AuthGuardDependencies {
  /** 登录成功 / 已登录用户访问访客页时的落点 */
  homePath: string;
  /** 登录页路径 */
  loginPath: string;
  /** 免登录白名单（精确匹配 path） */
  whiteList: readonly string[];
  /** 登录状态由应用提供：包不认识 pinia / token 存储 */
  isLoggedIn: () => boolean;
  /**
   * 已登录也应跳回首页的访客页；默认再算上 `/register`。
   * `loginPath` 始终包含在内，不用重复写。
   */
  guestOnlyPaths?: readonly string[];
}

/**
 * 鉴权时能拿到的目标信息。
 *
 * 只靠 `name` 是不够的：文件约定式路由（unplugin-vue-router）会自动生成
 * 形如 `/system/user/` 的 name，和业务菜单里的 `SystemUser` 不同源，
 * 于是"按 name 鉴权"会把合法页面判成无权限。应用侧可以同时校验 path。
 */
export interface RouteAccessTarget {
  name?: string;
  path: string;
}

export interface DynamicRouteGuardDependencies extends AuthGuardDependencies {
  /** 动态菜单是否已经注册进 router */
  isRoutesLoaded: () => boolean;
  /** 拉取并注册路由；抛错时由 guard 兜住，避免死循环 */
  loadRoutes: () => Promise<unknown>;
  /** 判断目标可访问：name 或 path 任一被菜单授权即通过 */
  canAccess: (target: RouteAccessTarget) => boolean;
  /** 无权限落点，默认 `/403` */
  forbiddenPath?: string;
  /** `loadRoutes` 失败的上报口子；不传则静默放行 */
  onError?: (error: unknown) => void;
  /**
   * 目录路径的落点解析。
   *
   * 菜单里的目录节点（`/dashboard`、`/system`）本身没有页面，直接访问或从
   * 登录页跳过去会得到一片空白。应用侧给出"该节点的第一个叶子 path"，
   * 守卫就在鉴权通过后 replace 过去；返回 undefined / 原路径表示不用重定向。
   *
   * 包不认识菜单结构，规则由应用提供 —— 与 `canAccess` 同一套依赖注入思路。
   */
  resolveDirectory?: (path: string) => string | undefined;
}

export interface ProgressGuardDependencies {
  /** 典型实现：NProgress.start */
  start: () => void;
  /** 典型实现：NProgress.done */
  done: () => void;
  /** 导航出错时的日志口子（原来是一句裸 console.log，错误现场因此丢失） */
  onError?: (error: unknown) => void;
}

export interface TitleGuardDependencies {
  /** 站点名，来自应用的 `import.meta.env.VITE_APP_TITLE` */
  baseTitle: string;
  /** 拼接方式，默认 `页面标题 | 站点名` */
  formatTitle?: (title: string, base: string) => string;
  /** 写标题的动作，默认 `document.title = next`；SSR / 测试可注入 */
  setTitle?: (title: string) => void;
  /** 每次导航后滚回顶部，默认 true */
  scrollToTop?: boolean;
}
