import type { UserInfo } from '@antdv/types';

import { computed, ref } from 'vue';

import { cache, decryptToken, encryptToken } from '@antdv/shared/cache';
import { defineStore } from 'pinia';
import { http } from '~/composables';
// 只取纯函数（不依赖组件上下文），避免把布局层 composables 整体拉进 store
import { resetPageCache } from '~/layouts/composables/usePageCache';

import { useRouteStore } from './route';
import { useTabsStore } from './tabs';

const TOKEN_KEY = 'auth_token';
const USER_INFO_KEY = 'user_info';
const TOKEN_EXPIRE = 24 * 60 * 60;

export const useUserStore = defineStore('user', () => {
  // 初始化时先尝试从缓存读取（可能是旧格式明文）
  const storedToken = cache.getItem(TOKEN_KEY) as null | string;
  const token = ref<null | string>(storedToken);
  const userInfo = ref<null | UserInfo>(
    cache.getItem(USER_INFO_KEY) as null | UserInfo,
  );

  /**
   * 把缓存里的凭证还原成可用的 token（解密）。
   *
   * `setToken` 落盘的是 JWE 密文，而 store 建好时的同步初始化只能直接读缓存，
   * 于是刷新后 `token` 里躺着一串密文：`isLoggedIn` 看着是"已登录"，请求头却是
   * `Bearer <JWE>` —— 后端认不出，等于每次刷新都掉一次登录态。
   * 必须在挂载（也就是路由守卫第一次取菜单）之前 await 这一步。
   *
   * 解密失败（设备指纹变了、值被改过）就当作没登录，宁可回登录页也不要
   * 带着一个永远 401 的凭证继续跑。
   */
  async function initToken() {
    const stored = cache.getItem(TOKEN_KEY) as null | string;
    if (!stored) return;
    try {
      token.value = await decryptToken(stored);
    } catch {
      // 不是加密格式（旧版本明文），按原样用
      token.value = stored;
    }
  }

  const isLoggedIn = computed(() => !!token.value);
  const username = computed(() => userInfo.value?.username || '');
  const nickname = computed(() => userInfo.value?.nickname || '');
  const avatar = computed(() => userInfo.value?.avatar || '');
  const email = computed(() => userInfo.value?.email || '');
  const phone = computed(() => userInfo.value?.phone || '');
  const roles = computed(() => userInfo.value?.roles || []);
  const permissions = computed(() => userInfo.value?.permissions || []);

  const setToken = async (newToken: string, expire?: number) => {
    token.value = newToken;
    // 加密后存储到缓存
    const encrypted = await encryptToken(newToken);
    cache.setItem(TOKEN_KEY, encrypted, expire ?? TOKEN_EXPIRE);
  };

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info;
    cache.setItem(USER_INFO_KEY, info);
  };

  /**
   * 会话态里"由当前账号推导出来"的三样东西。
   *
   * 换账号时必须整体作废，不能只清凭证：
   *
   * - 页面缓存里存的是上一个账号的组件实例（表单草稿、表格分页、图表数据都在里面），
   *   不清掉就会出现"换个账号进来，页面还是上一个人的状态"。
   * - 路由 store：`isLoaded` 仍是 true，守卫看到它就跳过 `loadRoutes()`，
   *   于是菜单和 `allowedNames/allowedPaths` 还是上一个人的。菜单看着对、
   *   权限判的却是别人的 —— 本应用是"菜单即权限"，带着别人的授权集接着跑
   *   等于越权。`resetRoutes()` 把 `isLoaded` 打回 false，下次导航重新拉菜单。
   * - 标签页 store：残留的 tab 指向新账号未必有权的页面，点进去就是空白或 403。
   *
   * `./route`、`./tabs` 都不引用 `./user`，所以顶层静态 import 不会成环。
   */
  const clearDerivedSession = () => {
    resetPageCache();
    useRouteStore().resetRoutes();
    useTabsStore().reset();
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await http.Post<{
        code: number;
        data: {
          user: {
            id: number | string;
            username: string;
            nickname?: string;
            avatar?: string;
            email?: string;
            phone?: string;
            token: string;
            roles?: string[];
            permissions?: string[];
          };
        };
        message: string;
      }>('/auth/login', { username, password });

      if (response.code === 200) {
        const { user } = response.data;
        /**
         * 先作废上一个账号的派生授权，再写入新会话。
         *
         * 登录页可以在"已经登录"的状态下被直接打开（手动改 hash、后退），
         * 这时路由 store 里还挂着旧账号的 `allowedNames/allowedPaths` 与
         * `isLoaded === true`；不重置的话守卫会跳过重新拉菜单，
         * 新账号拿着一份别人的授权集 —— 权限更小时是 403 错乱，权限更大时是越权。
         */
        clearDerivedSession();
        const mockUserInfo: UserInfo = {
          id: typeof user.id === 'string' ? Number(user.id) : user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          avatar: user.avatar || '',
          email: user.email || '',
          phone: user.phone || '',
          // 后端没给就当没有：兜底成 admin / '*' 等于"接口一坏就升超管"
          roles: user.roles ?? [],
          permissions: user.permissions ?? [],
        };

        // 安全存储 Token（加密可能失败，需要降级处理）
        try {
          await setToken(user.token);
        } catch (encryptError) {
          // 加密失败时降级为明文存储 + 控制台警告
          console.warn(
            '[UserStore] ⚠️ Token 加密失败，降级为明文存储:',
            encryptError,
          );
          token.value = user.token;
          cache.setItem(TOKEN_KEY, user.token, TOKEN_EXPIRE);
        }

        setUserInfo(mockUserInfo);

        return { success: true };
      }

      return { success: false, message: response.message || '登录失败' };
    } catch (error) {
      // 区分不同类型的错误，提供准确的错误信息
      if (error instanceof Error) {
        console.error('[UserStore] 登录请求失败:', error);
        return { success: false, message: error.message || '网络请求失败' };
      }

      return { success: false, message: '登录异常，请重试' };
    }
  };

  const logout = () => {
    token.value = null;
    userInfo.value = null;
    cache.removeItem(TOKEN_KEY);
    cache.removeItem(USER_INFO_KEY);
    clearDerivedSession();
  };

  const hasPermission = (permission: string) => {
    if (permissions.value.includes('*')) {
      return true;
    }
    return permissions.value.includes(permission);
  };

  const hasRole = (role: string) => {
    return roles.value.includes(role);
  };

  return {
    token,
    userInfo,
    isLoggedIn,
    username,
    nickname,
    avatar,
    email,
    phone,
    roles,
    permissions,
    initToken,
    setToken,
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
  };
});
