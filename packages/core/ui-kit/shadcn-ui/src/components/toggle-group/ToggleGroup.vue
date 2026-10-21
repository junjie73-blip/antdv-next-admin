<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority';
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import type { toggleVariants } from '../toggle';

import { provide, reactive } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { reactiveOmit } from '@vueuse/core';
import { ToggleGroupRoot, useForwardPropsEmits } from 'reka-ui';

type ToggleGroupVariants = VariantProps<typeof toggleVariants>;

const props = withDefaults(
  defineProps<
    ToggleGroupRootProps & {
      class?: HTMLAttributes['class'];
      variant?: ToggleGroupVariants['variant'];
      size?: ToggleGroupVariants['size'];
      spacing?: number;
    }
  >(),
  {
    spacing: 0,
  },
);

const emits = defineEmits<ToggleGroupRootEmits>();

/**
 * 带 getter 的 reactive，而不是普通对象：普通对象是 setup 那一刻的快照，
 * 之后 `size` 变了（全局尺寸档位被切）子项读到的还是旧档 —— 组自己身上的
 * `data-size` 会跟着变、按钮高度却不动，看起来就像"档位只写了个属性"。
 */
provide(
  'toggleGroup',
  reactive({
    get size() {
      return props.size;
    },
    get spacing() {
      return props.spacing;
    },
    get variant() {
      return props.variant;
    },
  }),
);

const delegatedProps = reactiveOmit(props, 'class', 'size', 'variant');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ToggleGroupRoot
    v-slot="slotProps"
    data-slot="toggle-group"
    :data-size="size"
    :data-variant="variant"
    :data-spacing="spacing"
    :style="{
      '--gap': spacing,
    }"
    v-bind="forwarded"
    :class="
      cn(
        'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
        props.class,
      )
    "
  >
    <slot v-bind="slotProps"></slot>
  </ToggleGroupRoot>
</template>
