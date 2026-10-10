import type { CacheInstance } from '@antdv/shared/cache';
import type { AppSetting } from '@antdv/types';

import type { Ref } from 'vue';

import type { BooleanPreferenceKey, PreferenceKey } from './defaults';

import { computed, ref } from 'vue';

import { createCache } from '@antdv/shared/cache';

import { applyPreferencesToDom } from './css-vars';
import {
  DEFAULT_PREFERENCES,
  pickKnownPreferences,
  withDefaultPreferences,
} from './defaults';
import { createSystemDark, resolveThemeMode } from './theme-mode';

/** 沿用历史键：改名会让老用户的设置凭空消失 */
export const PREFERENCES_CACHE_KEY = 'appSetting';

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

/**
 * 创建偏好实例：默认值 ← 缓存值 合并，变更即持久化 + 落 DOM。
 *
 * 为什么不用 pinia：偏好是"跨项目可复用"的东西，store 是"这个应用的状态"。
 * 把合并、净化、持久化、DOM 落地收进包里的纯工厂函数，
 * 应用的 store 只负责"暴露响应式字段 + 派生自己的业务状态"（见 `useAppStore`），
 * 两者职责不重叠，包也能被别的框架（或单测）直接使用。
 */
export function createPreferences(
  options: PreferencesOptions = {},
): PreferencesInstance {
  const defaults = withDefaultPreferences(options.defaults);
  const store =
    options.cache ?? createCache<AppSetting>({ type: 'local' });
  const cacheKey = options.cacheKey ?? PREFERENCES_CACHE_KEY;

  const media = createSystemDark({ matchMedia: options.matchMedia });
  const systemDark = ref(
    options.isSystemDark ? options.isSystemDark() : media.isDark(),
  );

  const state = ref<AppSetting>(readMerged());

  const listeners = new Set<PreferencesListener>();

  const preferences = computed(() => state.value);
  const resolvedTheme = computed(() =>
    resolveThemeMode(state.value.theme, systemDark.value),
  );

  /**
   * 读缓存 → 迁移 → 净化 → 与默认值合并。
   *
   * `migrate` 是"形状对但值过时"的出口：比如布局形态 `mixed` 被重命名成
   * `mixed-vertical`，它仍是合法 string，`pickKnownPreferences` 拦不住，
   * 但蓝图表里查不到就会退回默认值 —— 用户升级后布局凭空变样。
   * 迁移只在读时做一次，下一次落盘写的就是新值，包本身不必知道历史值长啥样。
   */
  function readMerged(): AppSetting {
    const saved = readSaved() as Record<string, unknown> | undefined;
    const migrated = options.migrate ? options.migrate(saved ?? {}) : saved;
    return { ...defaults, ...pickKnownPreferences(migrated, defaults) };
  }

  function readSaved(): Partial<AppSetting> | undefined {
    try {
      return store.getItem(cacheKey) ?? undefined;
    } catch {
      // 加密密钥变更、存储被禁用（Safari 无痕）都不该让应用起不来
      return undefined;
    }
  }

  function persist(snapshot: AppSetting): void {
    try {
      store.setItem(cacheKey, snapshot, options.expire);
    } catch {
      /* 落盘失败时内存态仍然有效，下次变更会再试 */
    }
  }

  function applyDom(): void {
    if (options.applyToDom === false) return;
    applyPreferencesToDom(state.value, {
      darkClass: options.darkClass,
      isSystemDark: systemDark.value,
    });
  }

  function commit(next: AppSetting): AppSetting {
    const previous = state.value;
    if (next === previous) return previous;
    state.value = next;
    persist(next);
    applyDom();
    listeners.forEach((listener) => listener(next, previous));
    return next;
  }

  // 系统主题变化时，`auto` 模式需要重新解析并刷新 DOM
  const unsubscribeMedia = media.subscribe((isDark) => {
    systemDark.value = isDark;
    if (state.value.theme === 'auto') {
      applyDom();
      const snapshot = state.value;
      listeners.forEach((listener) => listener(snapshot, snapshot));
    }
  });

  // 首次创建就把当前偏好落到 DOM，避免"首屏闪一下默认主色"
  applyDom();

  return {
    applyToDomNow: applyDom,
    destroy: () => {
      unsubscribeMedia();
      listeners.clear();
    },
    get: () => ({ ...state.value }),
    isSystemDark: computed(() => systemDark.value),
    patch: (partial) =>
      commit({
        ...state.value,
        ...pickKnownPreferences(partial, defaults),
      }),
    pick: (key) => state.value[key],
    preferences,
    reload: () => commit(readMerged()),
    replace: (next) => commit({ ...defaults, ...pickKnownPreferences(next, defaults) }),
    reset: () => commit({ ...defaults }),
    resolvedTheme,
    save: () => persist(state.value),
    set: (key, value) => commit({ ...state.value, [key]: value }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle: (key) =>
      commit({
        ...state.value,
        [key]: !state.value[key as BooleanPreferenceKey],
      } as AppSetting),
  };
}

/** 内置默认值的只读引用，方便应用直接展示"恢复默认"文案 */
export const BUILT_IN_DEFAULTS: Readonly<AppSetting> = DEFAULT_PREFERENCES;

/**
 * 为所有布尔偏好生成翻转函数。
 *
 * 应用侧原本手写 30 个 `xxx: () => updateSetting({ xxx: !state.xxx })`：
 * 加一个开关就要记得补一处，漏了就是"设置项点了没反应"。
 * 这里按默认值的实际类型自动推导，新增布尔偏好零成本。
 */
export function createToggles(
  preferences: Pick<PreferencesInstance, 'toggle'>,
): Record<BooleanPreferenceKey, () => void> {
  const toggles = {} as Record<BooleanPreferenceKey, () => void>;
  for (const key of booleanPreferenceKeys()) {
    toggles[key] = () => preferences.toggle(key);
  }
  return toggles;
}

/** 值类型为 boolean 的偏好键（以默认值对象的实际内容为准） */
export function booleanPreferenceKeys(): BooleanPreferenceKey[] {
  return (Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]).filter(
    (key) => typeof DEFAULT_PREFERENCES[key] === 'boolean',
  ) as BooleanPreferenceKey[];
}
