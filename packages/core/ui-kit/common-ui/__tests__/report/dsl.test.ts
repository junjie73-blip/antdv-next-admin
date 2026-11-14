import type {
  DatasetSpec,
  ReportSpec,
  WidgetSpec,
} from '../../src/report/core/types';

import { describe, expect, it } from 'vitest';

import {
  autoLayout,
  cloneReport,
  createEmptyReport,
  createWidget,
  CURRENT_SPEC_VERSION,
  DEFAULT_GRID_COLUMNS,
  isReportSpec,
  nextReportId,
  relayout,
  ReportDslError,
  upgradeSpec,
  validateReportSpec,
} from '../../src/report/core/dsl';

/**
 * DSL 体检的测试原则：每条规则至少一条断言，并且都检查 `code` + `widgetId`（设计器要靠这两个字段高亮那一格）。
 * 另外专门有一条"多条问题一次报全"，因为 validateReportSpec 的返回数组而不是抛错就是为它设计的。
 */

const dataset: DatasetSpec = {
  fields: [
    { key: 'region', kind: 'dimension', label: '区域' },
    { key: 'date', kind: 'dimension', label: '日期' },
    { dataType: 'number', key: 'sales', kind: 'measure', label: '销售额' },
  ],
  id: 'ds-1',
  name: '销售',
  source: 'static',
};

function widget(overrides: Partial<WidgetSpec> = {}): WidgetSpec {
  return {
    id: 'w1',
    layout: { h: 6, w: 6, x: 0, y: 0 },
    query: {
      datasetId: 'ds-1',
      dimensions: ['region'],
      measures: [{ agg: 'sum', field: 'sales' }],
    },
    type: 'chart',
    ...overrides,
  };
}

function report(
  widgets: WidgetSpec[],
  overrides: Partial<ReportSpec> = {},
): ReportSpec {
  return {
    datasets: [dataset],
    filters: [],
    id: 'r1',
    name: '测试报表',
    version: CURRENT_SPEC_VERSION,
    widgets,
    ...overrides,
  };
}

function codesOf(spec: ReportSpec, columns?: number): string[] {
  return validateReportSpec(spec, { columns }).map((issue) => issue.code);
}

describe('validateReportSpec 通过路径', () => {
  it('合法报表零问题；空 widgets 也是合法的（新建时就是这个状态）', () => {
    expect(validateReportSpec(report([widget()]))).toEqual([]);
    expect(validateReportSpec(report([]))).toEqual([]);
  });

  it('text widget 允许没有 query，其他类型必须有', () => {
    expect(
      validateReportSpec(report([widget({ query: undefined, type: 'text' })])),
    ).toEqual([]);
    expect(codesOf(report([widget({ query: undefined })]))).toEqual([
      'widget-query-missing',
    ]);
  });
});

