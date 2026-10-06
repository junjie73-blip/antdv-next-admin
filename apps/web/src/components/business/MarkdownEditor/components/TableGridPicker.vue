<script setup lang="ts">
import { range } from 'es-toolkit'
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

// es-toolkit range：直接生成 1..n 的序号数组
const rowRange = computed(() => range(1, props.rows + 1))
const colRange = computed(() => range(1, props.cols + 1))

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

    <div
      class="grid gap-0.5"
      :style="{ gridTemplateColumns: `repeat(${cols}, 14px)` }"
    >
      <template v-for="row in rowRange" :key="row">
        <button
          v-for="col in colRange"
          :key="`${row}-${col}`"
          type="button"
          class="h-3.5 w-3.5 rounded-sm border border-gray-300 dark:border-gray-600"
          :class="
            isHighlighted(row, col) &&
            'border-blue-500 bg-blue-100 dark:bg-blue-500/30'
          "
          @mouseenter="hovered = { rows: row, cols: col }"
          @click="emit('select', row, col)"
        />
      </template>
    </div>
  </div>
</template>
