import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '@antdv/stores';

import { useVisibleWidgets, WIDGET_MAP } from '../src/widgets/registry';

/**
 * 小部件清单必须跟着偏好走。
 *
 * 曾经这里是 `useVisibleWidgets()` 里一次性 `filter` 出来的普通数组：
 * 偏好抽屉把开关拨过去了，顶栏要刷新才认 —— 列表在 setup 时就算死了。
 */
describe('useVisibleWidgets', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const keys = () => useVisibleWidgets().value.map((meta) => meta.key);

  it('每个登记的小部件都能被渲染，顺序跟 WIDGET_MAP', () => {
    const appStore = useAppStore();
    appStore.updateSetting({
      widgetFullscreen: true,
      widgetLocaleSwitcher: true,
      widgetLogout: true,
      widgetNotice: true,
      widgetPreferences: true,
      widgetSearch: true,
      widgetTheme: true,
      widgetTimezone: true,
    });
    expect(keys()).toEqual(Object.keys(WIDGET_MAP));
  });

  it('拨动开关即时增减，不需要重挂载', async () => {
    const appStore = useAppStore();
    appStore.updateSetting({ widgetTimezone: false });
    expect(keys()).not.toContain('timezone');

    appStore.updateSetting({ widgetTimezone: true });
    expect(keys()).toContain('timezone');
  });
});
