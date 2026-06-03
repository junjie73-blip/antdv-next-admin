import type { AppSetting } from '@/settings'
import { theme } from 'antdv-next'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_SETTING } from '@/settings'

export const useAppStore = defineStore('app', () => {
  const { token } = theme.useToken()

  const appSetting = ref<AppSetting>({ ...DEFAULT_SETTING })

  const themeMode = computed(() => appSetting.value.theme)
  const themeStyle = computed(() => appSetting.value.themeStyle)
  const componentSize = computed(() => appSetting.value.componentSize)
  const primaryColor = computed(() => appSetting.value.primaryColor)
  const layout = computed(() => appSetting.value.layout)
  const darkSidebar = computed(() => appSetting.value.darkSidebar)
  const darkHeader = computed(() => appSetting.value.darkHeader)
  const colorWeak = computed(() => appSetting.value.colorWeak)
  const grayMode = computed(() => appSetting.value.grayMode)
  const borderRadius = computed(() => appSetting.value.borderRadius)
  const notificationPosition = computed(() => appSetting.value.notificationPosition)
  const sidebarWidth = computed(() => appSetting.value.sidebarWidth)
  const showBreadcrumb = computed(() => appSetting.value.showBreadcrumb)
  const showTabs = computed(() => appSetting.value.showTabs)
  const tabShowIcon = computed(() => appSetting.value.tabShowIcon)
  const showFooter = computed(() => appSetting.value.showFooter)
  const enableWaterRipple = computed(() => appSetting.value.enableWaterRipple)
  const transitionEffect = computed(() => appSetting.value.transitionEffect)
  const locale = computed(() => appSetting.value.locale)
  const enableWatermark = computed(() => appSetting.value.enableWatermark)
  const watermarkContent = computed(() => appSetting.value.watermarkContent)
  const sidebarCollapsed = computed(() => appSetting.value.sidebarCollapsed)
  const routeMode = computed(() => appSetting.value.routeMode)

  const updateSetting = (setting: Partial<AppSetting>) => {
    appSetting.value = { ...appSetting.value, ...setting }
  }

  const resetSetting = () => {
    appSetting.value = { ...DEFAULT_SETTING }
  }

  const toggleTheme = () => {
    updateSetting({ theme: appSetting.value.theme === 'light' ? 'dark' : 'light' })
  }

  const toggleDarkSidebar = () => updateSetting({ darkSidebar: !appSetting.value.darkSidebar })

  const toggleDarkHeader = () => updateSetting({ darkHeader: !appSetting.value.darkHeader })

  const toggleColorWeak = () => updateSetting({ colorWeak: !appSetting.value.colorWeak })

  const toggleGrayMode = () => updateSetting({ grayMode: !appSetting.value.grayMode })

  const toggleBreadcrumb = () => updateSetting({ showBreadcrumb: !appSetting.value.showBreadcrumb })

  const toggleTabs = () => updateSetting({ showTabs: !appSetting.value.showTabs })

  const toggleTabShowIcon = () => updateSetting({ tabShowIcon: !appSetting.value.tabShowIcon })

  const toggleFooter = () => updateSetting({ showFooter: !appSetting.value.showFooter })

  const toggleWaterRipple = () => updateSetting({ enableWaterRipple: !appSetting.value.enableWaterRipple })

  const toggleWatermark = () => updateSetting({ enableWatermark: !appSetting.value.enableWatermark })

  const toggleSidebar = () => updateSetting({ sidebarCollapsed: !appSetting.value.sidebarCollapsed })

  return {
    appSetting,
    token,
    themeMode,
    themeStyle,
    componentSize,
    primaryColor,
    layout,
    darkSidebar,
    darkHeader,
    colorWeak,
    grayMode,
    borderRadius,
    notificationPosition,
    sidebarWidth,
    showBreadcrumb,
    showTabs,
    tabShowIcon,
    showFooter,
    enableWaterRipple,
    transitionEffect,
    locale,
    enableWatermark,
    watermarkContent,
    sidebarCollapsed,
    routeMode,
    updateSetting,
    resetSetting,
    toggleTheme,
    toggleDarkSidebar,
    toggleDarkHeader,
    toggleColorWeak,
    toggleGrayMode,
    toggleBreadcrumb,
    toggleTabs,
    toggleTabShowIcon,
    toggleFooter,
    toggleWaterRipple,
    toggleWatermark,
    toggleSidebar,
  }
})
