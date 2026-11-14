import type { DatasetSpec, QuerySpec, Row } from '../../src/report/core/types';

import { describe, expect, it } from 'vitest';

import {
  aggregate,
  applyAgg,
  applyReportFilters,
  measureColumnKey,
} from '../../src/report/core/aggregate';

/**
 * 聚合引擎是整包的承重墙，测得最厚：每种聚合、空值口径、多键分组、并列稳定性、
 * having、limit、合计、占比列各自一条，断言全部落到具体数字。
 */

const dataset: DatasetSpec = {
  fields: [
    { dataType: 'date', key: 'date', kind: 'dimension', label: '日期' },
    { key: 'region', kind: 'dimension', label: '区域' },
    { key: 'channel', kind: 'dimension', label: '渠道' },
    {
      aggregator: 'sum',
      dataType: 'number',
      key: 'sales',
      kind: 'measure',
      label: '销售额',
    },
    {
      aggregator: 'sum',
      dataType: 'number',
      key: 'qty',
      kind: 'measure',
      label: '单量',
    },
    { key: 'memo', kind: 'dimension', label: '备注' },
  ],
  id: 'ds-test',
  name: '测试集',
  source: 'static',
};

const rows: Row[] = [
  {
    channel: '直营',
    date: '2026-01-01',
    memo: 'A',
    qty: 2,
    region: '华东',
    sales: 100,
  },
  {
    channel: '渠道',
    date: '2026-01-02',
    memo: 'B',
    qty: 1,
    region: '华东',
    sales: 50,
  },
  {
    channel: '直营',
    date: '2026-01-01',
    memo: 'C',
    qty: '3',
    region: '华北',
    sales: 70,
  },
  {
    channel: '渠道',
    date: '2026-01-03',
    memo: null,
    qty: 4,
    region: '华北',
    sales: null,
  },
  {
    channel: '直营',
    date: '2026-01-02',
    memo: 'A',
    qty: 1,
    region: null,
    sales: 20,
  },
];

function query(overrides: Partial<QuerySpec> = {}): QuerySpec {
  return {
    datasetId: 'ds-test',
    dimensions: ['region'],
    measures: [{ agg: 'sum', alias: 'sum_sales', field: 'sales' }],
    ...overrides,
  };
}

describe('applyAgg 单列聚合', () => {
  it('sum 跳过不可解析的值而不是当 0，avg 的分母跟着可解析个数走', () => {
    expect(applyAgg('sum', [1, 2, 3])).toBe(6);
    expect(applyAgg('sum', [1, '2', null, undefined, 'N/A', true, ''])).toBe(3);
    expect(applyAgg('avg', [1, 3, null, 'x'])).toBe(2);
    // 字符串先剥千分位与货币符号：接口直接下发已格式化金额的情况太常见
    expect(applyAgg('sum', ['1,200.5', '¥99.5'])).toBe(1300);
    // 负号可以在币种前面（formatValue 的输出），也可以在手填数据里跟在币种后
    expect(applyAgg('sum', ['-¥1,000', '¥-500'])).toBe(-1500);
    // `%` 后缀按百分比读数：12% 记作 0.12，与 formatValue 的 percent 输出成对
    expect(applyAgg('sum', ['12%', '1,000'])).toBe(1000.12);
    // 夹在中间的货币符号视为脏数据，不把两段数字拼成一个
    expect(applyAgg('sum', ['1¥2'])).toBe(0);
    // 空集合走"中性元"：sum/count 是 0，其余是 null（渲染成 —）
    expect(applyAgg('sum', [])).toBe(0);
    expect(applyAgg('avg', [])).toBeNull();
    expect(applyAgg('max', [])).toBeNull();
  });

  it('count 数填过的单元格（空串算没填，0 / false / "N/A" 都算填了）', () => {
    expect(applyAgg('count', [1, null, '', undefined, 0])).toBe(2);
    expect(applyAgg('count', ['N/A', false, 'x', null])).toBe(3);
    expect(applyAgg('countDistinct', ['a', 'a', 'b', null, 'b'])).toBe(2);
    expect(applyAgg('countDistinct', [1, '1', 2])).toBe(2);
    expect(applyAgg('countDistinct', [true, false, true])).toBe(2);
  });

  it('median 奇偶两种取法，偶数个取中间两者的算术平均', () => {
    expect(applyAgg('median', [5, 1, 3])).toBe(3);
    expect(applyAgg('median', [4, 1, 2, 3])).toBe(2.5);
    expect(applyAgg('median', [10, 'N/A', null])).toBe(10);
    expect(applyAgg('min', [5, 1, 3])).toBe(1);
    expect(applyAgg('max', [5, 1, 3])).toBe(5);
  });

  it('first/last 按输入顺序取第一个/最后一个有值的单元格，并保留原始类型', () => {
    expect(applyAgg('first', [null, '', 'x', 'y'])).toBe('x');
    expect(applyAgg('last', ['x', 'y', null])).toBe('y');
    expect(applyAgg('last', [new Date('2026-01-01T00:00:00Z')])).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(applyAgg('first', [])).toBeNull();
  });
});

