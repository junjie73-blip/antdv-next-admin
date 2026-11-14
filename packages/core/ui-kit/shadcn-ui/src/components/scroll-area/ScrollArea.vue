<script setup lang="ts">
import type { ScrollAreaRootProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import { reactiveOmit } from '@vueuse/core';
import { cn } from 'cn';
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui';

import ScrollBar from './ScrollBar.vue';

/**
 * 额外接收四个"穿透到内部节点"的样式属性。
 *
 * 之前只声明了 `ScrollAreaRootProps & { class }`，于是 `viewport-class` /
 * `scrollbar-class` / `thumb-class` 被当成普通 attrs 落在根 div 上（DOM 里能看到
 * `viewport-class="..."` 这种无效属性），真正需要它们的 viewport 与滚动条反而拿不到
 * —— 侧栏的 `overflow-x-hidden`、自绘条的细宽与配色全部失效。这里显式声明并下发。
 */
const props = withDefaults(
  defineProps<
    ScrollAreaRootProps & {
      class?: HTMLAttributes['class'];
      viewportClass?: HTMLAttributes['class'];
      viewportStyle?: HTMLAttributes['style'];
      scrollbarClass?: HTMLAttributes['class'];
      thumbClass?: HTMLAttributes['class'];
    }
  >(),
  {
    // reka 默认是 'hover'：指针停在侧栏/抽屉上时轨道常驻，看着像"滚动条一直显示"。
    // 'auto' 只在内容真的溢出时才挂载自绘滚动条，符合"超出高度才显示"的预期。
    type: 'auto',
  },
);

const delegatedProps = reactiveOmit(
  props,
  'class',
  'viewportClass',
  'viewportStyle',
  'scrollbarClass',
  'thumbClass',
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
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
