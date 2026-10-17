<script setup lang="ts">
import { computed } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
import { Icon } from '@iconify/vue';
import { useFullscreen } from '@vueuse/core';

import WidgetButton from '../widget-button.vue';

defineOptions({ name: 'WidgetFullscreen' });

const { t } = useLayoutI18n();
const { isFullscreen, toggle } = useFullscreen();
const icon = computed(() =>
  isFullscreen.value ? 'carbon:minimize' : 'carbon:maximize',
);
/** 名称跟着状态走：读屏用户按 Tab 走到这里时，得知道这一键是"进"还是"出" */
const label = computed(() =>
  isFullscreen.value ? t('header.exitFullscreen') : t('header.fullscreen'),
);
</script>

<template>
  <WidgetButton :label="label" @click="toggle()">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
