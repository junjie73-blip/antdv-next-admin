<script setup lang="ts">
defineProps<{
  colors: string[]
  current?: string
  /** 是否提供"清除颜色"入口 */
  clearable?: boolean
}>()

const emit = defineEmits<{ select: [value: string] }>()
</script>

<template>
  <div class="w-48 p-1">
    <div class="grid grid-cols-10 gap-1">
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        :title="color"
        class="h-4 w-4 rounded-sm border border-gray-300 transition-transform hover:scale-110 dark:border-gray-600"
        :class="color.toLowerCase() === current?.toLowerCase() && 'ring-2 ring-blue-500'"
        :style="{ backgroundColor: color }"
        @click="emit('select', color)"
      />
    </div>

    <div v-if="clearable" class="mt-2 border-t border-gray-100 pt-1 dark:border-gray-700">
      <button
        type="button"
        class="w-full rounded px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        @click="emit('select', '')"
      >
        清除颜色
      </button>
    </div>
  </div>
</template>
