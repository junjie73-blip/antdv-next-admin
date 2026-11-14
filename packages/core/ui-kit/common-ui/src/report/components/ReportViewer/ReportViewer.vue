<script setup lang="ts">
import type { HTMLAttributes, Ref } from 'vue';

import type { ReportDataSource } from '../../core/datasource';
import type {
  FilterValues,
  ReportSpec,
  SortSpec,
  WidgetSpec,
} from '../../core/types';

import { computed, toRef } from 'vue';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useReportData } from '../../composables/use-report-data';
import { getReportRuntime } from '../../config';
import { DEFAULT_GRID_COLUMNS } from '../../core/dsl';
import ReportWidget from '../ReportWidget/ReportWidget.vue';

/**
 * 报表的栅格渲染层。
 *
 * 分层位置：`components/`，只做「布局 + 把每格的状态喂给 ReportWidget」。
 * 取数与聚合全在 `useReportData` 里，所以这里没有任何异步代码，
 * 也就不需要为"组件卸载后还在写状态"这种问题再写一遍守卫。
 *
 * 三态（加载中 / 错误 / 空数据）由本组件按格判定、由 `ReportWidget` 统一出样式：
 * 判定放上面是为了让"哪一格在转圈"这个信息跟着数据源走，
 * 渲染放下面是为了五种 widget 类型不必各写一份占位。
 *
 * 布局用 CSS Grid + 内联的行列号（不是 Tailwind 类）：`x/y/w/h` 是运行时数字，
 * 静态类名扫不出组合，写死反而会漏样式。行高用 `rowHeight` 统一，保证不同 widget 对齐。
 *
 * 不做的事：不做响应式断点（窄屏请把 columns 调小，由宿主按视口传值）、
 * 不做拖拽移动（`ReportDesigner` 的扩展点）、不做打印分页。
 */
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    /** 栅格列数；缺省读 `configureReport({ columns })` */
    columns?: number;
    /** 格子间距（px） */
    gap?: number;
    filters?: FilterValues | Ref<FilterValues>;
    /** 覆盖运行时注入的数据源 */
    source?: ReportDataSource;
    spec: ReportSpec;
    /** 单格行高（px） */
    rowHeight?: number;
  }>(),
  {
    class: undefined,
    columns: undefined,
    gap: 16,
    filters: undefined,
    source: undefined,
    rowHeight: 32,
  },
);

const emit = defineEmits<{
  (event: 'sort', payload: SortSpec & { widgetId: string }): void;
}>();

const data = useReportData({
  /**
   * `toRef(props, ...)` 而不是 `props.filters`：模板里 `:filters="filters"` 到 props 这一层
   * 已经被摊成**值**，而 `v-model:values` 每次回抛的是一个**新对象**。直接传值进去，
   * composable 手里就只剩第一次那一个对象，没人告诉它宿主换了 —— 症状是"过滤条改了、报表一动不动"。
   */
  filters: toRef(props, 'filters'),
  source: props.source,
  spec: toRef(props, 'spec'),
});

const columnCount = computed(
  () => props.columns ?? getReportRuntime().columns ?? DEFAULT_GRID_COLUMNS,
);

const gridStyle = computed(() => ({
  display: 'grid',
  gap: `${props.gap}px`,
  gridAutoRows: `${props.rowHeight}px`,
  gridTemplateColumns: `repeat(${columnCount.value}, minmax(0, 1fr))`,
}));

function itemStyle(widget: WidgetSpec) {
  return {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
  };
}

/** 按 y、x 排一遍：DSL 里的声明顺序可能乱（设计器上下移动过），DOM 顺序稳定才好读也才好测 */
const widgets = computed(() =>
  [...(props.spec.widgets ?? [])].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  ),
);

function datasetOf(widget: WidgetSpec) {
  return props.spec.datasets.find(
    (dataset) => dataset.id === widget.query?.datasetId,
  );
}

defineExpose({
  loading: data.loading,
  reload: data.reload,
  setFilter: data.setFilter,
});
</script>

<template>
  <div
    :class="cn('w-full', props.class)"
    :data-widget-count="widgets.length"
    data-slot="report-viewer"
  >
    <div v-if="widgets.length > 0" :style="gridStyle">
      <ReportWidget
        v-for="widget in widgets"
        :key="widget.id"
        :class="cn('min-w-0')"
        :dataset="datasetOf(widget)"
        :error="data.errors.value[widget.id]"
        :loading="data.widgetState(widget.id)?.loading ?? false"
        :result="data.queryResult(widget.id)"
        :rows="data.widgetData(widget.id)"
        :spec="widget"
        :style="itemStyle(widget)"
        :data-widget-id="widget.id"
        @sort="
          (payload: SortSpec) =>
            emit('sort', { ...payload, widgetId: widget.id })
        "
      >
        <template v-if="$slots.actions" #actions>
          <slot name="actions" :widget="widget"></slot>
        </template>
      </ReportWidget>
    </div>
    <Empty v-else class="border border-dashed" data-slot="report-viewer-empty">
      <EmptyHeader>
        <EmptyTitle>这张报表还是空的</EmptyTitle>
        <EmptyDescription>
用报表设计器加一个指标卡或图表，或者先选一个模板。
</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
</template>
