import type { TabStyle } from './app';

/**
 * 标签页条目。
 *
 * `key` 与菜单、路由 name 同源（`normalizeMenuKey`），保证横向一级菜单、
 * 侧边二级菜单、标签页三者对同一个页面使用同一个标识。
 */
export interface TabItem {
  /** 唯一 key，等于路由 name（缺失时回退 path） */
  key: string;
  /** 完整路由 path，用于刷新与外链判断 */
  path: string;
  title: string;
  icon?: string;
  /** 是否可关闭 */
  closable: boolean;
  /** 固定标签：不可关闭、不可被拖拽越过 */
  affix?: boolean;
  /** 是否保持缓存：关闭时是否清理 keep-alive */
  keepAlive?: boolean;
  /** 外链地址 */
  href?: string;
}

/** 标签页操作集（右键菜单与右上角下拉共用） */
export type TabActionKey =
  | 'closeAll'
  | 'closeLeft'
  | 'closeOther'
  | 'closeRight'
  | 'maximize'
  | 'refresh'
  | 'reload';

export interface TabContextMenuPayload {
  key: string;
  x: number;
  y: number;
}

export interface TabsState {
  tabs: TabItem[];
  activeKey: string;
  tabStyle: TabStyle;
  /** 当前是否处于「放大当前标签页」状态 */
  maximized: boolean;
}
