import { defineAsyncComponent } from 'vue'

import { useAppStore } from '~/stores'

import type { WidgetKey, WidgetMeta } from './types'

export const WIDGET_MAP: Record<WidgetKey, WidgetMeta> = {
  search: {
    key: 'search',
    title: '搜索菜单',
    icon: 'carbon:search',
    component: () => import('./WidgetSearch.vue'),
  },
  fullscreen: {
    key: 'fullscreen',
    title: '全屏',
    icon: 'ant-design:fullscreen-outlined',
    component: () => import('./WidgetFullscreen.vue'),
  },
  theme: {
    key: 'theme',
    title: '主题',
    icon: 'carbon:contrast',
    component: () => import('./WidgetTheme.vue'),
  },
  timezone: {
    key: 'timezone',
    title: '时区',
    icon: 'carbon:time',
    component: () => import('./WidgetTimezone.vue'),
  },
  notice: {
    key: 'notice',
    title: '通知',
    icon: 'carbon:notification',
    component: () => import('./WidgetNotice.vue'),
  },

  preferences: {
    key: 'preferences',
    title: '偏好设置',
    icon: 'carbon:settings',
    component: () => import('./WidgetPreferences.vue'),
  },
  logout: {
    key: 'logout',
    title: '退出登录',
    icon: 'carbon:logout',
    component: () => import('./WidgetLogout.vue'),
  },
}

/** 根据 store 配置，返回要渲染的小部件列表 */
export function useVisibleWidgets(): WidgetMeta[] {
  const appStore = useAppStore()

  return Object.values(WIDGET_MAP).filter((meta) => {
    switch (meta.key) {
      case 'notice':
        return appStore.widgetNotice
      case 'fullscreen':
        return appStore.widgetFullscreen
      case 'theme':
        return appStore.widgetTheme
      case 'timezone':
        return appStore.widgetTimezone
      case 'logout':
        return appStore.widgetLogout
      case 'search':
        return appStore.widgetSearch
      case 'preferences':
        return appStore.widgetPreferences
      default:
        return false
    }
  })
}

export { defineAsyncComponent }
