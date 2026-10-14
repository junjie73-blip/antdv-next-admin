<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from '@antdv/shared/cn'

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <optgroup data-slot="native-select-optgroup" :class="cn('bg-popover text-popover-foreground', props.class)">
    <slot />
  </optgroup>
</template>
