<script setup lang="ts">
import type { ModalWrapperProps } from '../types';

import { computed } from 'vue';

import { ScrollArea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useWindowSize } from '@vueuse/core';

const props = withDefaults(defineProps<ModalWrapperProps>(), {
  footerOffset: 0,
  useWrapper: true,
});

// useWindowSize：视口高度响应式，窗口缩放自动更新
const { height: windowHeight } = useWindowSize();

const wrapperStyle = computed(() => {
  if (!props.useWrapper) return {};

  if (props.height) {
    return { height: `${props.height}px` };
  }

  const maxHeight = windowHeight.value - 200 - props.footerOffset;

  return {
    maxHeight: `${maxHeight}px`,
    minHeight: props.minHeight ? `${props.minHeight}px` : '200px',
  };
});

const bodyStyle = computed(() => ({ maxHeight: '100%' }));
</script>

<template>
  <div :class="cn('modal-wrapper relative')" :style="wrapperStyle">
    <div
      v-if="loading"
      :class="
        cn(
          'modal-loading-mask',
          'absolute inset-0 z-10 flex items-center justify-center',
          'bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm',
        )
      "
    >
      <div :class="cn('flex flex-col items-center gap-2')">
        <div
          :class="
            cn('text-primary animate-spin border-2 border-t-transparent h-8 w-8 rounded-full border-current/20')
          "
        ></div>
        <span v-if="loadingTip" :class="cn('text-muted-foreground text-sm')">{{
          loadingTip
        }}</span>
      </div>
    </div>

    <ScrollArea
      :class="cn('modal-body h-full p-6')"
      :style="bodyStyle"
      type="scroll"
    >
      <slot></slot>
    </ScrollArea>
  </div>
</template>
