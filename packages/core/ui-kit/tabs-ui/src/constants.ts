import type { TabActionKey } from '@antdv/types';

import type { TabActionContext, TabActionItem, TabActionMeta } from './types';

import { tabsRuntime } from './config';

/**
 * 标签页操作集元数据。
 *
 * 右上角下拉、标签右键菜单共用这一份定义，
 * 保证「同一个动作在不同入口叫法一致」，也让单测可以只测数据而不测 DOM。
 */

/**
 * 文案在 `label()` 被调用的那一刻才取（而不是模块顶部固化一份字符串），
 * 因为 label 是在组件的 computed 里求值的：读到 locale 就把这个 computed
 * 登记成了 locale 的依赖，切语言时菜单才会跟着重算。
 */
function text(key: string, named?: Record<string, number | string>): string {
  return named ? tabsRuntime.t(key, named) : tabsRuntime.t(key);
}

/** 批量关闭项：有数量走带 `{count}` 的键，数量为 0 时不带括号 */
function closeLabel(base: string, count: number): string {
  return count > 0
    ? text(`tabs.${base}Count`, { count })
    : text(`tabs.${base}`);
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
