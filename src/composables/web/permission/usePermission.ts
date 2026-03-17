import type { UsePermissionOptions } from './types'
import { computed, readonly, ref } from 'vue'
import { useAuthStore } from '@/stores/modules/auth'
import {
  PermissionRole,

} from './types'

export function usePermission(options: UsePermissionOptions = {}) {
  const authStore = useAuthStore()
  const strict = ref(options.strict !== undefined ? options.strict : true)

  const permissions = computed(() => authStore.userInfo?.permissions || [])
  const roles = computed(() => authStore.roles || [])

  const hasPermission = (permission: string): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userPermissions = permissions.value

    if (userPermissions.length === 0) {
      return !strict.value
    }

    return userPermissions.includes(permission)
  }

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userPermissions = permissions.value

    if (userPermissions.length === 0) {
      return !strict.value
    }

    return requiredPermissions.some(permission =>
      userPermissions.includes(permission),
    )
  }

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userPermissions = permissions.value

    if (userPermissions.length === 0) {
      return !strict.value
    }

    return requiredPermissions.every(permission =>
      userPermissions.includes(permission),
    )
  }

  const hasRole = (role: string): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userRoles = roles.value

    if (userRoles.length === 0) {
      return !strict.value
    }

    return userRoles.includes(role)
  }

  const hasAnyRole = (requiredRoles: string[]): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userRoles = roles.value

    if (userRoles.length === 0) {
      return !strict.value
    }

    return requiredRoles.some(role => userRoles.includes(role))
  }

  const hasAllRoles = (requiredRoles: string[]): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    const userRoles = roles.value

    if (userRoles.length === 0) {
      return !strict.value
    }

    return requiredRoles.every(role => userRoles.includes(role))
  }

  const isAdmin = (): boolean => {
    if (!authStore.isAuthenticated) {
      return false
    }

    return (
      authStore.userInfo?.role === PermissionRole.SUPER
      || authStore.userInfo?.role === PermissionRole.ADMIN
    )
  }

  const checkPermission = (
    requiredPermissions: string | string[],
    options?: { mode?: 'any' | 'all' },
  ): boolean => {
    const perms = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions]

    if (options?.mode === 'any') {
      return hasAnyPermission(perms)
    }

    return hasAllPermissions(perms)
  }

  const checkRole = (
    requiredRoles: string | string[],
    options?: { mode?: 'any' | 'all' },
  ): boolean => {
    const roleList = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles]

    if (options?.mode === 'any') {
      return hasAnyRole(roleList)
    }

    return hasAllRoles(roleList)
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    checkPermission,
    checkRole,
    permissions: readonly(permissions),
    roles: readonly(roles),
  }
}
