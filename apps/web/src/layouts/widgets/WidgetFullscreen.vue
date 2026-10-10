<script setup lang="ts">
import { computed } from 'vue';

import { Icon } from '@iconify/vue';
import { useFullscreen } from '@vueuse/core';

import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetFullscreen' });

const { isFullscreen, toggle } = useFullscreen();
const icon = computed(() =>
  isFullscreen.value ? 'carbon:minimize' : 'carbon:maximize',
);
/** 名称跟着状态走：读屏用户按 Tab 走到这里时，得知道这一键是"进"还是"出" */
const label = computed(() => (isFullscreen.value ? '退出全屏' : '全屏'));
</script>

<template>
  <WidgetButton :label="label" @click="toggle()">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
