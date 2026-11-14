/**
 * 示例报表：销售日报。
 *
 * 一份**可直接跑通**的报表定义，同时承担两个角色：
 * - 单测夹具：`createSalesRows()` 是确定性生成（固定种子的线性同余），任何一次运行拿到同样的
 *   180 行，所以测试可以断言具体金额而不是"大概是个数"；
 * - 宿主示例页的数据源：`createSalesSource()` 直接喂给 `configureReport({ source })`
 *   或 `<ReportViewer :source="...">` 就能出图，不需要后端。
 *
 * 分层位置：`presets/`，只依赖 `core/`，不被 core 反向依赖 —— 想让默认值带上它请显式 import。
 *
 * 数据形状刻意留了几个"真实世界"的特征用来压链路：
 * 金额带两位小数（测格式化与千分位）、退款率是 0~1 的小数（测 percent）、
 * 同一区域同一天有多条品类记录（测分组与透视的交叉格）。
 *
 * 不做的事：不接接口、不做随机漂移（随机种子写死）、不放脏数据（脏数据口径请在单测里就地构造）。
 */

import type {
  DatasetSpec,
  FilterSpec,
  ReportSpec,
  Row,
  WidgetSpec,
} from '../core/types';

import { createStaticSource } from '../core/datasource';
import { relayout } from '../core/dsl';

export const SALES_DATASET_ID = 'ds-sales-daily';
export const SALES_REPORT_ID = 'report-sales-daily';

const REGIONS = ['华东', '华北', '华南'] as const;
const CATEGORIES = ['硬件', '软件'] as const;
const CHANNELS = ['直营', '渠道'] as const;
const DAYS = 30;

/**
 * 固定种子的线性同余随机数。
 *
 * 不用 `Math.random()`：夹具的每一行金额都要能被测试写死，
 * 也不用日期相关的种子：那会让"今天的报表"和昨天的对不上。
 */
