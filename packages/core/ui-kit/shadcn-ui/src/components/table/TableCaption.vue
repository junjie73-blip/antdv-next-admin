<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <caption
    data-slot="table-caption"
    :class="cn('text-muted-foreground mt-4 text-sm', props.class)"
  >
    <slot></slot>
  </caption>
</template>
