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

export enum PermissionRole {
  SUPER = 'super',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export interface Permission {
  id: string
  name: string
  code: string
  description?: string
  resource: PermissionResource
  actions: PermissionAction[]
}

export interface Role {
  id: string
  name: string
  code: string
  description?: string
  permissions: string[]
}

export interface PermissionCheckOptions {
  mode?: PermissionMode
  strict?: boolean
}

export interface PermissionDirectiveBinding {
  value: string | string[] | { permission: string | string[], mode?: PermissionMode }
  arg?: string
  modifiers?: Record<string, boolean>
}

export interface UsePermissionOptions {
  mode?: PermissionMode
  strict?: boolean
}

export interface UsePermissionReturn {
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasAllRoles: (roles: string[]) => boolean
  isAdmin: () => boolean
  permissions: string[]
  roles: string[]
}
