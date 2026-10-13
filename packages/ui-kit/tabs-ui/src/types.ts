import type { TabActionKey } from '@antdv/types';

/** 标签页操作集元数据（右键菜单与右上角下拉共用一份定义） */
export interface TabActionMeta {
  /** 分隔线：只在菜单项里出现，不参与 action 分发 */
  divider?: boolean;
  icon?: string;
  key: 'divider' | TabActionKey;
  label: (ctx: TabActionContext) => string;
}

/**
 * 判定「某个动作现在能不能做」所需的上下文。
 *
 * 由宿主条从标签数组算出，子组件只渲染不判断，
 * 保证同一个动作在右上角下拉、标签右键菜单里的一致性。
 */
export interface TabActionContext {
  /** 目标标签当前是否处于固定态 */
  affixed: boolean;
  /** 左侧还有几个可关闭标签 */
  closeableLeft: number;
  closeableRight: number;
  /** 目标标签是否首页：首页永远不可取消固定 */
  isHome: boolean;
  /** 当前是否处于放大态 */
  maximized: boolean;
  /** 除自身外还有几个可关闭标签 */
  others: number;
}

/** 下拉与右键菜单共用的渲染数据：分隔线以 divider 项表达，由渲染层决定样式 */
export interface TabActionItem {
  disabled: boolean;
  divider: boolean;
  icon?: string;
  key: TabActionKey;
  label: string;
}

/**
 * 标签页视觉风格的语义槽位。
 *
 * 风格之间共用同一组槽位（bar / list / item / active / close），
 * 新增风格只需要在 STYLE_MAP 里补一项，组件不用改。
 */
export interface TabStyleClasses {
  /** 选中态标签（追加在 item 之后，靠后面的类覆盖前面的） */
  active: string;
  /** 标签栏容器（标签条那一行）：只有需要改变行对齐或底边时才写 */
  bar: string;
  /** 关闭按钮 */
  close: string;
  /** 是否显示标签间分隔线 */
  divider: boolean;
  /** 单个标签 */
  item: string;
  /** 标签容器（排列与分隔方式随风格变化） */
  list: string;
}
