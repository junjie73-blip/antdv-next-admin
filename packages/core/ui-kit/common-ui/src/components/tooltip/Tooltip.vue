<script setup lang="ts">
import { computed } from 'vue';

import {
  TooltipContent,
  Tooltip as TooltipPrimitive,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';

defineOptions({ name: 'Tooltip' });

const props = withDefaults(
  defineProps<{
    placement?:
      | 'bottom'
      | 'bottomLeft'
      | 'bottomRight'
      | 'left'
      | 'leftBottom'
      | 'leftTop'
      | 'right'
      | 'rightBottom'
      | 'rightTop'
      | 'top'
      | 'topLeft'
      | 'topRight';
    title?: string;
  }>(),
  {
    placement: 'top',
    title: undefined,
  },
);

/** antd 的九宫格方位映射到 reka 的 side + align */
const PLACEMENT: Record<
  string,
  {
    align: 'center' | 'end' | 'start';
    side: 'bottom' | 'left' | 'right' | 'top';
  }
> = {
  bottom: { align: 'center', side: 'bottom' },
  bottomLeft: { align: 'start', side: 'bottom' },
  bottomRight: { align: 'end', side: 'bottom' },
  left: { align: 'center', side: 'left' },
  leftBottom: { align: 'end', side: 'left' },
  leftTop: { align: 'start', side: 'left' },
  right: { align: 'center', side: 'right' },
  rightBottom: { align: 'end', side: 'right' },
  rightTop: { align: 'start', side: 'right' },
  top: { align: 'center', side: 'top' },
  topLeft: { align: 'start', side: 'top' },
  topRight: { align: 'end', side: 'top' },
};

const position = computed(() => PLACEMENT[props.placement]!);
const hasContent = computed(() => Boolean(props.title));
</script>

<template>
  <TooltipProvider v-if="hasContent">
    <TooltipPrimitive>
      <TooltipTrigger as-child>
        <slot></slot>
      </TooltipTrigger>
      <TooltipContent
        data-common-tooltip
        :align="position.align"
        :side="position.side"
      >
        <slot name="title">{{ props.title }}</slot>
      </TooltipContent>
    </TooltipPrimitive>
  </TooltipProvider>
  <slot v-else></slot>
</template>
