/**
 * 报表领域的形状。
 *
 * 分层位置：`core/*` 是纯 TypeScript，不认识 vue、不认识 shadcn-ui、也不认识 echarts，
 * 因此 `aggregate()` / `pivot()` / `formatValue()` 可以直接在 Node 侧（导出 CSV、服务端预计算）复用。
 *
 * 本文件**只放类型**，不放运行时常量：常量（标签、默认值）跟着实现走，
 * 否则改实现要同时改两处，类型面和实现面迟早分叉。
 *
 * 刻意不做的事：
 * - 不定义「数据从哪来」——那是 `datasource.ts` 的适配器接口，DSL 只描述"要什么"；
 * - 不引入 `any`：单元格值一律 `Row = Record<string, unknown>`，读写方各自做窄化，
 *   代价是每处多两行判断，收益是聚合引擎里不会出现"悄悄把 Date 当数字加"的事故。
 */

/** 一行原始事实。值刻意留 unknown：真实接口的 JSON 什么都有，聚合层负责解释 */
export type Row = Record<string, unknown>;

/** 字段角色：维度用于分组，度量用于算数 */
export type FieldKind = 'dimension' | 'measure';

/**
 * 逻辑类型。只用来决定「默认格式」与「排序时按字典序还是按数值」，
 * 不参与运行时强校验——上游 JSON 里日期常常就是字符串。
 */
export type FieldDataType = 'boolean' | 'date' | 'number' | 'string';

/** 支持的聚合方式。名字与常见 BI 对齐，避免同一个概念在本包内再起一个名 */
export type AggKind =
  | 'avg'
  | 'count'
  | 'countDistinct'
  | 'first'
  | 'last'
  | 'max'
  | 'median'
  | 'min'
  | 'sum';

/** 展示格式种类 */
export type FormatKind =
  | 'bytes'
  | 'compact'
  | 'currency'
  | 'date'
  | 'duration'
  | 'number'
  | 'percent'
  | 'text';

/**
 * 格式化说明。
 *
 * `scale` 与 `pattern` 是 kind 的专属开关，刻意放在同一个对象里而不是拆成联合类型：
 * DSL 要能手写、要能存库，判别联合会让设计器每次改 kind 都得先删掉不相干的键。
 * 未识别的组合作「无操作」处理（见 format.ts），不抛错——报表挂了比少个单位严重得多。
 */
export interface FormatSpec {
  /** 币种：接受 ISO 码（'CNY'/'USD'）或裸符号（'¥'） */
  currency?: string;
  /** 小数位；未给定时各 kind 用自己的默认口径（见 format.ts） */
  decimals?: number;
  kind: FormatKind;
  /** dayjs 模板，仅 kind='date' 生效，缺省 'YYYY-MM-DD' */
  pattern?: string;
  /** 仅 kind='compact'：'short' 走 K/M/B，'cn' 走 万/亿 */
  scale?: 'cn' | 'short';
  /** 紧邻数值后的符号后缀（无空格），如 '单' */
  suffix?: string;
  /** 量纲后缀（有空格），如 '元' */
  unit?: string;
}

/** 数据集里的一个字段元信息 */
export interface FieldMeta {
  /** 缺省聚合，设计器把字段拖成度量时的初值 */
  aggregator?: AggKind;
  dataType?: FieldDataType;
  /** 字段级默认格式；结果列没另配格式时用它 */
  format?: FormatSpec;
  /** 行数据里的取值键 */
  key: string;
  kind: FieldKind;
  /** 展示名，缺省用 key */
  label?: string;
}

/** 数据集描述：只有 schema 与取数方式，行数据在 datasource 那边 */
export interface DatasetSpec {
  fields: FieldMeta[];
  id: string;
  name?: string;
  /** static 走注入的内存表，remote 走宿主 fetcher；语义由 datasource.ts 解释 */
  source: 'remote' | 'static';
  /** 取数返回的是包裹对象时，从哪个键拿行数组，支持 'data.list' 这样的点路径 */
  rowsKey?: string;
}

/** 一个度量：聚合方式 + 字段 + 可选别名（别名同时决定结果列的 key） */
export interface MeasureSpec {
  agg: AggKind;
  field: string;
  alias?: string;
}

/** 行级过滤条件；expr 是交给 `@antdv/graph` 受限求值器的表达式，变量名 = 字段 key */
export interface RowFilterSpec {
  expr: string;
  label?: string;
}

/** 简单比较的运算符集合，会被编译成表达式串后交给同一个求值器 */
export type HavingOp = '!=' | '<' | '<=' | '==' | '>' | '>=';

/** 聚合后过滤：表达式，或「列 比较 值」的糖 */
export type HavingSpec =
  | { expr: string }
  | { field: string; op: HavingOp; value: number | string };

export type SortDir = 'asc' | 'desc';

/** 排序项；field 是结果列的 key（维度 key 或度量列 key） */
export interface SortSpec {
  dir: SortDir;
  field: string;
}

/** 一次查询的完整描述 */
export interface QuerySpec {
  datasetId: string;
  dimensions: string[];
  filters?: RowFilterSpec[];
  having?: HavingSpec;
  limit?: number;
  measures: MeasureSpec[];
  sort?: SortSpec[];
}

export type WidgetType = 'chart' | 'gantt' | 'kpi' | 'pivot' | 'table' | 'text';

export type ChartType = 'area' | 'bar' | 'line' | 'pie' | 'scatter';

