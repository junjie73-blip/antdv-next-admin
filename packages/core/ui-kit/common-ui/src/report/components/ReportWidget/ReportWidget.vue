<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type {
  DatasetSpec,
  FieldMeta,
  GanttFieldMap,
  QueryResult,
  ResultColumn,
  Row,
  SortDir,
  SortSpec,
  WidgetSpec,
} from '../../core/types';

import { computed, ref } from 'vue';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { getReportRuntime } from '../../config';
import {
  fieldMapOf,
  measureColumnKey,
  TOTAL_LABEL,
} from '../../core/aggregate';
import { toEChartsOption } from '../../core/chart-option';
import { formatValue } from '../../core/format';
import { toNumberValue } from '../../core/number';
import { encodeKey, pivot } from '../../core/pivot';
import ReportGantt from '../ReportGantt/ReportGantt.vue';

/**
 * 单个报表格子的渲染分发。
 *
 * 分层位置：`components/`，**只画不算** —— 输入是已经聚合好的 `QueryResult`（外加原始行），
 * 输出是 DOM 与 `sort` 事件。它不认识数据源，所以单测里可以直接塞一段常量结果，
 * 验证五种类型各画成什么样。
 *
 * 三个写在明面上的取舍：
 * - KPI 卡用 shadcn 的裸 token 拼，而不是 `@antdv/common-ui` 的 `Statistic`：
 *   后者在根 barrel 里，引它会把 tiptap、分片上传这一整层无关依赖拉进报表页，
 *   而 KPI 卡要的只是「标题 + 格式化后的值 + 次要指标」。
 * - 图表组件从 `getReportRuntime().widgetChart` 取（缺省即 `@antdv/common-ui/charts` 的 ECharts），
 *   用 `<component :is>` 而不是直接写标签：宿主可以换渲染实现，
 *   jsdom（无 canvas）下的组件测试也能换成一个只接 `option` 的假组件。
 * - 透视表优先用 `rows`（原始事实行）算格子：对 `avg` / `median` 这类不可加聚合，
 *   拿已聚合的结果再折一次会得到"平均的平均"，那是另一套口径。
 *
 * 不做的事：不做拖拽改尺寸（设计器扩展点）、不做下钻、不做虚拟滚动
 * （明细表上千行请由宿主分页取数，DSL 里已有 `limit`）。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  dataset?: DatasetSpec;
  /** 上一轮计算/取数失败的原因；非空时这一格只出错误态 */
  error?: string;
  /** chart 类型的容器高度（CSS 长度） */
  height?: string;
  loading?: boolean;
  result?: QueryResult;
  /** 原始事实行：透视表用它算格子 */
  rows?: Row[];
  spec: WidgetSpec;
}>();

const emit = defineEmits<{
  /** 表头点击排序：宿主可据此改 `query.sort` 重新取数；不接也成立，组件会本地排 */
  (event: 'sort', payload: SortSpec): void;
}>();

const runtime = getReportRuntime();
const chartComponent = runtime.widgetChart;
const sortState = ref<SortSpec | undefined>();

const columns = computed<ResultColumn[]>(() => props.result?.columns ?? []);
const fieldMap = computed(() => fieldMapOf(props.dataset));

const rows = computed<Row[]>(() => {
  const source = props.result?.rows ?? [];
  const state = sortState.value;
  if (!state || props.spec.type !== 'table') return source;
  const dir = state.dir === 'desc' ? -1 : 1;
  return [...source].sort((left, right) => {
    const a = toNumberValue(left[state.field]);
    const b = toNumberValue(right[state.field]);
    if (a !== null && b !== null) return (a - b) * dir;
    const x = String(left[state.field] ?? '');
    const y = String(right[state.field] ?? '');
    if (x === y) return 0;
    return (x < y ? -1 : 1) * dir;
  });
});

/** 字段级格式：列没单独配格式时回落到数据集里的字段定义 */
function formatOf(column: { field?: string; format?: ResultColumn['format'] }) {
  if (column.format) return column.format;
  const meta: FieldMeta | undefined = column.field
    ? fieldMap.value.get(column.field)
    : undefined;
  return meta?.format;
}

