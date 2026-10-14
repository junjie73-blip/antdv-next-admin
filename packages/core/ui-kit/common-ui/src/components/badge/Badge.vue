<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed, useSlots } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Badge' });

const props = withDefaults(
  defineProps<{
    color?: string;
    count?: number;
    dot?: boolean;
    max?: number;
    numberStyle?: CSSProperties;
    offset?: [number, number];
    show?: boolean;
    status?: 'default' | 'error' | 'processing' | 'success' | 'warning';
    text?: string;
    title?: string;
  }>(),
  {
    color: undefined,
    count: 0,
    dot: false,
    max: 99,
    numberStyle: undefined,
    offset: undefined,
    show: true,
    status: undefined,
    text: undefined,
    title: undefined,
  },
);

/** status 模式的圆点色板，literal class 才能被 Tailwind 扫到 */
const STATUS_DOT: Record<string, string> = {
  default: 'bg-gray-400 dark:bg-gray-600',
  error: 'bg-red-500',
  processing: 'animate-pulse bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

const slots = useSlots();

const statusMode = computed(() => Boolean(props.status));

/** 没有默认插槽就没有可贴靠的元素，气泡退化为行内独立显示 */
const standalone = computed(() => !slots.default);

const visible = computed(
  () => props.show && (props.dot || props.count > 0),
);

const display = computed(() =>
  props.dot ? '' : props.count > props.max ? `${props.max}+` : String(props.count)
);

const rootClass = computed(() =>
  cn('inline-flex', statusMode.value ? 'items-center gap-1.5 text-sm' : standalone.value ? '' : 'relative')
);

const bubbleClass = computed(() =>
  cn(
    'z-10 rounded-full text-xs leading-none text-white',
    standalone.value ? 'inline-flex' : 'absolute right-0 top-0 -translate-x-1/2 -translate-y-1/2',
    props.dot ? 'size-2' : 'px-1.5 py-0.5',
    props.color ? '' : 'bg-destructive'
  )
);

const bubbleStyle = computed<CSSProperties | undefined>(() => {
  const style: CSSProperties = { ...props.numberStyle };
  if (props.color) style.backgroundColor = props.color;
  if (props.offset) {
    style.marginLeft = `${props.offset[0]}px`;
    style.marginTop = `${props.offset[1]}px`;
  }
  return Object.keys(style).length ? style : undefined;
});

const statusDotClass = computed(() =>
  cn('size-2 shrink-0 rounded-full', STATUS_DOT[props.status ?? 'default'])
);

const statusDotStyle = computed(() =>
  props.color ? { backgroundColor: props.color } : undefined
);
</script>

<template>
  <span v-if="statusMode" data-common-badge :class="rootClass" :title="props.title">
    <span data-common-badge-dot :class="statusDotClass" :style="statusDotStyle"></span>
    <span>{{ props.text }}</span>
    <slot></slot>
  </span>
  <span v-else data-common-badge :class="rootClass">
    <slot></slot>
    <sup
      v-if="visible"
      data-common-badge-dot
      :class="bubbleClass"
      :style="bubbleStyle"
      :title="props.title"
    >{{ display }}</sup>
  </span>
</template>
