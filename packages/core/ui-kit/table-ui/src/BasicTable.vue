<script setup lang="ts">
import type { ColumnFiltersState, SortingState } from '@tanstack/vue-table';

import type { CSSProperties } from 'vue';

import type { TableUIColumnDef } from './features';
import type {
  BasicColumn,
  BasicTableProps,
  Recordable,
  TableActionType,
  TableRowKey,
} from './types';

import {
  computed,
  defineComponent,
  h,
  isVNode,
  nextTick,
  onMounted,
  reactive,
  ref,
  unref,
  useSlots,
  watch,
} from 'vue';

import { BasicForm } from '@antdv/form-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useTable as useTanstackTable } from '@tanstack/vue-table';
import { isFunction, isString } from 'es-toolkit';

import TableAction from './components/TableAction.vue';
import TableEditableCell from './components/TableEditableCell.vue';
import TableHeaderCell from './components/TableHeaderCell.vue';
import TableImg from './components/TableImg.vue';
import TablePagination from './components/TablePagination.vue';
import TableSetting from './components/TableSetting.vue';
import { features } from './features';
import {
  convertColumns,
  filterVisibleColumns,
  formatCellValue,
  getColumnId,
  isImageList,
  readCellText,
} from './helper';
import { useColumns } from './hooks/useColumns';
import { useDataSource } from './hooks/useDataSource';
import { useDragSort } from './hooks/useDragSort';
import { useLoading } from './hooks/useLoading';
import { usePagination } from './hooks/usePagination';
import { useRowSelection } from './hooks/useRowSelection';
import { useTableForm } from './hooks/useTableForm';

// ============================================
// Props & Emits
// ============================================

const props = withDefaults(defineProps<BasicTableProps>(), {
  rowKey: 'id',
  showIndexColumn: false,
  immediate: true,
  canResize: false,
  resizeHeightOffset: 0,
  showHeader: true,
  size: 'small',
  showTableSetting: true,
  tableLayout: 'fixed',
  scroll: () => ({ y: 440 }),
  // 树表首屏默认全展开；显式传 false 才收起。Vue 会把缺省的布尔 prop 转成 false，
  // 不写这条默认值就等于把"没传"当成了"传了 false"。
  defaultExpandAllRows: true,
});

const emit = defineEmits<{
  (e: 'change', pagination: any, filters: any, sorter: any): void;
  (e: 'rowClick', record: any, index: number, event: Event): void;
  (e: 'rowDbClick', record: any, index: number, event: Event): void;
  (e: 'register', instance: TableActionType): void;
  (e: 'headerEdit', column: BasicColumn): void;
  (
    e: 'cellSave',
    payload: {
      column: BasicColumn;
      dataIndex: string | string[];
      record: Recordable;
      value: any;
    },
  ): void;
  (
    e: 'cellCancel',
    payload: {
      column: BasicColumn;
      dataIndex: string | string[];
      record: Recordable;
    },
  ): void;
  (
    e: 'cellChange',
    payload: {
      column: BasicColumn;
      dataIndex: string | string[];
      record: Recordable;
      value: any;
    },
  ): void;
}>();

const slots = useSlots();

// ============================================
// State
// ============================================

const propsRef = ref<Partial<BasicTableProps>>({});
const rootRef = ref<HTMLElement>();
/** 展开态的 key 列表（树形展开与 expandedRowRender 共用），类型跟着数据源走 */
const expandedRowKeysRef = ref<TableRowKey[]>([]);
/** TanStack 排序/筛选状态的本地镜像：受控 UI 与 change 事件都要读它 */
const sortingRef = ref<SortingState>([]);
const columnFiltersRef = ref<ColumnFiltersState>([]);
const filterOpenMap = ref<Record<string, boolean>>({});
const filterDraft = ref<Record<string, string[]>>({});

// ============================================
// Computed
// ============================================

const getMergedProps = computed((): BasicTableProps => {
  return {
    ...props,
    ...unref(propsRef),
  } as BasicTableProps;
});

const mergedRowKey = computed(
  () => (getMergedProps.value.rowKey as string) || 'id',
);
const mergedIsTree = computed(() => getMergedProps.value.isTree);
const mergedChildrenField = computed(
  () => getMergedProps.value.childrenColumnName || 'children',
);
const mergedScroll = computed(() => getMergedProps.value.scroll);
/** 数值 `scroll.y` 决定是否开内部滚动容器并钉住表头（与旧实现一致） */
const mergedScrollY = computed(() => {
  const y = mergedScroll.value?.y;
  return typeof y === 'number' ? y : undefined;
});
const mergedShowHeader = computed(
  () => getMergedProps.value.showHeader ?? true,
);
const mergedBordered = computed(() => getMergedProps.value.bordered);
const mergedRowClassName = computed(() => getMergedProps.value.rowClassName);
const mergedCellClassName = computed(() => getMergedProps.value.cellClassName);
const mergedEmptyText = computed(() => getMergedProps.value.emptyText);
const mergedActionColumn = computed(() => getMergedProps.value.actionColumn);
const mergedIndentSize = computed(() => getMergedProps.value.indentSize ?? 20);
const mergedSortDirections = computed(
  () => getMergedProps.value.sortDirections ?? ['ascend', 'descend'],
);

// ============================================
// Hooks
// ============================================

const { loadingRef, setLoading } = useLoading(props.loading);

const pagination = usePagination({
  pagination: computed(() => getMergedProps.value.pagination),
});

const columns = useColumns({
  columns: computed(() => getMergedProps.value.columns || []),
  showIndexColumn: computed(
    () => getMergedProps.value.showIndexColumn ?? false,
  ),
  indexColumnProps: props.indexColumnProps,
  actionColumn: computed(() => getMergedProps.value.actionColumn),
});

