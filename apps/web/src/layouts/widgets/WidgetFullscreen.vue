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
</script>

<template>
  <WidgetButton @click="toggle()">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
