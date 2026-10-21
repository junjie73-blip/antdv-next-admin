import type { AppSetting } from '@antdv/types';

import type {
  PreferencesInstance,
  PreferencesListener,
  PreferencesOptions,
} from './types';

import { computed, ref } from 'vue';

import { createCache } from '@antdv/shared/cache';
import { createSystemDark, resolveThemeMode } from '@antdv/utils';

import { writeBootThemeCache } from './boot-theme';
import { pickKnownPreferences, withDefaultPreferences } from './config';
import { PREFERENCES_CACHE_KEY } from './constants';
import { applyPreferencesToDom } from './update-css-variables';

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
  const store = options.cache ?? createCache<AppSetting>({ type: 'local' });
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
   * 但布局蓝图里查不到就会退回默认值 —— 用户升级后布局凭空变样。
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
    // 必须在 applyDom 之后：快照读的是 DOM 上算出来的实色
    writeBootThemeCache(next, systemDark.value);
    listeners.forEach((listener) => listener(next, previous));
    return next;
  }

  // 系统主题变化时，`auto` 模式需要重新解析并刷新 DOM
  const unsubscribeMedia = media.subscribe((isDark) => {
    systemDark.value = isDark;
    if (state.value.theme === 'auto') {
      applyDom();
      writeBootThemeCache(state.value, systemDark.value);
      const snapshot = state.value;
      listeners.forEach((listener) => listener(snapshot, snapshot));
    }
  });

  // 首次创建就把当前偏好落到 DOM，避免"首屏闪一下默认主色"
  applyDom();
  writeBootThemeCache(state.value, systemDark.value);

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
    replace: (next) =>
      commit({ ...defaults, ...pickKnownPreferences(next, defaults) }),
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
        [key]: !state.value[key as keyof AppSetting],
      } as AppSetting),
  };
}

/* ============================================================
 * 模块级单例
 *
 * `usePreferences()` 要能在任意组件里拿到同一份偏好，就必须有个"当前实例"。
 * 单例归包管，但**创建时机归应用**：懒创建是硬要求，因为缓存前缀由应用的
 * bootstrap 注入，顶层直接创建会读写到默认前缀的键上（表现是"设置保存了但
 * 刷新就丢"）。所以这里只给 `initPreferences`，不给隐式默认实例。
 * ============================================================ */

let current: null | PreferencesInstance = null;

/** 创建（或复用）全局偏好实例；幂等，第二次调用返回第一次那份 */
export function initPreferences(
  options: PreferencesOptions = {},
): PreferencesInstance {
  current ??= createPreferences(options);
  return current;
}

/** 取单例；未 `initPreferences` 时抛错，而不是静默造一份新配置 */
export function getPreferencesInstance(): PreferencesInstance {
  if (!current) {
    throw new Error(
      '[@antdv/preferences] 先调用 initPreferences() 创建实例，再用 usePreferences()',
    );
  }
  return current;
}

/** 销毁单例（登出、测试收尾、多实例应用卸载） */
export function disposePreferences(): void {
  current?.destroy();
  current = null;
}