const dataSource = useDataSource({
  api: computed(() => getMergedProps.value.api),
  params: computed(() => getMergedProps.value.params || {}),
  dataSource: computed(() => getMergedProps.value.dataSource || []),
  beforeFetch: props.beforeFetch,
  afterFetch: props.afterFetch,
  fetchSetting: props.fetchSetting,
  rowKey: computed(() => getMergedProps.value.rowKey || 'id'),
  immediate: props.immediate,
  pagination: {
    getPagination: () => pagination.getPagination.value,
    setPagination: pagination.setPagination,
  },
  loading: { setLoading },
  fields: computed(() =>
    (getMergedProps.value.columns ?? [])
      .map((item) => item.dataIndex)
      .filter((dataIndex): dataIndex is string => isString(dataIndex)),
  ),
});

const rowSelection = useRowSelection({
  rowSelection: computed(() => getMergedProps.value.rowSelection),
  dataSourceRef: dataSource.dataSourceRef,
  rowKey: computed(() => getMergedProps.value.rowKey || 'id'),
});

const tableForm = useTableForm({
  baseProps: getMergedProps,
  propsRef,
  fetch: dataSource.fetch,
  setSearchInfo: dataSource.setSearchInfo,
});

// ============================================
// TanStack Table（排序 / 过滤 / 列宽管线）
// ============================================

/**
 * TanStack 的 `useTable` 接受 ref 形式的 `columns` / `data`，但要求的是**可写** ref
 * （`MaybeRef` → `Ref<T>`），而 `computed()` 在类型上是只读的，所以这里用 `ref`
 * + watcher 把本地状态同步进去；`enableColumnResizing` 之类是普通值，直接给 computed
 * 的 `.value` 语义由 `watch` 负责刷新。
 */
const tanstackColumns = ref<TableUIColumnDef[]>(
  convertColumns(columns.getColumns()),
);
const tanstackData = ref<Recordable[]>(dataSource.dataSourceRef.value);
const tanstackResize = ref(
  columns.getColumns().some((col) => col.resizable === true),
);

watch(
  columns.columnsRef,
  (cols) => {
    tanstackColumns.value = convertColumns(cols);
    tanstackResize.value = cols.some((col) => col.resizable === true);
  },
  { deep: true },
);

watch(
  dataSource.dataSourceRef,
  (rows) => {
    tanstackData.value = rows;
  },
  { deep: true },
);

/**
 * TanStack v9 的状态归属规则：只要给了 `onXxxChange`，变化就交给外部所有者，
 * 表实例自己**不再**保存这份状态。所以必须同时用 `state` 把我们的 ref 交回去，
 * 否则 `setSorting()` 只更新了镜像、行模型永远读到空数组 —— 表现就是"点了表头没反应"。
 */
const tanstackState = reactive({
  columnFilters: columnFiltersRef,
  sorting: sortingRef,
});

const tanstackTable = useTanstackTable({
  columns: tanstackColumns,
  data: tanstackData,
  state: tanstackState,
  enableColumnResizing: tanstackResize,
  columnResizeMode: 'onChange',
  features,
  onColumnFiltersChange: (updater) => {
    columnFiltersRef.value = isFunction(updater)
      ? updater(columnFiltersRef.value)
      : updater;
  },
  onSortingChange: (updater) => {
    sortingRef.value = isFunction(updater)
      ? updater(sortingRef.value)
      : updater;
  },
});

/**
 * v9 的行模型管线是 core → filtering → grouping → sorting → expanding → pagination，
 * 所以 `getFilteredRowModel()` 看不到排序结果。这里取排序阶段的模型：它上游就是过滤，
 * 拿到的既是过滤后的行、也排好了序；分页切片与树形摊平仍由本组件自己管。
 */
const filteredRows = computed(() => tanstackTable.getSortedRowModel().rows);

const getColumn = (id: string) => tanstackTable.getColumn(id);

const getHeader = (id: string) =>
  tanstackTable.getHeaderGroups()[0]?.headers.find((item) => item.column.id === id);

// ============================================
// 拖拽排序（dragSort / dragSortConfig）
// ============================================

const dragSortCtl = useDragSort({
  dataSource: dataSource.dataSourceRef,
  get enabled() {
    return getMergedProps.value.dragSort === true;
  },
  get handle() {
    return getMergedProps.value.dragSortConfig?.handle;
  },
  get animation() {
    return getMergedProps.value.dragSortConfig?.animation;
  },
  get disabled() {
    return getMergedProps.value.dragSortConfig?.disabled;
  },
  get canDrop() {
    return getMergedProps.value.dragSortConfig?.canDrop;
  },
  onDragEnd: (newData, oldData) => {
    // 钩子只写回 dataSourceRef，这里补一份 rawDataSourceRef，
    // 否则「重置数据」会把拖好的顺序退回拖之前的那份快照。
    dataSource.setTableData(newData);
    getMergedProps.value.dragSortConfig?.onDragEnd?.(newData, oldData);
  },
});

/**
 * Sortable 绑的是 `<tbody>` 节点本身，行是后来才有的（`api` 表首屏为空）也不影响，
 * 所以只需要在挂载后绑一次；`dragSort` 中途被关掉就解绑。
 */
async function syncDragSort() {
  if (!getMergedProps.value.dragSort) {
    dragSortCtl.destroySortable();
    return;
  }
  await nextTick();
  const tbody = rootRef.value?.querySelector('.basic-table-tbody');
  if (tbody) dragSortCtl.initSortable(tbody as HTMLElement);
}

watch(
  () => getMergedProps.value.dragSort,
  () => {
    dragSortCtl.destroySortable();
    void syncDragSort();
  },
);

// ============================================
// 列 / 数据
// ============================================

const visibleColumns = computed(() =>
  filterVisibleColumns(columns.getColumns()),
);

const getDataSource = computed(() => unref(dataSource.dataSourceRef));

/**
 * 递归收集所有可展开的 key（支持多级子节点）。
 *
 * ⚠️ 这里**不做 `String()` 归一**：展开态的比较是 `expandedRowKeys.includes(rowKey)`，
 * 而 `rowKey` 取的是 `record[idKey]` 本体。业务表的主键几乎都是数字（菜单/部门的 id），
 * 一旦转成字符串，`['1'].includes(1)` 恒为 false —— 表现是"树表首屏全是折叠状态、
 * 手动点一下才展开"。数字表键交数字，字符串表键交字符串，跟着数据源走才对齐。
 */
