<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Space' });

const props = withDefaults(
  defineProps<{
    align?: 'baseline' | 'center' | 'end' | 'start';
    direction?: 'horizontal' | 'vertical';
    size?: 'large' | 'middle' | 'small' | number;
    wrap?: boolean;
  }>(),
  {
    align: undefined,
    direction: 'horizontal',
    size: 'small',
    wrap: false,
  },
);

const GAP: Record<'large' | 'middle' | 'small', number> = {
  large: 24,
  middle: 16,
  small: 8,
};

/** Tailwind 只认字面类名，档位映射不能拼字符串 */
const ALIGN: Record<'baseline' | 'center' | 'end' | 'start', string> = {
  baseline: 'items-baseline',
  center: 'items-center',
  end: 'items-end',
  start: 'items-start',
};

const rootClass = computed(() =>
  cn(
    'inline-flex',
    props.direction === 'vertical' ? 'flex-col' : 'flex-row',
    props.wrap ? 'flex-wrap' : '',
    props.align
      ? ALIGN[props.align]
      : props.direction === 'vertical'
        ? 'items-stretch'
        : 'items-center',
  ),
);

const style = computed(() => {
  const gap =
    typeof props.size === 'number' ? props.size : (GAP[props.size] ?? 8);
  return { gap: `${gap}px` };
});
</script>

<template>
  <div data-common-space :class="rootClass" :style="style">
    <slot></slot>
  </div>
</template>
