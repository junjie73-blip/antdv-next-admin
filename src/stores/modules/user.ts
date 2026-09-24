import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserInfo } from '#/user'

import { getPermissions, getProfile } from '~/api'
import {
  PERMISSIONS_KEY,
  REFRESH_TOKEN_EXPIRE,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRE,
  TOKEN_KEY,
  USER_INFO_KEY,
} from '~/config/constants'
import { cache } from '~/utils/cache'
import { http } from '~/utils/request'
import { resetLogoutFlag } from '~/utils/request/alova'

export const useUserStore = defineStore('user', () => {
  // ✅ 同步从 cache 读，读到什么就是什么
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

  /** ✅ 修正：有 info 就用 info，不再重新请求；同时写 ref + cache */
  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
    cache.setItem(USER_INFO_KEY, info)
  }
  async function loadPermissions() {
    try {
      const list = await getPermissions()
      permissions.value = list || []
      cache.setItem(PERMISSIONS_KEY, permissions.value)
    } catch (e) {
      console.error('[UserStore] 拉取权限失败', e)
      permissions.value = []
    }
  }
  const login = async (username: string, password: string, tenantCode: string, captcha: any) => {
    try {
      const response = await http.Post<any>('/auth/login', {
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

        // ✅ 先写缓存（同步落盘），再写 ref
        cache.setItem(TOKEN_KEY, accessToken)
        cache.setItem(REFRESH_TOKEN_KEY, rt)
        cache.setItem(USER_INFO_KEY, mockUserInfo)
        token.value = accessToken
        refreshToken.value = rt
        userInfo.value = mockUserInfo

        const res = await getProfile()
        await loadPermissions()
        setUserInfo(res)
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
          // 只在还有 token 时才调接口
          await http.Post('/auth/logout', {}, { meta: { token: true } })
        }
      } catch {
        // 忽略登出接口错误，本地状态照清
      } finally {
        token.value = ''
        refreshToken.value = ''
        userInfo.value = null
        logoutPromise = null
        permissions.value = []
        cache.clear()
        router.replace('/login')
        window.location.reload()
      }
    })()

    return logoutPromise
  }

  const hasPermission = (permission: string) => {
    if (permissions.value.includes('*')) return true
    return permissions.value.includes(permission)
  }

  const hasRole = (role: string) => roles.value.includes(role)

  /** ✅ 刷新场景兜底：token 有但 userInfo 丢了 → 重新拉一次 */
  async function fetchCurrentUser() {
    const res: any = await http.Get('/auth/profile')
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
