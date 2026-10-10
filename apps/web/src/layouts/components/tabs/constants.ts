import type { TabActionKey } from '@antdv/types';

/**
 * 标签页操作集元数据。
 *
 * 右上角下拉、标签右键菜单、空状态提示共用这一份定义，
 * 保证「同一个动作在不同入口叫法一致」，也让单测可以只测数据而不测 DOM。
 */
export interface TabActionMeta {
  /** 分隔线：只在菜单项里出现，不参与 action 分发 */
  divider?: boolean;
  icon?: string;
  key: 'divider' | TabActionKey;
  label: (ctx: TabActionContext) => string;
}

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

/**
 * 顺序即右键菜单的展示顺序（对齐 vue-vben-admin 的标签页菜单）：
 * 单标签操作在前，批量关闭在后，中间用分隔线断开。
 */
export const TAB_ACTIONS: TabActionMeta[] = [
  {
    icon: 'carbon:close',
    key: 'close',
    label: () => '关闭当前',
  },
  {
    icon: 'carbon:pin',
    key: 'affix',
    label: (ctx) => (ctx.affixed ? '取消固定' : '固定标签页'),
  },
  {
    icon: 'carbon:maximize',
    key: 'maximize',
    label: (ctx) => (ctx.maximized ? '还原当前页' : '放大当前页'),
  },
  {
    icon: 'carbon:reset',
    key: 'refresh',
    label: () => '刷新当前',
  },
  { divider: true, key: 'divider', label: () => '' },
  {
    icon: 'carbon:launch',
    key: 'openInNewWindow',
    label: () => '在新窗口打开',
  },
  {
    icon: 'carbon:close-outline',
    key: 'closeOther',
    label: (ctx) => `关闭其他${ctx.others > 0 ? `（${ctx.others}）` : ''}`,
  },
  {
    icon: 'carbon:arrow-left',
    key: 'closeLeft',
    label: (ctx) => `关闭左侧${ctx.closeableLeft > 0 ? `（${ctx.closeableLeft}）` : ''}`,
  },
  {
    icon: 'carbon:arrow-right',
    key: 'closeRight',
    label: (ctx) => `关闭右侧${ctx.closeableRight > 0 ? `（${ctx.closeableRight}）` : ''}`,
  },
  {
    icon: 'carbon:close-filled',
    key: 'closeAll',
    label: () => '关闭全部',
  },
];

/** 下拉与右键菜单共用的渲染数据：分隔线以 divider 项表达，由渲染层决定样式 */
export interface TabActionItem {
  disabled: boolean;
  divider: boolean;
  icon?: string;
  key: TabActionKey;
  label: string;
}

export function buildTabActions(ctx: TabActionContext): TabActionItem[] {
  return TAB_ACTIONS.map((action) => ({
    disabled: action.divider ? true : isActionDisabled(action.key as TabActionKey, ctx),
    divider: Boolean(action.divider),
    icon: action.icon,
    key: (action.key === 'divider' ? '' : action.key) as TabActionKey,
    label: action.label(ctx),
  }));
}

export function isActionDisabled(key: TabActionKey, ctx: TabActionContext): boolean {
  switch (key) {
    // 首页是固定区的锚点，取消它会让「哪个是首页」的判断漂移
    case 'affix': {
      return ctx.isHome;
    }
    // 固定标签走 store 的 isClosable 也会被拒，菜单里直接禁用免得点了没反应
    case 'close': {
      return ctx.affixed;
    }
    case 'closeAll': {
      return ctx.closeableLeft + ctx.closeableRight + ctx.others === 0;
    }
    case 'closeLeft': {
      return ctx.closeableLeft === 0;
    }
    case 'closeOther': {
      return ctx.others === 0;
    }
    case 'closeRight': {
      return ctx.closeableRight === 0;
    }
    default: {
      return false;
    }
  }
}
