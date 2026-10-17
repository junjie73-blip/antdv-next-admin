import { CacheKey } from '@antdv/enums';
import { configureRequest } from '@antdv/request';
import { cache } from '@antdv/shared/cache';
import { LOGIN_PATH } from '~/config/constants';
import { useUserStore } from '@antdv/stores';

/**
 * `@antdv/request` 只管 HTTP，凭证存哪、登录页在哪、退出要清什么，全由这里注入。
 *
 * 只能由入口调用：本文件把 `~/stores` 拖进了模块图，测试 setup 碰了会让别人的
 * `vi.mock` 失效（与 `table-runtime.ts` 同一个约束）。
 * 取凭证的回调都是现取现算，所以这里不需要等 pinia 装好。
 */
export function configureRequestRuntime(): void {
  configureRequest({
    baseUrl: import.meta.env.VITE_APP_BASE_API ?? '',
    loginPath: LOGIN_PATH,
    onLogout: () => useUserStore().logout(),
    tokens: {
      // store 里是解密后的明文凭证；缓存里是 JWE 密文，不能当凭证用
      access: () => useUserStore().token,
      refresh: () => cache.getItem(CacheKey.REFRESH_TOKEN) as null | string,
      setAccess: (token) => useUserStore().setToken(token),
      setRefresh: (token) => cache.setItem(CacheKey.REFRESH_TOKEN, token),
    },
  });
}
