<script setup lang="ts">
import type {
  FilterValues,
  GanttFieldMap,
  GanttViewMode,
  ReportSpec,
} from '@antdv/common-ui/report';

import { computed, ref } from 'vue';

import { Alert, Card, Space } from '@antdv/common-ui';
import {
  aggregate,
  chartTypeLabel,
  configureReport,
  createSalesReport,
  createSalesRows,
  createSalesSource,
  formatCell,
  pivot,
  ReportDesigner,
  ReportFilterBar,
  ReportGantt,
  ReportViewer,
  SALES_DATASET_ID,
  salesDataset,
  validateReportSpec,
} from '@antdv/common-ui/report';
import { Button, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 报表设计器示例。
 *
 * **全程离线**：数据来自 `presets/sales-report` 里那份固定种子的 180 行销售日报，页面不发任何请求。
 * 要接真实后端只需把 `configureReport({ source })` 换成 `configureReport({ fetcher })`
 * （`fetcher` 指向宿主自己的请求封装，凭据留在宿主侧），DSL、聚合、渲染三处代码一行都不用改 ——
 * 这就是 `@antdv/common-ui/report` 不 import `~/api` 的换取方式。
 *
 * 一条链路上四个角色各管一段，可以只取其中一个用：
 * - `core/*` 纯函数（聚合 / 透视 / 格式化）：不认 vue，Node 侧导出 CSV 时可以直接复用；
 * - `useReportData`：把 core 接上响应式，取数按 `datasetId + 参数指纹` 合并、新一轮会掐掉旧一轮；
 * - `ReportViewer` / `ReportWidget`：只画不算，控件全来自 `@antdv/shadcn-ui`；
 * - `ReportDesigner`：输入输出一律是 `ReportSpec`，每次改动整份回抛，撤销/自动保存长在父级。
 */

/**
 * 运行时是进程级单例，而本包不猜宿主的数据从哪来 —— 示例页必须自己把那份内存表装上，
 * 否则每一格都会落到「没有可用的数据源」的错误态（`resetDemo()` 里那句同理，只是它在交互时才跑）。
 */
configureReport({ source: createSalesSource() });

/** 甘特示例：一行一任务的事实表，字段映射见下面 `ganttFieldMap` */
const GANTT_ROWS = [
  {
    deps: '',
    end: '2026-04-03',
    name: '需求评审',
    phase: '立项',
    progress: 100,
    start: '2026-03-20',
    task: 't1',
  },
  {
    deps: 't1',
    end: '2026-04-17',
    name: '数据模型与 DSL',
    phase: '设计',
    progress: 100,
    start: '2026-04-06',
    task: 't2',
  },
  {
    deps: 't2',
    end: '2026-05-08',
    name: '聚合引擎',
    phase: '研发',
    progress: 70,
    start: '2026-04-20',
    task: 't3',
  },
  {
    deps: 't2',
    end: '2026-05-15',
    name: '渲染层与设计器',
    phase: '研发',
    progress: 45,
    start: '2026-04-27',
    task: 't4',
  },
  {
    deps: 't3,t4',
    end: '2026-05-22',
    name: '联调与压测',
    phase: '交付',
    progress: 10,
    start: '2026-05-18',
    task: 't5',
  },
  {
    deps: 't5',
    end: '2026-05-29',
    name: '灰度上线',
    phase: '交付',
    progress: 0,
    start: '2026-05-25',
    task: 't6',
  },
  // 故意留一行脏数据：起止填反了，core 会挡掉并在组件里给出"跳过 N 行"的提示
  {
    deps: '',
    end: '2026-04-01',
    name: '（脏行）结束早于开始',
    phase: '交付',
    progress: 0,
    start: '2026-04-10',
    task: 't7',
  },
];

/** 字段映射：哪一列是开始 / 结束 / 名称 / 进度 / 依赖 / 分组，其余解释全在 `core/gantt.ts` */
const ganttFieldMap: GanttFieldMap = {
  dependencies: 'deps',
  end: 'end',
  group: 'phase',
  id: 'task',
  name: 'name',
  progress: 'progress',
  start: 'start',
};

/** 只读开关：报表默认只读，拖拽改档期是宿主页面的显式选择 */
const ganttReadonly = ref(true);
const ganttViewMode = ref<GanttViewMode>('Week');

/** 设计器编辑的就是 viewer 渲染的那一份 —— 改完立刻所见即所得 */
const spec = ref<ReportSpec>(createSalesReport());

/** 过滤条只产出取值，消费在 `ReportViewer :filters`（所以过滤条也能单独用在列表页上） */
const filters = ref<FilterValues>({ date: ['2026-03-01', '2026-03-30'] });

/** 定义期校验：版面重叠、字段不存在要在跑之前就说出来，而不是等渲染出半成品 */
const issues = computed(() => validateReportSpec(spec.value));

const datasetHint = computed(() =>
  salesDataset.fields
    .map((field) => `${field.label}（${field.key}·${field.kind}）`)
    .join('、'),
);

/** 设计器回抛整份新 DSL：这里是唯一的"写"入口，撤销/自动保存要挂就挂在这一行外面 */
function onSpecChange(next: ReportSpec): void {
  spec.value = next;
}

/* ---------------- 纯函数口径：不经数据源、不经组件，同一套 core 在 Node 侧也能跑 ---------------- */

const salesRows = createSalesRows();

/** 按区域分组求和 + 占总计百分比，`totals: false` 时不追加合计行 */
const regionBreakdown = computed(() =>
  aggregate(
    salesRows,
    {
      datasetId: SALES_DATASET_ID,
      dimensions: ['region'],
      measures: [
        { agg: 'sum', field: 'sales' },
        { agg: 'sum', field: 'orders' },
      ],
      sort: [{ dir: 'desc', field: 'sum_sales' }],
    },
    salesDataset,
    { percentOfTotal: true },
  ),
);

/** 合计行单独取出来：模板里 `regionBreakdown.totals` 是可选的，就地解构一次比写三遍判空清楚 */
const regionTotals = computed(() => regionBreakdown.value.totals);

/** 透视：行维度 region × 列维度 category，交叉格是 sum(sales) */
const regionByCategory = computed(() =>
  pivot(salesRows, {
    dataset: salesDataset,
    measures: [{ agg: 'sum', field: 'sales' }],
    pivotColumns: ['category'],
    rowDimensions: ['region'],
  }),
);

/** 透视格按列键取值；列的 `field` 指回原始字段，格式跟着字段走而不是页面里再抄一遍 */
const pivotCells = computed(() =>
  regionByCategory.value.rows.map((row) => ({
    label: row.label,
    values: regionByCategory.value.columns.map((column) => {
      const format = salesDataset.fields.find(
        (field) => field.key === column.field,
      )?.format;
      return formatCell(
        { key: column.key, kind: 'measure', label: column.label, format },
        row.values[column.key],
      );
    }),
  })),
);

/* ---------------- 配色：从 design token 里长出来，页面里不出现裸颜色 ---------------- */

/** viewer 的重挂 key：palette 是在组件 setup 时读一次的运行时配置，改完要靠重挂生效 */
const viewerKey = ref(0);
const paletteApplied = ref(false);

/**
 * 只读 `--primary` 的 HSL 通道，按色相旋转出 6 档。
 * 图表色板必须由宿主注入（本包不写死颜色，否则换主题预设时图还是旧的），
 * 而 token 存的就是「颜色通道」，所以这里拆的是 `215.02 100% 54.31%` 这种三段值。
 */
function chartPalette(count = 6): string[] {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim();
  const parts = raw.split(/\s+/);
  const hue = Number.parseFloat(parts[0] ?? '');
  if (!Number.isFinite(hue)) return [];
  const saturation = parts[1] ?? '70%';
  const lightness = parts[2] ?? '50%';
  return Array.from(
    { length: count },
    (_, index) => `hsl(${(hue + index * 47) % 360} ${saturation} ${lightness})`,
  );
}

function applyPalette(): void {
  const palette = chartPalette();
  configureReport({ palette: palette.length > 0 ? palette : undefined });
  paletteApplied.value = palette.length > 0;
  viewerKey.value += 1;
}

/** 演示"换数据源"这件事到底有多小：把内存表换成另一份静态表，重挂一次就够 */
function resetDemo(): void {
  configureReport({ source: createSalesSource() });
  spec.value = createSalesReport();
  filters.value = {};
  viewerKey.value += 1;
}

const containerClassName = cn('space-y-6');
const hintClassName = cn('text-sm', 'leading-relaxed', 'text-muted-foreground');
const codeClassName = cn(
  'rounded-sm',
  'bg-muted',
  'px-1',
  'py-0.5',
  'font-mono',
  'text-xs',
);
</script>

<template>
  <div :class="containerClassName">
    <!-- 1. 报表视图 -->
    <Card title="报表视图（过滤 + 栅格渲染）" variant="borderless">
      <p :class="hintClassName">
        数据来自
        <code :class="codeClassName">presets/sales-report</code>：固定种子生成
        30 天 × 3 区域 × 2 品类 共
        <code :class="codeClassName">180</code>
        行，页面不发任何请求。过滤条只负责产出取值， 真正解释它的是
        <code :class="codeClassName">core/aggregate.applyReportFilters</code>——
        所以
        <code :class="codeClassName">ReportFilterBar</code>
        也能单独搬到列表页上用。
      </p>
      <div class="mt-3">
        <ReportFilterBar
          v-model:values="filters"
          :filters="spec.filters ?? []"
        />
      </div>
      <Space :size="4" class="mt-3" wrap>
        <Button size="sm" @click="applyPalette">图表配色跟随当前主题</Button>
        <Button size="sm" variant="outline" @click="resetDemo">
重置示例报表
</Button>
        <span v-if="paletteApplied" :class="hintClassName">已注入 6 档色板（重挂 viewer 生效）</span>
      </Space>
      <Alert
        v-if="issues.length > 0"
        class="mt-4"
        type="warning"
        show-icon
        :message="`报表 DSL 有 ${issues.length} 条待确认项`"
        :description="issues.map((issue) => issue.message).join('；')"
      />
      <Separator class="my-4" />
      <ReportViewer
        :key="viewerKey"
        :filters="filters"
        :spec="spec"
        @sort="(payload) => console.info('[report] sort', payload)"
      />
    </Card>

    <!-- 2. 设计器 -->
    <Card title="设计器（改的就是上面那一份 DSL）" variant="borderless">
      <p :class="hintClassName">
        <code :class="codeClassName">ReportDesigner</code> 不取数、不就地改
        props：每次改动都
        <code :class="codeClassName">emit('update:spec', 新对象)</code>，所以撤销 / 自动保存 / 协同编辑都能长在父级。 上面那张
        <code :class="codeClassName">ReportViewer</code> 绑的是同一个
        <code :class="codeClassName">spec</code>，加一格、换个聚合方式立刻所见即所得。
      </p>
      <p :class="cn(hintClassName, 'mt-2')">
        数据集字段：<code :class="codeClassName">{{ datasetHint }}</code>
      </p>
      <div class="mt-3">
        <ReportDesigner
          :columns="12"
          :spec="spec"
          @update:spec="onSpecChange"
        />
      </div>
    </Card>

    <!-- 3. 甘特视图 -->
    <Card title="甘特视图（frappe-gantt + 字段映射）" variant="borderless">
      <p :class="hintClassName">
        甘特读的是明细事实行而不是一格
        <code :class="codeClassName">QueryResult</code>：
        <code :class="codeClassName">core/gantt.ts</code> 负责把「哪列是起止 /
        进度 / 依赖」翻译成任务并挡掉脏数据，
        画布归第三方库。最后那行故意填了「结束早于开始」，组件会给出跳过条数而不是画半截图。
      </p>
      <Space :size="4" class="mt-3" wrap>
        <Button
          size="sm"
          variant="outline"
          @click="ganttReadonly = !ganttReadonly"
        >
          {{ ganttReadonly ? '允许拖拽改期' : '改回只读' }}
        </Button>
        <Button
          v-for="mode in ['Day', 'Week', 'Month'] as const"
          :key="mode"
          :variant="ganttViewMode === mode ? 'default' : 'outline'"
          size="sm"
          @click="ganttViewMode = mode"
        >
          {{ mode }}
        </Button>
      </Space>
      <div class="mt-3">
        <ReportGantt
          v-model:view-mode="ganttViewMode"
          :field-map="ganttFieldMap"
          :holidays="['2026-05-01', '2026-05-02', '2026-05-03']"
          :readonly="ganttReadonly"
          :rows="GANTT_ROWS"
          :view-modes="['Day', 'Week', 'Month']"
          @date-change="
            (payload) => console.info('[gantt] dateChange', payload)
          "
          @task-click="(payload) => console.info('[gantt] taskClick', payload)"
        />
      </div>
    </Card>

    <!-- 4. 纯函数口径 -->
    <Card
      title="纯函数口径（core 不认 vue，Node 侧可直接复用）"
      variant="borderless"
    >
      <p :class="hintClassName">
        下面两张表是页面里直接调
        <code :class="codeClassName">aggregate()</code> /
        <code :class="codeClassName">pivot()</code>
        算出来的，不经数据源、不经组件—— 导出 CSV
        或服务端预计算走的就是同一份代码，口径不会分叉。
        <code :class="codeClassName">percentOfTotal</code>
        那一列由聚合引擎顺手算出， 而不是前端再折一次。
      </p>
      <div class="mt-3 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 class="text-sm font-medium">按区域分组 + 占总计百分比</h3>
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr class="border-b">
                <th
                  v-for="column in regionBreakdown.columns"
                  :key="column.key"
                  class="px-2 py-1 text-left font-medium"
                >
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in regionBreakdown.rows"
                :key="index"
                class="border-b border-border/60"
              >
                <td
                  v-for="column in regionBreakdown.columns"
                  :key="column.key"
                  class="px-2 py-1 tabular-nums"
                >
                  {{ formatCell(column, row[column.key]) }}
                </td>
              </tr>
              <tr v-if="regionTotals">
                <td
                  v-for="column in regionBreakdown.columns"
                  :key="column.key"
                  class="px-2 py-1 font-medium tabular-nums"
                >
                  {{
                    column.kind === 'dimension'
                      ? '合计'
                      : formatCell(column, regionTotals[column.key])
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 class="text-sm font-medium">区域 × 品类交叉（透视）</h3>
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="px-2 py-1 text-left font-medium">区域</th>
                <th
                  v-for="column in regionByCategory.columns"
                  :key="column.key"
                  class="px-2 py-1 text-left font-medium"
                >
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in pivotCells"
                :key="row.label"
                class="border-b border-border/60"
              >
                <td class="px-2 py-1">{{ row.label }}</td>
                <td
                  v-for="(cell, index) in row.values"
                  :key="index"
                  class="px-2 py-1 tabular-nums"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>

    <!-- 5. 接线说明 -->
    <Card title="接到真实后端上" variant="borderless">
      <p :class="hintClassName">
        只有一个接线点：<code :class="codeClassName">configureReport()</code>。
        <code :class="codeClassName">source</code>
        是整条数据源的实现（可以是内存表、函数、远端），
        <code :class="codeClassName">fetcher</code> 只给通道，本包按
        <code :class="codeClassName">datasetId + 参数指纹</code>
        造源并合并并发请求。
      </p>
      <pre class="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        `// 1) 最省事：把宿主已有的请求封装交出去\nconfigureReport({\n  fetcher: async (request, signal) => {\n    const { data } = await http.post('/report/query', request, { signal });\n    return data.rows; // 凭据留在宿主侧，包里不读环境变量\n  },\n  // 2) 图表配色从 design token 来（本包不写死颜色）\n  palette: chartPalette(),\n  // 3) 窄屏宿主按视口传列数，而不是让包去猜断点\n  columns: window.innerWidth < 1024 ? 6 : 12,\n})\n\n// 3) 只想换一份内存表（示例页、e2e）\nsetReportStaticTables({ 'ds-sales-daily': rows })`
      }}</pre>
      <p :class="cn(hintClassName, 'mt-2')">
        图形渲染组件也是注入点（<code :class="codeClassName">widgetChart</code>）：缺省用
        <code :class="codeClassName">@antdv/common-ui/charts</code> 的
        ECharts，SSR 出图或 jsdom 无 canvas 的场景换成一个只接
        <code :class="codeClassName">option</code> 的实现即可。 图表类型标签见
        <code :class="codeClassName">chartTypeLabel</code>，本页用得上的是
        <code :class="codeClassName">{{ chartTypeLabel('bar') }}</code> /
        <code :class="codeClassName">{{ chartTypeLabel('line') }}</code>。
      </p>
    </Card>
  </div>
</template>
