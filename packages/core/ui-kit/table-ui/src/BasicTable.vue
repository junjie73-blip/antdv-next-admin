<script setup lang="ts">
import type { ColumnFiltersState, SortingState } from '@tanstack/vue-table';

import type { CellContentHandlers } from './helpers/cellContent';
import type {
  BasicColumn,
  BasicTableProps,
  Recordable,
  TableActionType,
} from './types';

import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  unref,
  useSlots,
  watch,
} from 'vue';

import { PageToolbar } from '@antdv/common-ui';
import { BasicForm } from '@antdv/form-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@antdv/shadcn-ui';
import { useTable as useTanstackTable } from '@tanstack/vue-table';
import { isFunction, isString } from 'es-toolkit';

import TableAction from './components/TableAction.vue';
import TableHeaderCell from './components/TableHeaderCell.vue';
import TablePagination from './components/TablePagination.vue';
import { features } from './features';
import {
  convertColumns,
  filterVisibleColumns,
  getColumnId,
  readCellText,
} from './helper';
import { resolveCellContent } from './helpers/cellContent';
import { RenderVNode } from './helpers/renderVNode';
import { useColumns } from './hooks/useColumns';
import { useDataSource } from './hooks/useDataSource';
import { useDragSort } from './hooks/useDragSort';
import { useLoading } from './hooks/useLoading';
import { useMergedProps } from './hooks/useMergedProps';
import { usePagination } from './hooks/usePagination';
import { usePaginationModel } from './hooks/usePaginationModel';
import { useRowSelection } from './hooks/useRowSelection';
import { useSelectionColumn } from './hooks/useSelectionColumn';
import { useStickyColumns } from './hooks/useStickyColumns';
import { useTableApi } from './hooks/useTableApi';
import { useTableChange } from './hooks/useTableChange';
import { useTableClasses } from './hooks/useTableClasses';
import { useTableFilters } from './hooks/useTableFilters';
import { useTableForm } from './hooks/useTableForm';
import { useTableRows } from './hooks/useTableRows';
import { useTableSorting } from './hooks/useTableSorting';

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

/**
 * `setProps` 的运行时覆盖层。
 *
 * 组件内部**所有**配置读取都走 `getMergedProps`（再经 `useMergedProps` 收敛缺省值），
 * 没有一处直接摸 `props.x` —— 漏一处就会出现"调用方 setProps 改了，那一条没跟着改"。
 */
const propsRef = ref<Partial<BasicTableProps>>({});
const rootRef = ref<HTMLElement>();
/** 排序/筛选状态的本地镜像：受控 UI 与 `change` 事件都读它，同时也喂给 TanStack 的 `state` */
const sortingRef = ref<SortingState>([]);
const columnFiltersRef = ref<ColumnFiltersState>([]);

const getMergedProps = computed((): BasicTableProps => {
  return {
    ...props,
    ...unref(propsRef),
  } as BasicTableProps;
});

function setProps(next: Partial<BasicTableProps>) {
  propsRef.value = { ...unref(propsRef), ...next };
}

// ============================================
// Hooks：配置、数据、分页、表单
// ============================================

const merged = useMergedProps(getMergedProps);
const { mergedActionColumn, mergedIndentSize, mergedIsTree, mergedShowHeader } =
  merged;

const loading = useLoading(props.loading);
const { loadingRef, setLoading } = loading;

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
const tanstackColumns = ref(convertColumns(columns.getColumns()));
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
 * 拿到的既是过滤后的行、也排好了序；分页切片与树形摊平仍由 `useTableRows` 管。
 */
const filteredRows = computed(() => tanstackTable.getSortedRowModel().rows);

const getColumn = (id: string) => tanstackTable.getColumn(id);

const getHeader = (id: string) =>
  tanstackTable
    .getHeaderGroups()[0]
    ?.headers.find((item) => item.column.id === id);

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
// 列 / 行 / 选择列
// ============================================

const visibleColumns = computed(() =>
  filterVisibleColumns(columns.getColumns()),
);

const getDataSource = computed(() => unref(dataSource.dataSourceRef));

