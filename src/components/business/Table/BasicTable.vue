<script setup lang="ts">
import { Table } from "antdv-next";
import { computed, defineComponent, h, isVNode, nextTick, onMounted, ref, unref, watch } from "vue";

import TableAction from "./components/TableAction.vue";
import TableEditableCell from "./components/TableEditableCell";
import TableHeaderCell from "./components/TableHeaderCell";
import TableImg from "./components/TableImg.vue";
import TableSetting from "./components/TableSetting.vue";
import { convertColumns, formatCellValue, isImageList } from "./helper";
import { useColumns } from "./hooks/useColumns";
import { useDataSource } from "./hooks/useDataSource";
import { useLoading } from "./hooks/useLoading";
import { usePagination } from "./hooks/usePagination";
import { useRowSelection } from "./hooks/useRowSelection";
import { useTableForm } from "./hooks/useTableForm";

import type {
  BasicColumn,
  BasicTableProps,
  Recordable,
  TableActionType,
  TableRowSelection,
} from "./types";

import { BasicForm } from "~/components/business/Form";
import { cn } from "~/utils/cn";

// ============================================
// Props & Emits
// ============================================

const props = withDefaults(defineProps<BasicTableProps>(), {
  rowKey: "id",
  showIndexColumn: false,
  immediate: true,
  canResize: false,
  resizeHeightOffset: 0,
  showHeader: true,
  size: "small",
  showTableSetting: true,
  tableLayout: "fixed",
});

const emit = defineEmits<{
  (e: "change", pagination: any, filters: any, sorter: any): void;
  (e: "row-click", record: any, index: number, event: Event): void;
  (e: "row-db-click", record: any, index: number, event: Event): void;
  (e: "register", instance: TableActionType): void;
  (e: "header-edit", column: BasicColumn): void;
  (
    e: "cell-save",
    payload: { record: Recordable; dataIndex: string | string[]; value: any; column: BasicColumn },
  ): void;
  (
    e: "cell-cancel",
    payload: { record: Recordable; dataIndex: string | string[]; column: BasicColumn },
  ): void;
  (
    e: "cell-change",
    payload: { record: Recordable; dataIndex: string | string[]; value: any; column: BasicColumn },
  ): void;
}>();

// ============================================
// State
// ============================================

const propsRef = ref<Partial<BasicTableProps>>({});
const tableRef = ref<InstanceType<typeof Table>>();

// 展开行的 key 列表（统一由 getExpandable 管理）
const expandedRowKeysRef = ref<string[]>([]);

// ============================================
// Computed
// ============================================

const getMergedProps = computed((): BasicTableProps => {
  return {
    ...props,
    ...unref(propsRef),
  } as BasicTableProps;
});

// ============================================
// Hooks
// ============================================

const { loadingRef, setLoading } = useLoading(props.loading);

const pagination = usePagination({
  pagination: computed(() => getMergedProps.value.pagination),
});

const columns = useColumns({
  columns: computed(() => getMergedProps.value.columns || []),
  showIndexColumn: computed(() => getMergedProps.value.showIndexColumn ?? false),
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
  rowKey: computed(() => getMergedProps.value.rowKey || "id"),
  immediate: props.immediate,
  pagination: {
    getPagination: () => pagination.getPagination.value,
    setPagination: pagination.setPagination,
  },
  loading: { setLoading },
  fields: computed(
    () =>
      getMergedProps.value.columns
        ?.filter((item) => item.dataIndex)
        .map((item) => item.dataIndex) || [],
  ),
});

const rowSelection = useRowSelection({
  rowSelection: computed(() => getMergedProps.value.rowSelection),
  dataSourceRef: dataSource.dataSourceRef,
  rowKey: computed(() => getMergedProps.value.rowKey || "id"),
});

const tableForm = useTableForm({
  baseProps: getMergedProps,
  propsRef,
  fetch: dataSource.fetch,
});

// ============================================
// 列 / 数据
// ============================================

const getColumns = computed(() => convertColumns(columns.getColumns()));

const getDataSource = computed(() => unref(dataSource.dataSourceRef));

// 递归收集所有可展开的 key（支持多级子节点）
function collectExpandableKeys(list: Recordable[], rowKey: string): string[] {
  const keys: string[] = [];
  const childrenField = getMergedProps.value.childrenColumnName || "children";
  const walk = (arr: Recordable[]) => {
    for (const item of arr) {
      const children = item?.[childrenField];
      if (Array.isArray(children) && children.length > 0) {
        keys.push(String(item[rowKey]));
        walk(children);
      }
    }
  };
  walk(list);
  return keys;
}

