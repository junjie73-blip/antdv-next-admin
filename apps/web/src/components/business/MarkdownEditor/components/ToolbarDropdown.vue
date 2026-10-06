<script setup lang="ts">
import { ref } from 'vue';

import { Icon } from '@iconify/vue';
import { onClickOutside } from '@vueuse/core';

const props = defineProps<{
  title: string;
  label?: string;
  icon?: string;
  swatch?: string;
  active?: boolean;
  disabled?: boolean;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function close() {
  open.value = false;
}

// onClickOutside：自动挂载/清理 document 监听，语义更清晰
onClickOutside(rootRef, () => {
  if (open.value) open.value = false;
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      :title="title"
      :disabled="disabled"
      class="relative flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
      :class="
        (active || open) &&
        'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
      "
      @mousedown.prevent="toggle"
    >
      <Icon v-if="icon" :icon="icon" class="text-base" />
      <span v-else class="max-w-16 truncate">{{ label }}</span>
      <Icon icon="carbon:chevron-down" class="text-[10px] opacity-60" />

      <span
        v-if="swatch"
        class="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
        :style="{ backgroundColor: swatch }"
      ></span>
    </button>

    <div
      v-if="open"
      class="absolute top-full left-0 z-50 mt-1 min-w-max rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      @mousedown.prevent
      @click="close"
    >
      <slot :close="close"></slot>
    </div>
  </div>
</template>