const sticky = useStickyColumns({ getColumn, getHeader, visibleColumns });
const { cellStyleOf, headStyle, resizeHandler } = sticky;

const rows = useTableRows({
  childrenField: merged.mergedChildrenField,
  dataSource: dataSource.dataSourceRef,
  filteredRows,
  getMergedProps,
  getRowKeyValue: merged.getRowKeyValue,
  isTree: merged.mergedIsTree,
  pagination: pagination.getPagination,
  slots,
  visibleColumns,
});

/**
 * 模板里的 ref 只能解构成**顶层**绑定才能被自动脱壳（`rows.displayRows` 在模板里
 * 拿到的是 Ref 本体），所以这一层解构不是风格问题，是必需的。
 */
const {
  displayRows,
  firstRenderedColumnId,
  hasExpandedRowRender,
  isRowExpanded,
  showRowToggle,
  showTreeToggle,
  toggleRowExpand,
} = rows;

const getRowSelection = computed(() => rowSelection.getRowSelection.value);

const selection = useSelectionColumn({
  dataSourceRef: dataSource.dataSourceRef,
  displayRows: rows.displayRows,
  getRowKeyValue: merged.getRowKeyValue,
  getRowSelection,
});

const {
  getCheckboxDisabled,
  isAllSelected,
  isIndeterminate,
  isSelected,
  selectionType,
  toggleAllSelection,
  toggleRowSelection,
} = selection;

// ============================================
// 排序 / 筛选 / 分页变化
// ============================================

const filters = useTableFilters({
  columnFiltersRef,
  getColumn,
  // 闭包晚绑定：`change` 在下面才建，点击时才取值
  refetch: () => change.refetchOnChange(),
});

const {
  clearFilter,
  confirmFilter,
  filterDraft,
  filterOpenMap,
  isFilterActive,
  openFilter,
} = filters;

const sorting = useTableSorting({
  getColumns: columns.getColumns,
  getMergedProps,
  refetch: () => change.refetchOnChange(),
  setSorting: tanstackTable.setSorting,
  sortingRef,
});

const { getSortOrder, handleSort } = sorting;

const change = useTableChange({
  buildFiltersPayload: filters.buildFiltersPayload,
  buildSorterPayload: sorting.buildSorterPayload,
  emitChange: (paginationState, filtersState, sorterState) =>
    emit('change', paginationState, filtersState, sorterState),
  fetch: dataSource.fetch,
  getPagination: pagination.getPagination,
});

const paginationModel = usePaginationModel({
  filteredRowCount: computed(() => filteredRows.value.length),
  getMergedProps,
  getPagination: pagination.getPagination,
  refetch: () => change.refetchOnChange(),
  setPagination: pagination.setPagination,
});

const { changePage, changePageSize, paginationInfo } = paginationModel;

const classes = useTableClasses({
  getColumns: columns.getColumns,
  getMergedProps,
  getRowSelection,
  isSelected: selection.isSelected,
  merged,
  onRowClick: (record, index, event) => emit('rowClick', record, index, event),
  onRowDbClick: (record, index, event) =>
    emit('rowDbClick', record, index, event),
  sticky,
});

const {
  bodyClassName,
  cellClass,
  getHeaderRowProps,
  getRowProps,
  headClass,
  headRowClass,
  scrollerStyle,
  selectionCellClass,
  selectionCellStyle,
  selectionHeadClass,
  selectionHeadStyle,
  tableClassName,
  tableContainerClassName,
} = classes;

// ============================================
// 模板要的内容片段（标题 / 页脚 / 汇总 / 空态）
// ============================================

const showSearchForm = computed(
  () => getMergedProps.value.useSearchForm && getMergedProps.value.formConfig,
);

const emptyTextContent = computed(
  () =>
    (getMergedProps.value.locale as any)?.emptyText ??
    merged.mergedEmptyText.value ??
    '暂无数据',
);

/** 空态与展开行要横跨的列数：选择列也算一列 */
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

const getCellText = (col: BasicColumn, record: Recordable) =>
  readCellText(record, col);

function getActions(record: Recordable): any[] {
  const actionColumn = mergedActionColumn.value;
  if (!actionColumn?.actions) return [];
  return actionColumn.actions(record);
}

