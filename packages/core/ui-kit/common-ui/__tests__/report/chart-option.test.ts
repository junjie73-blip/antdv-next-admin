import type {
  QueryResult,
  ResultColumn,
  Row,
  WidgetSpec,
} from '../../src/report/core/types';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHART_TYPE,
  toEChartsOption,
} from '../../src/report/core/chart-option';

/**
 * 图形映射是「只翻译不画图」的一层，所以断言全部落在 option 对象的形状上：
 * 类目轴取哪几列、脏值是不是变成断点、双轴 / 堆叠 / 饼图各长什么样。
 * 这些断言不需要 echarts 实例，因此可以在 jsdom 之外（甚至 Node 里）跑。
 */

const dimensionColumns: ResultColumn[] = [
  { field: 'region', key: 'region', kind: 'dimension', label: '区域' },
  { field: 'channel', key: 'channel', kind: 'dimension', label: '渠道' },
];
const measureColumns: ResultColumn[] = [
  { agg: 'sum', key: 'sum_sales', kind: 'measure', label: '求和(销售额)' },
  { agg: 'avg', key: 'avg_rate', kind: 'measure', label: '平均(退款率)' },
];

function result(
  rows: Row[],
  columns: ResultColumn[] = [...dimensionColumns, ...measureColumns],
): QueryResult {
  return { columns, rows };
}

function chartWidget(options: WidgetSpec['options'] = {}): WidgetSpec {
  return {
    id: 'w1',
    layout: { h: 8, w: 6, x: 0, y: 0 },
    options,
    type: 'chart',
  };
}

const rows: Row[] = [
  { avg_rate: 0.1, channel: '直营', region: '华东', sum_sales: 100 },
  { avg_rate: null, channel: '渠道', region: '华北', sum_sales: '1,200.5' },
  { avg_rate: 0.3, channel: null, region: null, sum_sales: 'N/A' },
];

describe('通用映射', () => {
  it('缺省图形是柱状；第一维度当类目轴，其余维度拼进标签而不是丢掉', () => {
    const option = toEChartsOption(result(rows), chartWidget());
    expect(DEFAULT_CHART_TYPE).toBe('bar');
    expect(option.xAxis).toEqual({
      data: ['华东 / 直营', '华北 / 渠道', '未分类 / 未分类'],
      type: 'category',
    });
    expect(option.series).toHaveLength(2);
    expect(option.series[0]).toMatchObject({
      name: '求和(销售额)',
      type: 'bar',
    });
    expect(option.yAxis).toEqual({ type: 'value' });
    expect(option.legend).toEqual({
      data: ['求和(销售额)', '平均(退款率)'],
      top: 0,
    });
    expect(option.tooltip).toEqual({ trigger: 'axis' });
  });

  it('字符串金额读回数值，读不回的给 null 形成断点而不是 0', () => {
    const [sales] = toEChartsOption(result(rows), chartWidget()).series;
    expect(sales?.data).toEqual([100, 1200.5, null]);
    expect(sales?.data).not.toContain(0);
  });

  it('没有维度时类目轴只有「合计」一个点', () => {
    const option = toEChartsOption(
      result([{ sum_sales: 5 }], measureColumns),
      chartWidget(),
    );
    expect(option.xAxis).toEqual({ data: ['合计'], type: 'category' });
    expect(option.series[0]?.data).toEqual([5]);
  });

  it('空结果集也给结构完整的 option：列定义还在，series 是空数据的两条', () => {
    const option = toEChartsOption(result([]), chartWidget());
    expect(option.series).toEqual([
      { data: [], name: '求和(销售额)', type: 'bar' },
      { data: [], name: '平均(退款率)', type: 'bar' },
    ]);
    expect(option.xAxis).toEqual({ data: [], type: 'category' });
    expect(option.legend).toEqual({
      data: ['求和(销售额)', '平均(退款率)'],
      top: 0,
    });
  });

  it('未注入 palette 时 option 里没有 color 键，也没有任何十六进制颜色', () => {
    const option = toEChartsOption(result(rows), chartWidget());
    expect(option).not.toHaveProperty('color');
    expect(JSON.stringify(option)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('注入 palette 时原样复制一份，避免宿主数组被下游改写', () => {
    const palette = ['token-a', 'token-b'];
    const option = toEChartsOption(result(rows), chartWidget(), { palette });
    expect(option.color).toEqual(['token-a', 'token-b']);
    expect(option.color).not.toBe(palette);
    // 空数组视为「不指定」，交给 ECharts 默认色板
    expect(
      toEChartsOption(result(rows), chartWidget(), { palette: [] }),
    ).not.toHaveProperty('color');
  });
});

describe('area / line / stack', () => {
  it('area 不是独立 series 类型，是 line + areaStyle', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'area' }),
    );
    expect(option.series.map((series) => series.type)).toEqual([
      'line',
      'line',
    ]);
    expect(option.series[0]).toHaveProperty('areaStyle', {});
  });

  it('stack=true 时同类目相加，两条 series 共用一个 stack 名', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'line', stack: true }),
    );
    expect(option.series.map((series) => series.stack)).toEqual([
      'total',
      'total',
    ]);
  });

  it('scatter 不堆叠：叠起来的散点图是错图', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'scatter', stack: true }),
    );
    expect(option.series[0]).not.toHaveProperty('stack');
  });
});

