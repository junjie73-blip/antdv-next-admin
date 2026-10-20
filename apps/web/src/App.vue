<script setup lang="ts">
import { computed } from 'vue';

import { autoPrefixTransformer, px2remTransformer } from '@antdv-next/cssinjs';
import {
  ConfigProvider as SystemConfigProvider,
  Toaster,
} from '@antdv/common-ui';
import { NOTIFICATION_TOASTER_ID } from '@antdv/popup-ui';
import { useAppStore } from '@antdv/stores';
import { App as AApp, ConfigProvider, StyleProvider } from 'antdv-next';
import { useLocaleSync } from '~/composables/useLocale';
import { getThemeConfig } from '~/settings';

const appStore = useAppStore();
const antdLocale = useLocaleSync();

/**
 * 剩下的 antd DOM 只有 `@form-create/antd-designer`（模板预编译，靠全局注册找组件）。
 * 它的主题与 `@antdv/design` 那套 token **同源**：两边读的都是偏好里的
 * `primaryColor / borderRadius / fontSize`，所以不存在"换主题、设计器还是蓝的"
 * 的第二条链路 —— 有第二条的形态是它自己另存一份色板，这里没有。
 */
const themeConfig = computed(() =>
  getThemeConfig(appStore.appSetting, appStore.isSystemDark),
);

const getPopupContainer = (triggerNode?: HTMLElement): HTMLElement => {
  if (
    triggerNode?.closest(
      '.ant-table-cell-fix, .ant-table-cell-fix-start, .ant-table-cell-fix-end',
    )
  ) {
    return document.body;
  }
  return triggerNode?.parentElement || document.body;
};

/** 偏好项沿用 antd 的驼峰命名，sonner 的位置写法是连字符，这里做一次映射 */
const TOAST_POSITIONS = {
  bottomLeft: 'bottom-left',
  bottomRight: 'bottom-right',
  topLeft: 'top-left',
  topRight: 'top-right',
} as const;

/** 通知的出场位置：偏好 `notificationPosition`，取不到时落回右下角 */
const notificationPosition = computed(
  () =>
    TOAST_POSITIONS[
      appStore.notificationPosition as keyof typeof TOAST_POSITIONS
    ] ?? 'bottom-right',
);

/**
 * 全局系统配置（`@antdv/common-ui` 的 ConfigProvider）：把偏好看成唯一来源。
 *
 * 语言与尺寸档位由这里下发，包内组件（Popconfirm 的确定/取消等）读
 * `useGlobalConfig()` 而不是各写死一份中文 —— 切语言时这些内置文案才会跟着变。
 * 主题色/圆角不在这条链路上，它们由偏好直接写 CSS 变量（见 `applyPreferencesToDom`）。
 */
const globalConfig = computed(() => ({
  componentSize: appStore.componentSize,
  locale: appStore.locale as 'en-US' | 'zh-CN',
}));
</script>

<template>
  <StyleProvider>
    <ConfigProvider
      :theme="themeConfig"
      :locale="antdLocale"
      :transformers="[autoPrefixTransformer, px2remTransformer]"
      :get-popup-container="getPopupContainer"
      :component-size="appStore.componentSize"
      virtual
    >
      <AApp>
        <SystemConfigProvider
          :component-size="globalConfig.componentSize"
          :locale="globalConfig.locale"
        >
          <router-view />
          <Toaster position="top-center" :theme="appStore.resolvedTheme" />
          <Toaster
            :id="NOTIFICATION_TOASTER_ID"
            :position="notificationPosition"
            :theme="appStore.resolvedTheme"
            close-button
            close-button-position="top-right"
          />
        </SystemConfigProvider>
      </AApp>
    </ConfigProvider>
  </StyleProvider>
</template>