/**
 * 单元格文本。
 * 维度列在列格式与字段格式都没配时按 `text` 渲染：`formatValue` 的缺省是数值口径，
 * 直接套上去会把 '华东' 这类纯文本维度画成 `—`——空值占位符是给"没数"的，不是给"不是数"的。
 */
function cellText(column: ResultColumn, value: unknown): string {
  const format =
    formatOf(column) ??
    (column.kind === 'dimension' ? { kind: 'text' as const } : undefined);
  return formatValue(value, format);
}

/** 透视格子按"度量对应的字段格式"渲染；列宽与行距交给 Tailwind，不做数字对齐之外的排版 */
function pivotText(field: string, value: unknown): string {
  return formatValue(value, fieldMap.value.get(field)?.format);
}

/** 合计行的单元格：第一列是维度时让位给「合计」二字 */
const totalCells = computed<string[]>(() => {
  const totals = props.result?.totals;
  if (!totals || columns.value.length === 0) return [];
  const first = columns.value[0]!;
  const body = columns.value.map((column) =>
    column.kind === 'measure' ? cellText(column, totals[column.key]) : '',
  );
  if (first.kind === 'dimension') {
    const rest = [...body];
    rest[0] = TOTAL_LABEL;
    return rest;
  }
  return body;
});

/** 透视：优先用原始行算，没给原始行时退化成对结果行的二次折叠 */
const pivotResult = computed(() => {
  if (props.spec.type !== 'pivot') return undefined;
  const query = props.spec.query;
  if (!query) return undefined;
  const columnFields = props.spec.options?.pivotColumns ?? [];
  const source = props.rows?.length ? props.rows : (props.result?.rows ?? []);
  return pivot(source, {
    dataset: props.dataset,
    measures: query.measures,
    pivotColumns: columnFields,
    rowDimensions: query.dimensions.filter(
      (key) => !columnFields.includes(key),
    ),
  });
});

const chartOption = computed(() =>
  props.result
    ? toEChartsOption(props.result, props.spec, { palette: runtime.palette })
    : undefined,
);

/**
 * 甘特：只画不算的透传。fieldMap 缺省给一个空壳（start/end 为空串），
 * `core/gantt.ts` 会把所有行按 missing-start 跳过、组件自己落到空态 —— 比在这里判 null 再各写兜底省事。
 */
const ganttFieldMap = computed<GanttFieldMap>(
  () => props.spec.options?.gantt ?? { end: '', start: '' },
);
const ganttViewMode = computed(() => props.spec.options?.ganttViewMode);
const ganttReadonly = computed(() => props.spec.options?.ganttReadonly);
/** 甘特读原始事实行（一行一任务），而不是聚合后的 result.rows */
const ganttRows = computed<Row[]>(() => props.rows ?? []);

const chartHeight = computed(
  () => props.spec.options?.height ?? props.height ?? runtime.chartHeight,
);

const isEmpty = computed(() => {
  if (props.spec.type === 'text' || props.spec.type === 'kpi') return false;
  if (props.spec.type === 'pivot')
    return (pivotResult.value?.rows.length ?? 0) === 0;
  if (props.spec.type === 'gantt') return ganttRows.value.length === 0;
  return rows.value.length === 0;
});

/**
 * KPI：取第一个度量的首行值，没有分组行时退回全集合计。
 *
 * 但"一行都没命中"不许由 `totals` 替它说话：`core/aggregate` 给空集合的 `sum` 是中性元 0，
 * 那是算术事实；指标卡照它画成 `¥0.00` 就成了"这段时间真的卖了 0 元"—— 一个会被拿去做决策的数。
 * 所以这里按 `format.ts` 第 1 条口径办：0 是业务事实，"没数"是占位符 `—`。
 * 分组行为空 ⇔ 过滤后没有行（每个分组出一行），故用 `rows.length` 判，不必让聚合器再吐一个计数。
 */
