<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type {
  AggKind,
  ChartType,
  DatasetSpec,
  FieldMeta,
  ReportSpec,
  WidgetSpec,
  WidgetType,
} from '../../core/types';

import { computed, ref, watch } from 'vue';

import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { measureColumnKey } from '../../core/aggregate';
import { createWidget, nextReportId, relayout } from '../../core/dsl';
import {
  AGG_OPTIONS,
  CHART_TYPE_OPTIONS,
  WIDGET_TYPE_OPTIONS,
  widgetTypeLabel,
} from '../../utils/labels';

/**
 * 最小可编辑的报表设计器。
 *
 * 分层位置：`components/`，输入输出一律是 `ReportSpec` —— 它不取数、不缓存、不直接改 props，
 * 每次改动都 `emit('update:spec', 新对象)`，因此"撤销/重做""自动保存""协同编辑"都能长在父级，
 * 而不是被绑死在这个组件里。
 *
 * **有意不做的两件事（留作扩展点）**：
 * 1. 拖拽画布：移动/改尺寸需要指针事件、碰撞回弹与吸附，属于独立的一层
 *    （`core/dsl.autoLayout` 已经把"落点怎么算"抽出来了，加拖拽只需要接一个 useDraggable）；
 *    这里用「上移 / 下移 + 宽高数字输入」覆盖同一个结果，保证没有拖拽也能排出版面。
 * 2. 计算字段 / 自定义 SQL：DSL 里加派生字段要连带改校验与取数协议，不该由 UI 单方面决定。
 *
 * 也不做透视表列维度的挑选：`options.pivotColumns` 目前请由宿主或 preset 写好。
 */
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    /** 新增 widget 后是否顺带重排整版（关掉就得自己算落点） */
    autoReflow?: boolean;
    /** 栅格列数，只用于宽度的输入上限提示 */
    columns?: number;
    spec: ReportSpec;
    /** 受控选中项；不传时组件自己记 */
    widgetId?: string;
  }>(),
  { autoReflow: true, class: undefined, columns: 12, widgetId: undefined },
);

const emit = defineEmits<{
  (event: 'select', widgetId: string): void;
  (event: 'update:spec', spec: ReportSpec): void;
}>();

const localActive = ref<string | undefined>(
  props.widgetId ?? props.spec.widgets[0]?.id,
);
watch(
  () => props.widgetId,
  (next) => {
    if (next) localActive.value = next;
  },
);

const activeId = computed(() => localActive.value ?? props.spec.widgets[0]?.id);
const active = computed(() =>
  props.spec.widgets.find((widget) => widget.id === activeId.value),
);

const activeDataset = computed<DatasetSpec | undefined>(() =>
  props.spec.datasets.find(
    (dataset) => dataset.id === active.value?.query?.datasetId,
  ),
);

const addType = ref<WidgetType>('kpi');

/** 所有改动都走这里：产出一个新的 spec 对象，绝不原地改 props */
function patch(next: ReportSpec) {
  emit('update:spec', next);
}

function patchWidget(id: string, updater: (widget: WidgetSpec) => WidgetSpec) {
  patch({
    ...props.spec,
    widgets: props.spec.widgets.map((widget) =>
      widget.id === id ? updater(widget) : widget,
    ),
  });
}

function patchQuery(
  id: string,
  updater: (
    query: NonNullable<WidgetSpec['query']>,
  ) => NonNullable<WidgetSpec['query']>,
) {
  patchWidget(id, (widget) =>
    widget.query ? { ...widget, query: updater(widget.query) } : widget,
  );
}

function selectWidget(id: string) {
  localActive.value = id;
  emit('select', id);
}

function addWidget() {
  const type = addType.value;
  const id = nextReportId(`widget-${type}`);
  const dataset = props.spec.datasets[0];
  const widget = createWidget(id, type, {
    datasetId: dataset?.id ?? '',
    measures: dataset
      ? dataset.fields
          .filter((field) => field.kind === 'measure')
          .slice(0, 1)
          .map((field) => ({
            agg: field.aggregator ?? 'sum',
            field: field.key,
          }))
      : [],
    title: widgetTypeLabel(type),
  });
  const next: ReportSpec = {
    ...props.spec,
    widgets: [...props.spec.widgets, widget],
  };
  patch(props.autoReflow ? relayout(next, props.columns) : next);
  localActive.value = id;
  emit('select', id);
}

