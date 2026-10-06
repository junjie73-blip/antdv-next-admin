import type { AppSetting } from '~/settings';

import { ref, toRef, watch } from 'vue';

import { theme } from 'antdv-next';
import { defineStore } from 'pinia';
import { DEFAULT_SETTING } from '~/settings';
import { cache } from '~/utils';
import { setTimezone } from '~/utils/dayjs';

export const useAppStore = defineStore('app', () => {
  const { token } = theme.useToken();

  // 旧版本缓存里没有的新字段（如 tabStyle）需要以默认值兜底，
  // 直接取缓存会得到 undefined，模板里的受控组件因此显示异常。
  const cached = cache.getItem('appSetting') as null | Partial<AppSetting>;
  const appSetting = ref<AppSetting>({
    ...DEFAULT_SETTING,
    ...cached,
  });
  /* ---------- 主题 ---------- */
  const themeMode = toRef(() => appSetting.value.theme);
  const themeStyle = toRef(() => appSetting.value.themeStyle);
  const primaryColor = toRef(() => appSetting.value.primaryColor);
  const borderRadius = toRef(() => appSetting.value.borderRadius);
  const fontSize = toRef(() => appSetting.value.fontSize);
  const darkSidebar = toRef(() => appSetting.value.darkSidebar);
  const darkHeader = toRef(() => appSetting.value.darkHeader);
  const colorWeak = toRef(() => appSetting.value.colorWeak);
  const grayMode = toRef(() => appSetting.value.grayMode);

  /* ---------- 布局 ---------- */
  const layout = toRef(() => appSetting.value.layout);
  const sidebarCollapsed = toRef(() => appSetting.value.sidebarCollapsed);
  const sidebarWidth = toRef(() => appSetting.value.sidebarWidth);
  const menuAccordion = toRef(() => appSetting.value.menuAccordion);
  const headerMenuScroll = toRef(() => appSetting.value.headerMenuScroll);
  const showTabs = toRef(() => appSetting.value.showTabs);
  const tabShowIcon = toRef(() => appSetting.value.tabShowIcon);
  const tabStyle = toRef(() => appSetting.value.tabStyle);
  const tabDragSort = toRef(() => appSetting.value.tabDragSort);
  const tabContextMenu = toRef(() => appSetting.value.tabContextMenu);
  const showBreadcrumb = toRef(() => appSetting.value.showBreadcrumb);
  const hideBreadcrumbWhenOnlyOne = toRef(
    () => appSetting.value.hideBreadcrumbWhenOnlyOne,
  );
  const showBreadcrumbIcon = toRef(() => appSetting.value.showBreadcrumbIcon);

  /* ---------- 小部件 ---------- */
  const widgetNotice = toRef(() => appSetting.value.widgetNotice);
  const widgetFullscreen = toRef(() => appSetting.value.widgetFullscreen);
  const widgetTheme = toRef(() => appSetting.value.widgetTheme);
  const widgetTimezone = toRef(() => appSetting.value.widgetTimezone);
  const widgetLogout = toRef(() => appSetting.value.widgetLogout);
  const widgetSearch = toRef(() => appSetting.value.widgetSearch);
  const widgetPreferences = toRef(() => appSetting.value.widgetPreferences);

  /* ---------- 底栏 ---------- */
  const showFooter = toRef(() => appSetting.value.showFooter);
  const showCopyright = toRef(() => appSetting.value.showCopyright);
  const copyrightCompany = toRef(() => appSetting.value.copyrightCompany);
  const copyrightIcp = toRef(() => appSetting.value.copyrightIcp);

  /* ---------- 通用 ---------- */
  const timezone = toRef(() => appSetting.value.timezone);
  const enableWatermark = toRef(() => appSetting.value.enableWatermark);
  const watermarkContent = toRef(() => appSetting.value.watermarkContent);
  const enableWaterRipple = toRef(() => appSetting.value.enableWaterRipple);
  const notificationPosition = toRef(
    () => appSetting.value.notificationPosition,
  );
  const transitionEffect = toRef(() => appSetting.value.transitionEffect);
  const showProgressBar = toRef(() => appSetting.value.showProgressBar);
  const showLoading = toRef(() => appSetting.value.showLoading);
  const locale = toRef(() => appSetting.value.locale);
  const componentSize = toRef(() => appSetting.value.componentSize);

  /* ============================================================
   * 方法
   * ============================================================ */

  const updateSetting = (setting: Partial<AppSetting>) => {
    appSetting.value = { ...appSetting.value, ...setting };
    cache.setItem('appSetting', appSetting.value);
  };

  const resetSetting = () => {
    appSetting.value = { ...DEFAULT_SETTING };
    cache.setItem('appSetting', DEFAULT_SETTING);
  };

  /** 批量开关 */
  const toggles = {
    darkSidebar: () =>
      updateSetting({ darkSidebar: !appSetting.value.darkSidebar }),
    darkHeader: () =>
      updateSetting({ darkHeader: !appSetting.value.darkHeader }),
    colorWeak: () => updateSetting({ colorWeak: !appSetting.value.colorWeak }),
    grayMode: () => updateSetting({ grayMode: !appSetting.value.grayMode }),
    sidebarCollapsed: () =>
      updateSetting({ sidebarCollapsed: !appSetting.value.sidebarCollapsed }),
    menuAccordion: () =>
      updateSetting({ menuAccordion: !appSetting.value.menuAccordion }),
    headerMenuScroll: () =>
      updateSetting({
        headerMenuScroll: !appSetting.value.headerMenuScroll,
      }),
    showTabs: () => updateSetting({ showTabs: !appSetting.value.showTabs }),
    tabShowIcon: () =>
      updateSetting({ tabShowIcon: !appSetting.value.tabShowIcon }),
    tabDragSort: () =>
      updateSetting({ tabDragSort: !appSetting.value.tabDragSort }),
    tabContextMenu: () =>
      updateSetting({ tabContextMenu: !appSetting.value.tabContextMenu }),
    showBreadcrumb: () =>
      updateSetting({ showBreadcrumb: !appSetting.value.showBreadcrumb }),
    hideBreadcrumbWhenOnlyOne: () =>
      updateSetting({
        hideBreadcrumbWhenOnlyOne: !appSetting.value.hideBreadcrumbWhenOnlyOne,
      }),
    showBreadcrumbIcon: () =>
      updateSetting({
        showBreadcrumbIcon: !appSetting.value.showBreadcrumbIcon,
      }),
    widgetNotice: () =>
      updateSetting({ widgetNotice: !appSetting.value.widgetNotice }),
    widgetFullscreen: () =>
      updateSetting({ widgetFullscreen: !appSetting.value.widgetFullscreen }),
    widgetTheme: () =>
      updateSetting({ widgetTheme: !appSetting.value.widgetTheme }),
    widgetTimezone: () =>
      updateSetting({ widgetTimezone: !appSetting.value.widgetTimezone }),
    widgetLogout: () =>
      updateSetting({ widgetLogout: !appSetting.value.widgetLogout }),
    widgetSearch: () =>
      updateSetting({ widgetSearch: !appSetting.value.widgetSearch }),
    widgetPreferences: () =>
      updateSetting({ widgetPreferences: !appSetting.value.widgetPreferences }),
    showFooter: () =>
      updateSetting({ showFooter: !appSetting.value.showFooter }),
    showCopyright: () =>
      updateSetting({ showCopyright: !appSetting.value.showCopyright }),
    enableWatermark: () =>
      updateSetting({ enableWatermark: !appSetting.value.enableWatermark }),
    enableWaterRipple: () =>
      updateSetting({ enableWaterRipple: !appSetting.value.enableWaterRipple }),
    showProgressBar: () =>
      updateSetting({ showProgressBar: !appSetting.value.showProgressBar }),
    showLoading: () =>
      updateSetting({ showLoading: !appSetting.value.showLoading }),
    timezone: () => updateSetting({ timezone: appSetting.value.timezone }),
    locale: () => updateSetting({ locale: appSetting.value.locale }),
  };
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
    sidebarCollapsed,
    sidebarWidth,
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
    toggles,
  };
});
