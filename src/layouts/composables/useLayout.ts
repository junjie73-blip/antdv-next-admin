import { computed, ref, watch } from 'vue'
import { useRoute, type RouteLocationMatched } from 'vue-router'
import { useToggle, useMediaQuery, useFullscreen as _useFullscreen } from '@vueuse/core'
import type { LayoutMode } from '#/app'
import type { MenuConfig } from '#/menu'

export type { LayoutMode }

export const COLLAPSED_WIDTH = 80

const [collapsed, toggleCollapsed] = useToggle(false)
const isMobile = useMediaQuery('(max-width: 767px)')
const { isFullscreen: _isFullscreenRef, toggle: _toggleFullscreenFn } = _useFullscreen()
const isFullscreenRef = _isFullscreenRef
const toggleFullscreenFn = _toggleFullscreenFn

watch(isMobile, (mobile) => {
  if (mobile) {
    collapsed.value = true
  }
})

function checkMobile() {
  void isMobile
}

function setCollapsed(value: boolean) {
  collapsed.value = value
}

export function useLayout() {
  return {
    collapsed,
    isMobile,
    isFullscreen: isFullscreenRef,
    toggleCollapsed,
    toggleFullscreen: toggleFullscreenFn,
    checkMobile,
    setCollapsed,
    COLLAPSED_WIDTH,
  }
}

export function useFullscreen() {
  return {
    isFullscreen: isFullscreenRef,
    toggle: toggleFullscreenFn,
  }
}

export function useBreadcrumb() {
  const route = useRoute()
  const breadcrumbs = computed(() => {
    const matched = route.matched.filter(
      item => item.meta && typeof item.meta === 'object' && 'title' in item.meta,
    )
    return matched.map((item: RouteLocationMatched & { meta: Record<string, unknown> }) => ({
      title: (item.meta?.title as string) || '',
      path: item.path,
    }))
  })
  return { breadcrumbs }
}

function getParentPaths(path: string): string[] {
  const parents: string[] = []
  const segments = path.split('/').filter(Boolean)
  let current = ''
  for (let i = 0; i < segments.length - 1; i++) {
    current += `/${segments[i]}`
    parents.push(current)
  }
  return parents
}

export function useMenu(_menus?: MenuConfig[]) {
  const route = useRoute()
  const selectedKeys = ref<string[]>([])
  const openKeys = ref<string[]>([])

  watch(
    () => route.path,
    (path) => {
      selectedKeys.value = [path]
      const parents = getParentPaths(path)
      parents.forEach((parent) => {
        if (!openKeys.value.includes(parent)) {
          openKeys.value = [...openKeys.value, parent]
        }
      })
    },
    { immediate: true },
  )

  function handleOpenChange(keys: string[]) {
    openKeys.value = keys
  }

  return {
    selectedKeys,
    openKeys,
    handleOpenChange,
  }
}
