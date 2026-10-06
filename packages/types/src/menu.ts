import type { BadgeProps } from 'antdv-next';

/**
 * 菜单/标签页统一 key 类型。
 *
 * 取值优先级：路由 `name` → 完整 `path` → `title`。横向一级导航、侧边二级菜单、
 * 标签页三处必须同源，否则同一个页面在三个位置对不上（选中态错乱、二级菜单取不到）。
 */
export type MenuKey = string;

/** 微前端子应用配置 */
export interface MicroAppConfig {
  name: string;
  url: string;
  baseroute: string;
  keepAlive?: boolean;
  disableMemoryRouter?: boolean;
  disablePatchRequest?: boolean;
  inline?: boolean;
  destroy?: boolean;
}

/**
 * 菜单徽标配置。
 * `buildMenuItems` 会把它渲染成 antd Badge（text 数字徽标或 dot 圆点）。
 */
export interface MenuBadge {
  text?: number | string;
  dot?: boolean;
  status?: BadgeProps['status'];
  overflowCount?: number;
}

/**
 * 归一化后的菜单节点。
 *
 * key 约定：菜单树（横向一级 / 侧边二级 / 标签页）统一使用 `name` 作为 key，
 * `name` 缺失时回退 `title`，由 `normalizeMenuKey` 保证三处一致。
 */
export interface MenuConfig {
  name?: string;
  /** 一定是完整 path，由 store 从路由反查补全 */
  path: string;
  /** 已归一化到 title */
  title: string;
  icon?: string;
  hidden?: boolean;
  isExternal?: boolean;
  keepAlive?: boolean;
  children?: MenuConfig[];
  meta?: Record<string, unknown>;
  disabled?: boolean;
  extra?: boolean | number | string;
  badge?: MenuBadge;
}

/** 后端下发的原始菜单结构 */
export interface BackendMenu {
  menuId: string;
  parentId: null | string;
  menuName: string;
  name?: string;
  /** 1-目录 2-菜单 3-按钮 */
  menuType: number;
  icon?: string;
  path?: string;
  component?: string;
  permission?: string;
  sortOrder: number;
  /** '0' 禁用 '1' 启用 */
  status: string;
  children?: BackendMenu[];
  hidden?: boolean;
  isExternal?: boolean;
  layout?: 'blank' | 'default';
  keepAlive?: boolean;
}

export interface MenuState {
  menus: MenuConfig[];
  isLoaded: boolean;
}
