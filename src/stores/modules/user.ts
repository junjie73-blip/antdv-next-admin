import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserInfo } from '#/user'

import { getPermissions, getProfile } from '~/api'
// ⭐ 新的统一入口
import { request, requestCache, resetLogoutFlag } from '~/composables'
import { PERMISSIONS_KEY, REFRESH_TOKEN_KEY, TOKEN_KEY, USER_INFO_KEY } from '~/config/constants'
import { cache } from '~/utils/cache'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(cache.getItem(TOKEN_KEY) || null)
  const refreshToken = ref<string | null>(cache.getItem(REFRESH_TOKEN_KEY) || null)
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) || null)
  const permissions = ref<string[]>(cache.getItem(PERMISSIONS_KEY) || [])
  const router = useRouter()

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const nickname = computed(() => userInfo.value?.realname || '')
  const avatar = computed(() => userInfo.value?.avatar || '')
  const email = computed(() => userInfo.value?.email || '')
  const phone = computed(() => userInfo.value?.phone || '')
  const roles = computed(() => userInfo.value?.roles || [])

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
    cache.setItem(USER_INFO_KEY, info)
  }

  async function loadPermissions() {
    try {
      // ⭐ getPermissions 内部也换成 request，见下文 ~/api
      const { data: list } = await getPermissions()
      permissions.value = list || []
      cache.setItem(PERMISSIONS_KEY, permissions.value)
    } catch (e) {
      console.error('[UserStore] 拉取权限失败', e)
      permissions.value = []
    }
  }

  const login = async (username: string, password: string, tenantCode: string, captcha: any) => {
    try {
      const response = await request.post<any>('/auth/login', {
        username,
        password,
        tenantCode,
        ...captcha,
      })

      if (response.code === 200) {
        const { user, accessToken, refreshToken: rt } = response.data
        resetLogoutFlag()

        const mockUserInfo: UserInfo = {
          userId: user.userId,
          username: user.username,
          realname: user.realname || user.username,
          avatar: user.avatar || '',
          email: user.email || '',
          roles: user.roles || [],
          phone: user.phone || '',
        }

        cache.setItem(TOKEN_KEY, accessToken)
        cache.setItem(REFRESH_TOKEN_KEY, rt)
        cache.setItem(USER_INFO_KEY, mockUserInfo)
        token.value = accessToken
        refreshToken.value = rt
        userInfo.value = mockUserInfo

        const res = await getProfile()
        await loadPermissions()
        setUserInfo(res)
        requestCache.clear()
        return { success: true }
      }

      return { success: false, message: response.message || '登录失败' }
    } catch (error) {
      if (error instanceof Error) {
        console.error('[UserStore] 登录请求失败:', error)
        return { success: false, message: error.message || '网络请求失败' }
      }
      return { success: false, message: '登录异常，请重试' }
    }
  }

  let logoutPromise: Promise<void> | null = null
  async function logout() {
    if (logoutPromise) return logoutPromise

    logoutPromise = (async () => {
      try {
        if (token.value) {
          await request.post('/auth/logout', {})
        }
      } catch {
        // 忽略登出接口错误
      } finally {
        token.value = ''
        refreshToken.value = ''
        userInfo.value = null
        logoutPromise = null
        permissions.value = []
        cache.clear()
        requestCache.clear()
        router.replace('/login')
      }
    })()

    return logoutPromise
  }

  const hasPermission = (permission: string) => {
    if (permissions.value.includes('*')) return true
    return permissions.value.includes(permission)
  }

  const hasRole = (role: string) => roles.value.includes(role)

  async function fetchCurrentUser() {
    // ⭐ 保持调用形式：request.get 同样返回完整 envelope
    const res: any = await request.get('/auth/profile')
    const profile = res?.data ?? res
    userInfo.value = profile
    cache.setItem(USER_INFO_KEY, profile)
    await loadPermissions()
    return profile
  }

  const setToken = (accessToken: string, _refreshToken: string) => {
    token.value = accessToken
    refreshToken.value = _refreshToken
    cache.setItem(TOKEN_KEY, accessToken)
    cache.setItem(REFRESH_TOKEN_KEY, _refreshToken)
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
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
    refreshToken,
    fetchCurrentUser,
    setToken,
    loadPermissions,
  }
})
