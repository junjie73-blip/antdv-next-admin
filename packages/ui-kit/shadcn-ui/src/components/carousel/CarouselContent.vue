<script setup lang="ts">
import type { WithClassAsProps } from "./interface"

import { cn } from '@antdv/shared/cn'

import { useCarousel } from "./useCarousel"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()
// 模板 `ref="carouselRef"` 为字符串模板引用，vue-tsc 不计入使用点
void carouselRef
</script>

<template>
  <div
    ref="carouselRef"
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
      <slot></slot>
    </div>
  </div>
</template>
