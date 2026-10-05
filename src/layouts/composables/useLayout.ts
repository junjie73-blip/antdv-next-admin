import type { MenuProps } from 'antdv-next'

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAppStore } from '~/stores/modules/app'
import { useRouteStore } from '~/stores/modules/route'

type AntdMenuItem = NonNullable<MenuProps['items']>[number]

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
 * useMenu —— 侧边栏菜单状态（key 用 menu.name）
 * ============================================================ */
export function useMenu() {
  const route = useRoute()
  const router = useRouter()

  const menuTree = ref<AntdMenuItem[]>([])
  const selectedKeys = ref<string[]>([])
  const openKeys = ref<string[]>([])
  /** 是否由用户手动控制 openKeys（避免 watch 覆盖） */
  const userControlledOpen = ref(false)

  function setMenuTree(items: AntdMenuItem[]) {
    menuTree.value = items
  }

  /** 判断某个 key 是否是另一个 key 的祖先（按菜单树结构） */
  function findAncestorKeys(
    items: AntdMenuItem[],
    targetKey: string,
    parents: string[] = [],
  ): string[] | null {
    for (const item of items) {
      const key = item?.key as string
      if (!key) continue

      if (key === targetKey) return parents

      const children = (item as any).children as AntdMenuItem[] | undefined
      if (children?.length) {
        const found = findAncestorKeys(children, targetKey, [...parents, key])
        if (found) return found
      }
    }
    return null
  }

  /** 路由变化 → 同步选中态与展开态 */
  function syncMenuByRoute() {
    const name = route.name as string | undefined
    if (!name) {
      selectedKeys.value = []
      return
    }

    // 选中态：route.name 就是菜单 key
    selectedKeys.value = [name]

    // 如果用户没手动操作过，自动展开父级
    if (!userControlledOpen.value) {
      const ancestors = findAncestorKeys(menuTree.value, name)
      openKeys.value = ancestors ?? []
    }
  }

  function handleOpenChange(keys: string[]) {
    openKeys.value = keys
    // 用户操作后不再自动覆盖，除非切路由
    userControlledOpen.value = true
  }

  /** 点击菜单 → 用 name 跳转 */
  function handleMenuSelect(key: string) {
    if (!key) return
    // 已在当前页
    if (key === route.name) return
    // 无对应路由 → 忽略（外链由 <a> 处理）
    if (!router.hasRoute(key)) {
      console.warn('[menu] 无对应路由 name:', key)
      return
    }
    router.push({ name: key })
  }

  // 路由变化时重置用户控制标记，让下次自动展开生效
  watch(
    () => route.name,
    () => {
      userControlledOpen.value = false
      syncMenuByRoute()
    },
    { immediate: true },
  )

  return {
    menuTree,
    selectedKeys,
    openKeys,
    setMenuTree,
    syncMenuByRoute,
    handleOpenChange,
    handleMenuSelect,
  }
}
