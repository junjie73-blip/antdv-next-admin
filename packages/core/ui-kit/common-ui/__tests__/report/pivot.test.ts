import type {
  DatasetSpec,
  MeasureSpec,
  Row,
} from '../../src/report/core/types';

import { describe, expect, it } from 'vitest';

import { encodeKey, pivot } from '../../src/report/core/pivot';

/**
 * 透视表的三条承重口径各测一组：边缘合计按事实算（不是格子值相加）、空单元格补 0 但 counts 能分清
 * "没有"与"0"、列键用长度前缀编码所以任何字段值都撞不了键。
 */

const dataset: DatasetSpec = {
  fields: [
    { key: 'region', kind: 'dimension', label: '区域' },
    { key: 'category', kind: 'dimension', label: '品类' },
    { dataType: 'number', key: 'sales', kind: 'measure', label: '销售额' },
    { dataType: 'number', key: 'orders', kind: 'measure', label: '订单数' },
  ],
  id: 'ds-pivot',
  name: '透视测试集',
  source: 'static',
};

const rows: Row[] = [
  { category: '硬件', region: '华东', sales: 100, orders: 2 },
  { category: '软件', region: '华东', sales: 40, orders: 1 },
  { category: '硬件', region: '华北', sales: 200, orders: 4 },
  { category: '服务', region: '华北', sales: 30, orders: 3 },
  { category: '软件', region: '华南', sales: 70, orders: 5 },
];

const sumSales: MeasureSpec = { agg: 'sum', field: 'sales' };
const sumOrders: MeasureSpec = { agg: 'sum', field: 'orders' };

describe('encodeKey 列键编码', () => {
  it('长度前缀让含分隔符的值不会和拆开的值撞键', () => {
    expect(encodeKey(['a|b'])).not.toBe(encodeKey(['a', 'b']));
    expect(encodeKey(['a\u0000b'])).not.toBe(encodeKey(['a', 'b']));
    expect(encodeKey(['a'])).not.toBe(encodeKey(['ab']));
  });

  it('空组合与 [""] 不同键；空串维度值按「未分类」编码，与 aggregate 同一口径', () => {
    expect(encodeKey([])).toBe('');
    expect(encodeKey([''])).toBe('3~未分类');
    expect(encodeKey([''])).toBe(encodeKey(['未分类']));
    expect(encodeKey([''])).not.toBe(encodeKey([]));
  });

  it('中文按码元长度计，长度前缀不会因为多字节而错位', () => {
    expect(encodeKey(['华东'])).toBe('2~华东');
    expect(encodeKey(['华东', '硬件'])).toBe('2~华东2~硬件');
  });
});

describe('pivot 基本形状', () => {
  it('行维 × 列维：列按维度字典序、行按维度字典序，格子值是交叉聚合', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    expect(result.columns.map((column) => column.label)).toEqual([
      '服务',
      '硬件',
      '软件',
    ]);
    expect(result.rows.map((row) => row.label)).toEqual([
      '华东',
      '华北',
      '华南',
    ]);
    const hardware = result.columns[1]!.key;
    expect(result.rows.map((row) => row.values[hardware])).toEqual([
      100, 200, 0,
    ]);
  });

  it('空单元格补 0，但 counts 能区分「一条都没有」和「真的是 0」', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    const south = result.rows.find((row) => row.label === '华南')!;
    const hardware = result.columns.find((column) => column.label === '硬件')!;
    expect(south.values[hardware.key]).toBe(0);
    expect(south.counts[hardware.key]).toBe(0);
    const east = result.rows.find((row) => row.label === '华东')!;
    expect(east.counts[hardware.key]).toBe(1);
  });

  it('多度量时每个列维组合展开成多列，列标签带上度量名，键也带上度量', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales, sumOrders],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    expect(result.columns).toHaveLength(6);
    expect(result.columns[0]?.label).toBe('服务·求和(销售额)');
    expect(result.columns[1]?.label).toBe('服务·求和(订单数)');
    expect(result.metrics.map((metric) => metric.key)).toEqual([
      'sum_sales',
      'sum_orders',
    ]);
    // 列序是「列维字典序 × 度量顺序」：服务 / 硬件 / 软件，每个两条
    expect(result.columns.map((column) => column.label)).toEqual([
      '服务·求和(销售额)',
      '服务·求和(订单数)',
      '硬件·求和(销售额)',
      '硬件·求和(订单数)',
      '软件·求和(销售额)',
      '软件·求和(订单数)',
    ]);
    const east = result.rows.find((row) => row.label === '华东')!;
    expect(east.values[result.columns[4]!.key]).toBe(40);
    expect(east.values[result.columns[5]!.key]).toBe(1);
    expect(east.values[result.columns[2]!.key]).toBe(100);
    expect(east.values[result.columns[1]!.key]).toBe(0);
    expect(east.totals).toEqual({ sum_orders: 3, sum_sales: 140 });
  });

  it('没有列维时退化成一张一列的总计表，而不是空表', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: [],
      rowDimensions: ['region'],
    });
    expect(result.columns.map((column) => column.label)).toEqual(['总计']);
    expect(
      result.rows.map((row) => row.values[result.columns[0]!.key]),
    ).toEqual([140, 230, 70]);
  });

  it('没有行维时整体折成一行「总计」', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: [],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.label).toBe('总计');
    expect(result.grandTotals.sum_sales).toBe(440);
  });

  it('多行维用 parts 保留层次，标签用「 / 」连接', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: [],
      rowDimensions: ['region', 'category'],
    });
    expect(result.rows[0]?.parts).toEqual(['华东', '硬件']);
    expect(result.rows.map((row) => row.label)).toEqual([
      '华东 / 硬件',
      '华东 / 软件',
      '华北 / 服务',
      '华北 / 硬件',
      '华南 / 软件',
    ]);
  });

  it('维度空值归到「未分类」这一行/列，与 aggregate 同一口径', () => {
    const source: Row[] = [
      { category: null, region: '华东', sales: 1 },
      { category: '', region: '华东', sales: 2 },
      { category: '硬件', region: undefined, sales: 4 },
    ];
    const result = pivot(source, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    expect(result.columns.map((column) => column.label)).toEqual([
      '未分类',
      '硬件',
    ]);
    expect(result.rows.map((row) => row.label)).toEqual(['华东', '未分类']);
    const ungrouped = result.rows.find((row) => row.label === '未分类')!;
    const hardwareColumn = result.columns.find(
      (column) => column.label === '硬件',
    )!;
    expect(ungrouped.values[hardwareColumn.key]).toBe(4);
    expect(ungrouped.counts[hardwareColumn.key]).toBe(1);
    const east = result.rows.find((row) => row.label === '华东')!;
    const blankColumn = result.columns.find(
      (column) => column.label === '未分类',
    )!;
    expect(east.values[blankColumn.key]).toBe(3);
    expect(east.counts[blankColumn.key]).toBe(2);
  });
});

