import type { UserInfo } from "#/user";
import { defineStore, disposePinia, getActivePinia } from "pinia";
import { computed, ref } from "vue";
import { useLogger } from "@/composables/useLogger";
import { cache } from "@/utils/cache";
import { http } from "@/utils/request";
import { useRouter } from "vue-router";

const TOKEN_KEY = "auth_token";
const USER_INFO_KEY = "user_info";
const TOKEN_EXPIRE = 7 * 60 * 60;
const REFRESH_TOKEN_KEY = "refresh_token";
const REFRESH_TOKEN_EXPIRE = 3 * 3600;

export const useUserStore = defineStore("user", () => {
  // 初始化时先尝试从缓存读取（可能是旧格式明文）
  const storedToken = cache.getItem(TOKEN_KEY) as string | null;
  const token = ref<string | null>(storedToken);
  const refreshToken = ref<string | null>(cache.getItem(REFRESH_TOKEN_KEY) as string | null);
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) as UserInfo | null);
  const router = useRouter();

  const isLoggedIn = computed(() => !!token.value);
  const username = computed(() => userInfo.value?.username || "");
  const nickname = computed(() => userInfo.value?.nickname || "");
  const avatar = computed(() => userInfo.value?.avatar || "");
  const email = computed(() => userInfo.value?.email || "");
  const phone = computed(() => userInfo.value?.phone || "");
  const roles = computed(() => userInfo.value?.roles || []);
  const permissions = computed(() => userInfo.value?.permissions || []);

  const setUserInfo = async (info: UserInfo) => {
    const response = await http.Get<UserInfo>("/auth/profile");
    userInfo.value = response.data;
    cache.setItem(USER_INFO_KEY, response.data);
  };

  const login = async (username: string, password: string, tenantCode: string) => {
    try {
      const response = await http.Post<any>("/auth/login", { username, password, tenantCode });

      if (response.code === 200) {
        const { user } = response.data;
        const mockUserInfo: UserInfo = {
          userId: user.userId,
          username: user.username,
          realname: user.realname || user.username,
          avatar: user.avatar || "",
          email: user.email || "",
          roles: user.roles || [],
          phone: user.phone || "",
        };
        cache.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken, REFRESH_TOKEN_EXPIRE);
        cache.setItem(TOKEN_KEY, response.data.accessToken, TOKEN_EXPIRE);
        setUserInfo(mockUserInfo);
        token.value = response.data.accessToken;
        refreshToken.value = response.data.refreshToken;
        // 记录登录成功日志
        const logger = useLogger();
        logger.logLogin("success", response.data.username);
        return { success: true };
      }

      // 记录登录失败日志
      const logger = useLogger();
      logger.logLogin("failure", username, response.message || "登录失败");

      return { success: false, message: response.message || "登录失败" };
    } catch (error) {
      // 区分不同类型的错误，提供准确的错误信息
      if (error instanceof Error) {
        console.error("[UserStore] 登录请求失败:", error);
        return { success: false, message: error.message || "网络请求失败" };
      }

      return { success: false, message: "登录异常，请重试" };
    }
  };
  const logout = async () => {
    try {
      await http.Post("/auth/logout", {}, { meta: { silent: true } });
    } catch {
      // 即使后端失败，也要清空本地状态
    }

    const logger = useLogger();
    if (userInfo.value?.username) {
      logger.logLogin("logout", userInfo.value.username);
    }

    token.value = null;
    refreshToken.value = null;
    userInfo.value = null;
    cache.removeItem(TOKEN_KEY);
    cache.removeItem(REFRESH_TOKEN_KEY);
    cache.removeItem(USER_INFO_KEY);

    router.replace("/login");
  };

  const hasPermission = (permission: string) => {
    if (permissions.value.includes("*")) {
      return true;
    }
    return permissions.value.includes(permission);
  };

  const hasRole = (role: string) => {
    return roles.value.includes(role);
  };
  async function fetchCurrentUser() {
    const res: any = await http.Get("/auth/profile");
    userInfo.value = res.data;
  }
  const setToken = (accessToken: string, _refreshToken: string) => {
    token.value = accessToken;
    refreshToken.value = _refreshToken;
    cache.setItem(REFRESH_TOKEN_KEY, _refreshToken, REFRESH_TOKEN_EXPIRE);
    cache.setItem(TOKEN_KEY, accessToken, TOKEN_EXPIRE);
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
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
    refreshToken,
    fetchCurrentUser,
    setToken,
  };
});
