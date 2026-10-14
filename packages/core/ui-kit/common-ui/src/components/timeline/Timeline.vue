<script setup lang="ts">
import { computed, provide } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { TIMELINE_KEY } from './context';

defineOptions({ name: 'Timeline' });

const props = withDefaults(
  defineProps<{
    labelPlacement?: 'left' | 'right';
    mode?: 'alternative' | 'left' | 'right';
    pending?: boolean | string;
    reverse?: boolean;
  }>(),
  {
    labelPlacement: undefined,
    mode: undefined,
    pending: false,
    reverse: false,
  },
);

const labelPlacement = computed(
  () => props.labelPlacement ?? (props.mode === 'right' ? 'right' : 'left'),
);

const labeled = computed(() => Boolean(props.labelPlacement || props.mode));

const rootClass = computed(() =>
  cn('flex flex-col', props.reverse ? 'flex-col-reverse' : '')
);

provide(
  TIMELINE_KEY,
  computed(() => ({ labelPlacement: labelPlacement.value, labeled: labeled.value })),
);
</script>

<template>
  <ul data-common-timeline :class="rootClass">
    <slot></slot>
  </ul>
</template>
