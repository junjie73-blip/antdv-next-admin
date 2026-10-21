<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
  <optgroup
    data-slot="native-select-optgroup"
    :class="cn('bg-popover text-popover-foreground', props.class)"
  >
    <slot></slot>
  </optgroup>
</template>
