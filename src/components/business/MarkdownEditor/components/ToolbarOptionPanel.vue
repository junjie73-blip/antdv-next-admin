<script setup lang="ts">
import { Icon } from '@iconify/vue'

import type { ToolbarOption } from '../constants'

const props = defineProps<{
  options: ToolbarOption[]
  current?: string
  /** 选项内联预览，让字号 / 字体下拉所见即所得 */
  preview?: 'fontFamily' | 'fontSize'
}>()

const emit = defineEmits<{ select: [value: string] }>()

function previewStyle(value: string): Record<string, string> | undefined {
  if (!value || !props.preview) return undefined
  return props.preview === 'fontFamily' ? { fontFamily: value } : { fontSize: value }
}
</script>

<template>
  <ul class="max-h-64 min-w-24 overflow-y-auto">
    <li v-for="item in options" :key="item.value || 'default'">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        :class="item.value === current && 'text-blue-600 dark:text-blue-300'"
        @click="emit('select', item.value)"
      >
        <span :style="previewStyle(item.value)">{{ item.label }}</span>
        <Icon v-if="item.value === current" icon="carbon:checkmark" class="text-sm" />
      </button>
    </li>
  </ul>
</template>
