<script setup lang="ts">
import { autoPrefixTransformer, px2remTransformer } from "@antdv-next/cssinjs";
import { HappyProvider } from "@antdv-next/happy-work-theme";
// eslint-disable-next-line import/order
import { ConfigProvider, StyleProvider } from "antdv-next";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";
import "dayjs/locale/en";
import relativeTime from "dayjs/plugin/relativeTime";
import { computed, shallowRef, watch, watchEffect } from "vue";

import { getThemeConfig } from "~/settings";
import { useAppStore } from "~/stores/modules/app";
import dayjs from "~/utils/dayjs";

dayjs.extend(relativeTime);
const mode = import.meta.env.MODE;
const appStore = useAppStore();

dayjs.locale("zh-CN");

const antdLocale = shallowRef<any>();

const getPopupContainer = (triggerNode?: HTMLElement | undefined): HTMLElement =>
  triggerNode?.parentElement || document.body;

const themeConfig = computed(() =>
  getThemeConfig(appStore.themeStyle, appStore.themeMode === "dark", appStore.appSetting),
);

const DAYJS_LOCALE_MAP: Record<string, string> = {
  "zh-CN": "zh-cn",
  "zh-TW": "zh-tw",
  "en-US": "en",
};

watch(
  () => appStore.locale,
  async (locale) => {
    // 1) 切 dayjs
    dayjs.locale(DAYJS_LOCALE_MAP[locale] || "zh-cn");

    // 2) 切 antd locale
    const localeModules: Record<string, () => Promise<{ default: any }>> = {
      "zh-CN": () => import("antdv-next/locale/zh_CN"),
      "zh-TW": () => import("antdv-next/locale/zh_TW"),
      "en-US": () => import("antdv-next/locale/en_US"),
    };

    const loader = localeModules[locale] || localeModules["zh-CN"];
    if (loader) {
      const module = await loader();
      antdLocale.value = module.default;
    }
  },
  { immediate: true },
);

watchEffect(() => {
  const html = document.documentElement;
  html.classList.toggle("dark", appStore.themeMode === "dark");
  html.classList.toggle("color-weak", appStore.colorWeak);
  html.classList.toggle("gray-mode", appStore.grayMode);
});

watch(
  () => appStore.primaryColor,
  (color) => {
    document.documentElement.style.setProperty("--ant-color-primary", color);
  },
  { immediate: true },
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