// 树形数据就绪后自动展开所有节点
watch(getDataSource, (data) => {
  if (getMergedProps.value.isTree && data.length > 0) {
    const rowKey = (getMergedProps.value.rowKey as string) || "id";
    expandedRowKeysRef.value = collectExpandableKeys(data, rowKey);
  }
});

// ============================================
// 行选择
// ============================================

const getRowSelection = computed((): TableRowSelection | undefined => {
  const selection = rowSelection.getRowSelection.value;
  return selection || undefined;
});

// ============================================
// 展开配置（统一合并，关键修复）
// ============================================

const getExpandable = computed(() => {
  const userExpandable = getMergedProps.value.expandable || {};

  // 1) 树形表格
  if (getMergedProps.value.isTree) {
    return {
      indentSize: getMergedProps.value.indentSize ?? 20,
      childrenColumnName: getMergedProps.value.childrenColumnName || "children",
      defaultExpandAllRows: getMergedProps.value.defaultExpandAllRows ?? true,
      expandedRowKeys: expandedRowKeysRef.value,
      onExpandedRowsChange: (keys: string[]) => {
        expandedRowKeysRef.value = keys;
      },
      ...userExpandable,
    };
  }

  // 2) 自定义展开行
  if (getMergedProps.value.expandedRowRender) {
    return {
      expandedRowRender: getMergedProps.value.expandedRowRender,
      expandedRowKeys: expandedRowKeysRef.value,
      onExpandedRowsChange: (keys: string[]) => {
        expandedRowKeysRef.value = keys;
      },
      ...userExpandable,
    };
  }

  // 3) 用户自定义 expandable
  return Object.keys(userExpandable).length > 0 ? userExpandable : undefined;
});

// ============================================
// 分页 / 容器
// ============================================

const getPagination = computed(() => {
  const paginationConfig = pagination.getPagination.value;
  if (!paginationConfig) return false;
  return {
    ...paginationConfig,
    size: getMergedProps.value.size || "middle",
  };
});

const tableContainerClassName = computed(() =>
  cn("basic-table", "w-full", getMergedProps.value.canResize && "h-full"),
);

const showTableSetting = computed(() => getMergedProps.value.showTableSetting);

const tableSettingConfig = computed(() => {
  return getMergedProps.value.tableSetting || { redo: true, setting: true, fullScreen: true };
});

const showSearchForm = computed(() => {
  return getMergedProps.value.useSearchForm && getMergedProps.value.formConfig;
});

// 弹出容器，默认挂到 body
const getPopupContainer = computed(() => {
  return getMergedProps.value.getPopupContainer || (() => document.body);
});

// 行事件透传：统一在 onRow 里 emit + 用户回调
const getOnRow = computed(() => {
  const userOnRow = getMergedProps.value.onRow;
  return (record: Recordable, index: number) => {
    const userProps = userOnRow?.(record, index) || {};
    return {
      ...userProps,
      onClick: (event: MouseEvent) => {
        emit("row-click", record, index, event);
        userProps.onClick?.(event);
      },
      onDblclick: (event: MouseEvent) => {
        emit("row-db-click", record, index, event);
        userProps.onDblclick?.(event);
      },
    };
  };
});

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

function handleFormatCell(format: any, text: any, record: Recordable, index: number): string {
  if (!format) return text;
  return formatCellValue(format, text, record, index);
}

function getOriginalColumn(columnKey: string | number): BasicColumn | undefined {
  const cols = columns.getColumns();
  return cols.find((col) => col.key === columnKey || col.dataIndex === columnKey);
}
/**
 * 渲染任意 VNode 的辅助组件
 * Vue 3 模板里无法直接把 VNode 作为插值渲染，需要一个包装组件
 */
