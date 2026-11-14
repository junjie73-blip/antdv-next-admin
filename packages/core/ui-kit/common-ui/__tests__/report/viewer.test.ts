import type { ReportDataSource } from '../../src/report/core/datasource';
import type {
  DatasetSpec,
  ReportSpec,
  Row,
  WidgetSpec,
} from '../../src/report/core/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it } from 'vitest';

import { configureReport, resetReportRuntime } from '../../src/report/config';
import { NULL_PLACEHOLDER } from '../../src/report/core/format';
import { ReportViewer } from '../../src/report/index';

/**
 * ReportViewer 只该做两件事：按栅格摆放 + 把 `useReportData` 的每格状态喂给 ReportWidget。
 * 所以这里用「显式 source」把取数固定成内存表，再把图表组件换成一个假组件（jsdom 没有 canvas，
 * 真的 ECharts 起不来；这是 `configureReport({ widgetChart })` 存在的第二个理由），
 * 断言落在 DOM 结构、三态与事件回抛上，不落在像素上。
 */

const dataset: DatasetSpec = {
  fields: [
    { key: 'region', kind: 'dimension', label: '区域' },
    { key: 'channel', kind: 'dimension', label: '渠道' },
    {
      dataType: 'number',
      format: { currency: 'CNY', decimals: 2, kind: 'currency' },
      key: 'sales',
      kind: 'measure',
      label: '销售额',
    },
    {
      aggregator: 'count',
      dataType: 'number',
      key: 'orders',
      kind: 'measure',
      label: '订单数',
    },
  ],
  id: 'ds-1',
  name: '销售明细',
  source: 'static',
};

const rows: Row[] = [
  { channel: '直营', region: '华东', sales: 100, orders: 2 },
  { channel: '渠道', region: '华东', sales: 50, orders: 1 },
  { channel: '直营', region: '华北', sales: 70, orders: 4 },
];

/** 记录调用次数与最后一次上下文，用来验证「合并请求」和「过滤器进参数」 */
function spySource(table: Row[] = rows) {
  const calls: Array<{ ctx: Record<string, unknown>; datasetId: string }> = [];
  const source: ReportDataSource = {
    load(specDataset, ctx) {
      calls.push({
        ctx: ctx as Record<string, unknown>,
        datasetId: specDataset.id,
      });
      return Promise.resolve(table);
    },
  };
  return { calls, source };
}

function widget(
  overrides: Partial<WidgetSpec> & Pick<WidgetSpec, 'id' | 'type'>,
): WidgetSpec {
  return {
    layout: { h: 8, w: 12, x: 0, y: 0 },
    query: {
      datasetId: 'ds-1',
      dimensions: ['region'],
      measures: [{ agg: 'sum', field: 'sales' }],
    },
    ...overrides,
  };
}

const spec: ReportSpec = {
  datasets: [dataset],
  filters: [{ field: 'region', kind: 'select', label: '区域' }],
  id: 'r-view',
  name: '渲染测试',
  version: 2,
  widgets: [
    widget({
      id: 'note',
      layout: { h: 2, w: 12, x: 0, y: 8 },
      options: { text: '口径：含税' },
      query: undefined,
      type: 'text',
    }),
    widget({
      id: 'chart',
      layout: { h: 8, w: 6, x: 3, y: 0 },
      options: { chartType: 'bar' },
      type: 'chart',
    }),
    widget({
      id: 'kpi',
      layout: { h: 4, w: 3, x: 0, y: 0 },
      query: {
        datasetId: 'ds-1',
        dimensions: [],
        measures: [{ agg: 'sum', field: 'sales' }],
      },
      title: '总销售额',
      type: 'kpi',
    }),
    widget({
      id: 'table',
      layout: { h: 8, w: 3, x: 9, y: 0 },
      query: {
        datasetId: 'ds-1',
        dimensions: ['region', 'channel'],
        measures: [
          { agg: 'sum', field: 'sales' },
          { agg: 'sum', field: 'orders' },
        ],
      },
      type: 'table',
    }),
  ],
};

const FakeChart = defineComponent({
  name: 'FakeChart',
  props: {
    height: { default: '300px', type: String },
    loading: { default: false, type: Boolean },
    option: { default: () => ({}), type: Object },
  },
  setup(props) {
    return () =>
      h('div', {
        'data-chart-height': props.height,
        'data-chart-loading': String(props.loading),
        'data-option': JSON.stringify(props.option),
        'data-slot': 'fake-chart',
      });
  },
});

function view(overrides: Record<string, unknown> = {}) {
  return mount(ReportViewer, {
    props: { spec, source: spySource().source, ...overrides },
  });
}

beforeEach(() => {
  resetReportRuntime();
  configureReport({ widgetChart: FakeChart });
});