describe('aggregate 分组', () => {
  it('按区域分组求和，维度标签与列 key 都取字段元信息', () => {
    const result = aggregate(rows, query(), dataset);
    expect(result.columns.map((column) => column.key)).toEqual([
      'region',
      'sum_sales',
    ]);
    expect(result.columns[0]?.label).toBe('区域');
    expect(result.rows.map((row) => row.region)).toEqual([
      '华东',
      '华北',
      '未分类',
    ]);
    expect(result.rows.map((row) => row.sum_sales)).toEqual([150, 70, 20]);
  });

  it('null / undefined / 空串归到同一个「未分类」桶', () => {
    const source: Row[] = [
      { region: null, sales: 1 },
      { region: undefined, sales: 2 },
      { region: '', sales: 4 },
      { region: '华东', sales: 8 },
    ];
    const result = aggregate(source, query(), dataset);
    expect(result.rows).toEqual([
      { region: '华东', sum_sales: 8 },
      { region: '未分类', sum_sales: 7 },
    ]);
  });

  it('多键分组：先区域再渠道，四组各自的样本数能从 count 读出来', () => {
    const result = aggregate(
      rows,
      query({ dimensions: ['region', 'channel'] }),
      dataset,
    );
    // 次序是 UTF-16 码元序：渠道(U+6E20) 排在 直营(U+76F4) 之前，未分类(U+672A) 在 华东/华北 之后
    expect(result.rows.map((row) => `${row.region}/${row.channel}`)).toEqual([
      '华东/渠道',
      '华东/直营',
      '华北/渠道',
      '华北/直营',
      '未分类/直营',
    ]);
    expect(result.rows[0]).toMatchObject({
      channel: '渠道',
      region: '华东',
      sum_sales: 50,
    });
    expect(result.totals).toEqual({ sum_sales: 240 });
  });

  it('没起别名时列 key 是 agg_field，同字段两种聚合不会撞车', () => {
    expect(measureColumnKey({ agg: 'sum', field: 'sales' })).toBe('sum_sales');
    const result = aggregate(
      rows,
      query({
        measures: [
          { agg: 'sum', field: 'sales' },
          { agg: 'avg', field: 'sales' },
        ],
      }),
      dataset,
    );
    expect(result.columns.map((column) => column.key)).toEqual([
      'region',
      'sum_sales',
      'avg_sales',
    ]);
    expect(result.columns[1]?.label).toBe('求和(销售额)');
  });

  it('字符串数值（"3"）参与求和，脏值不参与', () => {
    const result = aggregate(
      rows,
      query({ measures: [{ agg: 'sum', alias: 'sum_qty', field: 'qty' }] }),
      dataset,
    );
    expect(result.totals?.sum_qty).toBe(11);
  });
});

