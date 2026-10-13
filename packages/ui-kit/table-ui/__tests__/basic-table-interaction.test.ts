import type { BasicColumn, BasicTableProps, Recordable } from '../src/types';

import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick, reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import BasicTable from '../src/BasicTable.vue';

const rows: Recordable[] = [
  { age: 28, id: 1, name: '张三', status: 'active' },
  { age: 32, id: 2, name: '李四', status: 'inactive' },
  { age: 24, id: 3, name: '王五', status: 'active' },
];

function mountTable(props: Partial<BasicTableProps> = {}, options: any = {}) {
  return mount(BasicTable, {
    props: {
      columns: [{ dataIndex: 'name', title: '名称' }] as BasicColumn[],
      dataSource: rows,
      showTableSetting: false,
      ...props,
    },
    ...options,
  });
}

const bodyRows = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.findAll('tbody tr.basic-table-row');

const cellTexts = (wrapper: ReturnType<typeof mountTable>) =>
  bodyRows(wrapper).map((row) =>
    row.findAll('td').map((cell) => cell.text().trim()),
  );

const rowKeys = (wrapper: ReturnType<typeof mountTable>) =>
  bodyRows(wrapper).map((row) => row.attributes('data-row-key'));

/** 触发排序/翻页后的异步链路（fetch + change emit） */
const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

beforeEach(() => {
  vi.useRealTimers();
});

describe('BasicTable 排序', () => {
  const sortableColumns: BasicColumn[] = [
    { dataIndex: 'name', title: '名称' },
    { dataIndex: 'age', sorter: (a: Recordable, b: Recordable) => a.age - b.age, title: '年龄' },
  ];

  it('sorter 函数走本地比较，点击表头升序 → 降序 → 取消', async () => {
    const wrapper = mountTable({ columns: sortableColumns });
    const head = () => wrapper.find('th[data-column-key="age"]');

    await head().trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[1])).toEqual([
      '24',
      '28',
      '32',
    ]);

    await head().trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[1])).toEqual([
      '32',
      '28',
      '24',
    ]);

    // 第三次点击回到默认方向序列的末尾（none），恢复数据源原序
    await head().trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[1])).toEqual([
      '28',
      '32',
      '24',
    ]);
  });

  it('排序态在表头上可读（title 提示 + change 事件载荷）', async () => {
    // 与 web 一致：`showSorterTooltip` 没传时 Vue 的布尔转换把它当成 false，提示不出现
    const plain = mountTable({ columns: sortableColumns });
    expect(
      plain.find('th[data-column-key="age"]').attributes('title'),
    ).toBeUndefined();

    const wrapper = mountTable({
      columns: sortableColumns,
      showSorterTooltip: true,
    });
    expect(
      wrapper.find('th[data-column-key="age"]').attributes('title'),
    ).toBe('点击排序');
    expect(
      wrapper.find('th[data-column-key="name"]').attributes('title'),
    ).toBeUndefined();

    await wrapper.find('th[data-column-key="age"]').trigger('click');
    await settle();
    const payload = wrapper.emitted('change')?.at(-1) as any[];
    expect(payload[2]).toMatchObject({
      columnKey: 'age',
      field: 'age',
      order: 'ascend',
    });
  });

  it('sorter: true 只翻转状态，数据顺序交给服务端', async () => {
    const api = vi.fn(async () => ({ list: rows, total: 3 }));
    const wrapper = mountTable({
      api,
      columns: [{ dataIndex: 'age', sorter: true, title: '年龄' }],
      dataSource: undefined,
    });
    await settle();

    api.mockClear();
    await wrapper.find('th[data-column-key="age"]').trigger('click');
    await settle();

    // 重新取数（把排序意图带给服务端），但本地不重排
    expect(api).toHaveBeenCalled();
    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual([
      '28',
      '32',
      '24',
    ]);
    const payload = wrapper.emitted('change')?.at(-1) as any[];
    expect(payload[2].order).toBe('ascend');
  });

  it('sortDirections 可自定义方向与顺序', async () => {
    const wrapper = mountTable({
      columns: sortableColumns,
      sortDirections: ['descend'],
    });
    await wrapper.find('th[data-column-key="age"]').trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[1])).toEqual([
      '32',
      '28',
      '24',
    ]);
    // 只有一个方向，再点直接回到无排序
    await wrapper.find('th[data-column-key="age"]').trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[1])).toEqual([
      '28',
      '32',
      '24',
    ]);
  });

  it('sorter 写成 { compare } 时同样做本地比较', async () => {
    const wrapper = mountTable({
      columns: [
        {
          dataIndex: 'age',
          sorter: {
            compare: (a: Recordable, b: Recordable) => a.age - b.age,
            multiple: 1,
          },
          title: '年龄',
        },
      ],
    });
    await wrapper.find('th[data-column-key="age"]').trigger('click');
    await settle();
    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual([
      '24',
      '28',
      '32',
    ]);
  });

  it('多列排序只取当前激活列，未标 sorter 的列点击不排序', async () => {
    const wrapper = mountTable({ columns: sortableColumns });
    await wrapper.find('th[data-column-key="name"]').trigger('click');
    await settle();
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual([
      '张三',
      '李四',
      '王五',
    ]);
  });
});