function collectExpandableKeys(list: Recordable[]): TableRowKey[] {
  const keys: TableRowKey[] = [];
  const childrenField = mergedChildrenField.value;
  const rowKey = mergedRowKey.value;
  const walk = (arr: Recordable[]) => {
    for (const item of arr) {
      const children = item?.[childrenField];
      if (Array.isArray(children) && children.length > 0) {
        keys.push(item[rowKey] as TableRowKey);
        walk(children);
      }
    }
  };
  walk(list);
  return keys;
}

// 树形数据就绪后自动展开所有节点
// ⭐ flush: 'post' 避免在渲染前同步触发，减少一次多余渲染
// ⭐ immediate: 静态 `dataSource` + `isTree` 的表没有取数环节，
//   `useDataSource` 在 setup 阶段就把数据同步写进了 dataSourceRef ——
//   非 immediate 的 watcher 看不到"注册之前就已经发生的那次变化"，
//   于是这类表首屏一行子项都不展开。
watch(
  getDataSource,
  (data) => {
    if (!mergedIsTree.value) return;
    if (
      getMergedProps.value.defaultExpandAllRows === false &&
      expandedRowKeysRef.value.length > 0
    ) {
      return;
    }
    if (getMergedProps.value.defaultExpandAllRows === false) {
      expandedRowKeysRef.value = [];
      return;
    }
    if (data.length > 0) {
      expandedRowKeysRef.value = collectExpandableKeys(data);
    }
  },
  { flush: 'post', immediate: true },
);

/** 当前页的行：服务端分页（配了 api）原样渲染取数结果，客户端分页本地切片 */
const pageRows = computed(() => {
  const rows = filteredRows.value;
  const cfg = pagination.getPagination.value;
  if (!cfg) return rows;
  if (getMergedProps.value.api) return rows;
  const pageSize = cfg.pageSize ?? 10;
  const start = ((cfg.current ?? 1) - 1) * pageSize;
  return rows.slice(start, start + pageSize);
});

function getRowKeyValue(record: Recordable): TableRowKey {
  const rowKey = getMergedProps.value.rowKey;
  if (isFunction(rowKey)) return rowKey(record);
  return record?.[(rowKey as string) || 'id'] as TableRowKey;
}

/** 树形展开：把当前页按 children 字段摊平成带缩进的可见行 */
const displayRows = computed(() => {
  const result: Array<{
    depth: number;
    index: number;
    record: Recordable;
    rowKey: TableRowKey;
  }> = [];
  const childrenField = mergedChildrenField.value;
  const isTree = mergedIsTree.value;
  let counter = 0;
  const walk = (record: Recordable, depth: number) => {
    const rowKey = getRowKeyValue(record);
    result.push({ depth, index: counter++, record, rowKey });
    const children = record?.[childrenField];
    if (
      isTree &&
      Array.isArray(children) &&
      children.length > 0 &&
      expandedRowKeysRef.value.includes(rowKey)
    ) {
      for (const child of children) walk(child, depth + 1);
    }
  };
  for (const row of pageRows.value) walk(row.original, 0);
  return result;
});

/** 首个数据列（序号列/操作列不参与缩进），树形展开图标与缩进挂在这一列 */
const firstRenderedColumnId = computed(() => {
  const first = visibleColumns.value[0];
  if (!first) return '';
  const candidate = visibleColumns.value.find(
    (col) => col.key !== 'index' && col.key !== 'action',
  );
  return getColumnId(candidate ?? first);
});

const hasExpandedRowRender = computed(
  () =>
    Boolean(getMergedProps.value.expandedRowRender) ||
    Boolean(slots.expandedRowRender),
);

const canRowExpand = (record: Recordable) => {
  const rowExpandable = getMergedProps.value.rowExpandable;
  return rowExpandable ? rowExpandable(record) : true;
};

const showTreeToggle = (col: BasicColumn, record: Recordable) =>
  mergedIsTree.value &&
  getColumnId(col) === firstRenderedColumnId.value &&
  Array.isArray(record?.[mergedChildrenField.value]) &&
  record[mergedChildrenField.value].length > 0;

const showRowToggle = (col: BasicColumn, record: Recordable) =>
  !mergedIsTree.value &&
  hasExpandedRowRender.value &&
  getColumnId(col) === firstRenderedColumnId.value &&
  canRowExpand(record);

const isRowExpanded = (rowKey: TableRowKey) =>
  expandedRowKeysRef.value.includes(rowKey);

function toggleRowExpand(record: Recordable) {
  const rowKey = getRowKeyValue(record);
  const willExpand = !isRowExpanded(rowKey);
  expandedRowKeysRef.value = willExpand
    ? [...expandedRowKeysRef.value, rowKey]
    : expandedRowKeysRef.value.filter((key) => key !== rowKey);
  getMergedProps.value.onExpand?.(willExpand, record);
  const onChange =
    getMergedProps.value.expandable?.onExpandedRowsChange ??
    getMergedProps.value.onExpandedRowsChange;
  onChange?.(expandedRowKeysRef.value);
}

// ============================================
// 行选择
// ============================================

const getRowSelection = computed(() => rowSelection.getRowSelection.value);

const selectionType = computed(
  () => getRowSelection.value?.type ?? 'checkbox',
);

/**
 * 选中态用的是**字符串化**的 rowKey —— 与 `useRowSelection` 内部的 `getRowKeyValue`
 * 保持一致（那边就是 `String(record[rowKey])`），否则数字主键的表永远勾选不上。
 * 展开态相反，必须交原始值（见 `collectExpandableKeys` 的说明）。
 */
const selectionKey = (record: Recordable): string =>
  String(getRowKeyValue(record));

const isSelected = (record: Recordable) =>
  (getRowSelection.value?.selectedRowKeys ?? []).includes(
    selectionKey(record) as never,
  );

