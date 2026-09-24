<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { cn } from '~/utils/cn'

import type { FileCategory } from '../types'

defineOptions({ name: 'FileCategoryNav' })

const props = defineProps<{
  categories: FileCategory[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [key: string]
}>()

function handleSelect(key: string) {
  if (key === props.modelValue) return
  emit('update:modelValue', key)
}
</script>

<template>
  <aside
    class="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 md:w-60 md:shrink-0 lg:w-64 dark:border-gray-800 dark:bg-gray-900"
  >
    <!-- 标题（小屏隐藏） -->
    <div class="hidden items-center gap-2 border-b border-gray-100 pb-2 md:flex dark:border-gray-800">
      <div
        class="text-ant-primary flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
      >
        <Icon icon="carbon:folder" class="text-lg" />
      </div>
      <div class="flex flex-col leading-tight">
        <span class="text-sm font-medium text-gray-800 dark:text-gray-100"> 文件分类 </span>
        <span class="text-xs text-gray-400 dark:text-gray-500"> 按类型筛选资源 </span>
      </div>
    </div>

    <!-- 分类列表：小屏横向滚动，大屏纵向 -->
    <nav class="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
      <button
        v-for="cat in categories"
        :key="cat.key"
        type="button"
        :class="
          cn(
            'group flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
            'md:w-full md:shrink',
            modelValue === cat.key
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60',
          )
        "
        @click="handleSelect(cat.key)"
      >
        <Icon :icon="cat.icon" class="shrink-0 text-base" />
        <span class="flex-1 truncate text-sm">{{ cat.label }}</span>
      </button>
    </nav>
  </aside>
</template>
