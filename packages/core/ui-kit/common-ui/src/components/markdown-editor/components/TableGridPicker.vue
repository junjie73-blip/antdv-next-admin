<script setup lang="ts">
import { computed, ref } from 'vue';

import { range } from 'es-toolkit';

const props = withDefaults(
  defineProps<{
    rows?: number;
    cols?: number;
  }>(),
  { rows: 6, cols: 6 },
);

const emit = defineEmits<{ select: [rows: number, cols: number] }>();

const hovered = ref({ rows: 0, cols: 0 });

// es-toolkit range：直接生成 1..n 的序号数组
const rowRange = computed(() => range(1, props.rows + 1));
const colRange = computed(() => range(1, props.cols + 1));

function isHighlighted(row: number, col: number) {
  return row <= hovered.value.rows && col <= hovered.value.cols;
}

function reset() {
  hovered.value = { rows: 0, cols: 0 };
}
</script>

<template>
  <div class="p-2" @mouseleave="reset">
    <div class="text-muted-foreground mb-1 h-4 text-xs">
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
          class="border-border h-3.5 w-3.5 rounded-sm border"
          :class="isHighlighted(row, col) && 'border-primary bg-primary/15'"
          @mouseenter="hovered = { rows: row, cols: col }"
          @click="emit('select', row, col)"
        ></button>
      </template>
    </div>
  </div>
</template>
