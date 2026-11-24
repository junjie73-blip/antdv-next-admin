<script setup lang="ts">
import { computed, inject } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { DESCRIPTIONS_KEY } from './context';

defineOptions({ name: 'DescriptionsItem' });

const props = withDefaults(
  defineProps<{
    label?: string;
    span?: number;
  }>(),
  {
    label: undefined,
    span: 1,
  },
);

const context = inject(DESCRIPTIONS_KEY, undefined);
const bordered = computed(() => context?.value.bordered ?? false);
const layout = computed(() => context?.value.layout ?? 'horizontal');
const size = computed(() => context?.value.size ?? 'default');
const isVertical = computed(() => layout.value === 'vertical');

// 跨列倍数交给 CSS 变量：响应式 column 切换时由列级规则重新计算实际宽度，
// 超过当前行容量的 span 会被 min(..., 100%) 收窄为占满整行。
const safeSpan = computed(() => {
  const raw = Number(props.span ?? 1);
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
});

const itemStyle = computed<Record<string, string>>(() => ({
  '--desc-span': String(safeSpan.value),
}));

const cellClass = computed(() =>
  size.value === 'small' ? 'px-2 py-1.5' : 'px-3 py-2',
);

const itemClass = computed(() =>
  cn(
    'flex min-w-0 items-start',
    isVertical.value && 'flex-col',
    bordered.value && 'border-r border-b',
  ),
);

const labelClass = computed(() =>
  cn(
    // 宽度统一由列级 --desc-label-width 控制，保证跨行/跨列同宽；右对齐对齐官网
    'text-muted-foreground shrink-0 text-right font-medium break-words whitespace-normal',
    cellClass.value,
    bordered.value ? 'bg-muted/40 border-r' : 'pr-2',
    isVertical.value && 'w-full text-left',
  ),
);

const labelStyle = computed(() =>
  isVertical.value ? undefined : { width: 'var(--desc-label-width)' },
);

const valueClass = computed(() =>
  cn(
    'min-w-0 flex-1 wrap-break-word',
    cellClass.value,
    isVertical.value && 'w-full',
  ),
);
</script>

<template>
  <div data-common-descriptions-item :style="itemStyle" :class="itemClass">
    <div data-common-descriptions-label :style="labelStyle" :class="labelClass">
      <slot name="label">{{ label }}</slot>
    </div>
    <div data-common-descriptions-value :class="valueClass">
      <slot></slot>
    </div>
  </div>
</template>