const RenderVNode = defineComponent({
  name: "RenderVNode",
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
 * 注意：这里不再处理 `cell-*` 插槽，插槽在模板里优先拦截
 */
function renderCellContent(column: any, text: any, record: Recordable, index: number): any {
  const origCol = getOriginalColumn(column.key);

  // 1. customRender 优先
  if (origCol?.customRender) {
    return origCol.customRender({ text, record, index, column: origCol });
  }

  // 2. 格式化（format 是字符串模板或函数）
  if (origCol?.format) {
    const formattedContent = handleFormatCell(origCol.format, text, record, index);
    return h("span", { innerHTML: formattedContent });
  }

  // 3. 可编辑单元格
  if (origCol?.edit || origCol?.editRow) {
    return h(TableEditableCell, {
      column: origCol,
      record,
      value: text,
      dataIndex: origCol.dataIndex,
      onSave: handleCellSave,
      onCancel: handleCellCancel,
      onChange: handleCellChange,
    });
  }

  // 4. 图片列
  if (isImageList(text)) {
    return h(TableImg, {
      imgList: text,
      size: 40,
      simpleShow: true,
    });
  }

  // 5. 默认
  return isVNode(text) ? h(() => text) : h("span", text);
}

async function handleTableChange(paginationInfo: any, filters: any, sorter: any) {
  if (paginationInfo) {
    pagination.setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
    });
  }

  await nextTick();
  await dataSource.fetch();

  emit("change", paginationInfo, filters, sorter);
}

function handleUpdateColumns(newColumns: BasicColumn[]) {
  columns.setColumns(newColumns);
}

function handleResetColumns() {
  const cacheColumns = columns.getCacheColumns();
  columns.setColumns(cacheColumns);
}

function handleHeaderEdit(column: BasicColumn) {
  emit("header-edit", column);
}

function handleCellSave(payload: {
  record: Recordable;
  dataIndex: string | string[];
  value: any;
  column: BasicColumn;
}) {
  emit("cell-save", payload);
}

function handleCellCancel(payload: {
  record: Recordable;
  dataIndex: string | string[];
  column: BasicColumn;
}) {
  emit("cell-cancel", payload);
}

function handleCellChange(payload: {
  record: Recordable;
  dataIndex: string | string[];
  value: any;
  column: BasicColumn;
}) {
  emit("cell-change", payload);
}

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
  getVisibleColumns: () => columns.getColumns().filter((col) => col.ifShow !== false),
  getCacheColumns: columns.getCacheColumns,

  // 行操作
  expandAll: () => {
    const rowKey = (getMergedProps.value.rowKey as string) || "id";
    expandedRowKeysRef.value = collectExpandableKeys(getDataSource.value, rowKey);
  },
  collapseAll: () => {
    expandedRowKeysRef.value = [];
  },
  expandRows: (keys: string[]) => {
    const currentKeys = new Set(expandedRowKeysRef.value);
    keys.forEach((key) => currentKeys.add(key));
    expandedRowKeysRef.value = Array.from(currentKeys);
  },
  collapseRows: (keys: string[]) => {
    const keySet = new Set(keys);
    expandedRowKeysRef.value = expandedRowKeysRef.value.filter((key) => !keySet.has(key));
  },
  scrollTo: (pos: { left?: number; top?: number }) => {
    const el = tableRef.value?.$el as HTMLElement | undefined;
    if (!el) return;
    const bodyEl = el.querySelector(".ant-table-body") as HTMLElement | null;
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

  // 表单操作 - 接真实实现
  getFormValues: () => (tableForm.getForm() as any)?.getFieldsValue?.() ?? {},
  setFormValues: (values: Recordable) => (tableForm.getForm() as any)?.setFieldsValue?.(values),
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
  emit("register", tableActionType);
});

defineExpose(tableActionType);
</script>

