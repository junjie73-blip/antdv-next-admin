export type { CallbackFn, Nullable } from '../types';

export { default as BasicDrawer } from './BasicDrawer.vue';
export type {
  DrawerInnerMethods,
  DrawerMethods,
  DrawerProps,
  DrawerSize,
  UseDrawerInnerReturnType,
  UseDrawerReturnType,
} from './types';

export { useDrawer } from './useDrawer';
// 与旧实现一致：本仓库的 useDrawerInner 就是 useDrawer 的别名导出
export { useDrawer as useDrawerInner } from './useDrawer';
