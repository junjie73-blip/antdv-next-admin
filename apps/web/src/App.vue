<script setup lang="ts">
import { computed } from 'vue';

import {
  ConfigProvider as SystemConfigProvider,
  Toaster,
} from '@antdv/common-ui';
import { NOTIFICATION_TOASTER_ID } from '@antdv/popup-ui';
import { useAppStore } from '@antdv/stores';

import { useLocaleSync } from '~/composables/useLocale';

const appStore = useAppStore();
/** locale 效应的唯一出口：i18n 文案、`<html lang>`、dayjs 格式化都在这一步展开 */
useLocaleSync();

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
 * 主题色/圆角不在这条链路上，它们由偏好直接写 CSS 变量（见 `applyPreferencesToDom`）：
 * 组件的配色一律走 `var(--app-*)` / `bg-primary` 这类 token，所以**只有这一条链路**，
 * 不存在"换了主题色、某块 DOM 还是蓝的"的第二份色板。
 */
const globalConfig = computed(() => ({
  componentSize: appStore.componentSize,
  locale: appStore.locale as 'en-US' | 'zh-CN',
}));
</script>

<template>
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
</template>
