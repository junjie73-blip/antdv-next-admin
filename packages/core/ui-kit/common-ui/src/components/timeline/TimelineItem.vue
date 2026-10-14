<script setup lang="ts">
import { computed, inject } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { TIMELINE_KEY } from './context';

defineOptions({ name: 'TimelineItem' });

const props = withDefaults(
  defineProps<{
    color?: string;
    label?: string;
    position?: 'left' | 'right';
  }>(),
  {
    color: 'blue',
    label: undefined,
    position: undefined,
  },
);

const COLOR: Record<string, string> = {
  blue: 'bg-primary',
  gray: 'bg-gray-300 dark:bg-gray-600',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
};

const context = inject(TIMELINE_KEY, undefined);
const labeled = computed(() => context?.value.labeled ?? false);
const labelPlacement = computed(() => context?.value.labelPlacement ?? 'left');

const dotClass = computed(() =>
  cn('size-2.5 shrink-0 rounded-full', COLOR[props.color] ?? 'bg-primary')
);

const dotStyle = computed(() =>
  COLOR[props.color] ? undefined : { backgroundColor: props.color },
);

const labelFirst = computed(() => labelPlacement.value !== 'right');
</script>

<template>
  <li data-common-timeline-item class="group relative flex gap-3 pb-6 last:pb-0">
    <div
      v-if="labeled && labelFirst"
      class="w-24 shrink-0 pt-0.5 text-right text-xs text-gray-500 dark:text-gray-400"
    >
      <slot name="label">{{ props.label }}</slot>
    </div>

    <div class="flex shrink-0 flex-col items-center">
      <slot name="dot">
        <span :class="dotClass" :style="dotStyle"></span>
      </slot>
      <span class="mt-1 w-px flex-1 bg-gray-200 group-last:hidden dark:bg-gray-700"></span>
    </div>

    <div class="min-w-0 flex-1 -mt-0.5 pb-1">
      <slot></slot>
    </div>

    <div
      v-if="labeled && !labelFirst"
      class="w-24 shrink-0 pt-0.5 text-left text-xs text-gray-500 dark:text-gray-400"
    >
      <slot name="label">{{ props.label }}</slot>
    </div>
  </li>
</template>
