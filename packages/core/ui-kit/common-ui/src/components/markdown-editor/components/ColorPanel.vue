<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { isString } from 'es-toolkit';

const props = defineProps<{
  colors: string[];
  current?: string;
  clearable?: boolean;
}>();

const emit = defineEmits<{ select: [value: string] }>();

/** 归一化当前色值：null/undefined 处理为空串 */
const normalizedCurrent = computed(() =>
  isString(props.current) ? props.current.toLowerCase() : '',
);

function isActive(color: string) {
  return color.toLowerCase() === normalizedCurrent.value;
}
</script>

<template>
  <div class="w-48 p-1">
    <div class="grid grid-cols-10 gap-1">
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        :title="color"
        :class="
          cn(
            'border-border h-4 w-4 rounded-sm border transition-transform hover:scale-110',
            isActive(color) && 'ring-2 ring-ring',
          )
        "
        :style="{ backgroundColor: color }"
        @click="emit('select', color)"
      ></button>
    </div>

    <div v-if="clearable" class="mt-2 border-t border-border pt-1">
      <button
        type="button"
        class="text-muted-foreground w-full rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
        @click="emit('select', '')"
      >
        清除颜色
      </button>
    </div>
  </div>
</template>