describe('aggregate 过滤 / having / 排序 / limit', () => {
  it('行级过滤走 @antdv/graph 的受限求值器，支持内置函数', () => {
    const result = aggregate(
      rows,
      query({ filters: [{ expr: 'sales >= 50' }] }),
      dataset,
    );
    expect(result.totals).toEqual({ sum_sales: 220 });
    const byFunction = aggregate(
      rows,
      query({ filters: [{ expr: 'contains(region, "北")' }] }),
      dataset,
    );
    expect(byFunction.rows).toEqual([{ region: '华北', sum_sales: 70 }]);
  });

  it('表达式语法错误直接抛出来，不静默当成"全通过"', () => {
    expect(() =>
      aggregate(rows, query({ filters: [{ expr: 'sales >' }] }), dataset),
    ).toThrow();
  });

  it('having 支持表达式写法', () => {
    const result = aggregate(
      rows,
      query({ having: { expr: 'sum_sales > 100' } }),
      dataset,
    );
    expect(result.rows.map((row) => row.region)).toEqual(['华东']);
  });

  it('having 的简单比较糖：值不会被拼回表达式里二次解析（防注入）', () => {
    const result = aggregate(
      rows,
      query({ having: { field: 'sum_sales', op: '>=', value: 70 } }),
      dataset,
    );
    expect(result.rows.map((row) => row.sum_sales)).toEqual([150, 70]);
    const text = aggregate(
      [
        { region: '华东', sales: 1 },
        { region: '华北', sales: 2 },
      ],
      query({ having: { field: 'sum_sales', op: '==', value: "1' || 1==1" } }),
      dataset,
    );
    expect(text.rows).toHaveLength(0);
  });

  it('默认按维度字典序升序，两次调用结果完全一致', () => {
    const first = aggregate(rows, query(), dataset).rows.map(
      (row) => row.region,
    );
    const second = aggregate(rows, query(), dataset).rows.map(
      (row) => row.region,
    );
    expect(first).toEqual(second);
    expect(first).toEqual(['华东', '华北', '未分类']);
  });

  it('排序并列时按维度字典序兜底，不会因为 Map 插入顺序而抖', () => {
    const source: Row[] = [
      { region: '华北', sales: 10 },
      { region: '华东', sales: 10 },
      { region: '华南', sales: 5 },
    ];
    const result = aggregate(
      source,
      query({ sort: [{ dir: 'desc', field: 'sum_sales' }] }),
      dataset,
    );
    expect(result.rows.map((row) => row.region)).toEqual([
      '华东',
      '华北',
      '华南',
    ]);
  });

  it('按度量降序时并列同样落到维度字典序，且空值不参与争榜首', () => {
    const source: Row[] = [
      { region: '甲', sales: 10 },
      { region: '乙', sales: 10 },
      { region: '丙', sales: 30 },
    ];
    const result = aggregate(
      source,
      query({ sort: [{ dir: 'desc', field: 'sum_sales' }] }),
      dataset,
    );
    // 并列时按码元序升序兜底：丙(U+4E19) < 乙(U+4E59) < 甲(U+7532)
    expect(result.rows.map((row) => row.region)).toEqual(['丙', '乙', '甲']);
  });

  it('空值不参与争榜首：降序时缺失度量的分组始终排在最后', () => {
    const source: Row[] = [
      { region: '甲', sales: null },
      { region: '乙', sales: 1 },
      { region: '丙', sales: undefined },
      { region: '丁', sales: 5 },
    ];
    const result = aggregate(
      source,
      query({ sort: [{ dir: 'desc', field: 'sum_sales' }] }),
      dataset,
    );
    expect(result.rows.map((row) => row.region)).toEqual([
      '丁',
      '乙',
      '丙',
      '甲',
    ]);
  });

  it('limit 只截结果行，合计仍是全集合计', () => {
    const result = aggregate(rows, query({ limit: 2 }), dataset);
    expect(result.rows).toHaveLength(2);
    expect(result.totals).toEqual({ sum_sales: 240 });
  });

  it('limit 0 给出空结果但仍带合计', () => {
    const result = aggregate(rows, query({ limit: 0 }), dataset);
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({ sum_sales: 240 });
  });

  it('options.totals=false 时不算 rollup', () => {
    const result = aggregate(rows, query(), dataset, { totals: false });
    expect(result.totals).toBeUndefined();
  });
});

