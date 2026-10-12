import type { TabActionKey } from '@antdv/types';

import i18n from '~/locales';

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

/**
 * 文案在 `label()` 被调用的那一刻才取（而不是模块顶部固化一份字符串），
 * 因为 label 是在组件的 computed 里求值的：读到 locale 就把这个 computed
 * 登记成了 locale 的依赖，切语言时菜单才会跟着重算。
 */
function text(key: string, named?: Record<string, number>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key);
}

/** 批量关闭项：有数量走带 `{count}` 的键，数量为 0 时不带括号 */
function closeLabel(base: string, count: number): string {
  return count > 0
    ? text(`tabs.${base}Count`, { count })
    : text(`tabs.${base}`);
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
    label: () => text('tabs.closeCurrent'),
  },
  {
    icon: 'carbon:pin',
    key: 'affix',
    label: (ctx) => text(ctx.affixed ? 'tabs.affixOff' : 'tabs.affix'),
  },
  {
    icon: 'carbon:maximize',
    key: 'maximize',
    label: (ctx) => text(ctx.maximized ? 'tabs.maximizeOff' : 'tabs.maximize'),
  },
  {
    icon: 'carbon:reset',
    key: 'refresh',
    label: () => text('tabs.refreshCurrent'),
  },
  { divider: true, key: 'divider', label: () => '' },
  {
    icon: 'carbon:launch',
    key: 'openInNewWindow',
    label: () => text('tabs.openInNewWindow'),
  },
  {
    icon: 'carbon:close-outline',
    key: 'closeOther',
    label: (ctx) => closeLabel('closeOther', ctx.others),
  },
  {
    icon: 'carbon:arrow-left',
    key: 'closeLeft',
    label: (ctx) => closeLabel('closeLeft', ctx.closeableLeft),
  },
  {
    icon: 'carbon:arrow-right',
    key: 'closeRight',
    label: (ctx) => closeLabel('closeRight', ctx.closeableRight),
  },
  {
    icon: 'carbon:close-filled',
    key: 'closeAll',
    label: () => text('tabs.closeAll'),
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
    disabled: action.divider
      ? true
      : isActionDisabled(action.key as TabActionKey, ctx),
    divider: Boolean(action.divider),
    icon: action.icon,
    key: (action.key === 'divider' ? '' : action.key) as TabActionKey,
    label: action.label(ctx),
  }));
}

export function isActionDisabled(
  key: TabActionKey,
  ctx: TabActionContext,
): boolean {
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
