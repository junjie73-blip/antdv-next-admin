<script setup lang="ts">
import type { ScrollAreaRootProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { reactiveOmit } from '@vueuse/core';
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui';

import ScrollBar from './ScrollBar.vue';

const props = defineProps<
  ScrollAreaRootProps & {
    class?: HTMLAttributes['class'];
    scrollbarClass?: HTMLAttributes['class'];
    thumbClass?: HTMLAttributes['class'];
    viewportClass?: HTMLAttributes['class'];
    viewportStyle?: HTMLAttributes['style'];
  }
>();

const delegatedProps = reactiveOmit(
  props,
  'class',
  'scrollbarClass',
  'thumbClass',
  'viewportClass',
  'viewportStyle',
);
</script>

<template>
  <ScrollAreaRoot
    data-slot="scroll-area"
    v-bind="delegatedProps"
    :class="cn('relative', props.class)"
  >
    <ScrollAreaViewport
      data-slot="scroll-area-viewport"
      :class="
        cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:outline-1',
          props.viewportClass,
        )
      "
      :style="props.viewportStyle"
    >
      <slot></slot>
    </ScrollAreaViewport>
    <ScrollBar :class="props.scrollbarClass" :thumb-class="props.thumbClass" />
    <ScrollBar
      orientation="horizontal"
      :class="props.scrollbarClass"
      :thumb-class="props.thumbClass"
    />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
