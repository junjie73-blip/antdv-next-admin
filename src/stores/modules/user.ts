import type { UserInfo } from '#/user'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cache } from '@/utils/cache'
import { http } from '@/utils/request'

const TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'
const TOKEN_EXPIRE = 24 * 60 * 60

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(cache.getItem(TOKEN_KEY) as string | null)
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) as UserInfo | null)

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const nickname = computed(() => userInfo.value?.nickname || '')
  const avatar = computed(() => userInfo.value?.avatar || '')
  const email = computed(() => userInfo.value?.email || '')
  const phone = computed(() => userInfo.value?.phone || '')
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
    try {
      const response = await http.Post<{
        code: number
        data: {
          user: {
            id: number
            username: string
            nickname?: string
            avatar?: string
            email?: string
            phone?: string
            token: string
            roles: string[]
            permissions: string[]
          }
        }
        message: string
      }>('/auth/login', { username, password })

      if (response.code === 200) {
        const { user } = response.data
        const mockUserInfo: UserInfo = {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          avatar: user.avatar || '',
          email: user.email || '',
          phone: user.phone || '',
          roles: user.roles || [],
          permissions: user.permissions || [],
        }

        setToken(user.token)
        setUserInfo(mockUserInfo)

        return { success: true }
      }

      return { success: false, message: response.message || '登录失败' }
    }
    catch {
      return { success: false, message: '网络请求失败' }
    }
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
    nickname,
    avatar,
    email,
    phone,
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
