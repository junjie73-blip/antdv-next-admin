import type { CacheInstance } from '@antdv/shared/cache';
import type { AppSetting } from '@antdv/types';

import type { Ref } from 'vue';

/**
 * 偏好项的完整形状来自 `@antdv/types`（跨包共享的契约），这里只补包自己的类型。
 *
 * `ThemeAlgorithm` / `ThemePreset` 不在名单里：那是 antd `ThemeConfig` 的派生类型，
 * 属于"某个 UI 库怎么把偏好翻译成主题配置"，不是偏好本身。
 */
export type {
  AppSetting,
  ComponentSize,
  ContentMode,
  LayoutMode,
  NotificationPosition,
  RouteMode,
  TabStyle,
  ThemeMode,
  ThemeStyle,
  TransitionEffect,
} from '@antdv/types';

/** 偏好项的键名联合，用于 `pick` / `set` / `toggle` 的类型收窄 */
export type PreferenceKey = keyof AppSetting;

/** 值为布尔的偏好项，`toggle()` 只接受这些键 */
export type BooleanPreferenceKey = {
  [K in PreferenceKey]: AppSetting[K] extends boolean ? K : never;
}[PreferenceKey];

/** 由 `createToggles` 生成的翻转函数集合 */
export type PreferenceToggles = Record<BooleanPreferenceKey, () => void>;

export interface ApplyPreferencesToDomOptions {
  /** 目标元素，默认 `document.documentElement` */
  target?: HTMLElement;
  /** 系统是否偏好深色，用于解析 `theme: 'auto'` */
  isSystemDark?: boolean;
  /** 是否写入 CSS 变量，默认 true；关掉只切 class */
  cssVars?: boolean;
  /**
   * `dark` class 的名字。
   * Tailwind 的 `@custom-variant dark (&:where(.dark, .dark *))` 依赖它，
   * 所以这里不是可选项，只是把名字交给应用决定。
   */
  darkClass?: string;
}

export interface PreferencesOptions {
  /** 应用侧默认值覆盖（把 `import.meta.env.VITE_APP_TITLE` 之类传进来） */
  defaults?: Partial<AppSetting>;
  /** 持久化实例，默认 `createCache<AppSetting>({ type: 'local' })` */
  cache?: CacheInstance<AppSetting>;
  /** 持久化键，默认 `appSetting` */
  cacheKey?: string;
  /** 过期时间（秒），默认永不过期 */
  expire?: number;
  /** 是否把偏好落到 DOM（class + CSS 变量），默认 true */
  applyToDom?: boolean;
  /**
   * 历史值迁移：读缓存后、净化前调用，用来把改名/换枚举的旧值翻译成当前值。
   * 入参可能是 `undefined` 之外的任意脏数据，返回值仍是同一份记录的副本。
   */
  migrate?: (
    cached: Record<string, unknown>,
  ) => Partial<AppSetting> | Record<string, unknown>;
  /** `dark` class 名，默认 `dark`（Tailwind 的 custom-variant 依赖它） */
  darkClass?: string;
  /** 覆盖系统深色判定，用于 SSR 或单测 */
  isSystemDark?: () => boolean;
  /** 注入 matchMedia（单测需要能伪造"用户切换了系统主题"） */
  matchMedia?: (query: string) => MediaQueryList;
}

export type PreferencesListener = (
  next: AppSetting,
  previous: AppSetting,
) => void;

export interface PreferencesInstance {
  /**
   * 响应式偏好快照。
   * 只读：写操作一律走 `patch` / `set` / `toggle`，
   * 否则会出现"改了但没落盘"的静默不一致。
   */
  readonly preferences: Readonly<Ref<AppSetting>>;
  /** `auto` 已折叠后的实际主题，模板里判断明暗用它而不是 `preferences.theme` */
  readonly resolvedTheme: Readonly<Ref<'dark' | 'light'>>;
  /** 系统是否偏好深色（`auto` 模式的输入） */
  readonly isSystemDark: Readonly<Ref<boolean>>;
  /** 取完整快照 */
  get: () => AppSetting;
  /** 取单项 */
  pick: <K extends keyof AppSetting>(key: K) => AppSetting[K];
  /** 合并写入并持久化 */
  patch: (partial: Partial<AppSetting>) => AppSetting;
  /** 写单项并持久化 */
  set: <K extends keyof AppSetting>(key: K, value: AppSetting[K]) => void;
  /** 布尔开关（只接受值类型为 boolean 的偏好项） */
  toggle: (key: BooleanPreferenceKey) => void;
  /** 整体替换（不合并），用于导入配置 */
  replace: (next: Partial<AppSetting>) => AppSetting;
  /** 恢复默认并落盘 */
  reset: () => AppSetting;
  /** 从缓存重新读取（多标签页同步、导入前预热） */
  reload: () => AppSetting;
  /** 手动落盘 */
  save: () => void;
  /** 手动把当前偏好应用到 DOM */
  applyToDomNow: () => void;
  /** 订阅变化，返回取消函数 */
  subscribe: (listener: PreferencesListener) => () => void;
  /** 释放系统主题监听 */
  destroy: () => void;
}
