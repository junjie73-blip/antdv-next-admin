import type { MenuKey } from '@antdv/types';

import type { ComputedRef, InjectionKey } from 'vue';

import type { MenuNode } from './types';
import type { MenuStyleApi } from './useMenuStyle';

import { inject, provide } from 'vue';

/**
 * 菜单内部上下文：`BasicMenu` 组装，`MenuList` / `MenuItem` 消费。
 *
 * 只放"整棵树共享且每层递归都要读"的东西，避免把 props 一层层透传：
 * 展开集、选中集、缩进、折叠态与两个动作。样式函数也放这里 —— 明暗/极客的
 * 判定只在根上算一次，递归层拿到的永远是同一份口径。
 *
 * 状态是**只读**的：展开与选中都由 `BasicMenu` 的受控 props 决定，
 * 子组件通过 `toggle` / `select` 回调上抛，手风琴策略留在应用侧
 * （迁移前 `useSidebarMenu` 就是这样做的，行为不能变）。
 */
export interface MenuContext {
  /** 侧栏折叠：折叠时文字收起、子菜单改浮层 */
  collapsed: ComputedRef<boolean>;
  /** 每级缩进量（px），对应迁移前 antd 的 `inline-indent` */
  indent: ComputedRef<number>;
  /** 缺图标的项也占一个图标位，保证一列文字左边缘对齐 */
  keepIconSlot: boolean;
  openKeys: ComputedRef<ReadonlySet<MenuKey>>;
  selectedKeys: ComputedRef<ReadonlySet<MenuKey>>;
  /** 叶子被点击（横向栏里目录也算，见 `MenuItem` 的注释） */
  select: (node: MenuNode) => void;
  style: MenuStyleApi;
  /** 目录行被点击：内联态展开/收起，浮层态由 hover 负责 */
  toggle: (node: MenuNode) => void;
}

const menuContextKey: InjectionKey<MenuContext> = Symbol('MenuContext');

export function provideMenuContext(context: MenuContext): void {
  provide(menuContextKey, context);
}

export function useMenuContext(): MenuContext {
  const context = inject(menuContextKey, undefined);
  if (!context) {
    throw new Error(
      '[@antdv/menu-ui] MenuList / MenuItem 需要在 <BasicMenu> 内部使用',
    );
  }
  return context;
}
