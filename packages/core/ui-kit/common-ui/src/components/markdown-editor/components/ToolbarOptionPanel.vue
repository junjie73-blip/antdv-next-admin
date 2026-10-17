<script setup lang="ts">
import type { ToolbarOption } from '../constants';

import { Icon } from '@iconify/vue';

import { Scrollbar } from '../../scrollbar';

const props = defineProps<{
  options: ToolbarOption[];
  current?: string;
  /** 选项内联预览，让字号 / 字体下拉所见即所得 */
  preview?: 'fontFamily' | 'fontSize';
}>();

const emit = defineEmits<{ select: [value: string] }>();

function previewStyle(value: string): Record<string, string> | undefined {
  if (!value || !props.preview) return undefined;
  return props.preview === 'fontFamily'
    ? { fontFamily: value }
    : { fontSize: value };
}
</script>

<template>
  <!--
    浮层里的选项列表：超过 16 条就必须能滚，而系统滚动条在这个尺寸下既难抓
    又会把面板撑宽，所以统一交给同包封装的 <Scrollbar>（../scrollbar）。
    高度限制放在 Scrollbar 的 root 上，`ul` 只负责内容与最小宽度。
  -->
  <Scrollbar root-class="max-h-64" wrap-class="overflow-x-hidden">
    <ul class="min-w-24">
      <li v-for="item in options" :key="item.value || 'default'">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs hover:bg-accent"
          :class="item.value === current && 'text-primary'"
          @click="emit('select', item.value)"
        >
          <span :style="previewStyle(item.value)">{{ item.label }}</span>
          <Icon
            v-if="item.value === current"
            icon="carbon:checkmark"
            class="text-sm"
          />
        </button>
      </li>
    </ul>
  </Scrollbar>
</template>
