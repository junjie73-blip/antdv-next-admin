<script setup lang="ts">
import { computed } from 'vue';

import { autoPrefixTransformer, px2remTransformer } from '@antdv-next/cssinjs';
import { HappyProvider } from '@antdv-next/happy-work-theme';
import { ConfigProvider, StyleProvider } from 'antdv-next';
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
        <a-app
          :notification="{
            placement: appStore.notificationPosition,
          }"
        >
          <router-view />
        </a-app>
      </ConfigProvider>
    </StyleProvider>
  </HappyProvider>
</template>
