import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'

export type LayoutMode = 'vertical' | 'horizontal' | 'mixed'

export interface LayoutState {
  collapsed: boolean
  isMobile: boolean
  sidebarWidth: number
  headerHeight: number
}

export const COLLAPSED_WIDTH = 80

export function useLayout() {
  const appStore = useAppStore()

  const collapsed = ref(false)
  const isMobile = ref(false)

  const sidebarWidth = computed(() => {
    return collapsed.value ? COLLAPSED_WIDTH : appStore.sidebarWidth
  })

  const headerHeight = computed(() => 48)

  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value
  }

  const setCollapsed = (value: boolean) => {
    collapsed.value = value
  }

  const checkMobile = () => {
    isMobile.value = window.innerWidth < 768
    if (isMobile.value) {
      collapsed.value = true
    }
  }

  return {
    collapsed,
    isMobile,
    sidebarWidth,
    headerHeight,
    toggleCollapsed,
    setCollapsed,
    checkMobile,
  }
}

export function useMenu() {
  const appStore = useAppStore()
  const route = useRoute()

  const selectedKeys = computed(() => {
    const path = route.path
    return [path]
  })

  const openKeys = ref<string[]>([])

  const menuTheme = computed(() => {
    return appStore.darkSidebar ? 'dark' : 'light'
  })

  const handleMenuSelect = ({ key }: { key: string }) => {
    console.log('Menu selected:', key)
  }

  const handleOpenChange = (keys: string[]) => {
    openKeys.value = keys
  }

  return {
    selectedKeys,
    openKeys,
    menuTheme,
    handleMenuSelect,
    handleOpenChange,
  }
}

export interface BreadcrumbItem {
  title: string
  path: string
  icon?: string
}

export function useBreadcrumb() {
  const route = useRoute()

  const breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const matched = route.matched.filter(item => item.meta && item.meta.title)
    return matched.map(item => ({
      title: String(item.meta?.title || ''),
      path: item.path,
      icon: item.meta?.icon as string | undefined,
    }))
  })

  return {
    breadcrumbs,
  }
}

export function useFullscreen() {
  const isFullscreen = ref(false)

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      isFullscreen.value = true
    }
    else {
      document.exitFullscreen()
      isFullscreen.value = false
    }
  }

  return {
    isFullscreen,
    toggle,
  }
}
