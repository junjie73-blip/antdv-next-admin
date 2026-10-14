/**
 * 请求层的运行时注入点。
 *
 * 包只负责"怎么发请求"，不负责"凭证存在哪、会话没了去哪"：
 * 那三件事分别是 pinia store、缓存键名和路由路径，属于应用。
 * 由应用在入口调用 `configureRequest()` 把它们接上（见 `apps/web/src/plugins/request-runtime.ts`），
 * 于是包体既不依赖 pinia，也不读 `import.meta.env`。
 */

export interface RequestTokens {
  /** 当前访问令牌；未登录返回 null / undefined */
  access: () => null | string | undefined;
  /** 刷新期间把新令牌写回凭证来源（store 里存的是密文，包不碰加密细节） */
  setAccess: (token: string) => Promise<void> | void;
  /** 刷新令牌：包只在刷新流程里读写，不落盘就说明应用没启用刷新 */
  refresh: () => null | string | undefined;
  setRefresh: (token: string) => void;
}

export interface RequestRuntime {
  /**
   * 会话失效时跳转的登录页站内路径（hash 路由下不含 `#`）。
   * 默认 `/login`；应用的路由表若不同，在这里注入。
   */
  loginPath?: string;
  /** 接口前缀，等价于过去的 `VITE_APP_BASE_API` */
  baseUrl: string;
  /** 凭证来源 */
  tokens: RequestTokens;
  /**
   * 会话失效的统一收尾（清 store、清缓存等）。
   * `forceLogout` 会调它，然后再做 hash 导航回登录页。
   */
  onLogout: () => Promise<void> | void;
  /** 默认超时（毫秒），缺省 30 秒 */
  timeout?: number;
}

const DEFAULT_LOGIN_PATH = '/login';

let runtime: null | RequestRuntime = null;

export function configureRequest(next: RequestRuntime): void {
  runtime = next;
}

/** 未配置就发请求属于接线漏了，早点炸比 401 满天飞好排查 */
export function getRequestRuntime(): RequestRuntime {
  if (!runtime) {
    throw new Error(
      '@antdv/request 还没有配置：请在应用入口先调用 configureRequest({...})',
    );
  }
  return runtime;
}

export function loginPathOfRuntime(): string {
  return getRequestRuntime().loginPath ?? DEFAULT_LOGIN_PATH;
}

/** 只给单测与热重启用：把运行时摘掉 */
export function resetRequestRuntime(): void {
  runtime = null;
}
