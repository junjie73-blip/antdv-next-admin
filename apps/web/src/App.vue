<script setup lang="ts">
import { computed } from 'vue';

import { autoPrefixTransformer, px2remTransformer } from '@antdv-next/cssinjs';
import { HappyProvider } from '@antdv-next/happy-work-theme';
import { Toaster } from '@antdv/shadcn-ui';
import { App as AApp, ConfigProvider, StyleProvider } from 'antdv-next';
import { useLocaleSync } from '~/composables/web/useLocale';
import { getThemeConfig } from '~/settings';
import { useAppStore } from '~/stores/modules/app';

const mode = import.meta.env.MODE;
const appStore = useAppStore();
const antdLocale = useLocaleSync();

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

const themeConfig = computed(() =>
  getThemeConfig(appStore.appSetting, appStore.isSystemDark),
);

/** 偏好项沿用 antd 的命名，sonner 的位置写法不同，这里做一次映射 */
const TOAST_POSITIONS = {
  bottomLeft: 'bottom-left',
  bottomRight: 'bottom-right',
  topLeft: 'top-left',
  topRight: 'top-right',
} as const;

const toastPosition = computed(
  () =>
    TOAST_POSITIONS[
      appStore.notificationPosition as keyof typeof TOAST_POSITIONS
    ] ?? 'top-right',
);
</script>

<template>
  <HappyProvider v-slot="{ wave }" :enabled="appStore.enableWaterRipple">
    <StyleProvider>
      <ConfigProvider
        :theme="themeConfig"
        :wave="wave"
        :locale="antdLocale"
        :transformers="[autoPrefixTransformer, px2remTransformer]"
        :get-popup-container="getPopupContainer"
        :component-size="appStore.componentSize"
        virtual
      >
        <AApp
          :notification="{
            placement: appStore.notificationPosition,
          }"
        >
          <router-view />
          <Toaster :position="toastPosition" />
        </AApp>
      </ConfigProvider>
    </StyleProvider>
  </HappyProvider>
</template>