describe('BasicTable 过滤', () => {
  const filterColumns: BasicColumn[] = [
    {
      dataIndex: 'status',
      filters: [
        { text: '启用', value: 'active' },
        { text: '停用', value: 'inactive' },
      ],
      onFilter: (value: string, record: Recordable) => record.status === value,
      title: '状态',
    },
  ];

  it('filters 无 onFilter 时不因筛选丢行（只由服务端/插槽自理）', async () => {
    const wrapper = mountTable({
      columns: [
        {
          dataIndex: 'status',
          filters: [{ text: '启用', value: 'active' }],
          title: '状态',
        },
      ],
    });
    expect(bodyRows(wrapper)).toHaveLength(3);
    expect(wrapper.find('[aria-label="筛选"]').exists()).toBe(true);
  });

  it('onFilter 生效：同一列多值取并集，change 事件带 filters', async () => {
    const wrapper = mountTable({ columns: filterColumns });

    // 弹层内容 teleport 到 body，所以从 document 上取
    await wrapper.find('[aria-label="筛选"]').trigger('click');
    await nextTick();
    const panel = document.body.querySelector('.basic-table-filter-panel');
    expect(panel).toBeTruthy();

    const [activeBox] = panel!.querySelectorAll('input[type="checkbox"]');
    (activeBox as HTMLInputElement).click();
    await nextTick();
    (panel!.querySelector('.basic-table-filter-confirm') as HTMLElement).click();
    await settle();

    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual([
      'active',
      'active',
    ]);
    expect(rowKeys(wrapper)).toEqual(['1', '3']);
    const payload = wrapper.emitted('change')?.at(-1) as any[];
    expect(payload[1]).toEqual({ status: ['active'] });

    // 追加第二个值 → 并集，回到 3 行
    await wrapper.find('[aria-label="筛选"]').trigger('click');
    await nextTick();
    const boxes = document.body.querySelectorAll(
      '.basic-table-filter-panel input[type="checkbox"]',
    );
    (boxes[1] as HTMLInputElement).click();
    await nextTick();
    (
      document.body
        .querySelector('.basic-table-filter-panel')!
        .querySelector('.basic-table-filter-confirm') as HTMLElement
    ).click();
    await settle();
    expect(bodyRows(wrapper)).toHaveLength(3);

    // 重置清空过滤条件
    await wrapper.find('[aria-label="筛选"]').trigger('click');
    await nextTick();
    (
      document.body
        .querySelector('.basic-table-filter-panel')!
        .querySelector('.basic-table-filter-reset') as HTMLElement
    ).click();
    await settle();
    expect(bodyRows(wrapper)).toHaveLength(3);
    expect(wrapper.emitted('change')?.at(-1)?.[1]).toEqual({});
  });
});