function toggleRowSelection(record: Recordable) {
  const cfg = getRowSelection.value;
  if (!cfg) return;
  const key = selectionKey(record);
  const current = (cfg.selectedRowKeys ?? []) as string[];
  const index = current.indexOf(key);
  let keys: string[];
  if (selectionType.value === 'radio') {
    keys = index === -1 ? [key] : [];
  } else if (index === -1) {
    keys = [...current, key];
  } else {
    keys = current.filter((item) => item !== key);
  }
  const keySet = new Set(keys);
  const rows = dataSource.dataSourceRef.value.filter((item) =>
    keySet.has(selectionKey(item)),
  );
  cfg.onChange?.(keys, rows, { type: 'multiple' });
}

const selectableRecords = computed(() =>
  displayRows.value
    .map((row) => row.record)
    .filter(
      (record) => !getRowSelection.value?.getCheckboxProps?.(record)?.disabled,
    ),
);

const isAllSelected = computed(
  () =>
    selectableRecords.value.length > 0 &&
    selectableRecords.value.every((record) => isSelected(record)),
);

const isIndeterminate = computed(() => {
  const selectedCount = selectableRecords.value.filter((record) =>
    isSelected(record),
  ).length;
  return selectedCount > 0 && selectedCount < selectableRecords.value.length;
});

function toggleAllSelection() {
  const cfg = getRowSelection.value;
  if (!cfg || cfg.hideSelectAll) return;
  if (isAllSelected.value) {
    cfg.onChange?.([], [], { type: 'all' });
    return;
  }
  cfg.onChange?.(
    selectableRecords.value.map((record) => selectionKey(record)),
    selectableRecords.value,
    { type: 'all' },
  );
}

const getCheckboxDisabled = (record: Recordable) =>
  getRowSelection.value?.getCheckboxProps?.(record)?.disabled ?? false;

// ============================================
// 排序 / 过滤
// ============================================

const getSortOrder = (columnId: string): 'asc' | 'desc' | undefined => {
  const entry = sortingRef.value.find((item) => item.id === columnId);
  if (!entry) return undefined;
  return entry.desc ? 'desc' : 'asc';
};

/**
 * antd 的排序循环：none → 首个方向 → 次个方向 → none。
 * `sortDirections` 决定可用方向与顺序（默认 ascend → descend）。
 */
async function handleSort(col: BasicColumn) {
  if (!col.sorter) return;
  const id = getColumnId(col);
  const orders = mergedSortDirections.value;
  const current = sortingRef.value.find((item) => item.id === id);
  const currentOrder = current ? (current.desc ? 'descend' : 'ascend') : undefined;
  const index = currentOrder ? orders.indexOf(currentOrder) : -1;
  const nextOrder = index + 1 < orders.length ? orders[index + 1] : undefined;

  tanstackTable.setSorting(
    nextOrder ? [{ desc: nextOrder === 'descend', id }] : [],
  );
  await nextTick();
  await refetchOnChange();
}

function buildSorterPayload() {
  const entry = sortingRef.value[0];
  if (!entry) return {};
  const col = columns
    .getColumns()
    .find((item) => getColumnId(item) === entry.id);
  return {
    column: col,
    columnKey: entry.id,
    field: col?.dataIndex ?? entry.id,
    order: entry.desc ? 'descend' : 'ascend',
  };
}

function buildFiltersPayload(): Recordable {
  const filters: Recordable = {};
  for (const item of columnFiltersRef.value) {
    if (Array.isArray(item.value) && item.value.length > 0) {
      filters[item.id] = item.value;
    }
  }
  return filters;
}

/** 排序/筛选/分页变化后的统一收尾：取数 + 向外抛 change */
async function refetchOnChange() {
  await nextTick();
  await dataSource.fetch();
  emit(
    'change',
    pagination.getPagination.value || undefined,
    buildFiltersPayload(),
    buildSorterPayload(),
  );
}

const getFilterValue = (columnId: string): string[] => {
  const entry = columnFiltersRef.value.find((item) => item.id === columnId);
  return Array.isArray(entry?.value) ? (entry!.value as string[]) : [];
};

function openFilter(columnId: string) {
  filterDraft.value[columnId] = [...getFilterValue(columnId)];
  filterOpenMap.value[columnId] = true;
}

function confirmFilter(col: BasicColumn) {
  const columnId = getColumnId(col);
  getColumn(columnId)?.setFilterValue(filterDraft.value[columnId] ?? []);
  filterOpenMap.value[columnId] = false;
  void refetchOnChange();
}

function clearFilter(col: BasicColumn) {
  filterDraft.value[getColumnId(col)] = [];
  confirmFilter(col);
}

const isFilterActive = (col: BasicColumn) =>
  getFilterValue(getColumnId(col)).length > 0;

// ============================================
// 分页
// ============================================

/**
 * 分页页码窗口交给 reka 的 Pagination 算（首尾恒定可见，中间随当前页滑动），
 * 这里只留 `pageCount` 给快速跳至做越界判定。
 */
const paginationInfo = computed(() => {
  const cfg = pagination.getPagination.value;
  if (!cfg) return null;
  const rowCount = filteredRows.value.length;
  const total = getMergedProps.value.api
    ? (cfg.total ?? rowCount)
    : rowCount;
  const pageSize = cfg.pageSize ?? 10;
  const current = cfg.current ?? 1;
  const pageCount = Math.max(1, Math.ceil((total || 1) / pageSize));
  return {
    current,
    pageCount,
    pageSize,
    pageSizeOptions: cfg.pageSizeOptions,
    showQuickJumper: cfg.showQuickJumper !== false,
    showSizeChanger: cfg.showSizeChanger !== false,
    showTotal: cfg.showTotal,
    total,
  };
});

async function changePage(current: number) {
  const cfg = paginationInfo.value;
  if (!cfg || current === cfg.current) return;
  if (current < 1 || current > cfg.pageCount) return;
  pagination.setPagination({ current, pageSize: cfg.pageSize });
  await refetchOnChange();
}

async function changePageSize(size: number) {
  const cfg = paginationInfo.value;
  if (!cfg || size === cfg.pageSize) return;
  pagination.setPagination({ current: 1, pageSize: size });
  await refetchOnChange();
}

// ============================================
// Methods
// ============================================

function setProps(p: Partial<BasicTableProps>) {
  propsRef.value = { ...unref(propsRef), ...p };
}

