<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { Loader2Icon } from '@lucide/vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <Loader2Icon
    role="status"
    aria-label="Loading"
    :class="cn('size-4 animate-spin', props.class)"
  />
</template>
