import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

interface UserInfo {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  roles?: string[];
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<null | string>(null);
  const userInfo = ref<null | UserInfo>(null);
  const roles = ref<string[]>([]);

  const isAuthenticated = computed(() => !!token.value);

  const setToken = (newToken: string) => {
    token.value = newToken;
  };

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info;
    roles.value = info.roles || [];
  };

  const logout = () => {
    token.value = null;
    userInfo.value = null;
    roles.value = [];
  };

  return {
    token,
    userInfo,
    roles,
    isAuthenticated,
    setToken,
    setUserInfo,
    logout,
  };
});