function getActions(record: Recordable): any[] {
  const actionColumn = getMergedProps.value.actionColumn;
  if (!actionColumn?.actions) return [];
  return actionColumn.actions(record);
}

/**
 * VNode 渲染辅助组件
 * Vue 3 模板里无法直接把 VNode 作为插值渲染，需要一个包装组件
 */
const RenderVNode = defineComponent({
  name: 'RenderVNode',
  props: {
    vnode: {
      type: [Object, Array, String, Number, Boolean],
      default: null,
    },
  },
  setup(p) {
    return () => p.vnode as any;
  },
});

/**
 * 统一单元格渲染
 * 优先级：customRender > format > edit > image > default
 * 注意：这里不处理 `cell-*` 插槽，插槽在模板里优先拦截
 */
function renderCellContent(
  column: BasicColumn,
  text: any,
  record: Recordable,
  index: number,
): any {
  // 1. customRender 优先
  if (column.customRender) {
    return column.customRender({ text, record, index, column });
  }

  // 2. 格式化（format 是字符串模板或函数）
  if (column.format) {
    const formatted = formatCellValue(column.format, text, record, index);
    return isVNode(formatted)
      ? h('span', formatted)
      : h('span', { innerHTML: formatted });
  }

  // 3. 可编辑单元格
  if (column.edit || column.editRow) {
    return h(TableEditableCell, {
      column,
      record,
      value: text,
      dataIndex: column.dataIndex,
      onSave: handleCellSave,
      onCancel: handleCellCancel,
      onChange: handleCellChange,
    });
  }

  // 4. 图片列
  if (isImageList(text)) {
    return h(TableImg, { imgList: text, size: 40, simpleShow: true });
  }

  // 5. 默认
  return isVNode(text) ? h(() => text) : h('span', text ?? '');
}

function handleUpdateColumns(newColumns: BasicColumn[]) {
  columns.setColumns(newColumns);
}

function handleResetColumns() {
  columns.setColumns(columns.getCacheColumns());
}

function handleHeaderEdit(column: BasicColumn) {
  emit('headerEdit', column);
}

function handleCellSave(payload: {
  column: BasicColumn;
  dataIndex: string | string[];
  record: Recordable;
  value: any;
}) {
  emit('cellSave', payload);
}

function handleCellCancel(payload: {
  column: BasicColumn;
  dataIndex: string | string[];
  record: Recordable;
}) {
  emit('cellCancel', payload);
}

function handleCellChange(payload: {
  column: BasicColumn;
  dataIndex: string | string[];
  record: Recordable;
  value: any;
}) {
  emit('cellChange', payload);
}

// ============================================
// 样式
// ============================================

const tableContainerClassName = computed(() =>
  cn('basic-table w-full', getMergedProps.value.canResize && 'h-full'),
);

const bodyClassName = computed(() =>
  cn(
    'basic-table-body relative w-full overflow-auto',
    mergedBordered.value &&
      'border border-gray-200 dark:border-gray-800',
  ),
);

const bodyStyle = computed<CSSProperties | undefined>(() =>
  mergedScrollY.value === undefined
    ? undefined
    : { maxHeight: `${mergedScrollY.value}px` },
);

const tableStyle = computed<CSSProperties | undefined>(() => {
  const x = mergedScroll.value?.x;
  if (typeof x === 'number') return { minWidth: `${x}px` };
  if (typeof x === 'string') return { minWidth: x };
  return undefined;
});

/** 列宽：TanStack 的实测宽（可拖拽列）优先，其次声明宽 */
const colSize = (col: BasicColumn): number | string | undefined => {
  const column = getColumn(getColumnId(col));
  if (column?.getCanResize()) return column.getSize();
  return col.width;
};

const stickyPosition = (col: BasicColumn) =>
  col.fixed || col.key === 'action' ? 'sticky' : undefined;

function stickyLeft(col: BasicColumn): string | undefined {
  if (col.fixed !== 'left') return undefined;
  let offset = 0;
  for (const item of visibleColumns.value) {
    if (item === col) break;
    if (item.fixed !== 'left') continue;
    offset += Number(colSize(item)) || 0;
  }
  return `${offset}px`;
}

function stickyRight(col: BasicColumn): string | undefined {
  const isRight = col.fixed === 'right' || (!col.fixed && col.key === 'action');
  if (!isRight) return undefined;
  let offset = 0;
  let passedSelf = false;
  for (let i = visibleColumns.value.length - 1; i >= 0; i -= 1) {
    const item = visibleColumns.value[i]!;
    if (item === col) {
      passedSelf = true;
      continue;
    }
    if (!passedSelf) continue;
    const itemIsRight =
      item.fixed === 'right' || (!item.fixed && item.key === 'action');
    if (!itemIsRight) continue;
    offset += Number(colSize(item)) || 0;
  }
  return `${offset}px`;
}

const headStyle = (col: BasicColumn): CSSProperties => {
  const size = colSize(col);
  return {
    left: stickyLeft(col),
    minWidth: typeof size === 'number' ? `${size}px` : size,
    position: stickyPosition(col),
    right: stickyRight(col),
    width: typeof size === 'number' ? `${size}px` : size,
    ...(col.headerStyle || {}),
  };
};

const cellStyleOf = (
  col: BasicColumn,
  record: Recordable,
  index: number,
): CSSProperties => {
  const custom = isFunction(col.cellStyle)
    ? col.cellStyle(record, index)
    : col.cellStyle;
  return {
    ...(custom || {}),
    left: stickyLeft(col),
    position: stickyPosition(col),
    right: stickyRight(col),
  };
};

const alignClass = (col: BasicColumn, header = false) => {
  const align =
    (header ? (col.headerAlign ?? col.align) : col.align) || 'left';
  if (align === 'center') return 'text-center';
  return align === 'right' ? 'text-right' : 'text-left';
};

const headClass = (col: BasicColumn) =>
  cn(
    'basic-table-head px-2 py-2 align-middle text-xs font-medium text-gray-500 dark:text-gray-400',
    'bg-gray-50 dark:bg-gray-800/60',
    mergedScrollY.value !== undefined && 'sticky top-0 z-10',
    col.sorter && 'cursor-pointer select-none',
    col.className,
    col.headerClassName,
  );

