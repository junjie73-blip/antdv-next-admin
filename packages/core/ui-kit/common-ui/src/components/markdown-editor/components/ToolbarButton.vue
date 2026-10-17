<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  title: string;
  icon?: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <!-- mousedown 阻止默认行为，避免点击工具栏时编辑器丢失选区 -->
  <button
    type="button"
    :title="title"
    :disabled="disabled"
    class="text-muted-foreground flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
    :class="active && 'bg-primary/10 text-primary'"
    @mousedown.prevent
    @click="emit('click')"
  >
    <Icon v-if="icon" :icon="icon" class="text-base" />
    <span v-else class="px-0.5 text-xs">{{ label }}</span>
  </button>
</template>
