// 子组件
export { default as TabActions } from './components/TabActions.vue';

export { default as TabContextMenu } from './components/TabContextMenu.vue';
export { default as TabItem } from './components/TabItem.vue';
export { default as TabList } from './components/TabList.vue';
// 运行时配置（多语言文案的注入点）
export { configureTabs, tabsRuntime } from './config';

export type { TabsTranslateFn, TabsUIRuntime } from './config';
// 动作集元数据与可用性判定
export { buildTabActions, isActionDisabled, TAB_ACTIONS } from './constants';

// 宿主条（store 无关：标签数据与动作回调都由使用方注入）
export { default as TabsBar } from './TabsBar.vue';

// 类型
export type {
  TabActionContext,
  TabActionItem,
  TabActionMeta,
  TabStyleClasses,
} from './types';
// Hooks
export { moveTab, useTabDragSort } from './useTabDragSort';

export type { UseTabDragSortOptions } from './useTabDragSort';
export { TAB_STYLE_OPTIONS, useTabStyle } from './useTabStyle';
