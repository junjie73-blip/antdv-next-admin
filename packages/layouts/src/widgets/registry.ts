import type { ComputedRef } from 'vue';

import type { WidgetKey, WidgetMeta } from './types';

import { computed, defineAsyncComponent } from 'vue';

import { useAppStore } from '@antdv/stores';

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

/**
 * 按钮文案不在这里：每个小部件自己用 `t('header.*')` 取名
 * （主题、全屏这类还要跟着状态换词），这里只登记"渲染哪一个、用哪个开关控制"。
 */
export const WIDGET_MAP: Record<WidgetKey, WidgetMeta> = {
  search: {
    key: 'search',
    icon: 'carbon:search',
    component: lazy(() => import('./search/index.vue')),
  },
  fullscreen: {
    key: 'fullscreen',
    icon: 'ant-design:fullscreen-outlined',
    component: lazy(() => import('./fullscreen/index.vue')),
  },
  theme: {
    key: 'theme',
    icon: 'carbon:contrast',
    component: lazy(() => import('./color-toggle/index.vue')),
  },
  timezone: {
    key: 'timezone',
    icon: 'carbon:time',
    component: lazy(() => import('./timezone/index.vue')),
  },
  notice: {
    key: 'notice',
    icon: 'carbon:notification',
    component: lazy(() => import('./notification/index.vue')),
  },
  preferences: {
    key: 'preferences',
    icon: 'carbon:settings',
    component: lazy(() => import('./preferences/index.vue')),
  },
  logout: {
    key: 'logout',
    icon: 'carbon:logout',
    component: lazy(() => import('./logout/index.vue')),
  },
  'locale-switcher': {
    key: 'locale-switcher',
    icon: 'carbon:language',
    component: lazy(() => import('./language-toggle/index.vue')),
  },
};

/**
 * 每个小部件对应哪个偏好开关。
 *
 * 以前这段是一个 `switch (meta.key)` + `default: return false`：
 * 往 `WIDGET_MAP` 里加了条目却忘了配 case，编译器与 lint 都不说话，
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
  'locale-switcher': (store) => store.widgetLocaleSwitcher,
};

/**
 * 根据 store 配置，返回要渲染的小部件列表（顺序 = `WIDGET_MAP` 的声明顺序）。
 *
 * 必须是 `computed`：偏好抽屉里那些「××小部件」开关就靠这条响应生效。
 * 写成一次性求值的话，症状是"开关拨过去了顶栏没反应，刷新才出现"。
 */
export function useVisibleWidgets(): ComputedRef<WidgetMeta[]> {
  const appStore = useAppStore();
  return computed(() =>
    Object.values(WIDGET_MAP).filter((meta) =>
      WIDGET_VISIBLE[meta.key]?.(appStore),
    ),
  );
}

/**
 * 窄屏（< 768px）屏幕右缘居中悬浮的那一簇：设置抽屉入口 + 主题切换。
 *
 * 这两样是"改外观"的高频入口，手机上不该藏在已经挤爆的顶栏里，
 * 也不该多一步才能打开；其余小部件要么用不上（时区、搜索、通知面板 380px 宽，
 * 在 360px 上比视口还大），要么已经有别的入口。
 */
export const WIDGET_FLOATING_KEYS: readonly WidgetKey[] = [
  'preferences',
  'theme',
];

/**
 * 窄屏顶栏工具区只留「退出登录」。
 *
 * 顶栏胶囊里按钮的账：8 颗 × 32px + 间距 ≈ 300px，390px 的手机上
 * Logo 与侧栏触发按钮直接被挤出视口（就是那张窄屏截图的现场）。
 * 于是小屏可见的功能项收敛成两个 —— 悬浮簇里的主题切换 + 顶栏的退出登录，
 * 头像下拉的位置与交互不参与这次收口。
 */
export const WIDGET_MOBILE_KEYS: readonly WidgetKey[] = ['logout'];

/**
 * 把"偏好开了哪些"拆成"这一档视口该渲染哪些"。
 *
 * 单独抽成纯函数是为了能直接单测：窄屏判定（`useMobile`）与偏好开关（store）
 * 是两个独立来源，混在组件里就只能靠挂组件去验，而挂组件要拖进异步小部件与 i18n。
 */
export function partitionVisibleWidgets(
  visible: WidgetMeta[],
  mobile: boolean,
): { floating: WidgetMeta[]; header: WidgetMeta[] } {
  if (!mobile) {
    return { floating: [], header: visible };
  }
  return {
    floating: visible.filter((meta) => WIDGET_FLOATING_KEYS.includes(meta.key)),
    header: visible.filter((meta) => WIDGET_MOBILE_KEYS.includes(meta.key)),
  };
}

export type { WidgetKey, WidgetMeta } from './types';
