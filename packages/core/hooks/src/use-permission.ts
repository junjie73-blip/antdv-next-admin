import { computed, readonly, ref } from 'vue';

import { useUserStore } from '@antdv/stores';

export enum PermissionMode {
  STRICT = 'strict',
  LOOSE = 'loose',
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGE = 'manage',
  ADMIN = 'admin',
}

export enum PermissionResource {
  USER = 'user',
  ROLE = 'role',
  MENU = 'menu',
  SETTINGS = 'settings',
  LOGS = 'logs',
}

/** `isAdmin()` 认的两个角色，值与后端下发的角色码一致 */
export enum PermissionRole {
  SUPER = 'super',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
  resource: PermissionResource;
  actions: PermissionAction[];
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  permissions: string[];
}

export interface PermissionCheckOptions {
  mode?: PermissionMode;
  strict?: boolean;
}

/**
 * `strict` 决定「用户一条权限都没配」时的口径：默认判否，
 * 关掉后空列表放行，给"后端还没发权限码"的开发期用。
 */
export interface UsePermissionOptions {
  mode?: PermissionMode;
  strict?: boolean;
}

/** 权限码通配哨兵：用户列表里出现它，任何要求都算满足 */
const WILDCARD = '*';

export function usePermission(options: UsePermissionOptions = {}) {
  const userStore = useUserStore();
  const strict = ref(options.strict === undefined ? true : options.strict);

  const permissions = computed(() => userStore.permissions);
  const roles = computed(() => userStore.roles);

  function checkAuth(): boolean {
    if (!userStore.isLoggedIn) {
      return false;
    }
    return true;
  }

  /**
   * 数组比对：`'*'` 是全通哨兵（后端给超管发 `permissions: ['*']`，就不必逐条列举），
   * 剩下的才是 `some`/`every` 的字面量包含。用户列表为空时按 `strict` 决定成败。
   */
  function checkArrayMatch(
    userList: string[],
    requiredList: string[],
    mode: 'every' | 'some',
  ): boolean {
    if (userList.includes(WILDCARD)) {
      return true;
    }
    if (userList.length === 0) {
      return !strict.value;
    }
    return mode === 'some'
      ? requiredList.some((item) => userList.includes(item))
      : requiredList.every((item) => userList.includes(item));
  }

  const hasPermission = (permission: string): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(permissions.value, [permission], 'some');
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(permissions.value, requiredPermissions, 'some');
  };

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(permissions.value, requiredPermissions, 'every');
  };

  const hasRole = (role: string): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(roles.value, [role], 'some');
  };

  const hasAnyRole = (requiredRoles: string[]): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(roles.value, requiredRoles, 'some');
  };

  const hasAllRoles = (requiredRoles: string[]): boolean => {
    if (!checkAuth()) return false;
    return checkArrayMatch(roles.value, requiredRoles, 'every');
  };

  const isAdmin = (): boolean => {
    if (!checkAuth()) return false;

    return (
      roles.value.includes(PermissionRole.SUPER) ||
      roles.value.includes(PermissionRole.ADMIN)
    );
  };

  const checkPermission = (
    requiredPermissions: string | string[],
    options?: { mode?: 'all' | 'any' },
  ): boolean => {
    const perms = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    if (options?.mode === 'any') {
      return hasAnyPermission(perms);
    }

    return hasAllPermissions(perms);
  };

  const checkRole = (
    requiredRoles: string | string[],
    options?: { mode?: 'all' | 'any' },
  ): boolean => {
    const roleList = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    if (options?.mode === 'any') {
      return hasAnyRole(roleList);
    }

    return hasAllRoles(roleList);
  };

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
  };
}