const kpi = computed(() => {
  if (props.spec.type !== 'kpi') return undefined;
  const result = props.result;
  const measures = props.spec.query?.measures ?? [];
  const [first] = measures;
  if (!result || !first) return undefined;
  const hasData = result.rows.length > 0;
  const valueOf = (measureKey: string) =>
    hasData
      ? (result.rows[0]?.[measureKey] ?? result.totals?.[measureKey] ?? null)
      : null;
  const key = measureColumnKey(first);
  const column = result.columns.find((item) => item.key === key);
  const primary = {
    label: props.spec.title ?? column?.label ?? key,
    text: formatValue(
      valueOf(key),
      props.spec.options?.format ?? formatOf(column ?? {}),
    ),
  };
  const secondary = measures.slice(1).map((measure) => {
    const measureKey = measureColumnKey(measure);
    return {
      label: measure.alias ?? measureKey,
      text: formatValue(valueOf(measureKey)),
    };
  });
  return { primary, secondary };
});

function onHeaderClick(column: ResultColumn) {
  const dir: SortDir =
    sortState.value?.field === column.key && sortState.value.dir === 'asc'
      ? 'desc'
      : 'asc';
  sortState.value = { dir, field: column.key };
  emit('sort', { dir, field: column.key });
}
</script>

<template>
  <section
    :class="
      cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm',
        props.class,
      )
    "
    :data-widget-type="props.spec.type"
    data-slot="report-widget"
  >
    <header
      v-if="props.spec.title || props.spec.description || $slots.actions"
      class="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
      data-slot="report-widget-header"
    >
      <div class="min-w-0">
        <h3 class="truncate font-medium text-sm">{{ props.spec.title }}</h3>
        <p
          v-if="props.spec.description"
          class="truncate text-muted-foreground text-xs"
        >
          {{ props.spec.description }}
        </p>
      </div>
      <slot name="actions"></slot>
    </header>

    <div class="min-h-0 flex-1 p-3" data-slot="report-widget-body">
      <div
        v-if="props.loading"
        class="flex flex-col gap-2"
        data-slot="report-widget-loading"
      >
        <Skeleton class="h-4 w-1/3" />
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-4 w-2/3" />
      </div>

      <div
        v-else-if="props.error"
        class="flex h-full flex-col items-start justify-center gap-2 rounded-md border border-dashed p-3"
        data-slot="report-widget-error"
      >
        <p class="font-medium text-sm">这一格没能算出来</p>
        <p class="text-muted-foreground text-xs">{{ props.error }}</p>
      </div>

      <!-- 说明文本 -->
      <div
        v-else-if="props.spec.type === 'text'"
        class="text-sm"
        data-slot="report-widget-text"
      >
        <p class="whitespace-pre-wrap">
          {{ props.spec.options?.text ?? props.spec.description ?? '' }}
        </p>
      </div>

      <!-- 指标卡 -->
      <div
        v-else-if="props.spec.type === 'kpi'"
        class="flex h-full flex-col justify-center"
        data-slot="report-widget-kpi"
      >
        <p class="text-muted-foreground text-xs">
          {{ kpi?.primary.label ?? props.spec.title }}
        </p>
        <p class="mt-1 font-semibold text-3xl tabular-nums">
          {{ kpi?.primary.text ?? '—' }}
        </p>
        <dl
          v-if="kpi?.secondary.length"
          class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
        >
          <div
            v-for="item in kpi?.secondary"
            :key="item.label"
            class="flex items-center gap-1"
          >
            <dt class="text-muted-foreground">{{ item.label }}</dt>
            <dd class="font-medium tabular-nums">{{ item.text }}</dd>
          </div>
        </dl>
      </div>

      <!-- 图表 -->
      <component
        :is="chartComponent"
        v-else-if="props.spec.type === 'chart' && chartOption && !isEmpty"
        :height="chartHeight"
        :loading="false"
        :option="chartOption"
      />

      <!-- 甘特图：frappe-gantt 渲染，读原始事实行 -->
      <ReportGantt
        v-else-if="props.spec.type === 'gantt' && !isEmpty"
        :error="props.error"
        :field-map="ganttFieldMap"
        :loading="props.loading"
        :readonly="ganttReadonly"
        :rows="ganttRows"
        :view-mode="ganttViewMode"
        data-slot="report-widget-gantt"
      />

      <!-- 透视表 -->
      <div
        v-else-if="props.spec.type === 'pivot' && pivotResult && !isEmpty"
        class="overflow-auto"
        data-slot="report-widget-pivot"
      >
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b">
              <th
                v-for="field in pivotResult.rowFields"
                :key="field"
                class="h-9 px-2 text-left align-middle font-medium whitespace-nowrap"
              >
                {{ fieldMap.get(field)?.label ?? field }}
              </th>
              <th
                v-for="column in pivotResult.columns"
                :key="column.key"
                class="h-9 px-2 text-right align-middle font-medium whitespace-nowrap"
              >
                {{ column.label }}
              </th>
              <th
                v-for="metric in pivotResult.metrics"
                :key="`total-${metric.key}`"
                class="h-9 px-2 text-right align-middle font-medium whitespace-nowrap"
              >
                {{ metric.label }}合计
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pivotResult.rows"
              :key="row.key"
              :data-pivot-row="row.label"
              class="border-b last:border-0"
            >
              <td
                v-for="(part, index) in row.parts"
                :key="index"
                class="px-2 py-1.5 align-middle whitespace-nowrap"
              >
                {{ part }}
              </td>
              <td
                v-for="column in pivotResult.columns"
                :key="column.key"
                :data-pivot-cell="`${row.label}|${column.label}`"
                class="px-2 py-1.5 text-right align-middle tabular-nums whitespace-nowrap"
              >
                {{ pivotText(column.field, row.values[column.key]) }}
              </td>
              <td
                v-for="metric in pivotResult.metrics"
                :key="`total-${metric.key}`"
                class="px-2 py-1.5 text-right align-middle font-medium tabular-nums whitespace-nowrap"
              >
                {{ pivotText(metric.field, row.totals[metric.key]) }}
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t font-medium">
            <tr>
              <td :colspan="Math.max(pivotResult.rowFields.length, 1)">
                {{ TOTAL_LABEL }}
              </td>
              <td
                v-for="column in pivotResult.columns"
                :key="`col-total-${column.key}`"
                class="px-2 py-1.5 text-right tabular-nums whitespace-nowrap"
              >
                {{
                  pivotText(
                    column.field,
                    pivotResult.columnTotals[encodeKey(column.parts)]?.[
                      column.metricKey
                    ],
                  )
                }}
              </td>
              <td
                v-for="metric in pivotResult.metrics"
                :key="`grand-${metric.key}`"
                class="px-2 py-1.5 text-right tabular-nums whitespace-nowrap"
              >
                {{
                  pivotText(metric.field, pivotResult.grandTotals[metric.key])
                }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- 明细表 -->
      <Table
        v-else-if="props.spec.type === 'table' && !isEmpty"
        data-slot="report-widget-table"
      >
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="column in columns"
              :key="column.key"
              :class="column.kind === 'measure' ? 'text-right' : undefined"
            >
              <button
                class="inline-flex items-center gap-1 font-medium hover:underline"
                :data-sort-field="column.key"
                type="button"
                @click="onHeaderClick(column)"
              >
                {{ column.label }}
                <span v-if="sortState?.field === column.key" aria-hidden="true">
                  {{ sortState.dir === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(row, index) in rows"
            :key="index"
            :data-row-index="index"
          >
            <TableCell
              v-for="column in columns"
              :key="column.key"
              :class="
                column.kind === 'measure'
                  ? 'text-right tabular-nums'
                  : undefined
              "
            >
              {{ cellText(column, row[column.key]) }}
            </TableCell>
          </TableRow>
          <TableRow
            v-if="totalCells.length > 0"
            data-slot="report-widget-total-row"
          >
            <TableCell
              v-for="(text, index) in totalCells"
              :key="index"
              class="font-medium"
              :class="index > 0 ? 'text-right tabular-nums' : undefined"
            >
              {{ text }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- 空数据 -->
      <Empty
        v-else
        class="border border-dashed"
        data-slot="report-widget-empty"
      >
        <EmptyHeader>
          <EmptyTitle>暂无数据</EmptyTitle>
          <EmptyDescription>
            这个查询在当前过滤条件下没有命中任何行，换个时间区间或放宽筛选试试。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  </section>
</template>
