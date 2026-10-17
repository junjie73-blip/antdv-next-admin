import type { PreferenceToggles, PreferencesInstance } from './types';

import { booleanPreferenceKeys } from './config';
import { getPreferencesInstance } from './preferences';

/**
 * 组件侧读写的默认入口：拿到包级单例的响应式视图与写入方法。
 *
 * 名字与 `useAppStore` 并存而不是取代它 —— store 负责把偏好字段摊成模板好用的
 * ref 并派生业务状态，这里只提供"不经过 pinia 也能读写偏好"的那条路。
 */
export function usePreferences(): PreferencesInstance {
  return getPreferencesInstance();
}

/**
 * 为所有布尔偏好生成翻转函数。
 *
 * 应用侧原本手写 30 个 `xxx: () => updateSetting({ xxx: !state.xxx })`：
 * 加一个开关就要记得补一处，漏了就是"设置项点了没反应"。
 * 这里按默认值的实际类型自动推导，新增布尔偏好零成本。
 */
export function createToggles(
  preferences: Pick<PreferencesInstance, 'toggle'>,
): PreferenceToggles {
  const toggles = {} as PreferenceToggles;
  for (const key of booleanPreferenceKeys()) {
    toggles[key] = () => preferences.toggle(key);
  }
  return toggles;
}