/**
 * 单元格内容的优先级判断在 `helpers/cellContent` 里，这里只把三个编辑事件
 * 接回组件的 `emit`。
 */
const cellHandlers: CellContentHandlers = {
  onCancel: (payload) => emit('cellCancel', payload),
  onChange: (payload) => emit('cellChange', payload),
  onSave: (payload) => emit('cellSave', payload),
};

const renderCellContent = (
  column: BasicColumn,
  text: any,
  record: Recordable,
  index: number,
) => resolveCellContent(column, text, record, index, cellHandlers);

function handleHeaderEdit(column: BasicColumn) {
  emit('headerEdit', column);
}

// ============================================
// 对外 API 与生命周期
// ============================================

const tableActionType = useTableApi({
  columns,
  dataSource,
  getDataSource: () => unref(getDataSource),
  getRoot: () => rootRef.value,
  loading,
  pagination,
  rowSelection,
  rows,
  setProps,
  tableForm,
});

onMounted(() => {
  emit('register', tableActionType);
  void syncDragSort();
});

defineExpose(tableActionType);
</script>

<template>
  <div ref="rootRef" :class="tableContainerClassName">
    <!-- 搜索表单 -->
    <div v-if="showSearchForm" class="mb-4">
      <BasicForm
        v-bind="tableForm.getFormProps"
        @register="tableForm.registerForm"
      />
    </div>

    <!--
      工具栏：标题与插槽内容靠左，页面级操作（导出/打印/批量）靠右。
      左右两栏用共享的 PageToolbar 而不是就地拼 flex，是为了让表格页与
      非表格页（安全概览、字典之类）的间距和窄屏堆叠行为只有一个来源。
    -->
    <PageToolbar
      v-if="$slots.toolbar || $slots['toolbar-actions'] || renderTitle"
      class="mb-4"
    >
      <span
        v-if="renderTitle"
        class="text-foreground mr-1 text-sm font-medium"
        data-table="toolbar-title"
      >
        <RenderVNode :vnode="renderTitle" />
      </span>
      <slot name="toolbar"></slot>
      <template v-if="$slots['toolbar-actions']" #actions>
        <slot name="toolbar-actions"></slot>
      </template>
    </PageToolbar>

    <!--
      `.basic-table-body` 这层只管三件事：loading 浮层的定位祖先、`bordered` 的外框、
      以及给调用方和测试留的稳定钩子。滚动是 shadcn `Table` 自带那层
      `data-slot="table-container"` 的活儿 —— 两层都能滚时，钉住的表头会跟着外层跑，
      所以这里不能再写 `overflow-auto`。
    -->
    <div :class="bodyClassName">
      <div
        v-if="loadingRef"
        class="basic-table-loading absolute inset-0 z-30 flex items-center justify-center bg-background/60"
      >
        <Icon
          class="animate-spin text-base text-primary"
          icon="ant-design:loading-outlined"
        />
      </div>

      <!-- `style` 不是 shadcn `Table` 声明的 prop，会落到它的外层容器上（就是滚动容器） -->
      <Table :class="tableClassName" :style="scrollerStyle">
        <TableCaption
          v-if="getMergedProps.caption"
          class="caption-top mt-0 py-2 text-left text-xs"
        >
          <RenderVNode :vnode="getMergedProps.caption" />
        </TableCaption>

        <TableHeader v-if="mergedShowHeader" class="basic-table-header">
          <TableRow v-bind="getHeaderRowProps(0)" :class="headRowClass">
            <!-- 选择列表头 -->
            <TableHead
              v-if="getRowSelection"
              :class="selectionHeadClass"
              :style="selectionHeadStyle"
            >
              <input
                v-if="
                  !getRowSelection?.hideSelectAll && selectionType !== 'radio'
                "
                aria-label="全选"
                class="basic-table-select-all cursor-pointer accent-primary"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                type="checkbox"
                @change="toggleAllSelection"
              />
            </TableHead>

            <TableHead
              v-for="col in visibleColumns"
              :key="getColumnId(col)"
              :class="headClass(col)"
              :data-column-key="getColumnId(col)"
              :style="headStyle(col)"
              :title="
                col.sorter && getMergedProps.showSorterTooltip !== false
                  ? '点击排序'
                  : undefined
              "
              @click="col.sorter ? handleSort(col) : undefined"
            >
              <TableHeaderCell :column="col" @edit="handleHeaderEdit">
                <slot :name="`header-${col.key}`" :column="col"></slot>

                <span
                  v-if="col.sorter"
                  class="ml-1 flex flex-col leading-[0]"
                  :class="
                    getSortOrder(getColumnId(col))
                      ? 'text-primary'
                      : 'text-muted-foreground/50'
                  "
                >
                  <Icon
                    :class="
                      getSortOrder(getColumnId(col)) === 'asc'
                        ? ''
                        : 'opacity-40'
                    "
                    icon="ant-design:caret-up-filled"
                  />
                  <Icon
                    :class="
                      getSortOrder(getColumnId(col)) === 'desc'
                        ? ''
                        : 'opacity-40'
                    "
                    icon="ant-design:caret-down-filled"
                  />
                </span>

                <Popover
                  v-if="col.filters?.length"
                  :open="filterOpenMap[getColumnId(col)]"
                  @update:open="
                    (v: boolean) => (filterOpenMap[getColumnId(col)] = v)
                  "
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
                          : 'text-muted-foreground'
                      "
                      class="text-sm"
                      icon="ant-design:filter-filled"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    class="basic-table-filter-panel w-48 p-2"
                  >
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
                      <Button
                        class="basic-table-filter-confirm"
                        size="xs"
                        @click="confirmFilter(col)"
                      >
                        确定
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <span
                  v-if="col.resizable"
                  class="basic-table-resize-handle -mr-2 ml-1 h-4 w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary"
                  @click.stop
                  @mousedown.stop="(e: MouseEvent) => resizeHandler(col)?.(e)"
                  @touchstart.stop="(e: TouchEvent) => resizeHandler(col)?.(e)"
                ></span>
              </TableHeaderCell>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody class="basic-table-tbody">
          <template v-for="row in displayRows" :key="String(row.rowKey)">
            <TableRow
              v-bind="getRowProps(row.record, row.index)"
              :data-row-key="String(row.rowKey)"
              :data-row-level="row.depth"
            >
              <!-- 选择列 -->
              <TableCell
                v-if="getRowSelection"
                :class="selectionCellClass"
                :style="selectionCellStyle"
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
              </TableCell>

              <TableCell
                v-for="col in visibleColumns"
                :key="getColumnId(col)"
                :class="cellClass(col, row.record, row.index)"
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
                        firstRenderedColumnId === getColumnId(col) &&
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
                      class="basic-table-row-expand-icon mr-1 inline-flex cursor-pointer align-middle text-muted-foreground"
                      :class="
                        isRowExpanded(row.rowKey) &&
                        'basic-table-row-expand-icon-expanded'
                      "
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
              </TableCell>
            </TableRow>

            <!-- 自定义展开行：横跨整行，行边框与 hover 都不该落在它身上 -->
            <TableRow
              v-if="
                !mergedIsTree &&
                hasExpandedRowRender &&
                isRowExpanded(row.rowKey)
              "
              class="basic-table-expanded-row border-b-0 hover:bg-transparent"
            >
              <TableCell :colspan="totalColumnCount" class="p-0">
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
              </TableCell>
            </TableRow>
          </template>

          <TableEmpty
            v-if="displayRows.length === 0"
            class="basic-table-empty-row text-muted-foreground text-sm"
            :colspan="totalColumnCount"
          >
            <slot name="empty">
              {{ emptyTextContent }}
            </slot>
          </TableEmpty>
        </TableBody>

        <!-- 汇总行由调用方给 `<tr>`，所以原语的浅底与加粗按回表格自己的样子 -->
        <TableFooter
          v-if="mergedSummary || $slots.summary"
          class="basic-table-summary bg-transparent font-normal"
        >
          <slot name="summary" :data="getDataSource">
            <RenderVNode :vnode="mergedSummary" />
          </slot>
        </TableFooter>
      </Table>
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
