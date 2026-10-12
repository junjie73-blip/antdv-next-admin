import { isEnvEnabled } from '@antdv/shared/env';

export interface BrowserMockEnv {
  PROD?: boolean;
  VITE_APP_BASE_API?: string;
  VITE_MOCK?: unknown;
}

/**
 * 浏览器内 mock 只在生产构建里装。
 *
 * dev 下 `VITE_MOCK` 同样是 `true`，但那时 `/api` 由 vite proxy 转给 Nitro 实时服务
 * （「Mock 数据中心」面板调延迟、停用、生成接口都靠它）。这里再拦一道会把实时 mock 顶掉，
 * 面板就成了一堆永远改不动的假数据。
 *
 * `VITE_MOCK` 来自 `import.meta.env`，运行时是字符串，必须走 `isEnvEnabled`。
 */
export function isBrowserMockEnabled(
  env: BrowserMockEnv = import.meta.env as unknown as BrowserMockEnv,
): boolean {
  return !!env.PROD && isEnvEnabled(env.VITE_MOCK);
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