describe('reportViewer 布局', () => {
  it('渲染栅格：DOM 顺序按 y、x 排，行列号来自 layout 而不是声明顺序', async () => {
    const wrapper = view();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-slot="report-viewer"]').exists()).toBe(true);
    expect(wrapper.attributes('data-widget-count')).toBe('4');

    const items = wrapper.findAll('[data-slot="report-widget"]');
    expect(items.map((item) => item.attributes('data-widget-id'))).toEqual([
      'kpi',
      'chart',
      'table',
      'note',
    ]);
    expect(items[0]!.attributes('style')).toContain('grid-column: 1 / span 3');
    expect(items[0]!.attributes('style')).toContain('grid-row: 1 / span 4');
    expect(items[3]!.attributes('style')).toContain('grid-row: 9 / span 2');

    const grid = wrapper.find('[data-slot="report-viewer"] > div');
    expect(grid.attributes('style')).toContain(
      'grid-template-columns: repeat(12, minmax(0, 1fr))',
    );
    expect(grid.attributes('style')).toContain('gap: 16px');
    expect(grid.attributes('style')).toContain('grid-auto-rows: 32px');
  });

  it('columns / gap / rowHeight 可覆盖，class 透传进 cn()', async () => {
    const wrapper = view({ columns: 24, gap: 8, rowHeight: 40 });
    wrapper.setProps({ class: 'report-demo' });
    await wrapper.vm.$nextTick();
    const grid = wrapper.find('[data-slot="report-viewer"] > div');
    expect(grid.attributes('style')).toContain('repeat(24, minmax(0, 1fr))');
    expect(grid.attributes('style')).toContain('gap: 8px');
    expect(grid.attributes('style')).toContain('grid-auto-rows: 40px');
    expect(wrapper.classes()).toContain('report-demo');
  });

  it('空报表给可解释的空态，而不是一个零高的栅格', () => {
    const wrapper = view({ spec: { ...spec, widgets: [] } });
    expect(wrapper.find('[data-slot="report-viewer-empty"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain('这张报表还是空的');
    expect(wrapper.find('[data-slot="report-widget"]').exists()).toBe(false);
  });
});

describe('reportViewer 三态', () => {
  it('加载中：每格先出骨架屏，不出图表', async () => {
    let release: (value: Row[]) => void = () => {};
    const source: ReportDataSource = {
      load: () =>
        new Promise<Row[]>((resolve) => {
          release = resolve;
        }),
    };
    const wrapper = view({ source });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('[data-slot="report-widget-loading"]')).toHaveLength(
      4,
    );
    expect(wrapper.find('[data-slot="fake-chart"]').exists()).toBe(false);
    expect(wrapper.find('[data-slot="report-widget-empty"]').exists()).toBe(
      false,
    );

    release(rows);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.findAll('[data-slot="report-widget-loading"]')).toHaveLength(
      0,
    );
    expect(wrapper.find('[data-slot="fake-chart"]').exists()).toBe(true);
  });

  it('取数失败：错误文本落在用到该数据集的每一格，而不是整页崩掉', async () => {
    const source: ReportDataSource = {
      load: () => Promise.reject(new Error('接口 500')),
    };
    const wrapper = view({ source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // 文本格没有 query，不参与取数，所以照常渲染
    expect(wrapper.findAll('[data-slot="report-widget-error"]')).toHaveLength(
      3,
    );
    expect(wrapper.text()).toContain('接口 500');
    expect(wrapper.text()).toContain('口径：含税');
  });

  it('没有命中任何行：图表位换成空态而不是空容器', async () => {
    const wrapper = view({ source: spySource([]).source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="fake-chart"]').exists()).toBe(false);
    expect(
      wrapper.findAll('[data-slot="report-widget-empty"]').length,
    ).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('暂无数据');
  });
});

describe('reportViewer 内容渲染', () => {
  it('指标卡按字段格式出数，图表收到映射后的 option', async () => {
    const wrapper = view();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const kpi = wrapper.find('[data-slot="report-widget-kpi"]');
    expect(kpi.text()).toContain('总销售额');
    expect(kpi.text()).toContain('¥220.00');

    const chart = wrapper.find('[data-slot="fake-chart"]');
    expect(chart.exists()).toBe(true);
    expect(chart.attributes('data-chart-height')).toBe('300px');
    const option = JSON.parse(chart.attributes('data-option') ?? '{}');
    expect(option.xAxis).toEqual({ data: ['华东', '华北'], type: 'category' });
    expect(option.series[0].data).toEqual([150, 70]);
    expect(option.series[0].type).toBe('bar');
  });

  /**
   * 「区间填反了 / 那个区域本来就没数」在业务里是"没数"，不是"卖了 0 元"。
   * 空集合的 `sum` 中性元是 0（`core/aggregate` 口径 1），表格与图表走空态，
   * 指标卡必须把它换成占位符 —— 一个会被截图进周报的 `¥0.00` 比空态更能误导人。
   */
  it('一行都没命中：表格图表出空态，指标卡给占位符而不是 ¥0.00', async () => {
    const wrapper = view({
      filters: { region: '华南' },
      source: spySource().source,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '总销售额',
    );
    expect(
      wrapper.find('[data-slot="report-widget-kpi"]').text(),
    ).not.toContain('¥0.00');
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      NULL_PLACEHOLDER,
    );
    expect(wrapper.find('[data-slot="report-widget-empty"]').exists()).toBe(
      true,
    );
  });

  it('明细表渲染表头与合计行，脏值走占位符', async () => {
    const wrapper = view();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const table = wrapper.find('[data-slot="report-widget-table"]');
    expect(table.text()).toContain('求和(销售额)');
    expect(table.text()).toContain('华东');
    expect(table.text()).toContain('¥100.00');
    expect(
      wrapper.find('[data-slot="report-widget-total-row"]').text(),
    ).toContain('合计');
    expect(
      wrapper.find('[data-slot="report-widget-total-row"]').text(),
    ).toContain('¥220.00');
  });

  it('表头点击：本地重排 + 回抛 sort（带上 widgetId 供宿主改 DSL）', async () => {
    const wrapper = view();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const button = wrapper.find(
      '[data-widget-id="table"] [data-sort-field="sum_sales"]',
    );
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    const emitted = wrapper.emitted('sort')?.[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(emitted).toMatchObject({ field: 'sum_sales', dir: 'asc' });
    expect(emitted.widgetId).toBe('table');
    // 只取数据行：合计行也在同一个 tbody 里，但它不参与重排（口径 5：合计是全集合合计）
    const bodyRows =
      '[data-widget-id="table"] tbody tr:not([data-slot="report-widget-total-row"])';
    const cells = wrapper.findAll(`${bodyRows} td:nth-child(3)`);
    // 第 3 列是「求和(销售额)」：默认按维度字典序是 50 / 100 / 70，asc 后必须是 50 / 70 / 100
    expect(cells.map((cell) => cell.text())).toEqual([
      '¥50.00',
      '¥70.00',
      '¥100.00',
    ]);
    const totalRow = wrapper.find('[data-slot="report-widget-total-row"]');
    expect(totalRow.text()).toContain('合计');
    expect(totalRow.text()).toContain('¥220.00');
  });
});

describe('reportViewer 与取数层的关系', () => {
  it('四格里三个共用一个数据集：只发一次请求', async () => {
    const { calls, source } = spySource();
    const wrapper = view({ source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.html()).toContain('report-widget');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.datasetId).toBe('ds-1');
  });

  it('setFilter 触发重新取数，结果与报表级过滤器一起生效', async () => {
    const { calls, source } = spySource();
    const wrapper = view({ source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥220.00',
    );

    (
      wrapper.vm as unknown as {
        setFilter: (field: string, value: unknown) => void;
      }
    ).setFilter('region', '华东');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(calls).toHaveLength(2);
    expect(calls[1]!.ctx.filters).toEqual({ region: '华东' });
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥150.00',
    );
    const option = JSON.parse(
      wrapper.find('[data-slot="fake-chart"]').attributes('data-option') ??
        '{}',
    );
    expect(option.xAxis.data).toEqual(['华东']);
  });

  it('外部 filters 用 Ref 传进来时跟随变化（单向：组件不回写它）', async () => {
    const filters = ref<Record<string, unknown>>({});
    const wrapper = view({ filters });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥220.00',
    );
    filters.value = { region: '华北' };
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥70.00',
    );
  });

  /**
   * 宿主最常见的两种写法，都曾经是断的：模板里 `v-model:values` 每次回抛**一个新对象**
   * （props 换引用），以及就地改响应式对象的某个键（引用没变）。
   * 组件把 props 摊成值交给 composable 的话，composable 只认识第一次那一个对象 ——
   * 症状是"过滤条改了、报表一动不动"，而 Ref 那条用例照样绿。
   */
  it('宿主用 v-model 换掉整个 filters 对象：报表跟着重算', async () => {
    const { calls, source } = spySource();
    const wrapper = view({ filters: { region: '华东' }, source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥150.00',
    );

    await wrapper.setProps({ filters: { region: '华北' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥70.00',
    );
    expect(calls.at(-1)!.ctx.filters).toEqual({ region: '华北' });
  });

  it('宿主就地改 filters 的某个键（不换新对象）：同样重算 —— deep 那条 watcher 存在的理由', async () => {
    const filters = reactive({ region: '' });
    const wrapper = view({ filters, source: spySource().source });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥220.00',
    );

    filters.region = '华北';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-slot="report-widget-kpi"]').text()).toContain(
      '¥70.00',
    );
  });

  it('#actions 插槽透传到每一格的卡片头，并带上当前 widget', async () => {
    const wrapper = mount(ReportViewer, {
      props: { spec, source: spySource().source },
      slots: { actions: '<button data-testid="drill">下钻</button>' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.findAll('[data-testid="drill"]').length).toBeGreaterThan(0);
    expect(wrapper.find('[data-slot="report-widget-header"]').exists()).toBe(
      true,
    );
  });
});