describe('右轴（双轴）', () => {
  it('只有命中的度量走第二根轴，第二根轴关掉分割线防止两套刻度打架', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ rightAxis: ['avg_rate'] }),
    );
    expect(option.series[0]).not.toHaveProperty('yAxisIndex');
    expect(option.series[1]).toMatchObject({ yAxisIndex: 1 });
    expect(option.yAxis).toEqual([
      { type: 'value' },
      { splitLine: { show: false }, type: 'value' },
    ]);
  });

  it('rightAxis 全空时退回单轴', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ rightAxis: [] }),
    );
    expect(option.yAxis).toEqual({ type: 'value' });
  });
});

describe('pie', () => {
  it('只取第一个度量，值变成 name/value 数据点，且不带坐标轴', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'pie' }),
    );
    expect(option.series).toEqual([
      {
        data: [
          { name: '华东 / 直营', value: 100 },
          { name: '华北 / 渠道', value: 1200.5 },
          { name: '未分类 / 未分类', value: null },
        ],
        name: '求和(销售额)',
        radius: ['40%', '68%'],
        type: 'pie',
      },
    ]);
    expect(option).not.toHaveProperty('xAxis');
    expect(option).not.toHaveProperty('yAxis');
    expect(option).not.toHaveProperty('legend');
    expect(option.tooltip).toEqual({ trigger: 'item' });
  });

  it('饼图不吃 stack / rightAxis，避免生成 ECharts 认不出的键', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'pie', rightAxis: ['sum_sales'], stack: true }),
    );
    expect(option.series[0]).not.toHaveProperty('stack');
    expect(option.series[0]).not.toHaveProperty('yAxisIndex');
  });

  it('没有度量时饼图是空数据，series 结构仍在', () => {
    const option = toEChartsOption(
      result([{ region: '华东' }], dimensionColumns),
      chartWidget({ chartType: 'pie' }),
    );
    expect(option.series).toEqual([
      { data: [], name: '数值', radius: ['40%', '68%'], type: 'pie' },
    ]);
  });
});

describe('scatter', () => {
  it('值是 [类目序号, 数值] 的配对，脏值仍然是 null', () => {
    const option = toEChartsOption(
      result(rows),
      chartWidget({ chartType: 'scatter' }),
    );
    expect(option.series[0]?.data).toEqual([
      [0, 100],
      [1, 1200.5],
      [2, null],
    ]);
    expect(option.series[0]?.type).toBe('scatter');
  });
});
