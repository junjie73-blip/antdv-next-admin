import type { UsePermissionOptions } from './types'
import { computed, readonly, ref } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import {
  PermissionRole,

} from './types'

export function usePermission(options: UsePermissionOptions = {}) {
  const userStore = useUserStore()
  const strict = ref(options.strict !== undefined ? options.strict : true)

  const permissions = computed(() => userStore.permissions)
  const roles = computed(() => userStore.roles)

  function checkAuth(): boolean {
    if (!userStore.isLoggedIn) {
      return false
    }
    return true
  }

  function checkArrayMatch(userList: string[], requiredList: string[], mode: 'some' | 'every'): boolean {
    if (userList.length === 0) {
      return !strict.value
    }
    return mode === 'some'
      ? requiredList.some(item => userList.includes(item))
      : requiredList.every(item => userList.includes(item))
  }

  const hasPermission = (permission: string): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(permissions.value, [permission], 'some')
  }

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(permissions.value, requiredPermissions, 'some')
  }

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(permissions.value, requiredPermissions, 'every')
  }

  const hasRole = (role: string): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(roles.value, [role], 'some')
  }

  const hasAnyRole = (requiredRoles: string[]): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(roles.value, requiredRoles, 'some')
  }

  const hasAllRoles = (requiredRoles: string[]): boolean => {
    if (!checkAuth())
      return false
    return checkArrayMatch(roles.value, requiredRoles, 'every')
  }

  const isAdmin = (): boolean => {
    if (!checkAuth())
      return false

    return (
      roles.value.includes(PermissionRole.SUPER)
      || roles.value.includes(PermissionRole.ADMIN)
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
