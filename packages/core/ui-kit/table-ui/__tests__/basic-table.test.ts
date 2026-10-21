import type { BasicColumn, BasicTableProps, Recordable } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import BasicTable from '../src/BasicTable.vue';

const rows: Recordable[] = [
  { age: 28, id: 1, name: '张三', tag: ['https://x/a.png', 'https://x/b.png'] },
  { age: 32, id: 2, name: '李四', tag: [] },
  { age: 24, id: 3, name: '王五', tag: 'note.txt' },
];

const baseColumns: BasicColumn[] = [
  { dataIndex: 'name', title: '名称' },
  { dataIndex: 'age', title: '年龄' },
];

function mountTable(props: Partial<BasicTableProps> = {}, options: any = {}) {
  return mount(BasicTable, {
    props: {
      columns: baseColumns,
      dataSource: rows,
      ...props,
    },
    ...options,
  });
}

/** 取 tbody 里的数据行（不含展开行/空态行） */
const bodyRows = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.findAll('tbody tr.basic-table-row');

const cellTexts = (wrapper: ReturnType<typeof mountTable>) =>
  bodyRows(wrapper).map((row) =>
    row.findAll('td').map((cell) => cell.text().trim()),
  );

describe('basicTable 基础渲染', () => {
  it('渲染表头与数据行，行上带 data-row-key', () => {
    const wrapper = mountTable();
    expect(wrapper.findAll('.basic-table-head')).toHaveLength(2);
    expect(bodyRows(wrapper)).toHaveLength(3);
    expect(bodyRows(wrapper).map((r) => r.attributes('data-row-key'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(cellTexts(wrapper)[0]).toEqual(['张三', '28']);
  });

  it('容器与滚动容器有稳定选择器（拖拽、滚动定位依赖它）', () => {
    const wrapper = mountTable();
    expect(wrapper.find('.basic-table').exists()).toBe(true);
    expect(wrapper.find('.basic-table-body').exists()).toBe(true);
    expect(wrapper.find('tbody').classes()).toContain('basic-table-tbody');
  });

  it('rowKey 为函数时用返回值做 data-row-key', () => {
    const wrapper = mountTable({
      rowKey: (record: Recordable) => `k-${record.id}`,
    });
    expect(bodyRows(wrapper)[0]!.attributes('data-row-key')).toBe('k-1');
  });

  it('序号列注入并可被 slot 覆盖', () => {
    const wrapper = mountTable({ showIndexColumn: true });
    expect(wrapper.findAll('.basic-table-head')).toHaveLength(3);
    expect(cellTexts(wrapper)[0]![0]).toBe('1');
    expect(cellTexts(wrapper)[2]![0]).toBe('3');
  });

  it('ifShow 为 false 的列不渲染', () => {
    const wrapper = mountTable({
      columns: [
        { dataIndex: 'name', title: '名称' },
        { dataIndex: 'age', ifShow: false, title: '年龄' },
      ],
    });
    expect(wrapper.findAll('.basic-table-head')).toHaveLength(1);
    expect(cellTexts(wrapper)[0]).toEqual(['张三']);
  });

  it('空数据渲染空态行，跨全部列', () => {
    const wrapper = mountTable({ dataSource: [] });
    const empty = wrapper.find('.basic-table-empty-row');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('暂无数据');
    expect(empty.find('td').attributes('colspan')).toBe('2');
  });

  it('emptyText / locale.emptyText 与 empty 插槽可替换空态', () => {
    expect(
      mountTable({ dataSource: [], emptyText: '没有记录' })
        .find('.basic-table-empty-row')
        .text(),
    ).toContain('没有记录');

    const slotted = mountTable(
      { dataSource: [] },
      { slots: { empty: () => h('span', '自定义空态') } },
    );
    expect(slotted.find('.basic-table-empty-row').text()).toContain(
      '自定义空态',
    );
  });

  it('loading 时显示遮罩', () => {
    expect(
      mountTable({ loading: true }).find('.basic-table-loading').exists(),
    ).toBe(true);
    expect(mountTable().find('.basic-table-loading').exists()).toBe(false);
  });

  it('showHeader=false 不渲染表头', () => {
    expect(mountTable({ showHeader: false }).find('thead').exists()).toBe(
      false,
    );
  });

  it('scroll.x 决定表格最小宽度，scroll.y 决定 body 最大高度与吸顶表头', () => {
    const wrapper = mountTable({ scroll: { x: 1200, y: 300 } });
    expect(wrapper.find('table').attributes('style')).toContain(
      'min-width: 1200px',
    );
    expect(wrapper.find('.basic-table-body').attributes('style')).toContain(
      'max-height: 300px',
    );
    expect(wrapper.find('.basic-table-head').classes()).toContain('sticky');
  });

  it('固定列自带不透明底色与层级，横向滚动时不被同行单元格穿透', () => {
    const wrapper = mountTable({
      actionColumn: { title: '操作', width: 160 },
      columns: [
        { dataIndex: 'name', fixed: 'left', title: '名称' },
        ...baseColumns.slice(1),
      ],
    });
    const first = bodyRows(wrapper)[0]!;
    const cells = first.findAll('td');
    const pinned = cells.filter((cell) =>
      cell.attributes('style')?.includes('position: sticky'),
    );
    expect(pinned).toHaveLength(2);

    // 左固定列与右固定操作列：实色底（从行继承）+ 压住普通单元格的层级
    for (const cell of pinned) {
      expect(cell.classes()).toEqual(
        expect.arrayContaining(['bg-inherit', 'z-[2]']),
      );
    }
    expect(pinned[0]!.attributes('style')).toContain('left: 0px');
    expect(pinned[1]!.attributes('style')).toContain('right: 0px');
    // 中间那列是普通单元格，不该被顺手染上底色
    const normal = cells.find(
      (cell) => !cell.attributes('style')?.includes('position: sticky'),
    );
    expect(normal!.classes()).not.toContain('bg-inherit');

    // 底色来自 `<tr>`，所以行背景必须是实色，否则固定列照样透
    expect(first.classes()).toEqual(
      expect.arrayContaining(['group', 'bg-card']),
    );
    for (const cls of wrapper.findAll('.basic-table-head')) {
      expect(cls.classes()).toEqual(expect.arrayContaining(['bg-gray-50']));
      expect(cls.classes().join(' ')).not.toContain('gray-800/');
    }
    // 固定表头压住固定单元格
    expect(wrapper.findAll('.basic-table-head')[0]!.classes()).toContain(
      'z-20',
    );
  });

  it('表头与单元格共用同一套盒模型（行高不一致会错位）', () => {
    const wrapper = mountTable();
    const head = wrapper.findAll('.basic-table-head')[0]!.classes();
    const cell = bodyRows(wrapper)[0]!.findAll('td')[0]!.classes();
    // 行高取 24px 的文本行盒：单元格住的不只是一行文字，20px 时表头比数据行矮一线
    for (const cls of [
      'px-3',
      'py-2',
      'text-sm',
      'leading-6',
      'align-middle',
    ]) {
      expect(head).toContain(cls);
      expect(cell).toContain(cls);
    }
  });

  it('bordered / rowClassName / cellClassName 落到 DOM', () => {
    const wrapper = mountTable({
      bordered: true,
      cellClassName: 'cell-x',
      rowClassName: (_record: Recordable, index: number) =>
        index === 0 ? 'row-first' : '',
    });
    expect(wrapper.find('.basic-table-body').classes()).toContain('border');
    expect(bodyRows(wrapper)[0]!.classes()).toContain('row-first');
    expect(bodyRows(wrapper)[1]!.find('td').classes()).toContain('cell-x');
  });

  it('title / caption / footer / summary 渲染', () => {
    const wrapper = mountTable({
      caption: h('span', '表说明'),
      footer: (data: Recordable[]) => h('span', `共${data.length}条`),
      summary: (data: Recordable[]) => h('span', `合计${data.length}`),
      title: () => h('span', '用户列表'),
    });
    expect(wrapper.find('.basic-table-footer').text()).toBe('共3条');
    expect(wrapper.find('.basic-table-summary').text()).toBe('合计3');
    expect(wrapper.find('caption').text()).toBe('表说明');
    expect(wrapper.text()).toContain('用户列表');
  });

  it('summary 插槽优先于 props', () => {
    const wrapper = mountTable(
      {},
      { slots: { summary: () => h('span', '插槽合计') } },
    );
    expect(wrapper.find('.basic-table-summary').text()).toBe('插槽合计');
  });
});

describe('basicTable 单元格渲染优先级', () => {
  it('customRender 最高优先', () => {
    const wrapper = mountTable({
      columns: [
        {
          customRender: ({ text, record }: any) => `${record.id}-${text}`,
          dataIndex: 'name',
          title: '名称',
        },
        { dataIndex: 'age', title: '年龄' },
      ],
    });
    expect(cellTexts(wrapper)[0]![0]).toBe('1-张三');
  });

  it('format 模板串按 HTML 注入', () => {
    const wrapper = mountTable({
      columns: [
        { dataIndex: 'name', format: '<b>{{text}}</b>', title: '名称' },
        { dataIndex: 'age', title: '年龄' },
      ],
    });
    expect(bodyRows(wrapper)[0]!.findAll('td')[0]!.find('b').exists()).toBe(
      true,
    );
  });

  it('format 函数返回 VNode 时直接渲染', () => {
    const wrapper = mountTable({
      columns: [
        {
          dataIndex: 'name',
          format: (text: string) => h('i', `f-${text}`),
          title: '名称',
        },
      ],
    });
    expect(bodyRows(wrapper)[0]!.findAll('td')[0]!.text()).toBe('f-张三');
  });

  it('图片数组列渲染 TableImg，非图片数组走默认文本', () => {
    const wrapper = mountTable({
      columns: [
        { dataIndex: 'tag', title: '附件' },
        { dataIndex: 'name', title: '名称' },
      ],
    });
    const first = bodyRows(wrapper)[0]!.findAll('td')[0]!;
    expect(first.find('img').exists()).toBe(true);
    const third = bodyRows(wrapper)[2]!.findAll('td')[0]!;
    expect(third.find('img').exists()).toBe(false);
    expect(third.text()).toContain('note.txt');
  });

  it('cell-{key} 插槽优先于 customRender 之外的一切', () => {
    const wrapper = mountTable(
      {
        columns: [
          {
            customRender: () => h('span', 'rendered'),
            dataIndex: 'name',
            key: 'name',
            title: '名称',
          },
        ],
      },
      {
        slots: { 'cell-name': (props: any) => h('span', `slot-${props.text}`) },
      },
    );
    expect(bodyRows(wrapper)[0]!.text()).toBe('slot-张三');
  });

  it('无 cell-{key} 时退回 cell-{dataIndex} 与 {dataIndex} 插槽', () => {
    const wrapper = mountTable(
      { columns: [{ dataIndex: 'name', title: '名称' }] },
      { slots: { 'cell-name': () => h('span', 'A') } },
    );
    expect(bodyRows(wrapper)[0]!.text()).toBe('A');

    const wrapper2 = mountTable(
      { columns: [{ dataIndex: 'name', title: '名称' }] },
      { slots: { name: () => h('span', 'B') } },
    );
    expect(bodyRows(wrapper2)[0]!.text()).toBe('B');
  });

  it('header-{key} 插槽覆盖表头内容', () => {
    const wrapper = mountTable(
      { columns: [{ dataIndex: 'name', key: 'name', title: '名称' }] },
      { slots: { 'header-name': () => h('span', '自定义表头') } },
    );
    expect(wrapper.find('.basic-table-head').text()).toContain('自定义表头');
  });
});

describe('basicTable 行事件', () => {
  it('rowClick / rowDbClick 抛出记录与下标', async () => {
    const wrapper = mountTable();
    await bodyRows(wrapper)[1]!.trigger('click');
    await bodyRows(wrapper)[1]!.trigger('dblclick');
    expect(wrapper.emitted('rowClick')?.[0]![0]).toMatchObject({ id: 2 });
    expect(wrapper.emitted('rowDbClick')?.[0]![1]).toBe(1);
  });

  it('onRow 的类名与事件与内部 emit 共存', async () => {
    const onClick = vi.fn();
    const wrapper = mountTable({
      onRow: (record: Recordable) => ({ class: `row-${record.id}`, onClick }),
    });
    await bodyRows(wrapper)[0]!.trigger('click');
    expect(bodyRows(wrapper)[0]!.classes()).toContain('row-1');
    expect(onClick).toHaveBeenCalled();
    expect(wrapper.emitted('rowClick')).toBeTruthy();
  });

  it('onHeaderRow 落到表头行', () => {
    const wrapper = mountTable({
      onHeaderRow: () => ({ class: 'head-row-x' }),
    });
    expect(wrapper.find('thead tr').classes()).toContain('head-row-x');
  });
});

describe('basicTable 工具栏', () => {
  it('toolbar 插槽渲染', () => {
    const wrapper = mountTable(
      {},
      { slots: { toolbar: () => h('button', '新增') } },
    );
    expect(wrapper.text()).toContain('新增');
  });
});

describe('basicTable 实例注册', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('onMounted 通过 register 抛出完整实例方法，且与 defineExpose 一致', async () => {
    const wrapper = mountTable();
    await nextTick();
    const registered = wrapper.emitted('register')?.[0]![0] as any;
    expect(registered).toBeTruthy();
    for (const key of [
      'reload',
      'setProps',
      'getColumns',
      'setColumns',
      'getDataSource',
      'setTableData',
      'selectRows',
      'getSelectRowKeys',
      'clearSelectedRowKeys',
      'setPagination',
      'getPaginationRef',
      'expandAll',
      'collapseAll',
      'insertTableDataRecord',
      'deleteTableDataRecord',
      'updateTableDataRecord',
      'findTableDataRecord',
      'scrollTo',
      'getForm',
    ]) {
      expect(typeof registered[key], key).toBe('function');
    }
    expect(registered.getDataSource()).toHaveLength(3);
  });

  it('setProps 覆盖 props 并影响渲染', async () => {
    const wrapper = mountTable();
    const instance = wrapper.vm as any;
    instance.setProps({ showIndexColumn: true });
    await nextTick();
    expect(wrapper.findAll('.basic-table-head')).toHaveLength(3);
    expect(cellTexts(wrapper)[0]![0]).toBe('1');
  });

  it('数据记录的增删改查走实例方法并同步 raw 快照', () => {
    const wrapper = mountTable();
    const instance = wrapper.vm as any;

    instance.insertTableDataRecord({ age: 1, id: 9, name: '新' }, 0);
    expect(instance.getDataSource()[0]).toMatchObject({ id: 9 });

    // `useDataSource` 按 `record[rowKey]` 原值严格比较（与 web 一致），所以这里用数字 key
    instance.updateTableDataRecord(9, { name: '改' });
    expect(instance.findTableDataRecord(9)).toMatchObject({ name: '改' });

    instance.deleteTableDataRecord(1);
    expect(instance.getDataSource().map((r: any) => r.id)).toEqual([9, 2, 3]);

    expect(instance.getRawDataSource()).toHaveLength(3);
  });

  it('reload 回到第一页并重新取数', async () => {
    const api = vi.fn().mockImplementation(async (params: any) => ({
      list: rows.slice(0, params.pageSize),
      total: 30,
    }));
    const wrapper = mountTable({
      api,
      dataSource: undefined,
      pagination: { pageSize: 2 },
    });
    await flushPromises();
    const instance = wrapper.vm as any;
    instance.setPagination({ current: 3 });
    await instance.reload();
    await flushPromises();
    expect(instance.getPaginationRef().current).toBe(1);
  });
});
