import type { AppSetting, ComponentSize, LayoutMode, NotificationPosition, RouteMode, ThemeMode, ThemeStyle, TransitionEffect } from '@/settings'
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
  const showFooter = computed(() => appSetting.value.showFooter)
  const enableWaterRipple = computed(() => appSetting.value.enableWaterRipple)
  const transitionEffect = computed(() => appSetting.value.transitionEffect)
  const locale = computed(() => appSetting.value.locale)
  const enableWatermark = computed(() => appSetting.value.enableWatermark)
  const watermarkContent = computed(() => appSetting.value.watermarkContent)
  const sidebarCollapsed = computed(() => appSetting.value.sidebarCollapsed)
  const routeMode = computed(() => appSetting.value.routeMode)

  const setTheme = (mode: ThemeMode) => {
    appSetting.value.theme = mode
  }

  const toggleTheme = () => {
    appSetting.value.theme = appSetting.value.theme === 'light' ? 'dark' : 'light'
  }

  const setThemeStyle = (style: ThemeStyle) => {
    appSetting.value.themeStyle = style
  }

  const setComponentSize = (size: ComponentSize) => {
    appSetting.value.componentSize = size
  }

  const setLayout = (mode: LayoutMode) => {
    appSetting.value.layout = mode
  }

  const setDarkSidebar = (enabled: boolean) => {
    appSetting.value.darkSidebar = enabled
  }

  const toggleDarkSidebar = () => {
    appSetting.value.darkSidebar = !appSetting.value.darkSidebar
  }

  const setDarkHeader = (enabled: boolean) => {
    appSetting.value.darkHeader = enabled
  }

  const toggleDarkHeader = () => {
    appSetting.value.darkHeader = !appSetting.value.darkHeader
  }

  const setColorWeak = (enabled: boolean) => {
    appSetting.value.colorWeak = enabled
  }

  const toggleColorWeak = () => {
    appSetting.value.colorWeak = !appSetting.value.colorWeak
  }

  const setGrayMode = (enabled: boolean) => {
    appSetting.value.grayMode = enabled
  }

  const toggleGrayMode = () => {
    appSetting.value.grayMode = !appSetting.value.grayMode
  }

  const setBorderRadius = (radius: number) => {
    appSetting.value.borderRadius = radius
  }

  const setNotificationPosition = (position: NotificationPosition) => {
    appSetting.value.notificationPosition = position
  }

  const setSidebarWidth = (width: number) => {
    appSetting.value.sidebarWidth = width
  }

  const setShowBreadcrumb = (show: boolean) => {
    appSetting.value.showBreadcrumb = show
  }

  const toggleBreadcrumb = () => {
    appSetting.value.showBreadcrumb = !appSetting.value.showBreadcrumb
  }

  const setShowTabs = (show: boolean) => {
    appSetting.value.showTabs = show
  }

  const toggleTabs = () => {
    appSetting.value.showTabs = !appSetting.value.showTabs
  }

  const setShowFooter = (show: boolean) => {
    appSetting.value.showFooter = show
  }

  const toggleFooter = () => {
    appSetting.value.showFooter = !appSetting.value.showFooter
  }

  const setEnableWaterRipple = (enabled: boolean) => {
    appSetting.value.enableWaterRipple = enabled
  }

  const toggleWaterRipple = () => {
    appSetting.value.enableWaterRipple = !appSetting.value.enableWaterRipple
  }

  const setTransitionEffect = (effect: TransitionEffect) => {
    appSetting.value.transitionEffect = effect
  }

  const setLocale = (newLocale: string) => {
    appSetting.value.locale = newLocale
  }

  const setEnableWatermark = (enabled: boolean) => {
    appSetting.value.enableWatermark = enabled
  }

  const toggleWatermark = () => {
    appSetting.value.enableWatermark = !appSetting.value.enableWatermark
  }

  const setWatermarkContent = (content: string) => {
    appSetting.value.watermarkContent = content
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    appSetting.value.sidebarCollapsed = collapsed
  }

  const toggleSidebar = () => {
    appSetting.value.sidebarCollapsed = !appSetting.value.sidebarCollapsed
  }

  const setRouteMode = (mode: RouteMode) => {
    appSetting.value.routeMode = mode
  }

  const updateSetting = (setting: Partial<AppSetting>) => {
    appSetting.value = { ...appSetting.value, ...setting }
  }

  const resetSetting = () => {
    appSetting.value = { ...DEFAULT_SETTING }
  }

  return {
    appSetting,
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
    showFooter,
    enableWaterRipple,
    transitionEffect,
    locale,
    enableWatermark,
    watermarkContent,
    sidebarCollapsed,
    routeMode,
    setTheme,
    toggleTheme,
    setThemeStyle,
    setComponentSize,
    setLayout,
    setDarkSidebar,
    toggleDarkSidebar,
    setDarkHeader,
    toggleDarkHeader,
    setColorWeak,
    toggleColorWeak,
    setGrayMode,
    toggleGrayMode,
    setBorderRadius,
    setNotificationPosition,
    setSidebarWidth,
    setShowBreadcrumb,
    toggleBreadcrumb,
    setShowTabs,
    toggleTabs,
    setShowFooter,
    toggleFooter,
    setEnableWaterRipple,
    toggleWaterRipple,
    setTransitionEffect,
    setLocale,
    setEnableWatermark,
    toggleWatermark,
    setWatermarkContent,
    setSidebarCollapsed,
    toggleSidebar,
    setRouteMode,
    updateSetting,
    resetSetting,
  }
})
