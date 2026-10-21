<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  variant?: 'label' | 'legend';
}>();
</script>

<template>
  <legend
    data-slot="field-legend"
    :data-variant="variant"
    :class="
      cn(
        'mb-3 font-medium',
        'data-[variant=legend]:text-base',
        'data-[variant=label]:text-sm',
        props.class,
      )
    "
  >
    <slot></slot>
  </legend>
</template>