describe('BasicTable 分页', () => {
  const manyRows = Array.from({ length: 25 }, (_, i) => ({
    age: i,
    id: i + 1,
    name: `用户${i + 1}`,
  }));

  it('本地数据按 pageSize 切片，翻页只换窗口', async () => {
    const wrapper = mountTable({
      columns: [{ dataIndex: 'name', title: '名称' }],
      dataSource: manyRows,
      pagination: { pageSize: 10 },
    });
    expect(bodyRows(wrapper)).toHaveLength(10);
    expect(cellTexts(wrapper)[0]![0]).toBe('用户1');

    await wrapper.find('.basic-table-page-2').trigger('click');
    await settle();
    expect(cellTexts(wrapper)[0]![0]).toBe('用户11');

    await wrapper.find('.basic-table-page-3').trigger('click');
    await settle();
    expect(bodyRows(wrapper)).toHaveLength(5);

    // 上一页 / 下一页
    await wrapper.find('.basic-table-prev').trigger('click');
    await settle();
    expect(cellTexts(wrapper)[0]![0]).toBe('用户11');
    await wrapper.find('.basic-table-next').trigger('click');
    await settle();
    expect(wrapper.find('.basic-table-next').attributes('disabled')).toBeDefined();
  });

  it('页码超过 7 页时收拢成省略号', () => {
    const wrapper = mountTable({
      dataSource: manyRows,
      pagination: { pageSize: 1 },
    });
    const pageButtons = wrapper.findAll('.basic-table-page');
    expect(pageButtons.length).toBeLessThanOrEqual(7);
    expect(wrapper.find('.basic-table-page-ellipsis').exists()).toBe(true);
    expect(wrapper.find('.basic-table-page-25').exists()).toBe(true);
  });

  it('改每页条数回到第一页', async () => {
    const wrapper = mountTable({
      dataSource: manyRows,
      pagination: { pageSize: 10 },
    });
    await wrapper.find('.basic-table-page-3').trigger('click');
    await settle();
    await wrapper.find('.basic-table-page-size').findAll('option')[2]!
      .setValue('50');
    await settle();
    expect(bodyRows(wrapper)).toHaveLength(25);
    expect(wrapper.find('.basic-table-page-1').exists()).toBe(true);
  });

  it('快速跳至输入页码', async () => {
    const wrapper = mountTable({
      dataSource: manyRows,
      pagination: { pageSize: 10 },
    });
    const jumper = wrapper.find('.basic-table-quick-jumper');
    await jumper.setValue('2');
    await jumper.trigger('keydown.enter');
    await settle();
    expect(cellTexts(wrapper)[0]![0]).toBe('用户11');

    // 越界页码不动
    await jumper.setValue('99');
    await jumper.trigger('keydown.enter');
    await settle();
    expect(cellTexts(wrapper)[0]![0]).toBe('用户11');
  });

  it('服务端分页：翻页带 pageNum / pageSize 重新取数', async () => {
    const api = vi.fn(async (params: any) => ({
      list: manyRows.slice(
        (params.pageNum - 1) * params.pageSize,
        params.pageNum * params.pageSize,
      ),
      total: manyRows.length,
    }));
    const wrapper = mountTable({
      api,
      dataSource: undefined,
      pagination: { pageSize: 10 },
    });
    await settle();
    expect(api.mock.calls[0]![0]).toMatchObject({ pageNum: 1, pageSize: 10 });
    expect(bodyRows(wrapper)).toHaveLength(10);
    // 服务端分页不在本地再切一次
    expect(wrapper.findAll('.basic-table-page')).toHaveLength(3);

    api.mockClear();
    await wrapper.find('.basic-table-page-2').trigger('click');
    await settle();
    expect(api.mock.calls[0]![0]).toMatchObject({ pageNum: 2, pageSize: 10 });
    expect(cellTexts(wrapper)[0]![0]).toBe('用户11');
    const payload = wrapper.emitted('change')?.at(-1) as any[];
    expect(payload[0]).toMatchObject({ current: 2 });
  });

  it('pagination: false 不渲染分页条', () => {
    const wrapper = mountTable({
      dataSource: manyRows,
      pagination: false,
    });
    expect(wrapper.find('.basic-table-pagination').exists()).toBe(false);
    expect(bodyRows(wrapper)).toHaveLength(25);
  });
});

