/**
 * 结果集 → ECharts option 的映射：`core/`，纯函数。
 *
 * 分层位置：只做「数据形状 → option 对象」的翻译，**不 import echarts、不碰实例、不碰 DOM**。
 * 这样三件事同时成立：可以脱离浏览器单测；图表库换版本时本包不跟着改；
 * 宿主想换渲染实现（SVG、Canvas、服务端出图）只需换一个 option 消费者。
 *
 * 口径：
 * - 维度列里**第一列**当类目轴；还有第二、第三列时把值拼成 `A / B`，
 *   而不是静默丢掉——丢维度会让用户以为数据少了，拼起来顶多是标签长。
 * - 度量列逐个变 series；值非数值时给 `null`（ECharts 画成断点），不给 0（0 是一根看得见的柱子）。
 * - `area` 不是独立 series 类型，是 `line + areaStyle`，与 ECharts 自己的口径一致。
 * - 配色只在注入 palette 时写 `option.color`，否则交给 ECharts 默认色板 ——
 *   本包不许出现十六进制颜色。
 *
 * 不做的事：不画标题（卡片头已经有）、不做 dataZoom/工具箱这些交互件、不做饼环以外的图形。
 */

import type { QueryResult, ResultColumn, Row, WidgetSpec } from './types';

/** series 项的最小结构；其余键透传，方便宿主自己往 option 里塞东西 */
export interface ChartSeries {
  data: unknown[];
  name?: string;
  stack?: string;
  type: string;
  yAxisIndex?: number;
  [key: string]: unknown;
}

export interface ChartAxis {
  data?: unknown[];
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ChartOption {
  color?: string[];
  grid?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  series: ChartSeries[];
  tooltip?: Record<string, unknown>;
  xAxis?: ChartAxis | ChartAxis[];
  yAxis?: ChartAxis | ChartAxis[];
  [key: string]: unknown;
}

/** 未声明 `options.chartType` 时的图形：柱状是报表里最不容易读错的默认值 */
export const DEFAULT_CHART_TYPE = 'bar' as const;

function isMeasure(column: ResultColumn): boolean {
  return column.kind === 'measure';
}

/** 图表数值：只接受真数值与可解析字符串，其余给 null 形成断点 */
function chartNumber(value: unknown): null | number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replaceAll(/[\s,_]/gu, '');
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** 类目标签：多维度拼接，空值走 `format` 层同一套「未分类」口径 */
function categoryLabel(row: Row, dimensions: ResultColumn[]): string {
  if (dimensions.length === 0) return '合计';
  return dimensions
    .map((column) => {
      const value = row[column.key];
      return value === null || value === undefined || value === ''
        ? '未分类'
        : String(value);
    })
    .join(' / ');
}

export interface ToChartOptionOptions {
  /** 注入的色板（通常由宿主从 design token 读出来再传进来） */
  palette?: string[];
}

/**
 * 主入口。
 *
 * `widget.options` 里用到的键：`chartType`、`stack`、`rightAxis`。
 * 结果集为空时仍然返回一个结构完整的 option（series 为空数组），
 * 让上层可以照常渲染容器并叠一层"暂无数据"，而不是拿到 undefined 再各写各的兜底。
 */
export function toEChartsOption(
  result: QueryResult,
  widget: WidgetSpec,
  options: ToChartOptionOptions = {},
): ChartOption {
  const chartType = widget.options?.chartType ?? DEFAULT_CHART_TYPE;
  const dimensions = result.columns.filter((column) => !isMeasure(column));
  const measures = result.columns.filter(isMeasure);
  const categories = result.rows.map((row) => categoryLabel(row, dimensions));

  const option: ChartOption = { series: [] };
  if (options.palette?.length) option.color = [...options.palette];

  if (chartType === 'pie') {
    const [first] = measures;
    const name = first?.label ?? '数值';
    const data = first
      ? result.rows.map((row, index) => ({
          name: categories[index] ?? '',
          value: chartNumber(row[first.key]),
        }))
      : [];
    option.series = [{ data, name, radius: ['40%', '68%'], type: 'pie' }];
    option.tooltip = { trigger: 'item' };
    return option;
  }

  const rightAxis = new Set(widget.options?.rightAxis ?? []);
  const stacked = widget.options?.stack === true;
  const dualAxis = measures.some((column) => rightAxis.has(column.key));

  option.series = measures.map((column) => {
    const data =
      chartType === 'scatter'
        ? result.rows.map((row, index) => [index, chartNumber(row[column.key])])
        : result.rows.map((row) => chartNumber(row[column.key]));
    const series: ChartSeries = {
      data,
      name: column.label,
      type: chartType === 'area' ? 'line' : chartType,
    };
    if (chartType === 'area') series.areaStyle = {};
    // 堆叠只对同类目相加有意义的图形生效；scatter 叠起来就是错图
    if (
      stacked &&
      (chartType === 'bar' || chartType === 'area' || chartType === 'line')
    ) {
      series.stack = 'total';
    }
    if (dualAxis && rightAxis.has(column.key)) series.yAxisIndex = 1;
    return series;
  });

  option.xAxis = { data: categories, type: 'category' };
  const axisBase: ChartAxis = { type: 'value' };
  option.yAxis = dualAxis
    ? [{ ...axisBase }, { ...axisBase, splitLine: { show: false } }]
    : axisBase;
  option.legend = { data: measures.map((column) => column.label), top: 0 };
  option.tooltip = { trigger: 'axis' };
  option.grid = {
    bottom: 24,
    containLabel: true,
    left: 12,
    right: 12,
    top: 48,
  };
  return option;
}
