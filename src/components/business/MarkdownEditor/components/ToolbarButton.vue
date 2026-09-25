<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  title: string
  icon?: string
  label?: string
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <!-- mousedown 阻止默认行为，避免点击工具栏时编辑器丢失选区 -->
  <button
    type="button"
    :title="title"
    :disabled="disabled"
    class="flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
    :class="active && 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'"
    @mousedown.prevent
    @click="emit('click')"
  >
    <Icon v-if="icon" :icon="icon" class="text-base" />
    <span v-else class="px-0.5 text-xs">{{ label }}</span>
  </button>
</template>
