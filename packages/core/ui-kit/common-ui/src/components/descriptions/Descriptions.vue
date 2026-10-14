<script setup lang="ts">
import { computed, provide } from 'vue';

import { DESCRIPTIONS_KEY } from './context';

defineOptions({ name: 'Descriptions' });

const props = withDefaults(
  defineProps<{
    bordered?: boolean;
    column?: number;
    layout?: 'horizontal' | 'vertical';
    size?: 'default' | 'middle' | 'small';
    title?: string;
  }>(),
  {
    bordered: false,
    column: 3,
    layout: 'horizontal',
    size: 'default',
    title: undefined,
  },
);

provide(
  DESCRIPTIONS_KEY,
  computed(() => ({
    bordered: props.bordered,
    column: props.column,
    layout: props.layout,
    size: props.size,
  })),
);

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.column}, minmax(0, 1fr))`,
}));
</script>

<template>
  <div
    data-common-descriptions
    :data-bordered="props.bordered"
    class="w-full text-sm"
  >
    <div
      v-if="props.title || $slots.title"
      data-common-descriptions-title
      class="mb-2 text-base font-medium"
    >
      <slot name="title">{{ props.title }}</slot>
    </div>
    <div
      class="grid"
      :class="props.bordered ? '-mt-px -ml-px' : 'gap-x-4'"
      :style="gridStyle"
    >
      <slot></slot>
    </div>
    <slot name="extra"></slot>
  </div>
</template>