describe('BasicTable 行选择', () => {
  const selection = (extra: Recordable = {}) => {
    const state = reactive<any>({
      selectedRowKeys: [],
      ...extra,
    });
    const onChange = vi.fn((keys: string[]) => {
      state.selectedRowKeys = keys;
    });
    state.onChange = onChange;
    return { onChange, state };
  };

  it('渲染选择列，勾选单行回调带字符串化的 key 与行记录', async () => {
    const { onChange, state } = selection();
    const wrapper = mountTable({ rowSelection: state });

    const boxes = () => wrapper.findAll('.basic-table-row-checkbox');
    expect(boxes()).toHaveLength(3);
    expect(wrapper.find('.basic-table-select-all').exists()).toBe(true);

    await boxes()[1]!.setValue(true);
    await nextTick();
    expect(onChange).toHaveBeenCalledWith(
      ['2'],
      [expect.objectContaining({ id: 2 })],
      { type: 'multiple' },
    );
    expect((boxes()[1]!.element as HTMLInputElement).checked).toBe(true);

    await boxes()[1]!.setValue(false);
    await nextTick();
    expect(state.selectedRowKeys).toEqual([]);
  });

  it('数字主键经 UI 勾选后按字符串记录；外部传入的 keys 不覆盖内部状态', async () => {
    const { onChange, state } = selection({ selectedRowKeys: [1] });
    const wrapper = mountTable({ rowSelection: state });
    const boxes = () => wrapper.findAll('.basic-table-row-checkbox');
    // useRowSelection 用内部状态覆盖 props 的 selectedRowKeys（与 web 一致）
    expect((boxes()[0]!.element as HTMLInputElement).checked).toBe(false);

    await boxes()[0]!.setValue(true);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual(['1']);
    expect((boxes()[0]!.element as HTMLInputElement).checked).toBe(true);
  });

  it('全选与半选态', async () => {
    const { onChange, state } = selection();
    const wrapper = mountTable({ rowSelection: state });
    const selectAll = () =>
      wrapper.find('.basic-table-select-all').element as HTMLInputElement;

    // 单选一行 → 半选
    await wrapper.findAll('.basic-table-row-checkbox')[1]!.setValue(true);
    await nextTick();
    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll().checked).toBe(false);

    // 表头全选补齐剩下的行
    await wrapper.find('.basic-table-select-all').setValue(true);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual(['1', '2', '3']);
    expect(selectAll().checked).toBe(true);
    expect(selectAll().indeterminate).toBe(false);

    // 全选态再点一次 → 清空
    await wrapper.find('.basic-table-select-all').setValue(false);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual([]);
    expect(selectAll().checked).toBe(false);
  });

  it('getCheckboxProps 禁用的行不参与全选', async () => {
    const { onChange, state } = selection();
    const wrapper = mountTable({
      rowSelection: {
        ...state,
        getCheckboxProps: (record: Recordable) => ({
          disabled: record.id === 2,
        }),
      },
    });
    const boxes = wrapper.findAll('.basic-table-row-checkbox');
    expect(boxes[1]!.attributes('disabled')).toBeDefined();

    await wrapper.find('.basic-table-select-all').setValue(true);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual(['1', '3']);
  });

  it('hideSelectAll 隐藏全选框', () => {
    const wrapper = mountTable({
      rowSelection: reactive({ hideSelectAll: true, selectedRowKeys: [] }),
    });
    expect(wrapper.find('.basic-table-select-all').exists()).toBe(false);
    expect(wrapper.findAll('.basic-table-row-checkbox')).toHaveLength(3);
  });

  it('radio 单选：换行即替换，且不渲染全选', async () => {
    const { onChange, state } = selection({ type: 'radio' });
    const wrapper = mountTable({ rowSelection: state });
    expect(wrapper.find('.basic-table-select-all').exists()).toBe(false);

    const radios = wrapper.findAll('.basic-table-row-checkbox');
    expect(radios[0]!.attributes('type')).toBe('radio');

    await radios[0]!.setValue(true);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual(['1']);
    await radios[2]!.setValue(true);
    await nextTick();
    expect(onChange.mock.calls.at(-1)![0]).toEqual(['3']);
    expect(
      wrapper
        .findAll('.basic-table-row-checkbox')
        .map((box) => (box.element as HTMLInputElement).checked),
    ).toEqual([false, false, true]);
  });

  it('选择列表头/单元格跟随 fixed 与 columnWidth', () => {
    const wrapper = mountTable({
      rowSelection: reactive({
        columnWidth: 48,
        fixed: 'left' as const,
        selectedRowKeys: [],
      }),
    });
    const head = wrapper.findAll('thead th')[0]!;
    expect(head.attributes('style')).toContain('position: sticky');
    expect(head.attributes('style')).toContain('width: 48px');
  });
});