function removeWidget(id: string) {
  const next: ReportSpec = {
    ...props.spec,
    widgets: props.spec.widgets.filter((widget) => widget.id !== id),
  };
  if (activeId.value === id) localActive.value = next.widgets[0]?.id;
  patch(props.autoReflow ? relayout(next, props.columns) : next);
}

/** 上移 / 下移：交换声明序再重排，等价于拖拽里的"换位置" */
function move(id: string, delta: -1 | 1) {
  const widgets = [...props.spec.widgets];
  const index = widgets.findIndex((widget) => widget.id === id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= widgets.length) return;
  [widgets[index], widgets[target]] = [widgets[target]!, widgets[index]!];
  patch(relayout({ ...props.spec, widgets }, props.columns));
}

function toggleDimension(widget: WidgetSpec, field: FieldMeta) {
  const query = widget.query;
  if (!query) return;
  const dimensions = query.dimensions.includes(field.key)
    ? query.dimensions.filter((key) => key !== field.key)
    : [...query.dimensions, field.key];
  patchWidget(widget.id, (item) => ({
    ...item,
    query: { ...query, dimensions },
  }));
}

function isDimension(widget: WidgetSpec, field: FieldMeta): boolean {
  return widget.query?.dimensions.includes(field.key) ?? false;
}

function isMeasure(widget: WidgetSpec, field: FieldMeta): boolean {
  return (
    widget.query?.measures.some((measure) => measure.field === field.key) ??
    false
  );
}

function toggleMeasure(widget: WidgetSpec, field: FieldMeta) {
  const query = widget.query;
  if (!query) return;
  const exists = isMeasure(widget, field);
  const measures = exists
    ? query.measures.filter((measure) => measure.field !== field.key)
    : [...query.measures, { agg: field.aggregator ?? 'sum', field: field.key }];
  patchWidget(widget.id, (item) => ({
    ...item,
    query: { ...query, measures },
  }));
}

function setAgg(widget: WidgetSpec, fieldKey: string, agg: AggKind) {
  patchQuery(widget.id, (query) => ({
    ...query,
    measures: query.measures.map((measure) =>
      measure.field === fieldKey ? { ...measure, agg } : measure,
    ),
  }));
}

function aggOf(widget: WidgetSpec, fieldKey: string): AggKind | undefined {
  return widget.query?.measures.find((measure) => measure.field === fieldKey)
    ?.agg;
}

function setTitle(widget: WidgetSpec, title: string) {
  patchWidget(widget.id, (item) => ({ ...item, title }));
}

function setLayout(widget: WidgetSpec, key: 'h' | 'w', raw: number | string) {
  const value = Math.max(1, Number(raw) || 1);
  patchWidget(widget.id, (item) => ({
    ...item,
    layout: { ...item.layout, [key]: value },
  }));
}

function setChartType(widget: WidgetSpec, chartType: ChartType) {
  patchWidget(widget.id, (item) => ({
    ...item,
    options: { ...item.options, chartType },
  }));
}

function chartTypeOf(widget: WidgetSpec): ChartType {
  return widget.options?.chartType ?? 'bar';
}

function measureKeyOf(widget: WidgetSpec, fieldKey: string): string {
  const measure = widget.query?.measures.find(
    (item) => item.field === fieldKey,
  );
  return measure ? measureColumnKey(measure) : fieldKey;
}
</script>

