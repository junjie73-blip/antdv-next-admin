import { type Directive, type DirectiveBinding, watch } from 'vue'

import type { PermissionDirectiveBinding } from '~/composables/web/permission/types'

import { usePermission } from '~/composables/web/permission'
import { useUserStore } from '~/stores/modules/user'

import { isBindingChanged, resolveAccess } from './utils'

/* ============================================================
 * 元素状态缓存
 * ============================================================ */

interface ElementState {
  /** 原始 display（mounted 时记录） */
  originalDisplay: string
  /** 上一次的 binding，用于变化比较 */
  prevBinding: DirectiveBinding<PermissionDirectiveBinding> | null
  /** watch 停止函数 */
  stopWatch: (() => void) | null
  /** 是否有 .disabled 修饰符 */
  disabledMode: boolean
}

const stateMap = new WeakMap<HTMLElement, ElementState>()

/* ============================================================
 * 核心：应用权限结果到 DOM
 * ============================================================ */

function applyToElement(el: HTMLElement, hasAccess: boolean, state: ElementState): void {
  const { disabledMode } = state

  if (disabledMode) {
    /* ---------- 禁用模式 ---------- */
    if (hasAccess) {
      el.removeAttribute('disabled')
      el.removeAttribute('aria-disabled')
      el.classList.remove('permission-disabled')
      ;(el as HTMLButtonElement).disabled = false
    } else {
      el.setAttribute('disabled', 'disabled')
      el.setAttribute('aria-disabled', 'true')
      el.classList.add('permission-disabled')
      if ('disabled' in el) {
        ;(el as HTMLButtonElement).disabled = true
      }
    }
    return
  }

  /* ---------- 隐藏模式（默认） ---------- */
  if (hasAccess) {
    // 恢复原始 display
    if (state.originalDisplay) {
      el.style.display = state.originalDisplay
    } else {
      el.style.removeProperty('display')
    }
    el.removeAttribute('disabled')
    el.removeAttribute('aria-disabled')
    el.classList.remove('permission-disabled')
  } else {
    el.style.display = 'none'
    el.setAttribute('disabled', 'disabled')
    el.setAttribute('aria-disabled', 'true')
    el.classList.add('permission-disabled')
  }
}

/* ============================================================
 * 指令定义
 * ============================================================ */

export const vPermission: Directive<HTMLElement, PermissionDirectiveBinding> = {
  mounted(el, binding) {
    // 1. 记录原始 display
    const originalDisplay = el.style.display || ''

    // 2. 保存状态
    const state: ElementState = {
      originalDisplay,
      prevBinding: null,
      stopWatch: null,
      disabledMode: !!binding.modifiers?.disabled,
    }
    stateMap.set(el, state)

    // 3. 首次执行
    performCheck(el, binding, state)

    // 4. ⭐ 监听权限变化（关键修复：解决 mounted 过早问题）
    const userStore = useUserStore()
    const stopWatch = watch(
      () => userStore.permissions,
      () => performCheck(el, binding, state),
      { deep: true },
    )
    state.stopWatch = stopWatch
  },

  updated(el, binding) {
    const state = stateMap.get(el)
    if (!state) return

    // ⭐ 只在 binding 值真正变化时才重跑
    if (!isBindingChanged(state.prevBinding, binding)) {
      return
    }

    state.disabledMode = !!binding.modifiers?.disabled
    performCheck(el, binding, state)
  },

  unmounted(el) {
    const state = stateMap.get(el)
    if (state?.stopWatch) {
      state.stopWatch()
    }
    stateMap.delete(el)
  },
}

/* ============================================================
 * 执行权限判断
 * ============================================================ */

function performCheck(el: HTMLElement, binding: DirectiveBinding<any>, state: ElementState): void {
  const helpers = usePermission()

  const hasAccess = resolveAccess(binding, {
    hasPermission: helpers.hasPermission,
    hasAnyPermission: helpers.hasAnyPermission,
    hasAllPermissions: helpers.hasAllPermissions,
    hasRole: helpers.hasRole,
    hasAnyRole: helpers.hasAnyRole,
    hasAllRoles: helpers.hasAllRoles,
    isAdmin: helpers.isAdmin,
  })

  // 开发环境打印，方便排查
  if (import.meta.env.DEV) {
    console.log('[v-permission]', {
      value: binding.value,
      arg: binding.arg,
      modifiers: binding.modifiers,
      hasAccess,
      currentPermissions: helpers.permissions,
    })
  }

  applyToElement(el, hasAccess, state)
  state.prevBinding = binding
}