/**
 * 甘特图的时间轴粒度。字符串取值与 frappe-gantt 内置的 view_modes 名字一一对齐，
 * 这样组件层可以原样透传给 `new Gantt(...)`，不必在本包再做一层名称翻译。
 */
export type GanttViewMode =
  | 'Day'
  | 'Half Day'
  | 'Hour'
  | 'Month'
  | 'Quarter Day'
  | 'Week'
  | 'Year';

/**
 * 甘特视图的字段映射：把「一行 = 一个任务」所需的语义列指到数据集字段的 key 上。
 *
 * 口径：
 * - `start` / `end` 是硬要求，缺任何一个的行都在 `core/gantt.ts` 里被丢弃（frappe 自己也画不出无起止的条）；
 * - `id` / `name` / `progress` / `group` / `dependencies` 可缺省，缺省时 `core/gantt.ts` 用行序号兜底 id、
 *   用 `name ?? id` 兜底名称、进度按 0 处理，不因为"少配了一列"就整张图打不开。
 *
 * 刻意只放字段名（字符串），不放取值本身：映射属于报表定义（要能进 DSL / 存库），
 * 取值属于运行时行数据，两者混在一起就没法序列化。
 */
export interface GanttFieldMap {
  /** 依赖列：值可以是 `'1,2'` 逗号串或数组，语义由 `core/gantt.ts` 解释 */
  dependencies?: string;
  /** 结束时间列（必填） */
  end: string;
  /** 分组列：仅透传给宿主 / 后续做泳道用，frappe 本身不画分组 */
  group?: string;
  /** 任务 id 列；缺省时按行序号生成稳定 id，保证依赖引用不漂移 */
  id?: string;
  /** 任务名称列 */
  name?: string;
  /** 进度列：0~1 比率或 0~100 百分数都可，最终归一到 frappe 需要的 0~100 */
  progress?: string;
  /** 开始时间列（必填） */
  start: string;
}

/** 栅格落点与尺寸，单位是「列」和「行」，不是像素 */
export interface GridLayoutItem {
  h: number;
  w: number;
  x: number;
  y: number;
}

/**
 * widget 的类型专属参数。
 *
 * 用「一个宽松对象 + 明确列出的常用键」而不是每种类型一个联合分支：
 * DSL 要能被宿主后端原样存 JSON，联合分支需要判别字段，而历史报表里判别字段经常缺失。
 * 多余的键一律忽略，缺少的键走默认值。
 */
export interface WidgetOptions extends Record<string, unknown> {
  /** chart：图形类型，缺省 'bar' */
  chartType?: ChartType;
  /** gantt：甘特视图的字段映射（开始/结束/名称/进度/分组/依赖对应的列 key） */
  gantt?: GanttFieldMap;
  /** gantt：时间轴粒度，缺省 'Day' */
  ganttViewMode?: GanttViewMode;
  /** gantt：是否只读（报表默认只读，拖拽改档期属于宿主页面的显式选择） */
  ganttReadonly?: boolean;
  /** kpi：主数值格式 */
  format?: FormatSpec;
  /** chart：图形高度，交给 ECharts 容器而不是 option */
  height?: string;
  /** pivot：列维度（query.dimensions 当行维度） */
  pivotColumns?: string[];
  /** table / pivot：是否追加合计行 */
  showTotals?: boolean;
  /** chart：同类目堆叠 */
  stack?: boolean;
  /** chart：画到第二根 Y 轴上的度量列 key */
  rightAxis?: string[];
  /** text：正文 */
  text?: string;
}

/** 报表上的一个格子 */
export interface WidgetSpec {
  description?: string;
  id: string;
  layout: GridLayoutItem;
  options?: WidgetOptions;
  /** text 类 widget 没有 query */
  query?: QuerySpec;
  title?: string;
  type: WidgetType;
}

/** 过滤器控件类型 */
export type FilterKind = 'between' | 'in' | 'number' | 'select' | 'text';

/** 报表级过滤器声明；取值本身由组件回抛，不写进 DSL */
export interface FilterSpec {
  /** 决定 `between` 长成长日期还是长数字，也决定回抛值是否要数值化 */
  dataType?: FieldDataType;
  /** 作用于哪个数据集，缺省取报表的第一个数据集 */
  datasetId?: string;
  field: string;
  kind: FilterKind;
  label?: string;
  /** select / in 的候选项；不传时由设计器或宿主自行喂 */
  options?: Array<{ label?: string; value: boolean | number | string }>;
}

/** 一份报表 = 数据集 schema + 过滤器 + widget 列表 */
export interface ReportSpec {
  datasets: DatasetSpec[];
  filters?: FilterSpec[];
  id: string;
  name: string;
  version: number;
  widgets: WidgetSpec[];
}

/** 结果集的一列 */
export interface ResultColumn {
  agg?: AggKind;
  /** 维度列对应的原始字段 key；度量列为 undefined */
  field?: string;
  format?: FormatSpec;
  /** 结果行里的取值键，也是 sort/having 里能引用的变量名 */
  key: string;
  kind: FieldKind;
  label: string;
}

/** 聚合引擎的产物 */
export interface QueryResult {
  columns: ResultColumn[];
  rows: Row[];
  /** 不带维度分组的整体合计；`undefined` 表示本次没有算合计 */
  totals?: Row;
}

/** 过滤器面板回抛的取值集合 */
export type FilterValues = Record<string, unknown>;
