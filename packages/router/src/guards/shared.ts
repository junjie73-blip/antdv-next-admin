import type { AuthGuardDependencies } from '../meta';

import { GUEST_ONLY_PATHS, isOneOf } from '../meta';

/**
 * 已登录用户不该再看到的页面（登录页 + 注册页这类访客页）。
 *
 * 登录守卫与动态路由守卫都要这个判断，放在共享模块里——
 * 两处各写一遍的话，加一个 `/invite` 就会只有一半守卫认识它。
 */
export function isGuestOnly(
  path: string,
  deps: Pick<AuthGuardDependencies, 'guestOnlyPaths' | 'loginPath'>,
): boolean {
  if (path === deps.loginPath) return true;
  return isOneOf(deps.guestOnlyPaths ?? GUEST_ONLY_PATHS, path);
}