describe('aggregate 占比列与空集', () => {
  it('percentOfTotal 追加 _pct 列，值是分母为全集合计的分数', () => {
    const result = aggregate(rows, query(), dataset, { percentOfTotal: true });
    expect(result.columns.map((column) => column.key)).toEqual([
      'region',
      'sum_sales',
      'sum_sales_pct',
    ]);
    expect(result.rows[0]?.sum_sales_pct).toBeCloseTo(0.625, 10);
    expect(result.rows[2]?.sum_sales_pct).toBeCloseTo(20 / 240, 10);
    expect(result.columns[2]?.format).toEqual({ decimals: 2, kind: 'percent' });
  });

  it('total 为 0 时占比给 null，不给 NaN 或 Infinity', () => {
    const zero: Row[] = [{ region: '华东', sales: 0 }];
    const result = aggregate(zero, query(), dataset, { percentOfTotal: true });
    expect(result.rows[0]?.sum_sales_pct).toBeNull();
  });

  it('空输入集：列结构仍在，行是空数组，sum/count 类合计为 0', () => {
    const result = aggregate(
      [],
      query({
        measures: [
          { agg: 'sum', alias: 'sum_sales', field: 'sales' },
          { agg: 'count', alias: 'count_sales', field: 'sales' },
          { agg: 'avg', alias: 'avg_sales', field: 'sales' },
        ],
      }),
      dataset,
    );
    expect(result.columns.map((column) => column.key)).toEqual([
      'region',
      'sum_sales',
      'count_sales',
      'avg_sales',
    ]);
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({
      avg_sales: null,
      count_sales: 0,
      sum_sales: 0,
    });
  });

  it('无维度分组时整体折成一行', () => {
    const result = aggregate(rows, query({ dimensions: [] }), dataset);
    expect(result.rows).toEqual([{ sum_sales: 240 }]);
  });
});

describe('applyReportFilters 报表级过滤器', () => {
  const source: Row[] = [
    { date: '2026-01-01', region: '华东', sales: 100, channel: '直营' },
    { date: '2026-01-10', region: '华北', sales: 50, channel: '渠道' },
    { date: '2026-02-01', region: '华南', sales: 20, channel: '直营' },
  ];

  it('between 是闭区间且两端可缺', () => {
    const hit = applyReportFilters(
      source,
      [{ field: 'date', kind: 'between' }],
      { date: ['2026-01-05', '2026-01-20'] },
    );
    expect(hit).toHaveLength(1);
    expect(hit[0]?.region).toBe('华北');
    const open = applyReportFilters(
      source,
      [{ field: 'sales', kind: 'between' }],
      { sales: [50, null] },
    );
    expect(open.map((row) => row.region)).toEqual(['华东', '华北']);
  });

  it('in 命中列表之一；空数组视为不启用', () => {
    expect(
      applyReportFilters(source, [{ field: 'region', kind: 'in' }], {
        region: ['华东', '华南'],
      }),
    ).toHaveLength(2);
    expect(
      applyReportFilters(source, [{ field: 'region', kind: 'in' }], {
        region: [],
      }),
    ).toHaveLength(3);
  });

  it('select 标量精确匹配，数字与字符串同形也算命中', () => {
    expect(
      applyReportFilters(source, [{ field: 'region', kind: 'select' }], {
        region: '华北',
      }),
    ).toHaveLength(1);
    expect(
      applyReportFilters(source, [{ field: 'sales', kind: 'select' }], {
        sales: '100',
      }),
    ).toHaveLength(1);
  });

  it('number 支持 {min,max} 区间与标量精确值', () => {
    expect(
      applyReportFilters(source, [{ field: 'sales', kind: 'number' }], {
        sales: { max: 90, min: 30 },
      }),
    ).toHaveLength(1);
    expect(
      applyReportFilters(source, [{ field: 'sales', kind: 'number' }], {
        sales: 20,
      }),
    ).toHaveLength(1);
  });

  it('text 做大小写不敏感的子串匹配；值为空串时不过滤', () => {
    expect(
      applyReportFilters(source, [{ field: 'channel', kind: 'text' }], {
        channel: '直',
      }),
    ).toHaveLength(2);
    expect(
      applyReportFilters(source, [{ field: 'channel', kind: 'text' }], {
        channel: '  ',
      }),
    ).toHaveLength(3);
  });

  it('多个过滤器是「与」关系，且没赋值的过滤器不参与', () => {
    const filters = [
      { field: 'region', kind: 'select' as const },
      { field: 'sales', kind: 'number' as const },
    ];
    expect(
      applyReportFilters(source, filters, { region: '华东' }),
    ).toHaveLength(1);
    expect(
      applyReportFilters(source, filters, { region: '华东', sales: 50 }),
    ).toHaveLength(0);
  });
});
