<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    rows?: number
    cols?: number
  }>(),
  { rows: 6, cols: 6 },
)

const emit = defineEmits<{ select: [rows: number, cols: number] }>()

const hovered = ref({ rows: 0, cols: 0 })

const cells = computed(() =>
  Array.from({ length: props.rows * props.cols }, (_, index) => ({
    key: index,
    row: Math.floor(index / props.cols) + 1,
    col: (index % props.cols) + 1,
  })),
)

function isHighlighted(row: number, col: number) {
  return row <= hovered.value.rows && col <= hovered.value.cols
}

function reset() {
  hovered.value = { rows: 0, cols: 0 }
}
</script>

<template>
  <div class="p-2" @mouseleave="reset">
    <div class="mb-1 h-4 text-xs text-gray-500 dark:text-gray-400">
      {{ hovered.rows ? `${hovered.rows} × ${hovered.cols}` : '插入表格' }}
    </div>

    <div class="grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${cols}, 14px)` }">
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="h-3.5 w-3.5 rounded-sm border border-gray-300 dark:border-gray-600"
        :class="isHighlighted(cell.row, cell.col) && 'border-blue-500 bg-blue-100 dark:bg-blue-500/30'"
        @mouseenter="hovered = { rows: cell.row, cols: cell.col }"
        @click="emit('select', cell.row, cell.col)"
      />
    </div>
  </div>
</template>
