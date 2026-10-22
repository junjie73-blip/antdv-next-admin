<script setup lang="ts">
import type { PageToolbarProps } from './types';

import { computed, useSlots } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'PageToolbar' });

const props = withDefaults(defineProps<PageToolbarProps>(), {
  stackOnNarrow: true,
});

const slots = useSlots();

const hasFilters = computed(() => Boolean(slots.filters || slots.default));

const actionsClass = computed(() =>
  cn(
    'flex shrink-0 flex-wrap items-center gap-2',
    // 窄屏让操作区独占一行右对齐：跟筛选挤一行时，按钮会被顶到视口外，
    // 而"看不见的新增按钮"在后台页里等于没有新增。
    props.stackOnNarrow ? 'max-sm:w-full max-sm:justify-end' : '',
  ),
);
</script>

<template>
  <!--
    列表页工具栏：筛选靠左成一组，操作靠右成一组。

    这条分工是这轮改版式的关键 —— 之前同一行里既有"查询/重置"又有"新增/导出/打印"，
    两组按钮各占一头又都是实心主色，读起来分不清"这是查还是这是做"。
    组件本身不带上下外边距，节奏交给页面根容器的 `space-y-*`。
  -->
  <div
    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    data-page="toolbar"
  >
    <div
      v-if="hasFilters"
      class="flex min-w-0 flex-1 flex-wrap items-center gap-3"
      data-page="toolbar-filters"
    >
      <slot name="filters">
        <slot></slot>
      </slot>
    </div>

    <div
      v-if="$slots.actions"
      :class="actionsClass"
      data-page="toolbar-actions"
    >
      <slot name="actions"></slot>
    </div>
  </div>
</template>