const cellClass = (col: BasicColumn, record: Recordable, index: number) => {
  const userClass = isFunction(mergedCellClassName.value)
    ? mergedCellClassName.value(record, index, col)
    : mergedCellClassName.value;
  return cn(
    'px-2 py-1.5 align-middle',
    col.ellipsis ? 'max-w-[1px] truncate' : 'whitespace-nowrap',
    col.className,
    userClass,
  );
};

const rowClass = (record: Recordable, index: number) => {
  const userClass = isFunction(mergedRowClassName.value)
    ? mergedRowClassName.value(record, index)
    : mergedRowClassName.value;
  return cn(
    'basic-table-row border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40',
    userClass,
    isSelected(record) && 'bg-primary/5',
  );
};

const getRowProps = (record: Recordable, index: number) => {
  const userOnRow = getMergedProps.value.onRow;
  const userProps = userOnRow?.(record, index) || {};
  return {
    ...userProps,
    class: cn(rowClass(record, index), userProps.class),
    onClick: (event: MouseEvent) => {
      emit('rowClick', record, index, event);
      userProps.onClick?.(event);
    },
    onDblclick: (event: MouseEvent) => {
      emit('rowDbClick', record, index, event);
      userProps.onDblclick?.(event);
    },
    style: userProps.style,
  };
};

const getHeaderRowProps = (index: number) => {
  const userProps = getMergedProps.value.onHeaderRow?.(
    columns.getColumns(),
    index,
  );
  if (!userProps) return undefined;
  return { ...userProps, class: cn(userProps.class) };
};

const showSearchForm = computed(
  () => getMergedProps.value.useSearchForm && getMergedProps.value.formConfig,
);

const showTableSetting = computed(() => getMergedProps.value.showTableSetting);

const tableSettingConfig = computed(
  () =>
    getMergedProps.value.tableSetting || {
      fullScreen: true,
      redo: true,
      setting: true,
    },
);

const emptyTextContent = computed(() => {
  const locale = getMergedProps.value.locale as any;
  return locale?.emptyText ?? mergedEmptyText.value ?? '暂无数据';
});

const totalColumnCount = computed(
  () => visibleColumns.value.length + (getRowSelection.value ? 1 : 0),
);

const renderTitle = computed(() => {
  const title = getMergedProps.value.title;
  if (!title) return undefined;
  return isFunction(title) ? title(getDataSource.value) : title;
});

const mergedFooter = computed(() => {
  const footer = getMergedProps.value.footer;
  return footer ? footer(getDataSource.value) : undefined;
});

const mergedSummary = computed(() => {
  const summary = getMergedProps.value.summary;
  return summary ? summary(getDataSource.value) : undefined;
});

const resizeHandler = (col: BasicColumn) => {
  const header = getHeader(getColumnId(col));
  return header ? header.getResizeHandler() : undefined;
};

const getCellText = (col: BasicColumn, record: Recordable) =>
  readCellText(record, col);

// ============================================
// Table Action Type
// ============================================

const tableActionType: TableActionType = {
  // 基础操作
  setProps,
  reload: dataSource.reload,
  setLoading,
  getRawDataSource: () => unref(dataSource.rawDataSourceRef),
  redoHeight: async () => {},

  // 列操作
  setColumns: columns.setColumns,
  getColumns: columns.getColumns,
  updateColumn: columns.updateColumn,
  getVisibleColumns: () =>
    columns.getColumns().filter((col) => col.ifShow !== false),
  getCacheColumns: columns.getCacheColumns,

  // 行操作
  expandAll: () => {
    expandedRowKeysRef.value = collectExpandableKeys(getDataSource.value);
  },
  collapseAll: () => {
    expandedRowKeysRef.value = [];
  },
  expandRows: (keys: string[]) => {
    const currentKeys = new Set<TableRowKey>(expandedRowKeysRef.value);
    keys.forEach((key) => currentKeys.add(key));
    expandedRowKeysRef.value = [...currentKeys];
  },
  collapseRows: (keys: string[]) => {
    const keySet = new Set<TableRowKey>(keys);
    expandedRowKeysRef.value = expandedRowKeysRef.value.filter(
      (key) => !keySet.has(key),
    );
  },
  scrollTo: (pos: { left?: number; top?: number }) => {
    const bodyEl = rootRef.value?.querySelector(
      '.basic-table-body',
    ) as HTMLElement | null;
    if (!bodyEl) return;
    if (pos.top !== undefined) bodyEl.scrollTop = pos.top;
    if (pos.left !== undefined) bodyEl.scrollLeft = pos.left;
  },
  selectRows: rowSelection.setSelectedRowKeys,
  getSelectRows: rowSelection.getSelectRows,
  getSelectRowKeys: () => unref(rowSelection.selectedRowKeysRef),
  clearSelectedRowKeys: rowSelection.clearSelectedRowKeys,
  deleteSelectRowByKey: rowSelection.deleteSelectRowByKey,

  // 分页操作
  getPaginationRef: () => pagination.getPagination.value,
  setPagination: pagination.setPagination,
  setShowPagination: pagination.setShowPagination,
  getShowPagination: pagination.getShowPagination,

  // 表单操作
  getFormValues: () => (tableForm.getForm() as any)?.getFieldsValue?.() ?? {},
  setFormValues: (values: Recordable) =>
    (tableForm.getForm() as any)?.setFieldsValue?.(values),
  resetForm: () => (tableForm.getForm() as any)?.resetFields?.(),
  submitForm: async () => (tableForm.getForm() as any)?.submit?.(),
  validateForm: async () => (tableForm.getForm() as any)?.validate?.() ?? {},
  updateFormSchema: () => {},
  appendFormSchema: () => {},
  removeFormSchema: () => {},
  getForm: () => tableForm.getForm() as any,

  // 数据操作
  insertTableDataRecord: dataSource.insertTableDataRecord,
  deleteTableDataRecord: dataSource.deleteTableDataRecord,
  updateTableDataRecord: dataSource.updateTableDataRecord,
  findTableDataRecord: dataSource.findTableDataRecord,
  getDataSource: () => unref(dataSource.dataSourceRef),
  setTableData: dataSource.setTableData,
};

