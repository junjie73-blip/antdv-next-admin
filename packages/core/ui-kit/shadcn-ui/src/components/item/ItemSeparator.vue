<script setup lang="ts">
import type { SeparatorProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { Separator } from '../separator';

const props = defineProps<
  SeparatorProps & { class?: HTMLAttributes['class'] }
>();
</script>

<template>
  <Separator
    data-slot="item-separator"
    orientation="horizontal"
    :class="cn('my-0', props.class)"
  />
</template>
