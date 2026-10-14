<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed } from 'vue';

import { Spinner } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'Statistic' });

const props = withDefaults(
  defineProps<{
    decimalSeparator?: string;
    groupSeparator?: string;
    loading?: boolean;
    precision?: number;
    prefix?: string;
    suffix?: string;
    title?: string;
    value?: number | string;
    valueStyle?: CSSProperties;
  }>(),
  {
    decimalSeparator: '.',
    groupSeparator: ',',
    loading: false,
    precision: undefined,
    prefix: undefined,
    suffix: undefined,
    title: undefined,
    value: undefined,
    valueStyle: undefined,
  },
);

const formatted = computed(() => {
  const raw = props.value;
  if (raw === undefined || raw === null || raw === '') return '-';
  if (typeof raw !== 'number') return String(raw);
  const fixed = props.precision === undefined ? raw : raw.toFixed(props.precision);
  const [int = '0', decimal] = String(fixed).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, props.groupSeparator);
  return decimal ? `${grouped}${props.decimalSeparator}${decimal}` : grouped;
});
</script>

<template>
  <div data-common-statistic class="inline-flex flex-col gap-1">
    <div
      v-if="props.title || $slots.title"
      class="text-sm text-gray-500 dark:text-gray-400"
    >
      <slot name="title">{{ props.title }}</slot>
    </div>
    <Spinner v-if="props.loading" class="text-base" />
    <div
      v-else
      :style="props.valueStyle"
      :class="cn('text-2xl font-semibold leading-tight tabular-nums')"
    >
      <span v-if="props.prefix || $slots.prefix" class="mr-1 text-base font-normal">
        <slot name="prefix">{{ props.prefix }}</slot>
      </span>
      <slot name="formatter">
        <span data-common-statistic-value>{{ formatted }}</span>
      </slot>
      <span v-if="props.suffix || $slots.suffix" class="ml-1 text-base font-normal">
        <slot name="suffix">{{ props.suffix }}</slot>
      </span>
    </div>
  </div>
</template>
