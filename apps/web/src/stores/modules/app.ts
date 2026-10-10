import type { AppSetting, PreferencesInstance } from '@antdv/preferences';

import type { Ref } from 'vue';

import { computed, toRef, watch } from 'vue';

import { setTimezone } from '@antdv/shared/dayjs';
import { theme } from 'antdv-next';
import { defineStore } from 'pinia';
import { createToggles, getPreferences } from '~/settings';

/**
 * 应用状态 = 偏好设置（`@antdv/preferences`）+ 本 store 的派生视图。
 *
 * 合并/持久化/CSS 落地都在包里，这里只负责：
 * 1. 把偏好字段摊成模板好用的响应式 ref；
 * 2. 保留历史 API（`updateSetting` / `resetSetting` / `toggles`），
 *    避免 SettingDrawer、Layout 等十几处调用点一起改。
 */
export const useAppStore = defineStore('app', () => {
  const { token } = theme.useToken();
  const preferences: PreferencesInstance = getPreferences();

  /** 当前偏好快照，只读：写入一律走 `updateSetting` / `toggles`，否则不会落盘 */
  const appSetting = computed<AppSetting>(() => preferences.preferences.value);

  /** 单项派生：`pick('theme')` 而不是手写 `() => appSetting.value.theme`，键名不会写错 */
  const pick = <K extends keyof AppSetting>(key: K): Ref<AppSetting[K]> =>
    toRef(() => appSetting.value[key]);

  /* ---------- 主题 ---------- */
  const themeMode = pick('theme');
  const themeStyle = pick('themeStyle');
  const primaryColor = pick('primaryColor');
  const borderRadius = pick('borderRadius');
  const fontSize = pick('fontSize');
  const darkSidebar = pick('darkSidebar');
  const darkHeader = pick('darkHeader');
  const colorWeak = pick('colorWeak');
  const grayMode = pick('grayMode');
  /** `auto` 已折叠后的明暗值：判断"现在到底是黑还是白"用它，别用 themeMode */
  const resolvedTheme = computed(() => preferences.resolvedTheme.value);
  /**
   * 系统深色偏好。
   * 单独摊平出来是因为 pinia 会解包 store 返回值里的 ref：
   * 直接写 `appStore.preferences.isSystemDark.value` 会拿到 boolean 上找 `.value`。
   */
  const isSystemDark = computed(() => preferences.isSystemDark.value);

  /* ---------- 布局 ---------- */
  const layout = pick('layout');
  const contentMode = pick('contentMode');
  const contentWidth = pick('contentWidth');
  const sidebarCollapsed = pick('sidebarCollapsed');
  const sidebarWidth = pick('sidebarWidth');
  const railWidth = pick('railWidth');
  /** 侧边导航形态下抽屉的开合（inline 形态忽略） */
  const sidebarOverlayOpen = pick('sidebarOverlayOpen');
  const menuAccordion = pick('menuAccordion');
  const headerMenuScroll = pick('headerMenuScroll');
  const showTabs = pick('showTabs');
  const tabShowIcon = pick('tabShowIcon');
  const tabStyle = pick('tabStyle');
  const tabDragSort = pick('tabDragSort');
  const tabContextMenu = pick('tabContextMenu');
  const showBreadcrumb = pick('showBreadcrumb');
  const hideBreadcrumbWhenOnlyOne = pick('hideBreadcrumbWhenOnlyOne');
  const showBreadcrumbIcon = pick('showBreadcrumbIcon');

  /* ---------- 小部件 ---------- */
  const widgetNotice = pick('widgetNotice');
  const widgetFullscreen = pick('widgetFullscreen');
  const widgetTheme = pick('widgetTheme');
  const widgetTimezone = pick('widgetTimezone');
  const widgetLogout = pick('widgetLogout');
  const widgetSearch = pick('widgetSearch');
  const widgetPreferences = pick('widgetPreferences');

  /* ---------- 底栏 ---------- */
  const showFooter = pick('showFooter');
  const showCopyright = pick('showCopyright');
  const copyrightCompany = pick('copyrightCompany');
  const copyrightIcp = pick('copyrightIcp');

  /* ---------- 通用 ---------- */
  const componentSize = pick('componentSize');
  const timezone = pick('timezone');
  const enableWatermark = pick('enableWatermark');
  const watermarkContent = pick('watermarkContent');
  const enableWaterRipple = pick('enableWaterRipple');
  const notificationPosition = pick('notificationPosition');
  const transitionEffect = pick('transitionEffect');
  const showProgressBar = pick('showProgressBar');
  const showLoading = pick('showLoading');
  const locale = pick('locale');

  /* ============================================================
   * 方法：全部转发给偏好实例，持久化与 DOM 应用在包内完成
   * ============================================================ */
  const updateSetting = (setting: Partial<AppSetting>) =>
    preferences.patch(setting);

  const resetSetting = () => preferences.reset();

  /** 导入配置（整体覆盖，未提供的键回到项目默认值） */
  const replaceSetting = (setting: Partial<AppSetting>) =>
    preferences.replace(setting);

  /**
   * 明暗切换。
   * 从"当前实际渲染的是黑还是白"出发，而不是比较 `theme` 字面量：
   * 默认值是 `auto`，用 `theme === 'dark' ? 'light' : 'dark'` 判断的话，
   * 系统深色下点一下"切到暗色"毫无反应——用户看到的是按钮坏了。
   */
  const toggleTheme = () =>
    preferences.patch({
      theme: preferences.resolvedTheme.value === 'dark' ? 'light' : 'dark',
    });

  /**
   * 布尔开关集合。
   * 以前是手写的 30 个箭头函数，新增偏好时容易漏；现在由包按默认值类型生成。
   */
  const toggles = createToggles(preferences);

  watch(
    timezone,
    (tz) => {
      if (tz) {
        setTimezone(tz);
      }
    },
    { immediate: true },
  );

  return {
    appSetting,
    preferences,
    isSystemDark,
    resolvedTheme,
    token,

    themeMode,
    themeStyle,
    primaryColor,
    borderRadius,
    fontSize,
    darkSidebar,
    darkHeader,
    colorWeak,
    grayMode,

    layout,
    contentMode,
    contentWidth,
    sidebarCollapsed,
    sidebarWidth,
    railWidth,
    sidebarOverlayOpen,
    menuAccordion,
    headerMenuScroll,
    showTabs,
    tabShowIcon,
    tabStyle,
    tabDragSort,
    tabContextMenu,
    showBreadcrumb,
    hideBreadcrumbWhenOnlyOne,
    showBreadcrumbIcon,

    widgetNotice,
    widgetFullscreen,
    widgetTheme,
    widgetTimezone,
    widgetLogout,
    widgetSearch,
    widgetPreferences,

    showFooter,
    showCopyright,
    copyrightCompany,
    copyrightIcp,
    locale,
    componentSize,
    timezone,
    enableWatermark,
    watermarkContent,
    enableWaterRipple,
    notificationPosition,
    transitionEffect,
    showProgressBar,
    showLoading,

    updateSetting,
    resetSetting,
    replaceSetting,
    toggleTheme,
    toggles,
  };
});
