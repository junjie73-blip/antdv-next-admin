import { CacheKey } from '@antdv/enums';
import { getRequestRuntime, resetRequestRuntime } from '@antdv/request';
import { cache } from '@antdv/shared/cache';
import { useUserStore } from '@antdv/stores';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_PATH } from '~/config/constants';
import { configureRequestRuntime } from '~/plugins/request-runtime';

/**
 * 请求层包不认识 pinia、缓存与路由，凭证与登录页全靠这里注入，
 * 所以用例读的是包那边的 `getRequestRuntime()`：注入没接对，取到的是包的默认值或抛错。
 *
 * 回调都是调用时才现取 store（`useUserStore()` 要等 pinia 装好），因此这里先建 pinia。
 */
describe('configureRequestRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureRequestRuntime();
  });

  afterEach(() => {
    resetRequestRuntime();
    vi.restoreAllMocks();
  });

  it('把接口前缀与登录页路径交给包', () => {
    const runtime = getRequestRuntime();

    expect(runtime.baseUrl).toBe(import.meta.env.VITE_APP_BASE_API ?? '');
    expect(runtime.loginPath).toBe(LOGIN_PATH);
  });

  it('访问令牌读写走 user store，不碰缓存里那串密文', async () => {
    const userStore = useUserStore();
    // store 的 setToken 会做 JWE 落盘（jsdom 没有 crypto.subtle），这里只验路由
    const setToken = vi
      .spyOn(userStore, 'setToken')
      .mockResolvedValue(undefined);
    const { tokens } = getRequestRuntime();

    tokens.setAccess('plain-token');
    expect(setToken).toHaveBeenCalledWith('plain-token');

    userStore.token = 'plain-token';
    expect(tokens.access()).toBe('plain-token');

    userStore.token = null;
    expect(tokens.access()).toBeNull();
  });

  it('刷新令牌读写走缓存', () => {
    const { tokens } = getRequestRuntime();

    expect(tokens.refresh()).toBeNull();

    tokens.setRefresh('refresh-token');
    expect(tokens.refresh()).toBe('refresh-token');
    expect(cache.getItem(CacheKey.REFRESH_TOKEN)).toBe('refresh-token');
  });

  it('会话失效时由 user store 收尾', () => {
    const userStore = useUserStore();
    const logout = vi.spyOn(userStore, 'logout').mockImplementation(() => {});

    getRequestRuntime().onLogout();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