function createRandom(seed: number): () => number {
  let state = seed % 2_147_483_647;
  if (state <= 0) state += 2_147_483_646;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 区域基准额不同，保证柱状图有高低；周末（每 7 天的后两天）翻倍，保证折线有形状 */
const REGION_BASE: Record<string, number> = {
  华东: 52_000,
  华北: 38_000,
  华南: 26_000,
};

export interface SalesRow extends Record<string, unknown> {
  category: string;
  channel: string;
  cost: number;
  date: string;
  orders: number;
  refundRate: number;
  region: string;
  sales: number;
}

/** 确定性生成 30 天 × 3 区域 × 2 品类 = 180 行 */
export function createSalesRows(): SalesRow[] {
  const random = createRandom(20_260_301);
  const rows: SalesRow[] = [];
  for (let day = 1; day <= DAYS; day += 1) {
    const weekendBoost = day % 7 === 6 || day % 7 === 0 ? 1.6 : 1;
    for (const region of REGIONS) {
      for (const category of CATEGORIES) {
        const base = REGION_BASE[region] ?? 30_000;
        const sales = round2(
          base *
            weekendBoost *
            (0.6 + random() * 0.9) *
            (category === '硬件' ? 1.25 : 0.75),
        );
        const cost = round2(sales * (0.55 + random() * 0.15));
        const orders = Math.max(1, Math.round(sales / (320 + random() * 260)));
        rows.push({
          category,
          channel: CHANNELS[Math.floor(random() * CHANNELS.length)] ?? '直营',
          cost,
          date: `2026-03-${String(day).padStart(2, '0')}`,
          orders,
          refundRate: round2(random() * 0.12),
          region,
          sales,
        });
      }
    }
  }
  return rows;
}

export const salesDataset: DatasetSpec = {
  fields: [
    {
      dataType: 'date',
      format: { kind: 'date', pattern: 'MM-DD' },
      key: 'date',
      kind: 'dimension',
      label: '日期',
    },
    { key: 'region', kind: 'dimension', label: '区域' },
    { key: 'category', kind: 'dimension', label: '品类' },
    { key: 'channel', kind: 'dimension', label: '渠道' },
    {
      aggregator: 'sum',
      dataType: 'number',
      format: { currency: 'CNY', decimals: 2, kind: 'currency' },
      key: 'sales',
      kind: 'measure',
      label: '销售额',
    },
    {
      aggregator: 'sum',
      dataType: 'number',
      format: { currency: 'CNY', decimals: 2, kind: 'currency' },
      key: 'cost',
      kind: 'measure',
      label: '成本',
    },
    {
      aggregator: 'sum',
      dataType: 'number',
      format: { kind: 'number' },
      key: 'orders',
      kind: 'measure',
      label: '单量',
    },
    {
      aggregator: 'avg',
      dataType: 'number',
      format: { decimals: 1, kind: 'percent' },
      key: 'refundRate',
      kind: 'measure',
      label: '退款率',
    },
  ],
  id: SALES_DATASET_ID,
  name: '销售日报',
  rowsKey: 'rows',
  source: 'static',
};

const WIDGETS: WidgetSpec[] = [
  {
    id: 'kpi-sales',
    layout: { h: 4, w: 3, x: 0, y: 0 },
    options: { format: { currency: 'CNY', decimals: 2, kind: 'currency' } },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: [],
      measures: [{ agg: 'sum', alias: 'sum_sales', field: 'sales' }],
    },
    title: '销售总额',
    type: 'kpi',
  },
  {
    id: 'kpi-orders',
    layout: { h: 4, w: 3, x: 3, y: 0 },
    options: { format: { kind: 'compact' }, height: '120px' },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: [],
      measures: [{ agg: 'sum', alias: 'sum_orders', field: 'orders' }],
    },
    title: '总单量',
    type: 'kpi',
  },
  {
    id: 'chart-region',
    layout: { h: 8, w: 6, x: 6, y: 0 },
    options: { chartType: 'bar' },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: ['region'],
      measures: [
        { agg: 'sum', alias: 'sum_sales', field: 'sales' },
        { agg: 'sum', alias: 'sum_cost', field: 'cost' },
      ],
      sort: [{ dir: 'desc', field: 'sum_sales' }],
    },
    title: '各区域销售额与成本',
    type: 'chart',
  },
  {
    id: 'chart-trend',
    layout: { h: 8, w: 6, x: 0, y: 4 },
    options: { chartType: 'line' },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: ['date'],
      measures: [{ agg: 'sum', alias: 'sum_sales', field: 'sales' }],
      sort: [{ dir: 'asc', field: 'date' }],
    },
    title: '每日销售趋势',
    type: 'chart',
  },
  {
    id: 'pivot-region-category',
    layout: { h: 8, w: 12, x: 0, y: 12 },
    options: { pivotColumns: ['category'], showTotals: true },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: ['region', 'category'],
      measures: [{ agg: 'sum', alias: 'sum_sales', field: 'sales' }],
    },
    title: '区域 × 品类交叉',
    type: 'pivot',
  },
  {
    id: 'table-detail',
    layout: { h: 10, w: 12, x: 0, y: 20 },
    options: { showTotals: true },
    query: {
      datasetId: SALES_DATASET_ID,
      dimensions: ['date', 'region', 'category'],
      measures: [
        { agg: 'sum', alias: 'sum_sales', field: 'sales' },
        { agg: 'sum', alias: 'sum_orders', field: 'orders' },
        { agg: 'avg', alias: 'avg_refund', field: 'refundRate' },
      ],
      sort: [{ dir: 'desc', field: 'sum_sales' }],
    },
    title: '明细（按销售额降序，前 20 行）',
    type: 'table',
  },
];

const FILTERS: FilterSpec[] = [
  { dataType: 'date', field: 'date', kind: 'between', label: '日期' },
  {
    field: 'region',
    kind: 'select',
    label: '区域',
    options: REGIONS.map((region) => ({ label: region, value: region })),
  },
  {
    field: 'category',
    kind: 'in',
    label: '品类',
    options: CATEGORIES.map((category) => ({
      label: category,
      value: category,
    })),
  },
  { field: 'channel', kind: 'text', label: '渠道' },
];

/**
 * 造一份全新的示例报表 DSL。
 *
 * 返回新副本而不是共享常量：设计器会就地基于它产出下一版，共用同一对象会让"撤销"回到上一个用户的操作。
 */
export function createSalesReport(): ReportSpec {
  const spec: ReportSpec = {
    datasets: [salesDataset],
    filters: FILTERS.map((filter) => ({ ...filter })),
    id: SALES_REPORT_ID,
    name: '销售日报（示例）',
    version: 2,
    widgets: WIDGETS.map((widget) => ({
      ...widget,
      layout: { ...widget.layout },
    })),
  };
  // 布局交给 autoLayout 复核一遍：preset 手写坐标最容易重叠，重排一次保证示例页开箱即用
  return relayout(spec, 12);
}

/** 示例数据源：喂给 `configureReport({ source })` 或 `useReportData({ source })` 即可跑通 */
export function createSalesSource() {
  return createStaticSource({ [SALES_DATASET_ID]: createSalesRows() as Row[] });
}
