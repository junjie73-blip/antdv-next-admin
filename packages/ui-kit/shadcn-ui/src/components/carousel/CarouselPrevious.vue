<script setup lang="ts">
import type { ButtonVariants } from '../button'
import type { WithClassAsProps } from "./interface"

import { cn } from '@antdv/shared/cn'
import { ArrowLeft } from "@lucide/vue"

import { Button } from '../button'
import { useCarousel } from "./useCarousel"

const props = withDefaults(defineProps<WithClassAsProps
& {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
}>(), {
  variant: "outline",
  size: "icon",
})

const { orientation, canScrollPrev, scrollPrev } = useCarousel()
</script>

<template>
  <Button
    data-slot="carousel-previous"
    :disabled="!canScrollPrev"
    :class="cn(
      'absolute size-8 rounded-full',
      orientation === 'horizontal'
        ? 'top-1/2 -left-12 -translate-y-1/2'
        : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
      props.class,
    )"
    :variant="variant"
    :size="size"
    @click="scrollPrev"
  >
    <slot>
      <ArrowLeft />
      <span class="sr-only">Previous Slide</span>
    </slot>
  </Button>
</template>
