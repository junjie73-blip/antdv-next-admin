import type {
  BasicTableProps,
  Recordable,
  TableActionType,
  UseColumnsReturn,
  UseDataSourceReturn,
  UsePaginationReturn,
  UseRowSelectionReturn,
} from '../types';
import type { UseLoadingReturn } from './useLoading';
import type { UseTableRowsReturn } from './useTableRows';

export interface UseTableApiOptions {
  columns: UseColumnsReturn;
  dataSource: UseDataSourceReturn;
  /** 当前数据源快照：`expandAll` 要在它上面重算可展开 key */
  getDataSource: () => Recordable[];
  /** 组件根节点，`scrollTo` 从它往下找滚动容器 */
  getRoot: () => HTMLElement | undefined;
  /** 只用到 `setLoading`（`loadingRef` 由模板消费），所以按用到的形状收 */
  loading: Pick<UseLoadingReturn, 'setLoading'>;
  pagination: UsePaginationReturn;
  rowSelection: UseRowSelectionReturn;
  rows: UseTableRowsReturn;
  setProps: (props: Partial<BasicTableProps>) => void;
  /** 只用到 `getForm`：搜索表单实例可能还没 register 回来 */
  tableForm: { getForm: () => any };
}

/**
 * 对外 API（`TableActionType`）的装配处。
 *
 * 这份对象同时是 `emit('register')` 的载荷与 `defineExpose` 的出口，业务侧
 * `useTable()` 拿到的每个方法都从这里出。单独成一个 hook 有两个好处：改对外
 * 承诺时只看这一个文件就知道有没有破坏兼容；BasicTable 的 setup 不再被这
 * 四十多行装配占掉一半篇幅。
 *
 * 三条历史约束照原样保留：
 *
 * 1. `expandAll` 走"在当前数据源上重算可展开 key"，不是"把页面上看到的行都展开"
 *    —— 静态 `dataSource` 的树表没有取数环节，也必须能一键全展开。
 * 2. `scrollTo` 滚的是**真正的滚动容器**。原先是 `.basic-table-body`；模板换成
 *    shadcn 的 `Table` 原语后，`overflow-auto` 在那层 `data-slot="table-container"`
 *    上，外壳留着 `.basic-table-body` 只是给既有钩子兜底。所以先找容器、找不到
 *    再退回外壳，两种模板都能工作，不靠选择器版本赌运气。
 * 3. `updateFormSchema` / `appendFormSchema` / `removeFormSchema` 至今是空实现
 *    （搜索表单的 schema 由 `formConfig` 声明式给出，没有命令式入口）。这里保持
 *    空实现而不是顺手接上 `getForm()`：接上就是新增行为，本轮重构的口径是
 *    "对外一致"，补这个洞该单独开一条改动。
 */
export function useTableApi(options: UseTableApiOptions): TableActionType {
  const {
    columns,
    dataSource,
    getDataSource,
    getRoot,
    loading,
    pagination,
    rowSelection,
    rows,
    setProps,
    tableForm,
  } = options;

  /** 表单实例可能还没 `register` 回来（搜索表单是条件渲染的），统一走可选链 */
  const form = () => tableForm.getForm() as null | Recordable;

  /** 滚动容器：shadcn 原语那层优先，退回外壳兼容旧模板 */
  function scroller(): HTMLElement | null {
    const root = getRoot();
    return (
      (root?.querySelector('[data-slot="table-container"]') as HTMLElement) ??
      (root?.querySelector('.basic-table-body') as HTMLElement) ??
      null
    );
  }

  return {
    // 基础操作
    getRawDataSource: () => dataSource.rawDataSourceRef.value,
    // 高度自适应（`canResize`）目前是空实现，留着是因为对外 API 有这个名字
    redoHeight: async () => {},
    reload: dataSource.reload,
    setProps,
    setLoading: loading.setLoading,

    // 列操作
    getCacheColumns: columns.getCacheColumns,
    getColumns: columns.getColumns,
    getVisibleColumns: () =>
      columns.getColumns().filter((col) => col.ifShow !== false),
    setColumns: columns.setColumns,
    updateColumn: columns.updateColumn,

    // 行操作
    clearSelectedRowKeys: rowSelection.clearSelectedRowKeys,
    collapseAll: rows.collapseAll,
    collapseRows: rows.collapseRows,
    deleteSelectRowByKey: rowSelection.deleteSelectRowByKey,
    expandAll: () => rows.expandAll(getDataSource()),
    expandRows: rows.expandRows,
    getSelectRowKeys: () => rowSelection.selectedRowKeysRef.value,
    getSelectRows: rowSelection.getSelectRows,
    scrollTo: (pos: { left?: number; top?: number }) => {
      const el = scroller();
      if (!el) return;
      if (pos.top !== undefined) el.scrollTop = pos.top;
      if (pos.left !== undefined) el.scrollLeft = pos.left;
    },
    selectRows: rowSelection.setSelectedRowKeys,

    // 分页操作
    getPaginationRef: () => pagination.getPagination.value,
    getShowPagination: pagination.getShowPagination,
    setPagination: pagination.setPagination,
    setShowPagination: pagination.setShowPagination,

    // 表单操作
    appendFormSchema: () => {},
    getForm: tableForm.getForm,
    getFormValues: () => form()?.getFieldsValue?.() ?? {},
    removeFormSchema: () => {},
    resetForm: () => form()?.resetFields?.(),
    setFormValues: (values: Recordable) => form()?.setFieldsValue?.(values),
    submitForm: async () => form()?.submit?.(),
    updateFormSchema: () => {},
    validateForm: async () => form()?.validate?.() ?? {},

    // 数据操作
    deleteTableDataRecord: dataSource.deleteTableDataRecord,
    findTableDataRecord: dataSource.findTableDataRecord,
    getDataSource,
    insertTableDataRecord: dataSource.insertTableDataRecord,
    setTableData: dataSource.setTableData,
    updateTableDataRecord: dataSource.updateTableDataRecord,
  };
}
