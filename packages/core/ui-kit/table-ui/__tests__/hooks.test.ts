import type { BasicColumn, PaginationProps, Recordable } from '../src/types';

import { computed, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useColumns } from '../src/hooks/useColumns';
import { useLoading } from '../src/hooks/useLoading';
import { usePagination } from '../src/hooks/usePagination';
import { useRowSelection } from '../src/hooks/useRowSelection';

const baseColumns: BasicColumn[] = [
  { dataIndex: 'name', title: '名称' },
  { dataIndex: 'age', title: '年龄' },
];

describe('useColumns', () => {
  it('默认不注入序号列与操作列', () => {
    const columns = useColumns({
      columns: computed(() => baseColumns),
    });
    expect(columns.getColumns().map((c) => c.dataIndex)).toEqual([
      'name',
      'age',
    ]);
  });

  it('showIndexColumn / actionColumn 注入魔法 key 的列', () => {
    const columns = useColumns({
      actionColumn: computed(() => ({ title: '操作', width: 120 })),
      columns: computed(() => baseColumns),
      showIndexColumn: computed(() => true),
    });
    const [first] = columns.getColumns();
    const last = columns.getColumns().at(-1)!;
    expect(first!.key).toBe('index');
    expect(first!.width).toBe(60);
    expect(last!.key).toBe('action');
    expect(last!.fixed).toBe('right');
    expect(last!.width).toBe(120);
  });

  it('indexColumnProps 可覆盖序号列默认值', () => {
    const columns = useColumns({
      columns: computed(() => baseColumns),
      indexColumnProps: { title: '#', width: 30 },
      showIndexColumn: computed(() => true),
    });
    expect(columns.getColumns()[0]).toMatchObject({ title: '#', width: 30 });
  });

  it('默认给每列补 center 对齐，列自己的声明优先', () => {
    const columns = useColumns({
      columns: computed(() => [
        { align: 'left', dataIndex: 'name' },
        { dataIndex: 'age' },
      ]),
    });
    const [a, b] = columns.getColumns();
    expect(a!.align).toBe('left');
    expect(b!.align).toBe('center');
  });

  it('setColumns 支持 key 数组（列设置）与完整列数组', () => {
    const columns = useColumns({
      columns: computed(() => baseColumns),
    });
    columns.setColumns(['age']);
    expect(columns.getColumns().map((c) => c.dataIndex)).toEqual(['age']);

    columns.getCacheColumns();
    columns.setColumns([{ dataIndex: 'x', title: 'X' }]);
    expect(columns.getColumns().map((c) => c.dataIndex)).toEqual(['x']);
  });

  it('updateColumn 按 key / dataIndex 定位并合并', () => {
    const columns = useColumns({
      columns: computed(() => baseColumns),
    });
    columns.updateColumn({ title: '改名' }, 'name');
    expect(columns.getColumns()[0]!.title).toBe('改名');
  });

  it('props 里的列变化会重算并刷新缓存', async () => {
    const source = ref<BasicColumn[]>([{ dataIndex: 'a', title: 'A' }]);
    const columns = useColumns({ columns: computed(() => source.value) });
    source.value = [
      { dataIndex: 'a', title: 'A' },
      { dataIndex: 'b', title: 'B' },
    ];
    await nextTick();
    expect(columns.getColumns()).toHaveLength(2);
    expect(columns.getCacheColumns()).toHaveLength(2);
  });

  it('非数组入参被忽略（不炸）', () => {
    const columns = useColumns({
      columns: computed(() => undefined as unknown as BasicColumn[]),
    });
    expect(columns.getColumns()).toEqual([]);
  });
});

describe('usePagination', () => {
  const make = (pagination?: any) =>
    usePagination({ pagination: computed(() => pagination) });

  it('对象配置与默认值合并', () => {
    const p = make({ current: 3, pageSize: 20 });
    expect(p.getPagination.value).toMatchObject({
      current: 3,
      pageSize: 20,
      showTotal: expect.any(Function),
      total: 0,
    });
    expect(
      p.getPagination.value && p.getPagination.value.showTotal!(5, [1, 5]),
    ).toBe('共 5 条');
  });

  it('false 关闭分页', () => {
    const p = make(false);
    expect(p.getPagination.value).toBe(false);
    expect(p.getShowPagination()).toBe(false);
  });

  it('true 走默认配置', () => {
    const p = make(true);
    expect(p.getPagination.value).toMatchObject({ current: 1, pageSize: 10 });
  });

  it('setPagination 的内部状态优先于 props（翻页不被覆盖）', () => {
    const p = make({ current: 1, pageSize: 10 });
    p.setPagination({ current: 4 });
    expect((p.getPagination.value as PaginationProps).current).toBe(4);
  });

  it('setShowPagination(false) 后配置为 false，再打开恢复默认', () => {
    const p = make({ current: 2 });
    p.setShowPagination(false);
    expect(p.paginationRef.value).toBe(false);
    p.setShowPagination(true);
    expect((p.getPagination.value as PaginationProps).current).toBe(1);
  });

  it('props 里写死 false 时 getPagination 恒为 false，但内部状态仍可重建', () => {
    const p = make(false);
    p.setPagination({ pageSize: 50 });
    // 关掉分页的表：props 说了算，界面不出现分页器
    expect(p.getPagination.value).toBe(false);
    expect(p.paginationRef.value).toMatchObject({ current: 1, pageSize: 50 });
  });
});

