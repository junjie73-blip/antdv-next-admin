/**
 * `@antdv/common-ui/report` —— 报表设计器：数据集 DSL + 纯函数聚合/透视/格式化 + 栅格渲染 + 最小可视化编辑。
 *
 * 分层与依赖口径（按 import 的方向读，上层可以依赖下层，反之不行）：
 * - `core/*` 纯 TypeScript：不认识 vue、不认识 UI、不认识 echarts，可以被 Node 侧
 *   （导出 CSV、服务端预计算、CI 里的数据对账）直接复用；
 * - `composables/*` 是把 core 接上响应式的唯一一座桥；
 * - `components/*` 只画不算，基础控件全部来自 `@antdv/shadcn-ui`，图形来自
 *   `@antdv/common-ui/charts`（刻意走子路径：它带着一整份 echarts，不进根 barrel）；
 * - `presets/*` 是可直接跑通的示例与单测夹具，不被 core 反向依赖。
 *
 * 表达式语义（行过滤 / having）复用 `@antdv/graph` 的受限求值器：
 * 报表条件同样来自用户输入，**不许 `eval`、不许 `new Function`**，两边共用一套语法也更省事。
 *
 * 本包不 import 宿主的 `~/api` / `~/stores` / `~/locales`：需要宿主能力时走
 * `configureReport()` 注入（数据源、fetcher、配色、图表渲染组件）。
 */

export { ReportDesigner } from './components/ReportDesigner';

export { ReportFilterBar } from './components/ReportFilterBar';

export { ReportGantt } from './components/ReportGantt';

export { ReportViewer } from './components/ReportViewer';

export { ReportWidget } from './components/ReportWidget';

export {
  useReportData,
  type UseReportDataOptions,
  type UseReportDataReturn,
  type WidgetState,
} from './composables/use-report-data';

export {
  configureReport,
  createConfiguredReportSource,
  getReportRuntime,
  type ReportRuntimeConfig,
  resetReportRuntime,
  setReportStaticTables,
} from './config';

export {
  aggLabel,
  aggregate,
  type AggregateOptions,
  applyAgg,
  applyReportFilters,
  buildColumns,
  compileHaving,
  fieldMapOf,
  measureColumnKey,
  normalizeDimension,
  type QuerySpecLike,
  toIdentifier,
  TOTAL_LABEL,
  UNGROUPED_LABEL,
} from './core/aggregate';

export {
  type ChartAxis,
  type ChartOption,
  type ChartSeries,
  DEFAULT_CHART_TYPE,
  type ToChartOptionOptions,
  toEChartsOption,
} from './core/chart-option';

export {
  createAbortError,
  createFallbackSource,
  createFunctionSource,
  createRemoteSource,
  createRequestCoalescer,
  createStaticSource,
  type DatasourceErrorCode,
  fingerprintParams,
  isAbortError,
  readRowsAt,
  type RemoteFetcher,
  type RemoteRequest,
  type ReportDataSource,
  ReportDataSourceError,
  type ReportLoadContext,
  type RequestCoalescer,
  requestKey,
  type StaticPayload,
  type StaticTable,
} from './core/datasource';

export {
  autoLayout,
  cloneReport,
  createEmptyReport,
  createWidget,
  CURRENT_SPEC_VERSION,
  DEFAULT_GRID_COLUMNS,
  type DslIssue,
  type DslIssueCode,
  isReportSpec,
  nextReportId,
  relayout,
  ReportDslError,
  upgradeSpec,
  validateReportSpec,
} from './core/dsl';

export {
  DATE_DEFAULT_PATTERN,
  formatCell,
  formatField,
  formatValue,
  NULL_PLACEHOLDER,
} from './core/format';

export {
  type GanttBuildResult,
  type GanttChangePayload,
  type GanttDateValue,
  type GanttSkippedRow,
  type GanttSkipReason,
  type GanttTask,
  toGanttDate,
  toGanttProgress,
  toGanttTasks,
} from './core/gantt';
export { isBlankCell, toNumberValue } from './core/number';
export {
  encodeKey,
  metricLabel,
  pivot,
  type PivotColumn,
  type PivotResult,
  type PivotRow,
  type PivotSpec,
} from './core/pivot';
export * from './core/types';
export {
  createSalesReport,
  createSalesRows,
  createSalesSource,
  SALES_DATASET_ID,
  SALES_REPORT_ID,
  salesDataset,
  type SalesRow,
} from './presets/sales-report';

export {
  AGG_KINDS,
  AGG_OPTIONS,
  CHART_TYPE_OPTIONS,
  chartTypeLabel,
  FILTER_KIND_OPTIONS,
  WIDGET_TYPE_OPTIONS,
  widgetTypeLabel,
} from './utils/labels';