// ============================================
// Lifecycle
// ============================================

onMounted(() => {
  emit('register', tableActionType);
  void syncDragSort();
});

defineExpose(tableActionType);
</script>

<template>
  <div ref="rootRef" :class="tableContainerClassName">
    <!-- 搜索表单 -->
    <div v-if="showSearchForm" class="mb-2">
      <BasicForm
        v-bind="tableForm.getFormProps"
        @register="tableForm.registerForm"
      />
    </div>

    <div
      v-if="showSearchForm"
      class="mb-2 border-t border-gray-200 dark:border-gray-700"
    ></div>

    <!-- 工具栏 -->
    <div
      v-if="showTableSetting || $slots.toolbar || renderTitle"
      class="mb-4 flex items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="renderTitle"
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <RenderVNode :vnode="renderTitle" />
        </span>
        <slot name="toolbar"></slot>
      </div>
      <TableSetting
        v-if="showTableSetting"
        :setting="tableSettingConfig"
        :columns="columns.getColumns()"
        :cache-columns="columns.getCacheColumns()"
        @redo="dataSource.reload"
        @update:columns="handleUpdateColumns"
        @reset="handleResetColumns"
      />
    </div>

    <div :class="bodyClassName" :style="bodyStyle">
      <div
        v-if="loadingRef"
        class="basic-table-loading absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-900/60"
      >
        <Icon class="animate-spin text-base text-primary" icon="ant-design:loading-outlined" />
      </div>

      <table
        class="w-full caption-bottom text-sm"
        :class="mergedBordered ? 'border-collapse' : ''"
        :style="tableStyle"
      >
        <caption v-if="getMergedProps.caption" class="caption-top py-2 text-left text-xs text-gray-500">
          <RenderVNode :vnode="getMergedProps.caption" />
        </caption>

        <thead v-if="mergedShowHeader" class="basic-table-header">
          <tr v-bind="getHeaderRowProps(0)" class="border-b border-gray-200 dark:border-gray-800">
            <!-- 选择列表头 -->
            <th
              v-if="getRowSelection"
              :class="cn(headClass({ key: 'ant-table-selection-column' }), 'text-center')"
              :style="{
                position: getRowSelection?.fixed ? 'sticky' : undefined,
                right: getRowSelection?.fixed === 'right' ? '0px' : undefined,
                left: getRowSelection?.fixed === 'left' ? '0px' : undefined,
                width: getRowSelection?.columnWidth
                  ? `${getRowSelection.columnWidth}px`
                  : undefined,
              }"
            >
              <input
                v-if="!getRowSelection?.hideSelectAll && selectionType !== 'radio'"
                aria-label="全选"
                class="basic-table-select-all cursor-pointer accent-primary"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                type="checkbox"
                @change="toggleAllSelection"
              />
            </th>

            <th
              v-for="col in visibleColumns"
              :key="getColumnId(col)"
              :class="cn(headClass(col), alignClass(col, true))"
              :data-column-key="getColumnId(col)"
              :title="col.sorter && getMergedProps.showSorterTooltip !== false ? '点击排序' : undefined"
              :style="headStyle(col)"
              @click="col.sorter ? handleSort(col) : undefined"
            >
              <TableHeaderCell :column="col" @edit="handleHeaderEdit">
                <slot :name="`header-${col.key}`" :column="col"></slot>

                <span
                  v-if="col.sorter"
                  class="ml-1 flex flex-col leading-[0]"
                  :class="getSortOrder(getColumnId(col)) ? 'text-primary' : 'text-gray-300 dark:text-gray-600'"
                >
                  <Icon
                    :class="getSortOrder(getColumnId(col)) === 'asc' ? '' : 'opacity-40'"
                    icon="ant-design:caret-up-filled"
                  />
                  <Icon
                    :class="getSortOrder(getColumnId(col)) === 'desc' ? '' : 'opacity-40'"
                    icon="ant-design:caret-down-filled"
                  />
                </span>

                <Popover
                  v-if="col.filters?.length"
                  :open="filterOpenMap[getColumnId(col)]"
                  @update:open="(v: boolean) => (filterOpenMap[getColumnId(col)] = v)"
                >
                  <PopoverTrigger
                    aria-label="筛选"
                    class="ml-1"
                    @click.stop="openFilter(getColumnId(col))"
                  >
                    <Icon
                      :class="
                        isFilterActive(col)
                          ? 'text-primary'
                          : 'text-gray-400 dark:text-gray-500'
                      "
                      class="text-sm"
                      icon="ant-design:filter-filled"
                    />
                  </PopoverTrigger>
                  <PopoverContent align="start" class="basic-table-filter-panel w-48 p-2">
                    <div class="max-h-48 overflow-y-auto">
                      <label
                        v-for="item in col.filters"
                        :key="item.value"
                        class="flex cursor-pointer items-center gap-2 py-1 text-sm"
                      >
                        <input
                          v-model="filterDraft[getColumnId(col)]"
                          :value="item.value"
                          class="accent-primary"
                          type="checkbox"
                        />
                        <span>{{ item.text }}</span>
                      </label>
                    </div>
                    <div class="mt-2 flex items-center justify-end gap-2">
                      <Button
                        class="basic-table-filter-reset"
                        size="xs"
                        variant="outline"
                        @click="clearFilter(col)"
                      >
                        重置
                      </Button>
                      <Button class="basic-table-filter-confirm" size="xs" @click="confirmFilter(col)">
                        确定
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <span
                  v-if="col.resizable"
                  class="basic-table-resize-handle -mr-2 ml-1 h-4 w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-primary dark:bg-gray-700"
                  @click.stop
                  @mousedown.stop="
                    (e: MouseEvent) => resizeHandler(col)?.(e)
                  "
                  @touchstart.stop="
                    (e: TouchEvent) => resizeHandler(col)?.(e)
                  "
                ></span>
              </TableHeaderCell>
            </th>
          </tr>
        </thead>

        <tbody class="basic-table-tbody">
          <template v-for="row in displayRows" :key="String(row.rowKey)">
            <tr
              v-bind="getRowProps(row.record, row.index)"
              :data-row-key="String(row.rowKey)"
            >
              <!-- 选择列 -->
              <td
                v-if="getRowSelection"
                :class="cn('px-2 py-1.5 text-center align-middle', getRowSelection?.fixed && 'sticky')"
                :style="{
                  left: getRowSelection?.fixed === 'left' ? '0px' : undefined,
                  right: getRowSelection?.fixed === 'right' ? '0px' : undefined,
                }"
              >
                <input
                  :aria-label="`选择第 ${row.index + 1} 行`"
                  :checked="isSelected(row.record)"
                  class="basic-table-row-checkbox cursor-pointer accent-primary"
                  :disabled="getCheckboxDisabled(row.record)"
                  :type="selectionType"
                  @click.stop
                  @change="toggleRowSelection(row.record)"
                />
              </td>

              <td
                v-for="col in visibleColumns"
                :key="getColumnId(col)"
                :class="cn(cellClass(col, row.record, row.index), alignClass(col))"
                :style="cellStyleOf(col, row.record, row.index)"
              >
                <!-- 序号列 -->
                <template v-if="col.key === 'index'">
                  <slot
                    name="index"
                    :column="col"
                    :index="row.index"
                    :record="row.record"
                    :text="undefined"
                  >
                    {{ row.index + 1 }}
                  </slot>
                </template>

                <!-- 操作列 -->
                <template v-else-if="col.key === 'action'">
                  <slot
                    name="action"
                    :column="col"
                    :index="row.index"
                    :record="row.record"
                  >
                    <TableAction
                      :actions="getActions(row.record)"
                      :max-show-count="mergedActionColumn?.maxShowCount || 4"
                      :record="row.record"
                    />
                  </slot>
                </template>

                <!-- 普通单元格：插槽优先，其次 customRender / format / edit / 图片 / 默认 -->
                <template v-else>
                  <slot
                    v-if="$slots[`cell-${col.key}`]"
                    :name="`cell-${col.key}`"
                    :column="col"
                    :index="row.index"
                    :record="row.record"
                    :text="getCellText(col, row.record)"
                  ></slot>

                  <slot
                    v-else-if="
                      typeof col.dataIndex === 'string' &&
                      $slots[`cell-${col.dataIndex}`]
                    "
                    :name="`cell-${col.dataIndex}`"
                    :column="col"
                    :index="row.index"
                    :record="row.record"
                    :text="getCellText(col, row.record)"
                  ></slot>

                  <slot
                    v-else-if="
                      typeof col.dataIndex === 'string' && $slots[col.dataIndex]
                    "
                    :name="col.dataIndex"
                    :column="col"
                    :index="row.index"
                    :record="row.record"
                    :text="getCellText(col, row.record)"
                  ></slot>

                  <template v-else>
                    <!-- 树形缩进：首列按深度留出空位（有子节点时缩进在前、展开图标在后） -->
                    <span
                      v-if="
                        mergedIsTree &&
                        getColumnId(col) === firstRenderedColumnId &&
                        row.depth > 0
                      "
                      class="inline-block shrink-0 align-middle"
                      :style="{ width: `${mergedIndentSize * row.depth}px` }"
                    ></span>
                    <span
                      v-if="
                        showTreeToggle(col, row.record) ||
                        showRowToggle(col, row.record)
                      "
                      class="basic-table-row-expand-icon mr-1 inline-flex cursor-pointer align-middle text-gray-400"
                      :class="isRowExpanded(row.rowKey) && 'basic-table-row-expand-icon-expanded'"
                      @click.stop="toggleRowExpand(row.record)"
                    >
                      <Icon
                        :icon="
                          isRowExpanded(row.rowKey)
                            ? 'ant-design:minus-square-outlined'
                            : 'ant-design:plus-square-outlined'
                        "
                      />
                    </span>
                    <RenderVNode
                      :vnode="
                        renderCellContent(
                          col,
                          getCellText(col, row.record),
                          row.record,
                          row.index,
                        )
                      "
                    />
                  </template>
                </template>
              </td>
            </tr>

            <!-- 自定义展开行 -->
            <tr
              v-if="!mergedIsTree && hasExpandedRowRender && isRowExpanded(row.rowKey)"
              class="basic-table-expanded-row"
            >
              <td :colspan="totalColumnCount">
                <slot
                  name="expandedRowRender"
                  :expanded="true"
                  :indent="0"
                  :index="row.index"
                  :record="row.record"
                >
                  <RenderVNode
                    :vnode="
                      getMergedProps.expandedRowRender?.(
                        row.record,
                        row.index,
                        0,
                        true,
                      )
                    "
                  />
                </slot>
              </td>
            </tr>
          </template>

          <tr v-if="displayRows.length === 0" class="basic-table-empty-row">
            <td
              :colspan="totalColumnCount"
              class="px-2 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
            >
              <slot name="empty">
                {{ emptyTextContent }}
              </slot>
            </td>
          </tr>
        </tbody>

        <tfoot
          v-if="mergedSummary || $slots.summary"
          class="basic-table-summary border-t border-gray-200 dark:border-gray-800"
        >
          <slot name="summary" :data="getDataSource">
            <RenderVNode :vnode="mergedSummary" />
          </slot>
        </tfoot>
      </table>
    </div>

    <!-- 页脚 -->
    <div v-if="mergedFooter" class="basic-table-footer mt-2 text-sm">
      <RenderVNode :vnode="mergedFooter" />
    </div>

    <!-- 分页 -->
    <TablePagination
      v-if="paginationInfo && pagination.getShowPagination()"
      :current="paginationInfo.current"
      :page-size="paginationInfo.pageSize"
      :page-size-options="paginationInfo.pageSizeOptions"
      :show-quick-jumper="paginationInfo.showQuickJumper"
      :show-size-changer="paginationInfo.showSizeChanger"
      :show-total="paginationInfo.showTotal"
      :total="paginationInfo.total"
      @update:current="changePage"
      @update:page-size="changePageSize"
    />
  </div>
</template>
