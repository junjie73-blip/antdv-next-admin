import type { LayoutMode } from '#/app'
import type { MenuConfig } from '#/menu'
import type { RouteLocationMatched } from 'vue-router'
import { useFullscreen as _useFullscreen, useMediaQuery, useToggle } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores'

export type { LayoutMode }

export const COLLAPSED_WIDTH = 80
const isMobile = useMediaQuery('(max-width: 767px)')
const { isFullscreen: _isFullscreenRef, toggle: _toggleFullscreenFn } = _useFullscreen()
const isFullscreenRef = _isFullscreenRef
const toggleFullscreenFn = _toggleFullscreenFn

export function useLayout() {
  const store = useAppStore()

  return {
    collapsed: computed(() => store.sidebarCollapsed),
    isMobile,
    isFullscreen: isFullscreenRef,
    toggleCollapsed: store.toggleSidebar,
    toggleFullscreen: toggleFullscreenFn,
    checkMobile: () => isMobile.value,
    setCollapsed: (value: boolean) => store.updateSetting({
      sidebarCollapsed: value,
    }),
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

/** 获取菜单项的层级映射（用于手风琴模式） */
interface LevelKeyItem { key?: string, children?: LevelKeyItem[] }

function getLevelKeys(items: LevelKeyItem[]): Record<string, number> {
  const map: Record<string, number> = {}
  const walk = (list: LevelKeyItem[], level = 1) => {
    for (const item of list) {
      if (item.key)
        map[item.key] = level
      if (item.children)
        walk(item.children, level + 1)
    }
  }
  walk(items)
  return map
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
      // 手风琴模式：路由变化时只展开当前路径的最后一个父级
      if (parents.length > 0)
        openKeys.value = [parents[parents.length - 1]]
      else
        openKeys.value = []
    },
    { immediate: true },
  )

  /**
   * 手风琴模式：点谁展谁，其他的全关掉
   * 算法参考 Antdv Next 官方 sider-current demo
   */
  function handleOpenChange(keys: string[], levelKeys?: Record<string, number>) {
    const currentOpenKey = keys.find(key => !openKeys.value.includes(key))
    const closedKey = openKeys.value.find(key => !keys.includes(key))

    if (currentOpenKey !== undefined) {
      // 展开操作
      if (levelKeys) {
        const repeatIndex = keys
          .filter(k => k !== currentOpenKey)
          .findIndex(k => levelKeys[k] === levelKeys[currentOpenKey])

        openKeys.value = keys
          .filter((_, i) => i !== repeatIndex)
          .filter(k => (levelKeys[k] ?? 0) <= (levelKeys[currentOpenKey] ?? 0))
      }
      else {
        openKeys.value = [currentOpenKey]
      }
    }
    else if (closedKey !== undefined) {
      // 收起操作：确实有 key 被关闭了
      openKeys.value = keys
    }
    // 既没有展开也没有收起，忽略（点击菜单项触发的无关事件，openKeys 由路由 watcher 维护）
  }

  return {
    selectedKeys,
    openKeys,
    handleOpenChange,
  }
}
