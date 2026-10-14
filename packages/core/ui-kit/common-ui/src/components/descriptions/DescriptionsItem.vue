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
const column = computed(() => context?.value.column ?? 3);
const layout = computed(() => context?.value.layout ?? 'horizontal');
const size = computed(() => context?.value.size ?? 'default');

const isVertical = computed(() => layout.value === 'vertical');

const style = computed(() => {
  const span = Math.max(1, Math.min(props.span, column.value));
  return { gridColumn: `span ${span} / span ${span}` };
});

const rootClass = computed(() =>
  cn(
    'flex min-w-0 py-1',
    bordered.value ? 'border' : '',
    isVertical.value ? 'flex-col' : 'flex-row',
  ),
);

const cellClass = computed(() =>
  size.value === 'small' ? 'px-2 py-1' : 'px-3 py-2',
);

const labelClass = computed(() =>
  bordered.value
    ? cn(
        'flex shrink-0 items-center bg-muted/40 font-medium',
        cellClass.value,
        isVertical.value ? 'border-b' : 'border-r',
      )
    : cn(
        'shrink-0 text-gray-500 dark:text-gray-400',
        isVertical.value ? 'mb-0.5' : 'mr-2',
      ),
);

const valueClass = computed(() =>
  cn('min-w-0 flex-1 break-words', bordered.value ? cellClass.value : ''),
);
</script>

<template>
  <div data-common-descriptions-item :style="style" :class="rootClass">
    <div v-if="props.label || $slots.label" data-common-descriptions-label :class="labelClass">
      <slot name="label">{{ props.label }}</slot>
    </div>
    <div data-common-descriptions-value :class="valueClass">
      <slot></slot>
    </div>
  </div>
</template>
