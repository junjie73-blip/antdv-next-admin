import type { UserInfo } from '#/user'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cache } from '@/utils/cache'

const TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'
const TOKEN_EXPIRE = 24 * 60 * 60

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(cache.getItem(TOKEN_KEY) as string | null)
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) as UserInfo | null)

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const avatar = computed(() => userInfo.value?.avatar || '')
  const roles = computed(() => userInfo.value?.roles || [])
  const permissions = computed(() => userInfo.value?.permissions || [])

  const setToken = (newToken: string, expire?: number) => {
    token.value = newToken
    cache.setItem(TOKEN_KEY, newToken, expire ?? TOKEN_EXPIRE)
  }

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
    cache.setItem(USER_INFO_KEY, info)
  }

  const login = async (username: string, password: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))

    if (username === 'admin' && password === 'admin123') {
      const mockToken = `mock_token_${Date.now()}`
      const mockUserInfo: UserInfo = {
        id: 1,
        username: 'admin',
        nickname: '管理员',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: ['*'],
      }

      setToken(mockToken)
      setUserInfo(mockUserInfo)

      return { success: true }
    }

    return { success: false, message: '用户名或密码错误' }
  }

  const logout = () => {
    token.value = null
    userInfo.value = null
    cache.removeItem(TOKEN_KEY)
    cache.removeItem(USER_INFO_KEY)
  }

  const hasPermission = (permission: string) => {
    if (permissions.value.includes('*')) {
      return true
    }
    return permissions.value.includes(permission)
  }

  const hasRole = (role: string) => {
    return roles.value.includes(role)
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    username,
    avatar,
    roles,
    permissions,
    setToken,
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
  }
})
