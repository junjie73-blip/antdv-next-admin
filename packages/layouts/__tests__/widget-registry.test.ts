import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '@antdv/stores';

import {
  partitionVisibleWidgets,
  useVisibleWidgets,
  WIDGET_MAP,
} from '../src/widgets/registry';

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

/**
 * 窄屏分流（`partitionVisibleWidgets`）。
 *
 * 顶栏那圈胶囊在 390px 的手机上会挤掉 Logo 与侧栏触发按钮 —— 8 颗按钮各 32px，
 * 加上间距就是 300px。收口的口径写在这里而不是组件模板里，是为了能直接单测：
 * 视口判定与偏好开关是两个独立来源，混起来只能靠挂组件验。
 */
describe('partitionVisibleWidgets', () => {
  const all = () => Object.values(WIDGET_MAP);
  const keysOf = (list: ReturnType<typeof all>) => list.map((meta) => meta.key);

  it('宽屏：偏好开着的都留在顶栏，悬浮簇为空', () => {
    const { floating, header } = partitionVisibleWidgets(all(), false);
    expect(keysOf(header)).toEqual(Object.keys(WIDGET_MAP));
    expect(floating).toEqual([]);
  });

  it('窄屏：顶栏只剩退出登录，主题切换与设置抽屉进悬浮簇', () => {
    const { floating, header } = partitionVisibleWidgets(all(), true);
    expect(keysOf(header)).toEqual(['logout']);
    // 顺序仍按 WIDGET_MAP 声明序（theme 在 preferences 之前）
    expect(keysOf(floating)).toEqual(['theme', 'preferences']);
  });

  it('窄屏也不越过偏好：用户关掉的主题切换不会被强行塞回悬浮簇', () => {
    const visible = all().filter((meta) => meta.key !== 'theme');
    const { floating, header } = partitionVisibleWidgets(visible, true);
    expect(keysOf(floating)).toEqual(['preferences']);
    expect(keysOf(header)).toEqual(['logout']);
  });

  it('窄屏下顶栏可以空掉（只留退出登录的开关也被关掉时）', () => {
    const visible = all().filter((meta) => meta.key !== 'logout');
    const { header } = partitionVisibleWidgets(visible, true);
    expect(header).toEqual([]);
  });
});
