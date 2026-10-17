<script setup lang="ts">
import { computed } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
import { Icon } from '@iconify/vue';
import { useAppStore } from '@antdv/stores';

import { useThemeTransition } from '../../hooks/use-theme-transition';
import WidgetButton from '../widget-button.vue';

defineOptions({ name: 'WidgetTheme' });

const { t } = useLayoutI18n();
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
