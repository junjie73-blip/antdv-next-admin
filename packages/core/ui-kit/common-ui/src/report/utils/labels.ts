/**
 * UI 侧的中文标签与下拉选项：`utils/`，只有组件层用它。
 *
 * 为什么不放 `core/`：core 要能被 Node 侧原样复用，标签属于展示约定，
 * 改文案不该动到聚合口径。聚合名（'求和'/'平均'）仍从 `core/aggregate.aggLabel` 取，
 * 避免出现"下拉里叫求和、表头里叫合计"两套词。
 *
 * 不做的事：不做多语言（本包不 import 宿主 `~/locales`，需要 i18n 的宿主请把这些常量换成自己的）。
 */

import type {
  AggKind,
  ChartType,
  FilterKind,
  GanttViewMode,
  WidgetType,
} from '../core/types';

import { aggLabel } from '../core/aggregate';
import { GANTT_VIEW_MODES } from '../core/gantt';

export const AGG_KINDS: AggKind[] = [
  'sum',
  'avg',
  'count',
  'countDistinct',
  'max',
  'min',
  'median',
  'first',
  'last',
];

export const AGG_OPTIONS: Array<{ label: string; value: AggKind }> =
  AGG_KINDS.map((value) => ({
    label: aggLabel(value),
    value,
  }));

export const CHART_TYPE_OPTIONS: Array<{ label: string; value: ChartType }> = [
  { label: '柱状图', value: 'bar' },
  { label: '折线图', value: 'line' },
  { label: '面积图', value: 'area' },
  { label: '饼图', value: 'pie' },
  { label: '散点图', value: 'scatter' },
];

export const WIDGET_TYPE_OPTIONS: Array<{ label: string; value: WidgetType }> =
  [
    { label: '图表', value: 'chart' },
    { label: '指标卡', value: 'kpi' },
    { label: '甘特图', value: 'gantt' },
    { label: '透视表', value: 'pivot' },
    { label: '明细表', value: 'table' },
    { label: '说明文本', value: 'text' },
  ];

export const FILTER_KIND_OPTIONS: Array<{ label: string; value: FilterKind }> =
  [
    { label: '区间', value: 'between' },
    { label: '多选', value: 'in' },
    { label: '数值', value: 'number' },
    { label: '单选', value: 'select' },
    { label: '文本', value: 'text' },
  ];

/**
 * 甘特时间轴粒度的中文标签。
 *
 * 顺序直接由 `core/gantt.GANTT_VIEW_MODES` 派生（步长从小到大），也就是工具条的按钮顺序；
 * 这里再列一遍 value 只会给"下拉少一档、工具条多一档"留机会。
 * 名字本身是 frappe 内置档位的英文原词（`'Quarter Day'` 是"一天四列"，不是"季度"），
 * 标签按实际列宽口径翻，翻成季度会让人以为时间轴按季度分格。
 */
const GANTT_VIEW_MODE_LABELS: Record<GanttViewMode, string> = {
  Day: '天',
  'Half Day': '半天',
  Hour: '小时',
  Month: '月',
  'Quarter Day': '6 小时',
  Week: '周',
  Year: '年',
};

export const GANTT_VIEW_MODE_OPTIONS: Array<{
  label: string;
  value: GanttViewMode;
}> = GANTT_VIEW_MODES.map((value) => ({
  label: GANTT_VIEW_MODE_LABELS[value],
  value,
}));

export function ganttViewModeLabel(mode: GanttViewMode): string {
  return GANTT_VIEW_MODE_LABELS[mode];
}

const CHART_TYPE_LABELS = Object.fromEntries(
  CHART_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<ChartType, string>;
const WIDGET_TYPE_LABELS = Object.fromEntries(
  WIDGET_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<WidgetType, string>;

export function chartTypeLabel(type: ChartType | undefined): string {
  return CHART_TYPE_LABELS[type ?? 'bar'] ?? '柱状图';
}

export function widgetTypeLabel(type: WidgetType): string {
  return WIDGET_TYPE_LABELS[type] ?? type;
}
