import type { LayoutMode } from '#/app'
import type { MenuConfig } from '#/menu'
import type { RouteLocationMatched } from 'vue-router'
import { useFullscreen as _useFullscreen, useMediaQuery, useToggle } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

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

/** 获取菜单项的层级映射（用于手风琴模式） */
interface LevelKeyItem { key?: string; children?: LevelKeyItem[] }

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

    if (currentOpenKey !== undefined && levelKeys) {
      // 展开操作：过滤掉同层级的其他已展开项
      const repeatIndex = keys
        .filter(k => k !== currentOpenKey)
        .findIndex(k => levelKeys[k] === levelKeys[currentOpenKey])

      openKeys.value = keys
        .filter((_, i) => i !== repeatIndex)
        .filter(k => (levelKeys[k] ?? 0) <= (levelKeys[currentOpenKey] ?? 0))
    }
    else if (currentOpenKey !== undefined) {
      // 没有层级信息时：只保留最新点击的那个
      openKeys.value = [currentOpenKey]
    }
    else {
      // 收起操作
      openKeys.value = keys
    }
  }

  return {
    selectedKeys,
    openKeys,
    handleOpenChange,
  }
}
