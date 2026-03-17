import type { Directive, DirectiveBinding } from 'vue'
import type { PermissionDirectiveBinding } from './types'
import { usePermission } from '@/composables/web/permission'

export const vPermission: Directive<HTMLElement, PermissionDirectiveBinding> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionDirectiveBinding>) {
    updatePermission(el, binding)
  },

  updated(el: HTMLElement, binding: DirectiveBinding<PermissionDirectiveBinding>) {
    updatePermission(el, binding)
  },
}

function updatePermission(el: HTMLElement, binding: DirectiveBinding<PermissionDirectiveBinding>) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, hasAllRoles, isAdmin } = usePermission()

  const value = binding.value
  const arg = binding.arg
  const modifiers = binding.modifiers || {}

  let hasAccess = false

  if (typeof value === 'string') {
    hasAccess = hasPermission(value)
  }
  else if (Array.isArray(value)) {
    if (value.length === 0) {
      hasAccess = true
    }
    else if (modifiers.all) {
      hasAccess = hasAllPermissions(value)
    }
    else {
      hasAccess = hasAnyPermission(value)
    }
  }
  else if (typeof value === 'object' && value !== null) {
    const permissionValue = value as unknown as { permission: string | string[], mode?: string }
    const permissions = Array.isArray(permissionValue.permission)
      ? permissionValue.permission
      : [permissionValue.permission]

    if (permissionValue.mode === 'all') {
      hasAccess = hasAllPermissions(permissions)
    }
    else {
      hasAccess = hasAnyPermission(permissions)
    }
  }
  else if (arg) {
    if (arg === 'role') {
      if (typeof value === 'string') {
        hasAccess = hasRole(value)
      }
      else if (Array.isArray(value)) {
        if (modifiers.all) {
          hasAccess = hasAllRoles(value)
        }
        else {
          hasAccess = hasAnyRole(value)
        }
      }
    }
    else if (arg === 'admin') {
      hasAccess = isAdmin()
    }
  }
  else {
    hasAccess = true
  }

  if (modifiers.hide) {
    if (hasAccess) {
      el.style.display = ''
    }
    else {
      el.style.display = 'none'
    }
  }
  else if (modifiers.disabled) {
    if (hasAccess) {
      el.removeAttribute('disabled')
      el.classList.remove('permission-disabled')
    }
    else {
      el.setAttribute('disabled', 'true')
      el.classList.add('permission-disabled')
    }
  }
  else {
    if (hasAccess) {
      el.style.display = ''
      el.removeAttribute('disabled')
      el.classList.remove('permission-disabled')
    }
    else {
      el.style.display = 'none'
      el.setAttribute('disabled', 'true')
      el.classList.add('permission-disabled')
    }
  }
}
