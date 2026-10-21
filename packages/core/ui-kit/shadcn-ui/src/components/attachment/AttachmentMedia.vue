<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { AttachmentMediaVariants } from '.';

import { cn } from '@antdv/shared/utils/cn';

import { attachmentMediaVariants } from '.';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  variant?: AttachmentMediaVariants['variant'];
}>();
</script>

<template>
  <div
    data-slot="attachment-media"
    :data-variant="variant"
    :class="cn(attachmentMediaVariants({ variant }), props.class)"
  >
    <slot></slot>
  </div>
</template>
