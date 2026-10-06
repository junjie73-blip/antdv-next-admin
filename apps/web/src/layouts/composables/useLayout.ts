import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAppStore } from '~/stores/modules/app'
import { useRouteStore } from '~/stores/modules/route'

export const COLLAPSED_WIDTH = 64
export const DEFAULT_SIDEBAR_WIDTH = 220

/* ============================================================
 * useLayout —— 布局状态
 * ============================================================ */
export function useLayout() {
  const appStore = useAppStore()
  const isMobile = ref(false)

  const collapsed = computed({
    get: () => appStore.sidebarCollapsed,
    set: (v: boolean) => appStore.updateSetting({ sidebarCollapsed: v }),
  })

  const sidebarWidth = computed(
    () => appStore.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
  )

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  function checkMobile() {
    const w = window.innerWidth
    isMobile.value = w < 768
    // 移动端自动收起
    if (isMobile.value && !collapsed.value) {
      collapsed.value = true
    }
  }

  return {
    collapsed,
    isMobile,
    sidebarWidth,
    toggleCollapsed,
    checkMobile,
  }
}

/* ============================================================
 * useBreadcrumb —— 面包屑
 * ============================================================ */
export interface BreadcrumbItem {
  title: string
  path: string
  icon?: string
}

export function useBreadcrumb() {
  const route = useRoute()
  const routeStore = useRouteStore()

  const breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = []
    const matched = route.matched.filter((r) => r.meta?.title)

    for (const r of matched) {
      if (!r.meta?.title) continue
      items.push({
        title: r.meta.title as string,
        path: r.path,
        icon: r.meta.icon as string | undefined,
      })
    }

    // 若路由没声明 meta.title，退化为从菜单里找
    if (items.length === 0 && route.name) {
      const chain = findMenuChain(routeStore.menus, route.name as string)
      return chain
    }

    return items
  })

  return { breadcrumbs }
}

/** 从菜单树找 name 对应的祖先链（含自身） */
function findMenuChain(
  menus: any[],
  targetName: string,
  parents: BreadcrumbItem[] = [],
): BreadcrumbItem[] {
  for (const m of menus) {
    const key = m.name || m.title
    const current: BreadcrumbItem = {
      title: m.title,
      path: m.path || '',
      icon: m.icon,
    }

    if (key === targetName) {
      return [...parents, current]
    }

    if (m.children?.length) {
      const found = findMenuChain(m.children, targetName, [...parents, current])
      if (found.length) return found
    }
  }
  return []
}

/* ============================================================
 * 菜单状态已迁移：
 * - useMenuTree    —— 三种布局共享的菜单数据源（key = name ?? path ?? title）
 * - useSidebarMenu —— 侧边栏选中 / 展开态
 * - useHeaderMenu  —— 顶部横向导航选中态
 * 旧的 useMenu 用 route.name 当唯一 key，且把整棵树的 key 写成 menu.path
 * （后端菜单大多没有 path），导致「选中一项、多项高亮」，故整体删除。
 * ============================================================ */
