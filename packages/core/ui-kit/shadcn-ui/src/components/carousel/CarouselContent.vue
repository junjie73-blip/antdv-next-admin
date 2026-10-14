<script setup lang="ts">
import type { ComponentPublicInstance } from "vue"

import type { WithClassAsProps } from "./interface"
import { cn } from '@antdv/shared/cn'
import { useCarousel } from "./useCarousel"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()

function setContentRef(el: ComponentPublicInstance | Element | null) {
  carouselRef.value = (el as HTMLElement) ?? undefined
}
</script>

<template>
  <div
    :ref="setContentRef"
    data-slot="carousel-content"
    class="overflow-hidden"
  >
    <div
      :class="
        cn(
          'flex',
          orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
          props.class,
        )"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </div>
</template>
