import { isEnvEnabled } from '@antdv/shared/utils/env';

export interface BrowserMockEnv {
  PROD?: boolean;
  VITE_APP_BASE_API?: string;
  VITE_MOCK?: unknown;
}

declare global {
  interface Window {
    /** 运行时覆盖开关：部署后不改包也能启停 mock */
    __BACKEND_MOCK_ENABLED__?: boolean;
  }
}

/**
 * 运行时开关，优先级：URL `?mock=0/1` > localStorage > window 全局 > 构建期 VITE_MOCK。
 *
 * 这样同一份包部署到任意平台都能现场切换：不重新构建就能临时关掉 mock 走真实接口，
 * 也能在真实接口还没就绪的预览环境临时打开。读不到（隐私模式 / SSR）就回落到构建期值。
 */
export function readRuntimeSwitch(): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('mock');
    if (fromUrl !== null) {
      const value = fromUrl.trim().toLowerCase();
      if (['0', 'false', 'off', 'no'].includes(value)) return false;
      if (['1', 'true', 'on', 'yes'].includes(value)) return true;
    }
    const stored = window.localStorage?.getItem('BACKEND_MOCK_ENABLED');
    if (stored !== null && stored !== undefined) return isEnvEnabled(stored);
    if (typeof window.__BACKEND_MOCK_ENABLED__ === 'boolean') {
      return window.__BACKEND_MOCK_ENABLED__;
    }
  } catch {
    // 读不到就按构建期开关走，不因为隐私模式把整站请求拦掉
  }
  return undefined;
}

/**
 * 浏览器内 mock 默认只在生产构建里装。
 *
 * dev 下 `VITE_MOCK` 同样是 `true`，但那时 `/api` 由 vite proxy 转给 Nitro 实时服务
 * （「Mock 数据中心」面板调延迟、停用、生成接口都靠它）。这里再拦一道会把实时 mock 顶掉，
 * 面板就成了一堆永远改不动的假数据；只有显式给运行时开关才允许 dev 强开。
 *
 * `VITE_MOCK` 来自 `import.meta.env`，运行时是字符串，必须走 `isEnvEnabled`。
 */
export function isBrowserMockEnabled(
  env: BrowserMockEnv = import.meta.env as unknown as BrowserMockEnv,
): boolean {
  const runtime = readRuntimeSwitch();
  if (runtime !== undefined) return runtime;
  if (env.PROD === false) return false;
  return isEnvEnabled(env.VITE_MOCK);
}

/**
 * 命中开关才 `import()` 拦截器模块：fixtures 是几百 KB 的快照，
 * 开关关着时它必须待在另一个 chunk 里、不进首屏主包。
 */
export async function installBrowserMockIfEnabled(
  env: BrowserMockEnv = import.meta.env as unknown as BrowserMockEnv,
): Promise<void> {
  if (!isBrowserMockEnabled(env)) return;
  const { installBrowserMock } = await import('./browser');
  installBrowserMock();
}
