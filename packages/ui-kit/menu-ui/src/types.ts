import type { MenuBadge, MenuConfig, MenuKey } from '@antdv/types';

/** 渲染模式：侧栏内联 / 顶部横向 */
export type MenuMode = 'horizontal' | 'inline';

/** 配色主题（跟随明暗模式或偏好里的「深色侧栏」，由使用方决定） */
export type MenuTheme = 'dark' | 'light';

/**
 * 渲染用的菜单节点。
 *
 * `@antdv/types` 的 `MenuConfig` 是「业务数据」：`hidden` 要靠渲染层过滤、
 * `children` 可能为空数组、外链判定要看 `path` 协议。这些判断如果散在模板里，
 * 每个递归层都要重算一遍，所以这里一次性归一成「渲染事实」：
 * - `key`：与横向导航、图标栏、标签页同源（`menuKeyOf`）
 * - `external`：非空即外链，渲染成 `<a>` 且不参与选中态
 * - `leaf`：**渲染后**没有子节点（被 `maxDepth` 截断的目录也算叶子，
 *   于是混合布局的一级项点击即导航，与迁移前 antd `@click` 的行为一致）
 */
export interface MenuNode {
  badge?: MenuBadge;
  children: MenuNode[];
  depth: number;
  disabled: boolean;
  /** 外链地址；普通菜单为 undefined */
  external?: string;
  extra?: MenuConfig['extra'];
  icon?: string;
  key: MenuKey;
  leaf: boolean;
  path: string;
  title: string;
}

/** `toMenuNodes` 的裁剪参数，语义与迁移前 `buildMenuItems` 的选项一一对应 */
export interface ToMenuNodesOptions {
  /** 只渲染到该深度（混合布局的一级导航传 1，水平布局传 Infinity） */
  maxDepth?: number;
  /** 是否渲染子节点 */
  withChildren?: boolean;
}

/** 样式计算输入：明暗 + 极客风格 + 是否折叠 */
export interface MenuVisualOptions {
  collapsed?: boolean;
  geek?: boolean;
  theme?: MenuTheme;
}
