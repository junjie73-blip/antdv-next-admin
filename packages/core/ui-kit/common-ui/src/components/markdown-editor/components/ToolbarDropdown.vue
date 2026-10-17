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
      class="text-muted-foreground relative flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
      :class="(active || open) && 'bg-primary/10 text-primary'"
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
      class="border-border bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 min-w-max rounded-md border p-1 shadow-lg"
      @mousedown.prevent
      @click="close"
    >
      <slot :close="close"></slot>
    </div>
  </div>
</template>
