import type { UserInfo } from "#/user";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useLogger } from "@/composables/useLogger";
import { cache } from "@/utils/cache";
import { http } from "@/utils/request";

const TOKEN_KEY = "auth_token";
const USER_INFO_KEY = "user_info";
const TOKEN_EXPIRE = 3 * 60 * 60;

export const useUserStore = defineStore("user", () => {
  // 初始化时先尝试从缓存读取（可能是旧格式明文）
  const storedToken = cache.getItem(TOKEN_KEY) as string | null;
  const token = ref<string | null>(storedToken);
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) as UserInfo | null);

  /**
   * 异步初始化 Token（解密）
   * 需要在应用启动后调用
   */
  async function initToken() {
    const stored = cache.getItem(TOKEN_KEY) as string | null;
    if (stored) {
      try {
        token.value = stored;
      } catch {
        // 解密失败，可能不是加密格式，直接使用
        token.value = stored;
      }
    }
  }

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

  const login = async (username: string, password: string) => {
    try {
      const response = await http.Post<{
        code: number;
        data: any;
        message: string;
      }>("/auth/login", { username, password });

      if (response.code === 200) {
        const { user } = response.data;
        console.log(user, "user");
        const mockUserInfo: UserInfo = {
          id: typeof user.id === "string" ? Number(user.id) : user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          avatar: user.avatar || "",
          email: user.email || "",
          roles: user.roles || [],
        };

        cache.setItem(TOKEN_KEY, response.data.accessToken, TOKEN_EXPIRE);
        setUserInfo(mockUserInfo);
        token.value = response.data.accessToken;
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

  const logout = () => {
    // 记录登出日志
    const logger = useLogger();
    if (userInfo.value?.username) {
      logger.logLogin("logout", userInfo.value.username);
    }

    token.value = null;
    userInfo.value = null;
    cache.removeItem(TOKEN_KEY);
    cache.removeItem(USER_INFO_KEY);
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
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
    fetchCurrentUser,
  };
});