describe('useLoading', () => {
  it('start / stop / set', () => {
    const { loadingRef, setLoading, startLoading, stopLoading } = useLoading();
    expect(loadingRef.value).toBe(false);
    startLoading();
    expect(loadingRef.value).toBe(true);
    stopLoading();
    setLoading(true);
    expect(loadingRef.value).toBe(true);
  });
});

const rows: Recordable[] = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
];

describe('useRowSelection', () => {
  const make = (rowSelection?: any, dataSource = rows) => {
    const dataSourceRef = ref<Recordable[]>([...dataSource]);
    return {
      dataSourceRef,
      ...useRowSelection({
        dataSourceRef,
        rowKey: computed(() => 'id'),
        rowSelection: computed(() => rowSelection),
      }),
    };
  };

  it('未配置 rowSelection 时返回 null', () => {
    const hook = make(undefined);
    expect(hook.getRowSelection.value).toBeNull();
  });

  it('布尔 true → 默认 checkbox 配置', () => {
    const hook = make(true);
    expect(hook.getRowSelection.value).toMatchObject({
      columnWidth: 48,
      type: 'checkbox',
    });
  });

  it('布尔 false → null', () => {
    expect(make(false).getRowSelection.value).toBeNull();
  });

  it('内部状态覆盖传入的 selectedRowKeys / onChange，但保留 type', () => {
    const hook = make({ selectedRowKeys: ['99'], type: 'radio' });
    expect(hook.getRowSelection.value!.type).toBe('radio');
    expect(hook.getRowSelection.value!.selectedRowKeys).toEqual([]);
  });

  it('onChange 同步 state，并回调用户自己的 onChange', () => {
    const userOnChange = vi.fn();
    const hook = make({ onChange: userOnChange });
    hook.getRowSelection.value!.onChange!([2], [rows[1]!], {
      type: 'single',
    });
    expect(hook.selectedRowKeysRef.value).toEqual([2]);
    expect(hook.getSelectRows()).toEqual([rows[1]]);
    expect(userOnChange).toHaveBeenCalledWith([2], [rows[1]], {
      type: 'single',
    });
  });

  it('setSelectedRowKeys 依据数据源回填 selectedRows', () => {
    const hook = make({});
    hook.setSelectedRowKeys(['1', '3']);
    expect(hook.getSelectRows().map((r) => r.id)).toEqual([1, 3]);
  });

  it('deleteSelectRowByKey 精确移除', () => {
    const hook = make({});
    hook.setSelectedRowKeys(['1', '2']);
    hook.deleteSelectRowByKey('1');
    expect(hook.selectedRowKeysRef.value).toEqual(['2']);
  });

  it('clearSelectedRowKeys 清空', () => {
    const hook = make({});
    hook.setSelectedRowKeys(['1']);
    hook.clearSelectedRowKeys();
    expect(hook.selectedRowKeysRef.value).toEqual([]);
    expect(hook.getSelectRows()).toEqual([]);
  });

  it('函数型 rowKey 参与选中行匹配', () => {
    const dataSourceRef = ref<Recordable[]>([{ code: 'x', id: 1 }]);
    const hook = useRowSelection({
      dataSourceRef,
      rowKey: computed(() => (record: Recordable) => record.code),
      rowSelection: computed(() => ({})),
    });
    hook.setSelectedRowKeys(['x']);
    expect(hook.getSelectRows()).toEqual([{ code: 'x', id: 1 }]);
  });

  it('数据源刷新后重新匹配选中行（引用换新也不丢选中）', async () => {
    const dataSourceRef = ref<Recordable[]>([...rows]);
    const hook = useRowSelection({
      dataSourceRef,
      rowKey: computed(() => 'id'),
      rowSelection: computed(() => ({})),
    });
    hook.setSelectedRowKeys(['2']);
    dataSourceRef.value = rows.map((r) => ({ ...r }));
    await nextTick();
    expect(hook.selectedRowKeysRef.value).toEqual(['2']);
    expect(hook.getSelectRows().map((r) => r.id)).toEqual([2]);
  });

  it('clearSelectOnPageChange：数据源变化即清空', async () => {
    const dataSourceRef = ref<Recordable[]>([...rows]);
    const hook = useRowSelection({
      clearSelectOnPageChange: true,
      dataSourceRef,
      rowKey: computed(() => 'id'),
      rowSelection: computed(() => ({})),
    });
    hook.setSelectedRowKeys(['2']);
    dataSourceRef.value = [...rows];
    await nextTick();
    expect(hook.selectedRowKeysRef.value).toEqual([]);
  });
});