describe('validateReportSpec 诊断规则', () => {
  it('widget id 重复：报一条并带上 id', () => {
    const issues = validateReportSpec(
      report([
        widget({ layout: { h: 4, w: 6, x: 0, y: 0 } }),
        widget({ layout: { h: 4, w: 6, x: 6, y: 0 } }),
        widget({ id: 'w2', layout: { h: 4, w: 12, x: 0, y: 4 } }),
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'widget-id-duplicate',
      level: 'error',
      widgetId: 'w1',
    });
  });

  it('栅格：负坐标与零宽高算不合法', () => {
    expect(
      codesOf(report([widget({ layout: { h: 6, w: 6, x: -1, y: 0 } })])),
    ).toEqual(['layout-out-of-bounds']);
    expect(
      codesOf(report([widget({ layout: { h: 0, w: 6, x: 0, y: 0 } })])),
    ).toEqual(['layout-out-of-bounds']);
  });

  it('栅格：宽度超出列数', () => {
    const issues = validateReportSpec(
      report([widget({ layout: { h: 4, w: 8, x: 6, y: 0 } })]),
      { columns: 12 },
    );
    expect(issues[0]).toMatchObject({
      code: 'layout-out-of-bounds',
      widgetId: 'w1',
    });
    expect(issues[0]!.message).toContain('12');
    // 同一份 spec 放在 24 列栅格里就不越界
    expect(
      validateReportSpec(
        report([widget({ layout: { h: 4, w: 8, x: 6, y: 0 } })]),
        { columns: 24 },
      ),
    ).toEqual([]);
  });

  it('栅格：两格重叠只报一条，定位到前一个 widget', () => {
    const issues = validateReportSpec(
      report([
        widget({ layout: { h: 4, w: 6, x: 0, y: 0 } }),
        widget({ id: 'w2', layout: { h: 4, w: 6, x: 3, y: 2 } }),
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'layout-overlap', widgetId: 'w1' });
  });

  it('栅格：刚好相接（右边界 = 下一格左边界）不算重叠', () => {
    expect(
      validateReportSpec(
        report([
          widget({ layout: { h: 4, w: 6, x: 0, y: 0 } }),
          widget({ id: 'w2', layout: { h: 4, w: 6, x: 6, y: 0 } }),
        ]),
      ),
    ).toEqual([]);
  });

  it('引用不存在的数据集后不再深挖字段，避免一份错 spec 刷屏', () => {
    const issues = validateReportSpec(
      report([
        widget({
          query: {
            datasetId: 'ds-x',
            dimensions: ['nope'],
            measures: [{ agg: 'sum', field: 'nope' }],
          },
        }),
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'dataset-unknown',
      datasetId: 'ds-x',
      widgetId: 'w1',
    });
  });

  it('没有度量：只会得到一串分组，属于要提醒的配置错误', () => {
    const issues = validateReportSpec(
      report([
        widget({
          query: { datasetId: 'ds-1', dimensions: ['region'], measures: [] },
        }),
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('query-missing-measures');
  });

  it('维度字段不存在 / 度量当维度 / 度量字段不存在，三种都报 field-unknown 或 measure-as-dimension', () => {
    const issues = validateReportSpec(
      report([
        widget({
          id: 'w1',
          query: {
            datasetId: 'ds-1',
            dimensions: ['ghost', 'sales'],
            measures: [{ agg: 'sum', field: 'ghost' }],
          },
        }),
      ]),
    );
    expect(issues.map((issue) => [issue.code, issue.field])).toEqual([
      ['field-unknown', 'ghost'],
      ['measure-as-dimension', 'sales'],
      ['field-unknown', 'ghost'],
    ]);
    expect(issues.every((issue) => issue.widgetId === 'w1')).toBe(true);
  });

  it('过滤器字段不存在时带上 datasetId；报表没有数据集时另有一条', () => {
    const issues = validateReportSpec(
      report([widget()], { filters: [{ field: 'ghost', kind: 'select' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'filter-field-unknown',
      datasetId: 'ds-1',
      field: 'ghost',
    });

    const orphan = validateReportSpec(
      report([], {
        datasets: [],
        filters: [{ field: 'region', kind: 'select' }],
      }),
    );
    expect(orphan).toHaveLength(1);
    expect(orphan[0]!.code).toBe('filter-field-unknown');
    // 报表级问题不定位到任何 widget，也没有 datasetId 可带
    expect(orphan[0]).not.toHaveProperty('datasetId');
    expect(orphan[0]).not.toHaveProperty('widgetId');
  });

  it('过滤器默认落在第一个数据集，显式 datasetId 优先', () => {
    const second: DatasetSpec = {
      ...dataset,
      fields: [{ key: 'channel', kind: 'dimension', label: '渠道' }],
      id: 'ds-2',
    };
    const spec = report([widget()], {
      datasets: [dataset, second],
      filters: [
        { datasetId: 'ds-2', field: 'channel', kind: 'select' },
        { datasetId: 'ds-2', field: 'region', kind: 'select' },
      ],
    });
    const issues = validateReportSpec(spec);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ datasetId: 'ds-2', field: 'region' });
  });

  it('一次报全所有问题，顺序稳定：重复 id → 布局 → 查询 → 过滤器', () => {
    const spec = report(
      [
        widget({ layout: { h: 6, w: 99, x: 0, y: 0 } }),
        widget({
          id: 'w1',
          query: { datasetId: 'ds-no', dimensions: [], measures: [] },
          layout: { h: 6, w: 6, x: 0, y: 6 },
        }),
      ],
      { filters: [{ field: 'ghost', kind: 'text' }] },
    );
    expect(codesOf(spec)).toEqual([
      'widget-id-duplicate',
      'layout-out-of-bounds',
      'dataset-unknown',
      'filter-field-unknown',
    ]);
  });
});

describe('autoLayout / relayout', () => {
  it('缺省列数是 12，且默认就是 12 列', () => {
    expect(DEFAULT_GRID_COLUMNS).toBe(12);
    expect(autoLayout([])).toEqual([]);
  });

  it('顺序流式：两个半宽并排，第三个换行到最矮列', () => {
    const layouts = autoLayout([
      { layout: { h: 4, w: 6, x: 0, y: 0 } },
      { layout: { h: 4, w: 6, x: 0, y: 0 } },
      { layout: { h: 2, w: 6, x: 0, y: 0 } },
    ]);
    expect(layouts).toEqual([
      { h: 4, w: 6, x: 0, y: 0 },
      { h: 4, w: 6, x: 6, y: 0 },
      { h: 2, w: 6, x: 0, y: 4 },
    ]);
  });

  it('窄块往坑里填：先放一个 1/12，之后的宽块绕到它右边', () => {
    const layouts = autoLayout(
      [
        { layout: { h: 2, w: 1, x: 0, y: 0 } },
        { layout: { h: 2, w: 3, x: 0, y: 0 } },
      ],
      12,
    );
    expect(layouts).toEqual([
      { h: 2, w: 1, x: 0, y: 0 },
      { h: 2, w: 3, x: 1, y: 0 },
    ]);
  });

  it('宽度超界的块被夹到列数内，高度与宽度至少为 1', () => {
    const [one] = autoLayout([{ layout: { h: 0, w: 99, x: 0, y: 0 } }], 12);
    expect(one).toEqual({ h: 1, w: 12, x: 0, y: 0 });
  });

  it('relayout 不改 widget 内容只压布局，且不修改传入的 spec', () => {
    const spec = report([
      widget({ layout: { h: 4, w: 12, x: 0, y: 99 } }),
      widget({ id: 'w2', layout: { h: 4, w: 12, x: 0, y: 200 } }),
    ]);
    const before = JSON.parse(JSON.stringify(spec)) as ReportSpec;
    const next = relayout(spec, 12);
    expect(next.widgets.map((item) => item.layout)).toEqual([
      { h: 4, w: 12, x: 0, y: 0 },
      { h: 4, w: 12, x: 0, y: 4 },
    ]);
    expect(next.widgets[0]).toEqual({
      ...before.widgets[0],
      layout: { h: 4, w: 12, x: 0, y: 0 },
    });
    expect(spec.widgets[0]!.layout.y).toBe(99);
    expect(validateReportSpec(next)).toEqual([]);
  });
});

describe('createWidget / id / 空报表 / 克隆', () => {
  it('各类型的默认尺寸不同，text 没有 query，chart 缺省 bar', () => {
    const kpi = createWidget('k1', 'kpi', {
      datasetId: 'ds-1',
      measures: [{ agg: 'sum', field: 'sales' }],
    });
    expect(kpi.layout).toEqual({ h: 4, w: 3, x: 0, y: 0 });
    expect(kpi.query).toEqual({
      datasetId: 'ds-1',
      dimensions: [],
      measures: [{ agg: 'sum', field: 'sales' }],
    });

    const text = createWidget('t1', 'text', { title: '口径说明' });
    expect(text.query).toBeUndefined();
    expect(text.options).toEqual({ text: '口径说明' });

    const chart = createWidget('c1', 'chart');
    expect(chart.options).toEqual({ chartType: 'bar' });
    expect(chart.query).toEqual({
      datasetId: '',
      dimensions: [],
      measures: [],
    });
    expect(chart.title).toBeUndefined();
  });

  it('nextReportId 带前缀、连续调用不重复', () => {
    const ids = Array.from({ length: 20 }, () => nextReportId('widget'));
    expect(new Set(ids).size).toBe(20);
    expect(ids[0]!.startsWith('widget-')).toBe(true);
  });

  it('createEmptyReport 是合法 spec，可直接过校验', () => {
    const spec = createEmptyReport({ dataset, name: '新报表' });
    expect(spec.datasets).toEqual([dataset]);
    expect(spec.name).toBe('新报表');
    expect(spec.version).toBe(CURRENT_SPEC_VERSION);
    expect(validateReportSpec(spec)).toEqual([]);
  });

  it('cloneReport 深到 layout 对象，改副本不影响原本', () => {
    const spec = report([widget()]);
    const copy = cloneReport(spec);
    copy.widgets[0]!.layout.w = 3;
    copy.widgets[0]!.query!.dimensions.push('date');
    expect(spec.widgets[0]!.layout.w).toBe(6);
    expect(spec.widgets[0]!.query!.dimensions).toEqual(['region']);
  });

  it('isReportSpec 只认结构，不校验内容', () => {
    expect(isReportSpec(report([widget()]))).toBe(true);
    for (const value of [null, undefined, 1, 'r', [], {}, { id: 'r' }]) {
      expect(isReportSpec(value)).toBe(false);
    }
  });
});

describe('upgradeSpec 版本迁移', () => {
  const v1 = {
    datasets: [
      {
        fields: [
          { key: 'region', label: '区域', role: 'dim' },
          { aggregator: 'sum', key: 'sales', label: '销售额', role: 'metric' },
        ],
        id: 'ds-1',
        name: '销售',
        source: 'static',
      },
    ],
    id: 'r-old',
    name: '老报表',
    version: 1,
    widgets: [
      {
        id: 'w1',
        layout: { h: 6, w: 6, x: 0, y: 0 },
        options: { graphType: 'line', showTotals: true },
        query: {
          datasetId: 'ds-1',
          dimensions: ['region'],
          measures: ['sum:sales', 'avg:sales'],
        },
        type: 'graph',
      },
    ],
  };

  it('v1 → v2：measures 变对象、graph 并入 chart、role 变 kind', () => {
    const upgraded = upgradeSpec(v1, 1);
    expect(upgraded.version).toBe(2);
    const [chart] = upgraded.widgets;
    expect(chart?.type).toBe('chart');
    expect(chart?.options).toEqual({ chartType: 'line', showTotals: true });
    expect(chart?.query?.measures).toEqual([
      { agg: 'sum', field: 'sales' },
      { agg: 'avg', field: 'sales' },
    ]);
    expect(upgraded.datasets[0]?.fields).toEqual([
      { key: 'region', kind: 'dimension', label: '区域' },
      { aggregator: 'sum', key: 'sales', kind: 'measure', label: '销售额' },
    ]);
    // 迁移完就能过校验，说明迁移后的形状与校验器一致
    expect(validateReportSpec(upgraded)).toEqual([]);
  });

  it('迁移是幂等的：v2 再走一次 upgradeSpec 原样返回', () => {
    const once = upgradeSpec(v1, 1);
    expect(upgradeSpec(once, CURRENT_SPEC_VERSION)).toEqual(once);
    expect(once).not.toBe(v1);
  });

  it('高于本包的版本与缺迁移函数的版本都抛 ReportDslError', () => {
    expect(() => upgradeSpec(v1, CURRENT_SPEC_VERSION + 1)).toThrow(
      ReportDslError,
    );
    try {
      upgradeSpec(v1, 99);
    } catch (error) {
      expect(error).toBeInstanceOf(ReportDslError);
      expect((error as ReportDslError).code).toBe('unsupported-version');
      expect((error as Error).message).toContain('@antdv/common-ui/report');
    }
    expect(() => upgradeSpec(v1, 0)).toThrow(/缺少 v0 → v1/);
  });
});
