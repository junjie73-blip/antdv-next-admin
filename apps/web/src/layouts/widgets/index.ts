import type { WidgetKey, WidgetMeta } from './types';

import { defineAsyncComponent } from 'vue';

import { useAppStore } from '~/stores';

/**
 * 包一次就好，别在模板里包。
 *
 * `defineAsyncComponent` 每调一次就产生一个新的组件**类型**；模板里现包的话，
 * 顶栏每次重渲染（切换路由、主题、侧栏都会）都会让每个小部件卸载重挂：
 * `WidgetSearch` 的 `useMagicKeys` 监听随之被拆掉重建，Ctrl+K 有概率正好落在
 * 空窗期里按了没反应，入场动画也反复重播。
 */
const lazy = (loader: () => Promise<unknown>) =>
  defineAsyncComponent(loader as never);

export const WIDGET_MAP: Record<WidgetKey, WidgetMeta> = {
  search: {
    key: 'search',
    title: '搜索菜单',
    icon: 'carbon:search',
    component: lazy(() => import('./WidgetSearch.vue')),
  },
  fullscreen: {
    key: 'fullscreen',
    title: '全屏',
    icon: 'ant-design:fullscreen-outlined',
    component: lazy(() => import('./WidgetFullscreen.vue')),
  },
  theme: {
    key: 'theme',
    title: '主题',
    icon: 'carbon:contrast',
    component: lazy(() => import('./WidgetTheme.vue')),
  },
  timezone: {
    key: 'timezone',
    title: '时区',
    icon: 'carbon:time',
    component: lazy(() => import('./WidgetTimezone.vue')),
  },
  notice: {
    key: 'notice',
    title: '通知',
    icon: 'carbon:notification',
    component: lazy(() => import('./WidgetNotice.vue')),
  },
  preferences: {
    key: 'preferences',
    title: '偏好设置',
    icon: 'carbon:settings',
    component: lazy(() => import('./WidgetPreferences.vue')),
  },
  logout: {
    key: 'logout',
    title: '退出登录',
    icon: 'carbon:logout',
    component: lazy(() => import('./WidgetLogout.vue')),
  },
};

/**
 * 每个小部件对应哪个偏好开关。
 *
 * 以前这段是一个 `switch (meta.key)` + `default: return false`：
 * 往 `WIDGET_MAP` 里加了条目却忘了配 case，编译器与 lint 都不吭声，
 * 症状是"偏好设置里明明有开关，顶栏永远不出现"——通知铃铛正是这样哑掉的
 * （`widgetNotice` 默认 true，用户能拨动一个永远不生效的开关）。
 * 换成 `Record<WidgetKey, …>`，少一项就是类型错误。
 */
const WIDGET_VISIBLE: Record<
  WidgetKey,
  (store: ReturnType<typeof useAppStore>) => boolean
> = {
  fullscreen: (store) => store.widgetFullscreen,
  logout: (store) => store.widgetLogout,
  notice: (store) => store.widgetNotice,
  preferences: (store) => store.widgetPreferences,
  search: (store) => store.widgetSearch,
  theme: (store) => store.widgetTheme,
  timezone: (store) => store.widgetTimezone,
};

/** 根据 store 配置，返回要渲染的小部件列表（顺序 = `WIDGET_MAP` 的声明顺序） */
export function useVisibleWidgets(): WidgetMeta[] {
  const appStore = useAppStore();
  return Object.values(WIDGET_MAP).filter((meta) =>
    WIDGET_VISIBLE[meta.key]?.(appStore),
  );
}

export type { WidgetKey, WidgetMeta } from './types';
