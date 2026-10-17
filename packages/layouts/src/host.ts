/**
 * 宿主能力注入点（顶栏小部件用）。
 *
 * `widgets/` 从应用搬进包里以后，那些"只有应用才知道的东西"不能再直接 import：
 * 通知接口与 WebSocket 在 `~/api` / `~/utils`，账户页面在 `~/views`，
 * 语言候选来自应用的文案表，包一旦反向引用就是循环依赖。
 * 所以这些能力统一由宿主在启动时交进来，包只按接口调用。
 *
 * 每一项都有可用的默认值：没注入时铃铛是空列表、跳转静默跳过、抽屉里没有页面，
 * 包自己的单测因此能脱离应用挂载组件（`configureLayoutHost` 在用例里给假数据即可）。
 *
 * 与 layout-ui 的 `configureLayout({ t, translateMenu })` 是同一套路，分工不同：
 * 那边给文案，这边给数据与业务组件。
 */

import type { Component } from 'vue';

export interface LayoutNoticeApi {
  /** 「通知中心」页路由；空串表示宿主没有这一页，跳转就静默跳过 */
  centerPath: string;
  /** 实时推送：注册监听，返回取消函数（组件卸载时必须调用，否则监听会越积越多） */
  onPush: (handler: (raw: Record<string, unknown>) => void) => () => void;
  /** 取最近的通知，返回值交给 `mapNoticeList` 归一化（信封形态由那边兜） */
  fetch: (limit: number) => Promise<unknown>;
  markAllRead: () => Promise<unknown>;
  markRead: (id: number) => Promise<unknown>;
}

export interface LayoutLocaleOption {
  code: string;
  /** 用该语言自称的名字（English 不译成「英语」） */
  label: string;
}

export interface LayoutAccountViews {
  /** 「前往修改」这类按钮通过 `inject('switchAccountTab')` 反向切页签 */
  center?: Component;
  settings?: Component;
}

export interface LayoutHostConfig {
  accountViews?: LayoutAccountViews;
  locales?: LayoutLocaleOption[];
  notice?: Partial<LayoutNoticeApi>;
  /** 弹层/抽屉里用原生滚动条还是封装件的自定义滚动条（`projectConfig.scrollbar.native`） */
  nativeScrollbar?: boolean;
}

const noopUnsubscribe = () => {};

export const layoutHost = {
  accountViews: {} as LayoutAccountViews,
  locales: [] as LayoutLocaleOption[],
  nativeScrollbar: false,
  notice: {
    centerPath: '',
    onPush: () => noopUnsubscribe,
    fetch: async () => [],
    markAllRead: async () => {},
    markRead: async () => {},
  } as LayoutNoticeApi,
};

/** 应用启动时调用一次；可重复调用，后写的覆盖先写的 */
export function configureLayoutHost(config: LayoutHostConfig): void {
  if (config.accountViews)
    Object.assign(layoutHost.accountViews, config.accountViews);
  if (config.locales) layoutHost.locales = config.locales;
  if (config.notice) Object.assign(layoutHost.notice, config.notice);
  if (config.nativeScrollbar !== undefined)
    layoutHost.nativeScrollbar = config.nativeScrollbar;
}
