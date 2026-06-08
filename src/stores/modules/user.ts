import type { UserInfo } from '#/user'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLogger } from '@/composables/useLogger'
import { cache } from '@/utils/cache'
import { decryptToken, encryptToken } from '@/utils/cache/tokenCrypto'
import { http } from '@/utils/request'

const TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'
const TOKEN_EXPIRE = 24 * 60 * 60

export const useUserStore = defineStore('user', () => {
  // 初始化时先尝试从缓存读取（可能是旧格式明文）
  const storedToken = cache.getItem(TOKEN_KEY) as string | null
  const token = ref<string | null>(storedToken)
  const userInfo = ref<UserInfo | null>(cache.getItem(USER_INFO_KEY) as UserInfo | null)

  /**
   * 异步初始化 Token（解密）
   * 需要在应用启动后调用
   */
  async function initToken() {
    const stored = cache.getItem(TOKEN_KEY) as string | null
    if (stored) {
      try {
        token.value = await decryptToken(stored)
      }
      catch {
        // 解密失败，可能不是加密格式，直接使用
        token.value = stored
      }
    }
  }

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const nickname = computed(() => userInfo.value?.nickname || '')
  const avatar = computed(() => userInfo.value?.avatar || '')
  const email = computed(() => userInfo.value?.email || '')
  const phone = computed(() => userInfo.value?.phone || '')
  const roles = computed(() => userInfo.value?.roles || [])
  const permissions = computed(() => userInfo.value?.permissions || [])

  const setToken = async (newToken: string, expire?: number) => {
    token.value = newToken
    // 加密后存储到缓存
    const encrypted = await encryptToken(newToken)
    cache.setItem(TOKEN_KEY, encrypted, expire ?? TOKEN_EXPIRE)
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
            id: number | string
            username: string
            nickname?: string
            avatar?: string
            email?: string
            phone?: string
            token: string
            roles?: string[]
            permissions?: string[]
          }
        }
        message: string
      }>('/auth/login', { username, password })

      if (response.code === 200) {
        const { user } = response.data
        const mockUserInfo: UserInfo = {
          id: typeof user.id === 'string' ? Number(user.id) : user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          avatar: user.avatar || '',
          email: user.email || '',
          phone: user.phone || '',
          roles: user.roles ?? ['admin'],
          permissions: user.permissions ?? ['*'],
        }

        // 安全存储 Token（加密可能失败，需要降级处理）
        try {
          await setToken(user.token)
        }
        catch (encryptError) {
          // 加密失败时降级为明文存储 + 控制台警告
          console.warn('[UserStore] ⚠️ Token 加密失败，降级为明文存储:', encryptError)
          token.value = user.token
          cache.setItem(TOKEN_KEY, user.token, TOKEN_EXPIRE)
        }

        setUserInfo(mockUserInfo)

        // 记录登录成功日志
        const logger = useLogger()
        logger.logLogin('success', user.username)

        return { success: true }
      }

      // 记录登录失败日志
      const logger = useLogger()
      logger.logLogin('failure', username, response.message || '登录失败')

      return { success: false, message: response.message || '登录失败' }
    }
    catch (error) {
      // 区分不同类型的错误，提供准确的错误信息
      if (error instanceof Error) {
        console.error('[UserStore] 登录请求失败:', error)
        return { success: false, message: error.message || '网络请求失败' }
      }

      return { success: false, message: '登录异常，请重试' }
    }
  }

  const logout = () => {
    // 记录登出日志
    const logger = useLogger()
    if (userInfo.value?.username) {
      logger.logLogin('logout', userInfo.value.username)
    }

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
    initToken,
    setToken,
    setUserInfo,
    login,
    logout,
    hasPermission,
    hasRole,
  }
})
