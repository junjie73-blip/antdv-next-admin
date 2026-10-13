<script setup lang="ts">
import type { HTMLAttributes } from "vue"

import { cn } from '@antdv/shared/cn'

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <option data-slot="native-select-option" :class="cn('bg-popover text-popover-foreground', props.class)">
    <slot></slot>
  </option>
</template>