describe('BasicTable 树形展开', () => {
  const treeRows: Recordable[] = [
    {
      children: [
        { id: 11, name: '子1' },
        { id: 12, name: '子2' },
      ],
      id: 1,
      name: '父1',
    },
    { id: 2, name: '父2' },
  ];
  const treeColumns: BasicColumn[] = [{ dataIndex: 'name', title: '名称' }];

  it('isTree + defaultExpandAllRows 展开全部，子行带缩进', () => {
    const wrapper = mountTable({
      columns: treeColumns,
      dataSource: treeRows,
      defaultExpandAllRows: true,
      isTree: true,
    });
    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual([
      '父1',
      '子1',
      '子2',
      '父2',
    ]);
    // 子行首列前有缩进占位
    const indent = wrapper
      .findAll('tbody tr')[1]!
      .find('td span.inline-block');
    expect(indent.attributes('style')).toContain('width: 20px');
  });

  it('defaultExpandAllRows: false 时首屏只渲染父行', () => {
    const wrapper = mountTable({
      columns: treeColumns,
      dataSource: treeRows,
      defaultExpandAllRows: false,
      isTree: true,
    });
    expect(bodyRows(wrapper)).toHaveLength(2);
  });

  it('点击展开图标切换单行，并回调 onExpand / onExpandedRowsChange', async () => {
    const onExpand = vi.fn();
    const onExpandedRowsChange = vi.fn();
    const wrapper = mountTable({
      columns: treeColumns,
      dataSource: treeRows,
      defaultExpandAllRows: false,
      isTree: true,
      onExpand,
      onExpandedRowsChange,
    });
    const icon = () => wrapper.find('.basic-table-row-expand-icon');
    await icon().trigger('click');
    await nextTick();
    expect(bodyRows(wrapper)).toHaveLength(4);
    expect(icon().classes()).toContain('basic-table-row-expand-icon-expanded');
    // 数字主键不做 String 归一，否则 includes(1) 永不命中
    expect(onExpand).toHaveBeenCalledWith(true, expect.objectContaining({ id: 1 }));
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith([1]);

    await icon().trigger('click');
    await nextTick();
    expect(bodyRows(wrapper)).toHaveLength(2);
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith([]);
  });

  it('expandAll / collapseAll 走实例方法', async () => {
    const wrapper = mountTable({
      columns: treeColumns,
      dataSource: treeRows,
      defaultExpandAllRows: false,
      isTree: true,
    });
    const instance = wrapper.vm as any;
    instance.expandAll();
    await nextTick();
    expect(bodyRows(wrapper)).toHaveLength(4);
    instance.collapseAll();
    await nextTick();
    expect(bodyRows(wrapper)).toHaveLength(2);
  });

  it('childrenColumnName 自定义子字段', () => {
    const wrapper = mountTable({
      childrenColumnName: 'items',
      columns: treeColumns,
      dataSource: [{ id: 1, items: [{ id: 11, name: '子1' }], name: '父1' }],
      defaultExpandAllRows: true,
      isTree: true,
    });
    expect(cellTexts(wrapper).map((cells) => cells[0])).toEqual(['父1', '子1']);
  });

  it('expandedRowRender 渲染自定义展开行，rowExpandable 控制可展开', async () => {
    const wrapper = mountTable({
      columns: [{ dataIndex: 'name', title: '名称' }],
      dataSource: rows,
      expandedRowRender: (record: Recordable) =>
        h('span', { class: 'my-expand' }, `详情-${record.name}`),
      rowExpandable: (record: Recordable) => record.id !== 2,
    });
    expect(wrapper.findAll('.basic-table-row-expand-icon')).toHaveLength(2);

    await wrapper
      .findAll('.basic-table-row-expand-icon')[0]!
      .trigger('click');
    await nextTick();
    expect(wrapper.find('.basic-table-expanded-row').exists()).toBe(true);
    expect(wrapper.find('.my-expand').text()).toBe('详情-张三');
  });

  it('expandedRowRender 插槽版本同样可用', async () => {
    const wrapper = mountTable(
      { columns: [{ dataIndex: 'name', title: '名称' }], dataSource: rows },
      {
        slots: {
          expandedRowRender: ({ record }: any) => h('b', `slot-${record.id}`),
        },
      },
    );
    await wrapper
      .find('.basic-table-row-expand-icon')
      .trigger('click');
    await nextTick();
    expect(wrapper.find('.basic-table-expanded-row').text()).toBe('slot-1');
  });
});

describe('BasicTable 列宽拖拽', () => {
  it('resizable 列渲染手柄，按下后由 TanStack 接管 sizing', async () => {
    const wrapper = mountTable({
      columns: [
        { dataIndex: 'name', resizable: true, title: '名称', width: 100 },
        { dataIndex: 'age', title: '年龄' },
      ],
    });
    const handle = wrapper.find('.basic-table-resize-handle');
    expect(handle.exists()).toBe(true);

    await handle.trigger('mousedown', { clientX: 100, button: 0 });
    document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 160, bubbles: true }),
    );
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await nextTick();

    const head = wrapper.find('th[data-column-key="name"]');
    expect(head.attributes('style') ?? '').toContain('width');
  });

  it('手柄点击不触发排序', async () => {
    const wrapper = mountTable({
      columns: [
        {
          dataIndex: 'age',
          resizable: true,
          sorter: (a: Recordable, b: Recordable) => a.age - b.age,
          title: '年龄',
        },
      ],
    });
    await wrapper.find('.basic-table-resize-handle').trigger('click');
    await settle();
    expect(wrapper.emitted('change')).toBeUndefined();
  });
});
