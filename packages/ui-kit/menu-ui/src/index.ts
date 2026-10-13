// 宿主组件（store 无关：菜单数据、选中/展开状态与导航回调都由使用方注入）
export { default as BasicMenu } from './BasicMenu.vue';

// 子组件（layout-ui 的图标栏、应用侧的自定义导航可以直接复用）
export { default as MenuBadge } from './components/MenuBadge.vue';
export { default as MenuItem } from './components/MenuItem.vue';
export { default as MenuLabel } from './components/MenuLabel.vue';
export { default as MenuList } from './components/MenuList.vue';
export { default as MenuRow } from './components/MenuRow.vue';

// 运行时配置（滚动箭头等控件文案的注入点）
export { configureMenu, menuRuntime } from './config';
export type { MenuTranslateFn, MenuUIRuntime } from './config';

// 数据归一与选中判定
export { containsKey, isBranchSelected, toMenuNodes } from './menu-tree';

// 类型
export type {
  MenuMode,
  MenuNode,
  MenuTheme,
  MenuVisualOptions,
  ToMenuNodesOptions,
} from './types';
// 排版（明暗 / 极客 / 折叠三档的全部类名）
export { useMenuStyle } from './useMenuStyle';

export type { MenuRowState, MenuStyleApi, MenuVariant } from './useMenuStyle';