describe('pivot 边缘合计', () => {
  it('行合计按事实行算，不是把格子值加起来', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    const east = result.rows.find((row) => row.label === '华东')!;
    expect(east.totals.sum_sales).toBe(140);
  });

  it('avg 的行合计不等于格子值平均 —— 这条口径就是为它准备的', () => {
    const source: Row[] = [
      { category: '硬件', region: '华东', sales: 10 },
      { category: '硬件', region: '华东', sales: 20 },
      { category: '软件', region: '华东', sales: 90 },
    ];
    const result = pivot(source, {
      dataset,
      measures: [{ agg: 'avg', field: 'sales' }],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    const row = result.rows[0]!;
    const [hardware, software] = result.columns;
    // 格子平均各是 15 / 90，随手一加除二是 52.5；按事实算的整行平均必须是 40
    expect(row.values[hardware!.key]).toBe(15);
    expect(row.values[software!.key]).toBe(90);
    expect(row.totals.avg_sales).toBe(40);
  });

  it('列合计按该列全部事实行算，全表合计按所有事实行算', () => {
    const result = pivot(rows, {
      dataset,
      measures: [sumSales, sumOrders],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    const hardwareKey = encodeKey(['硬件']);
    expect(result.columnTotals[hardwareKey]).toEqual({
      sum_orders: 6,
      sum_sales: 300,
    });
    expect(result.grandTotals).toEqual({ sum_orders: 15, sum_sales: 440 });
  });

  it('median 同样从事实取，不受格子切分影响', () => {
    const result = pivot(rows, {
      dataset,
      measures: [{ agg: 'median', field: 'sales' }],
      pivotColumns: ['category'],
      rowDimensions: [],
    });
    expect(result.grandTotals.median_sales).toBe(70);
    expect(result.rows[0]?.totals.median_sales).toBe(70);
  });
});

describe('pivot 稳定性', () => {
  it('两次调用结果完全一致，输入顺序不同也一致', () => {
    const spec = {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    };
    const shuffled = [...rows].reverse();
    const a = pivot(rows, spec);
    const b = pivot(shuffled, spec);
    expect(b.rows.map((row) => row.label)).toEqual(
      a.rows.map((row) => row.label),
    );
    expect(b.columns.map((column) => column.key)).toEqual(
      a.columns.map((column) => column.key),
    );
    expect(b.rows.map((row) => ({ ...row.values }))).toEqual(
      a.rows.map((row) => ({ ...row.values })),
    );
  });

  it('脏数据（字符串金额）参与求和，无法解析的不参与', () => {
    const source: Row[] = [
      { category: '硬件', region: '华东', sales: '1,000' },
      { category: '硬件', region: '华东', sales: '待定' },
      { category: '硬件', region: '华东', sales: 500 },
    ];
    const result = pivot(source, {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    expect(result.rows[0]?.values[result.columns[0]!.key]).toBe(1500);
    expect(result.rows[0]?.counts[result.columns[0]!.key]).toBe(3);
  });

  it('空输入：没有行维组合就没有行，总计列仍然在，全表合计是 0', () => {
    const result = pivot([], {
      dataset,
      measures: [sumSales],
      pivotColumns: ['category'],
      rowDimensions: ['region'],
    });
    expect(result.rows).toEqual([]);
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0]).toMatchObject({
      label: '总计',
      metricKey: 'sum_sales',
      parts: [],
    });
    expect(result.columnTotals).toEqual({});
    expect(result.grandTotals).toEqual({ sum_sales: 0 });
  });
});
