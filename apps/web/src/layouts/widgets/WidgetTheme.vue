<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';
import { useThemeTransition } from '~/composables/web/useThemeTransition';
import { useAppStore } from '~/stores/modules/app';

import WidgetButton from './components/WidgetButton.vue';
defineOptions({ name: 'WidgetTheme' });

const { t } = useI18n({ useScope: 'global' });
const appStore = useAppStore();
const { switchThemeWithAnimation, isDarkNow } = useThemeTransition();

const isDark = computed(() => isDarkNow(appStore.themeMode));
/** 图标：暗色时显示太阳（点击切亮色），亮色时显示月亮 */
const icon = computed(() =>
  isDarkNow(appStore.themeMode) ? 'carbon:sun' : 'carbon:moon',
);
const title = computed(() =>
  isDark.value ? t('header.toLight') : t('header.toDark'),
);

function handleClick(e: MouseEvent) {
  void switchThemeWithAnimation(isDark.value ? 'light' : 'dark', e);
}
</script>

<template>
  <WidgetButton :label="title" @click="(e: MouseEvent) => handleClick(e)">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