<template>
  <div
    :class="cn('flex w-full flex-col gap-4 md:flex-row', props.class)"
    :data-widget-count="props.spec.widgets.length"
    data-slot="report-designer"
  >
    <!-- 左：widget 清单与增删排序 -->
    <div class="flex w-full shrink-0 flex-col gap-2 md:w-72">
      <div class="flex items-center gap-2">
        <Select v-model="addType">
          <SelectTrigger class="flex-1" data-input="new-widget-type" size="sm">
            <SelectValue placeholder="要加什么" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in WIDGET_TYPE_OPTIONS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          type="button"
          variant="outline"
          data-action="add-widget"
          @click="addWidget"
        >
          添加
        </Button>
      </div>

      <ul class="flex flex-col gap-1">
        <li
          v-for="(widget, index) in props.spec.widgets"
          :key="widget.id"
          :class="
            cn(
              'flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm',
              widget.id === activeId
                ? 'bg-accent text-accent-foreground'
                : 'bg-background',
            )
          "
          :data-designer-widget="widget.id"
        >
          <button
            class="min-w-0 flex-1 truncate text-left"
            type="button"
            data-action="select-widget"
            @click="selectWidget(widget.id)"
          >
            {{ widget.title ?? widget.id }}
            <span class="text-muted-foreground text-xs">· {{ widgetTypeLabel(widget.type) }}</span>
          </button>
          <Button
            :disabled="index === 0"
            aria-label="上移"
            size="icon-sm"
            type="button"
            variant="ghost"
            data-action="move-up"
            @click="move(widget.id, -1)"
          >
            ↑
          </Button>
          <Button
            :disabled="index === props.spec.widgets.length - 1"
            aria-label="下移"
            size="icon-sm"
            type="button"
            variant="ghost"
            data-action="move-down"
            @click="move(widget.id, 1)"
          >
            ↓
          </Button>
          <Button
            aria-label="删除"
            size="icon-sm"
            type="button"
            variant="ghost"
            data-action="remove-widget"
            @click="removeWidget(widget.id)"
          >
            ×
          </Button>
        </li>
      </ul>
    </div>

    <!-- 右：选中项的编辑面板 -->
    <div
      v-if="active"
      class="flex min-w-0 flex-1 flex-col gap-4"
      data-slot="report-designer-panel"
    >
      <div class="flex flex-col gap-1.5">
        <Label class="text-muted-foreground text-xs" for="report-designer-title">标题</Label>
        <Input
          id="report-designer-title"
          :model-value="active.title ?? ''"
          data-input="title"
          @update:model-value="
            (value: number | string) => setTitle(active!, String(value))
          "
        />
      </div>

      <div class="flex items-end gap-3">
        <div class="flex w-24 flex-col gap-1.5">
          <Label class="text-muted-foreground text-xs" for="report-designer-w">宽（列）</Label>
          <Input
            id="report-designer-w"
            :max="props.columns"
            :model-value="String(active.layout.w)"
            min="1"
            type="number"
            data-input="width"
            @update:model-value="
              (value: number | string) => setLayout(active!, 'w', value)
            "
          />
        </div>
        <div class="flex w-24 flex-col gap-1.5">
          <Label class="text-muted-foreground text-xs" for="report-designer-h">高（行）</Label>
          <Input
            id="report-designer-h"
            :model-value="String(active.layout.h)"
            min="1"
            type="number"
            data-input="height"
            @update:model-value="
              (value: number | string) => setLayout(active!, 'h', value)
            "
          />
        </div>
        <div v-if="active.type === 'chart'" class="flex w-40 flex-col gap-1.5">
          <Label class="text-muted-foreground text-xs">图形</Label>
          <Select
            :model-value="chartTypeOf(active)"
            data-input="chart-type"
            @update:model-value="
              (value: unknown) => setChartType(active!, value as ChartType)
            "
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="图形类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="item in CHART_TYPE_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- 字段勾选：同一行既能当维度也能当度量，勾上即进 query -->
      <div
        v-if="activeDataset"
        class="flex flex-col gap-1"
        data-slot="report-designer-fields"
      >
        <p class="text-muted-foreground text-xs">
          字段（数据集：{{ activeDataset.name ?? activeDataset.id }}）
        </p>
        <div
          v-for="field in activeDataset.fields"
          :key="field.key"
          class="flex items-center gap-3 border-b py-1.5 last:border-b-0"
          :data-field-row="field.key"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{
            field.label ?? field.key
          }}</span>
          <span class="text-muted-foreground text-xs">{{ field.key }}</span>
          <label class="flex items-center gap-1 text-xs">
            <Checkbox
              :checked="isDimension(active, field)"
              data-role="dimension"
              @update:model-value="() => toggleDimension(active!, field)"
            />
            维度
          </label>
          <label class="flex items-center gap-1 text-xs">
            <Checkbox
              :checked="isMeasure(active, field)"
              data-role="measure"
              @update:model-value="() => toggleMeasure(active!, field)"
            />
            度量
          </label>
          <Select
            v-if="isMeasure(active, field)"
            :model-value="aggOf(active, field.key)"
            :disabled="
              !active.query?.measures.some(
                (measure) => measure.field === field.key,
              )
            "
            data-role="agg"
            @update:model-value="
              (value: unknown) => setAgg(active!, field.key, value as AggKind)
            "
          >
            <SelectTrigger class="w-28" size="sm">
              <SelectValue placeholder="聚合" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="item in AGG_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <code
            v-if="isMeasure(active, field)"
            class="text-muted-foreground text-xs"
          >
            {{ measureKeyOf(active, field.key) }}
          </code>
        </div>
      </div>
      <p v-else class="text-muted-foreground text-sm">这一格不需要数据集。</p>
    </div>
    <p v-else class="text-muted-foreground text-sm">左边加一个格子再编辑。</p>
  </div>
</template>