<template>
  <div :class="tableContainerClassName">
    <!-- 搜索表单 -->
    <div v-if="showSearchForm" class="mb-4">
      <BasicForm v-bind="tableForm.getFormProps" @register="tableForm.registerForm" />
    </div>

    <div v-if="showSearchForm" class="mb-4 border-t border-gray-200 dark:border-gray-700" />

    <!-- 工具栏 -->
    <div v-if="showTableSetting || $slots.toolbar" class="flex items-center justify-between mb-4">
      <div class="flex items-center flex-wrap gap-2">
        <slot name="toolbar" />
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

    <!-- 表格主体 -->
    <Table
      ref="tableRef"
      :columns="getColumns as any"
      :data-source="getDataSource"
      :loading="loadingRef"
      :pagination="getPagination"
      :row-selection="getRowSelection as any"
      :row-key="getMergedProps.rowKey"
      :bordered="getMergedProps.bordered"
      :table-layout="getMergedProps.tableLayout"
      :sticky="getMergedProps.sticky"
      :show-header="getMergedProps.showHeader ?? true"
      :locale="getMergedProps.locale"
      :row-class-name="getMergedProps.rowClassName"
      :size="getMergedProps.size"
      :expandable="getExpandable"
      :scroll="getMergedProps.scroll"
      :title="getMergedProps.title"
      :caption="getMergedProps.caption"
      :footer="getMergedProps.footer"
      :summary="getMergedProps.summary"
      :show-sorter-tooltip="getMergedProps.showSorterTooltip"
      :sort-directions="getMergedProps.sortDirections"
      :on-row="getOnRow"
      :on-header-row="getMergedProps.onHeaderRow"
      :get-popup-container="getPopupContainer"
      @change="handleTableChange"
    >
      <!-- ============ 表头插槽 ============ -->
      <template #headerCell="{ column }">
        <!-- 选择列：默认 -->
        <template v-if="column.key === 'ant-table-selection-column'">
          {{ column.title }}
        </template>

        <!-- 操作列表头 -->
        <template v-else-if="column.key === 'action'">
          <TableHeaderCell :column="column" @edit="handleHeaderEdit">
            <slot name="actionHeader" :column="column" />
          </TableHeaderCell>
        </template>

        <!-- 序号列表头 -->
        <template v-else-if="column.key === 'index'">
          <TableHeaderCell :column="column" @edit="handleHeaderEdit">
            <slot name="indexHeader" :column="column" />
          </TableHeaderCell>
        </template>

        <!-- 普通列表头 -->
        <template v-else>
          <TableHeaderCell :column="column" @edit="handleHeaderEdit">
            <slot :name="`header-${column.key}`" :column="column" />
          </TableHeaderCell>
        </template>
      </template>

      <!-- ============ 单元格插槽 ============ -->
      <template #bodyCell="{ column, record, text, index }">
        <!-- 选择列：交给 antdv-next 默认渲染 -->
        <template v-if="column.key === 'ant-table-selection-column'" />

        <!-- 操作列 -->
        <template v-else-if="column.key === 'action'">
          <slot name="action" :record="record" :index="index" :column="column">
            <TableAction
              :actions="getActions(record)"
              :max-show-count="getMergedProps.actionColumn?.maxShowCount || 4"
            />
          </slot>
        </template>

        <!-- 序号列 -->
        <template v-else-if="column.key === 'index'">
          <slot name="index" :column="column" :record="record" :text="text" :index="index">
            {{ index + 1 }}
          </slot>
        </template>

        <!-- 普通单元格：插槽优先级最高 -->
        <template v-else>
          <!-- 1. `cell-${key}` 插槽 -->
          <slot
            v-if="$slots[`cell-${column.key}`]"
            :name="`cell-${column.key}`"
            :column="column"
            :record="record"
            :text="text"
            :index="index"
          />

          <!-- 2. `cell-${dataIndex}` 插槽 -->
          <slot
            v-else-if="typeof column.dataIndex === 'string' && $slots[`cell-${column.dataIndex}`]"
            :name="`cell-${column.dataIndex}`"
            :column="column"
            :record="record"
            :text="text"
            :index="index"
          />

          <!-- 3. dataIndex 直接命名的插槽（兼容老写法） -->
          <slot
            v-else-if="typeof column.dataIndex === 'string' && $slots[column.dataIndex]"
            :name="column.dataIndex"
            :column="column"
            :record="record"
            :text="text"
            :index="index"
          />

          <!-- 4. 统一走 renderCellContent（customRender / format / edit / 图片 / 默认） -->
          <RenderVNode v-else :vnode="renderCellContent(column, text, record, index)" />
        </template>
      </template>

      <!-- ============ 展开行 ============ -->
      <template
        v-if="getMergedProps.expandedRowRender || $slots.expandedRowRender"
        #expandedRowRender="{ record, index, indent, expanded }"
      >
        <slot
          name="expandedRowRender"
          :record="record"
          :index="index"
          :indent="indent"
          :expanded="expanded"
        >
          <RenderVNode
            :vnode="getMergedProps.expandedRowRender?.(record, index, indent, expanded)"
          />
        </slot>
      </template>

      <!-- ============ 汇总行 ============ -->
      <template v-if="getMergedProps.summary || $slots.summary" #summary>
        <slot name="summary" :data="getDataSource">
          <RenderVNode :vnode="getMergedProps.summary?.(getDataSource)" />
        </slot>
      </template>

      <!-- ============ 空数据 ============ -->
      <template v-if="getMergedProps.emptyText || $slots.empty" #emptyText>
        <slot name="empty">
          {{ getMergedProps.emptyText || "暂无数据" }}
        </slot>
      </template>
    </Table>
  </div>
</template>
<style scoped>
:deep(.ant-form-item){
  margin-bottom:12px
}
</style>
