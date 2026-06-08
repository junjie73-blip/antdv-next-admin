<script setup lang="ts">
import type { BasicColumn, BasicTableProps, Recordable, TableActionType, TableRowSelection } from './types'
import { Table } from 'antdv-next'
import { computed, isVNode, nextTick, onMounted, ref, unref, watch } from 'vue'
import { BasicForm } from '@/components/business/Form'
import { cn } from '@/utils/cn'
import TableAction from './components/TableAction'
import TableEditableCell from './components/TableEditableCell'
import TableHeaderCell from './components/TableHeaderCell'
import TableImg from './components/TableImg.vue'
import TableSetting from './components/TableSetting.vue'
import { convertColumns, formatCellValue, isImageList } from './helper'
import { useColumns } from './hooks/useColumns'
import { useDataSource } from './hooks/useDataSource'
import { useLoading } from './hooks/useLoading'
import { usePagination } from './hooks/usePagination'
import { useRowSelection } from './hooks/useRowSelection'
import { useTableForm } from './hooks/useTableForm'
import { useTableScroll } from './hooks/useTableScroll'

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
  size: 'middle',
  showTableSetting: true,
  // 默认启用虚拟滚动（大数据量时性能提升显著）
  // 数据量 < 100 时自动降级为普通渲染
  virtual: true,
})

const emit = defineEmits<{
  (e: 'change', pagination: any, filters: any, sorter: any): void
  (e: 'row-click', record: any, index: number, event: Event): void
  (e: 'row-db-click', record: any, index: number, event: Event): void
  (e: 'register', instance: TableActionType): void
  (e: 'header-edit', column: BasicColumn): void
  (e: 'cell-save', payload: { record: Recordable, dataIndex: string | string[], value: any, column: BasicColumn }): void
  (e: 'cell-cancel', payload: { record: Recordable, dataIndex: string | string[], column: BasicColumn }): void
  (e: 'cell-change', payload: { record: Recordable, dataIndex: string | string[], value: any, column: BasicColumn }): void
}>()

// 使用原生 Array.isArray
const isArray = Array.isArray

// ============================================
// State
// ============================================

// 内部 props 引用（用于 useTable 模式）
const propsRef = ref<Partial<BasicTableProps>>({})

// 表格 ref
const tableRef = ref<InstanceType<typeof Table>>()

// 展开行的 key 列表
const expandedRowKeysRef = ref<string[]>([])

// ============================================
// Computed
// ============================================

// 合并 props（支持 useTable 模式）
const getMergedProps = computed((): BasicTableProps => {
  return {
    ...props,
    ...unref(propsRef),
  } as BasicTableProps
})

// ============================================
// Hooks
// ============================================

// 加载状态
const { loadingRef, setLoading } = useLoading(props.loading)

// 分页
const pagination = usePagination({
  pagination: computed(() => getMergedProps.value.pagination),
})

// 列配置
const columns = useColumns({
  columns: computed(() => getMergedProps.value.columns || []),
  showIndexColumn: computed(() => getMergedProps.value.showIndexColumn ?? false),
  indexColumnProps: props.indexColumnProps,
  actionColumn: computed(() => getMergedProps.value.actionColumn),
})

// 数据源
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
})

// 行选择
const rowSelection = useRowSelection({
  rowSelection: computed(() => getMergedProps.value.rowSelection),
  dataSourceRef: dataSource.dataSourceRef,
  rowKey: computed(() => getMergedProps.value.rowKey || 'id'),
})

// 滚动
const tableScroll = useTableScroll({
  scroll: computed(() => getMergedProps.value.scroll),
  canResize: computed(() => getMergedProps.value.canResize ?? false),
  resizeHeightOffset: computed(() => getMergedProps.value.resizeHeightOffset ?? 0),
})

// 搜索表单
const tableForm = useTableForm({
  baseProps: getMergedProps,
  propsRef,
  fetch: dataSource.fetch,
})

// 表格列
const getColumns = computed(() => {
  const cols = columns.getColumns()
  // 转换为 antdv-next 支持的格式
  return convertColumns(cols)
})

// 表格数据
const getDataSource = computed(() => {
  return unref(dataSource.dataSourceRef)
})

watch(getDataSource, (data) => {
  if (getMergedProps.value.isTree && data.length > 0) {
    const rowKey = getMergedProps.value.rowKey || 'id'
    expandedRowKeysRef.value = data
      .filter((record: Recordable) => record.children?.length > 0)
      .map((record: Recordable) => String(record[rowKey]))
  }
})

// 行选择配置
const getRowSelection = computed((): TableRowSelection | undefined => {
  const selection = rowSelection.getRowSelection.value
  return selection || undefined
})

// 树形展开配置（保持引用稳定，避免每次渲染创建新对象）
const getExpandable = computed(() => {
  if (getMergedProps.value.isTree) {
    return {
      indentSize: getMergedProps.value.indentSize ?? 20,
      childrenColumnName: getMergedProps.value.childrenColumnName || 'children',
      defaultExpandAllRows: true,
      onExpandedRowsChange: (keys: string[]) => { expandedRowKeysRef.value = keys },
    }
  }

  if (getMergedProps.value.expandedRowRender) {
    return {
      expandedRowRender: getMergedProps.value.expandedRowRender,
      expandedRowKeys: expandedRowKeysRef.value,
      onExpandedRowsChange: (keys: string[]) => { expandedRowKeysRef.value = keys },
    }
  }

  return undefined
})

// 分页配置
const getPagination = computed(() => {
  const paginationConfig = pagination.getPagination.value
  if (!paginationConfig)
    return false

  // 强制分页器使用与表格相同的 size，避免被 ConfigProvider 覆盖
  return {
    ...paginationConfig,
    size: getMergedProps.value.size || 'middle',
  }
})

// 滚动配置
const getScroll = computed(() => {
  return tableScroll.getScroll.value
})

// 表格容器类名
const tableContainerClassName = computed(() => {
  return cn(
    'basic-table',
    'w-full',
    getMergedProps.value.canResize && 'h-full',
  )
})

// 是否显示表格设置
const showTableSetting = computed(() => {
  return getMergedProps.value.showTableSetting
})

// 表格设置配置
const tableSettingConfig = computed(() => {
  return getMergedProps.value.tableSetting || { redo: true, setting: true, fullScreen: true }
})

// 是否显示搜索表单
const showSearchForm = computed(() => {
  return getMergedProps.value.useSearchForm && getMergedProps.value.formConfig
})

// 搜索表单配置
const getFormConfig = computed(() => {
  return getMergedProps.value.formConfig || {}
})

// ============================================
// Methods
// ============================================

// 设置 props
function setProps(p: Partial<BasicTableProps>) {
  propsRef.value = { ...unref(propsRef), ...p }
}

// 获取操作列操作项
function getActions(record: Recordable): any[] {
  const actionColumn = getMergedProps.value.actionColumn
  if (!actionColumn?.actions)
    return []
  return actionColumn.actions(record)
}

// 处理格式化单元格
function handleFormatCell(format: any, text: any, record: Recordable, index: number): string {
  if (!format)
    return text
  return formatCellValue(format, text, record, index)
}

// 根据 key 获取原始列配置
function getOriginalColumn(columnKey: string | number): BasicColumn | undefined {
  const cols = columns.getColumns()
  return cols.find(col => col.key === columnKey || col.dataIndex === columnKey)
}

// 处理表格变化
async function handleTableChange(paginationInfo: any, filters: any, sorter: any, extra: any) {
  // 更新分页状态
  if (paginationInfo) {
    pagination.setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
    })
  }

  // 等待分页状态更新完成后再获取数据
  // 使用 nextTick 确保分页状态已同步
  await nextTick()

  // 重新获取数据
  await dataSource.fetch()

  // 触发事件
  emit('change', paginationInfo, filters, sorter)
}

// 处理行点击
function handleRowClick(record: Recordable, index: number, event: Event) {
  emit('row-click', record, index, event)
}

// 处理行双击
function handleRowDoubleClick(record: Recordable, index: number, event: Event) {
  emit('row-db-click', record, index, event)
}

// 处理更新列
function handleUpdateColumns(newColumns: BasicColumn[]) {
  columns.setColumns(newColumns)
}

// 处理重置列
function handleResetColumns() {
  const cacheColumns = columns.getCacheColumns()
  columns.setColumns(cacheColumns)
}

// 处理表头编辑点击
function handleHeaderEdit(column: BasicColumn) {
  emit('header-edit', column)
}

// 处理单元格保存
function handleCellSave(payload: { record: Recordable, dataIndex: string | string[], value: any, column: BasicColumn }) {
  emit('cell-save', payload)
}

// 处理单元格取消
function handleCellCancel(payload: { record: Recordable, dataIndex: string | string[], column: BasicColumn }) {
  emit('cell-cancel', payload)
}

// 处理单元格变化
function handleCellChange(payload: { record: Recordable, dataIndex: string | string[], value: any, column: BasicColumn }) {
  emit('cell-change', payload)
}

// ============================================
// Table Action Type
// ============================================

const tableActionType: TableActionType = {
  // 基础操作
  setProps,
  reload: dataSource.reload,
  redoHeight: tableScroll.redoHeight,
  setLoading,
  getRawDataSource: () => unref(dataSource.rawDataSourceRef),

  // 列操作
  setColumns: columns.setColumns,
  getColumns: columns.getColumns,
  updateColumn: columns.updateColumn,
  getVisibleColumns: () => columns.getColumns().filter(col => col.ifShow !== false),
  getCacheColumns: columns.getCacheColumns,

  // 行操作
  expandAll: () => {
    const rowKey = getMergedProps.value.rowKey || 'id'
    const allKeys = getDataSource.value.map((record: Recordable) => String(record[rowKey]))
    expandedRowKeysRef.value = allKeys
  },
  collapseAll: () => {
    expandedRowKeysRef.value = []
  },
  expandRows: (keys: string[]) => {
    const currentKeys = new Set(expandedRowKeysRef.value)
    keys.forEach(key => currentKeys.add(key))
    expandedRowKeysRef.value = Array.from(currentKeys)
  },
  collapseRows: (keys: string[]) => {
    const keySet = new Set(keys)
    expandedRowKeysRef.value = expandedRowKeysRef.value.filter(key => !keySet.has(key))
  },
  scrollTo: tableScroll.scrollTo,
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
  getFormValues: () => ({}),
  setFormValues: () => {},
  resetForm: () => {},
  submitForm: async () => {},
  validateForm: async () => ({}),
  updateFormSchema: () => {},
  appendFormSchema: () => {},
  removeFormSchema: () => {},
  getForm: () => ({}),

  // 数据操作
  insertTableDataRecord: dataSource.insertTableDataRecord,
  deleteTableDataRecord: dataSource.deleteTableDataRecord,
  updateTableDataRecord: dataSource.updateTableDataRecord,
  findTableDataRecord: dataSource.findTableDataRecord,
  getDataSource: () => unref(dataSource.dataSourceRef),
  setTableData: dataSource.setTableData,
}

// ============================================
// Lifecycle
// ============================================

// 注册表格实例
onMounted(() => {
  emit('register', tableActionType)
})

// 暴露方法
defineExpose(tableActionType)
</script>

<template>
  <div :class="tableContainerClassName">
    <!-- 搜索表单 -->
    <div
      v-if="showSearchForm"
      class="mb-4"
    >
      <BasicForm
        v-bind="tableForm.getFormProps"
        @register="tableForm.registerForm"
      />
    </div>

    <!-- 表格头部工具栏 -->
    <div
      v-if="showTableSetting || $slots.toolbar"
      class="flex items-center justify-between mb-4"
    >
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
      :scroll="getScroll"
      :row-key="getMergedProps.rowKey"
      :bordered="getMergedProps.bordered"
      :table-layout="getMergedProps.tableLayout"
      :sticky="getMergedProps.sticky"
      :show-header="getMergedProps.showHeader ?? true"
      :locale="getMergedProps.locale"
      :row-class-name="getMergedProps.rowClassName"
      :expanded-row-keys="expandedRowKeysRef"
      :size="getMergedProps.size"
      :expandable="getExpandable"
      @change="handleTableChange"
      @rowClick="handleRowClick"
    >
      <!-- 表头插槽 -->
      <template #headerCell="{ column }">
        <!-- 选择列：使用默认渲染 -->
        <template v-if="column.key === 'ant-table-selection-column'">
          {{ column.title }}
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.key === 'action'">
          <TableHeaderCell
            :column="column"
            @edit="handleHeaderEdit"
          >
            <slot
              name="actionHeader"
              :column="column"
            />
          </TableHeaderCell>
        </template>

        <!-- 序号列 -->
        <template v-else-if="column.key === 'index'">
          <TableHeaderCell
            :column="column"
            @edit="handleHeaderEdit"
          >
            <slot
              name="indexHeader"
              :column="column"
            />
          </TableHeaderCell>
        </template>

        <!-- 普通列 -->
        <template v-else>
          <TableHeaderCell
            :column="column"
            @edit="handleHeaderEdit"
          />
        </template>
      </template>

      <!-- 单元格插槽 -->
      <template #bodyCell="{ column, record, text, index }">
        <!-- 选择列：不渲染，让 antdv-next 使用默认渲染 -->
        <template v-if="column.key === 'ant-table-selection-column'" />

        <!-- 操作列 -->
        <template v-else-if="column.key === 'action'">
          <slot
            name="action"
            :record="record"
            :index="index"
          >
            <TableAction
              :actions="getActions(record)"
              :max-show-count="getMergedProps.actionColumn?.maxShowCount || 4"
            />
          </slot>
        </template>

        <!-- 序号列 -->
        <template v-else-if="column.key === 'index'">
          <slot
            name="index"
            :column="column"
            :record="record"
            :text="text"
            :index="index"
          >
            {{ index + 1 }}
          </slot>
        </template>

        <!-- 普通列 -->
        <template v-else>
          <slot
            :name="`cell-${column.key}`"
            :column="column"
            :record="record"
            :text="text"
            :index="index"
          >
            <slot
              :name="column.dataIndex"
              :column="column"
              :record="record"
              :text="text"
              :index="index"
            >
              <!-- 获取原始列配置以使用 format -->
              <template v-if="getOriginalColumn(column.key)">
                <template
                  v-for="origCol in [getOriginalColumn(column.key)]"
                  :key="origCol?.key"
                >
                  <!-- 可编辑单元格 -->
                  <template v-if="origCol?.edit || origCol?.editRow">
                    <TableEditableCell
                      :column="origCol"
                      :record="record"
                      :value="text"
                      :data-index="origCol.dataIndex"
                      @save="handleCellSave"
                      @cancel="handleCellCancel"
                      @change="handleCellChange"
                    />
                  </template>

                  <!-- 格式化显示 -->
                  <template v-else-if="origCol?.format">
                    <span v-html="handleFormatCell(origCol.format, text, record, index)" />
                  </template>

                  <!-- 图片列 -->
                  <template v-else-if="isImageList(text)">
                    <TableImg
                      :img-list="text"
                      :size="40"
                      simple-show
                    />
                  </template>

                  <!-- 默认渲染 -->
                  <template v-else>
                    <template v-if="isVNode(text)">
                      <component :is="() => text" />
                    </template>
                    <template v-else>
                      {{ text }}
                    </template>
                  </template>
                </template>
              </template>

              <!-- 如果没有找到原始列配置，使用默认渲染 -->
              <template v-else>
                <template v-if="isVNode(text)">
                  <component :is="() => text" />
                </template>
                <template v-else>
                  {{ text }}
                </template>
              </template>
            </slot>
          </slot>
        </template>
      </template>

      <!-- 展开行 -->
      <template
        v-if="getMergedProps.expandedRowRender"
        #expandedRowRender="{ record, index, indent, expanded }"
      >
        <slot
          name="expandedRowRender"
          :record="record"
          :index="index"
          :indent="indent"
          :expanded="expanded"
        >
          <component :is="() => getMergedProps.expandedRowRender?.(record, index, indent, expanded)" />
        </slot>
      </template>

      <!-- 汇总行 -->
      <template
        v-if="getMergedProps.summary"
        #summary
      >
        <slot
          name="summary"
          :data="getDataSource"
        >
          <component :is="() => getMergedProps.summary?.(getDataSource)" />
        </slot>
      </template>

      <!-- 空数据 -->
      <template
        v-if="getMergedProps.emptyText || $slots.empty"
        #emptyText
      >
        <slot name="empty">
          {{ getMergedProps.emptyText || '暂无数据' }}
        </slot>
      </template>
    </Table>
  </div>
</template>

<style scoped>
.basic-table :deep(.ant-table-thead > tr > th) {
  font-weight: 500;
}

.basic-table :deep(.ant-pagination) {
  margin-top: 1rem;
  justify-content: flex-end;
}

/* 确保表格单元格不会遮挡下拉菜单 */
.basic-table :deep(.ant-table-cell) {
  overflow: visible !important;
}

/* 操作列内容居中（text-align 对 flex 子元素不生效） */
.basic-table :deep(.ant-table-cell:last-of-type) {
  text-align: center;
}

.basic-table :deep(.ant-table-cell:last-of-type > .ant-wrapper) {
  justify-content: center;
}

/* 下拉菜单样式 */
:global(.table-action-dropdown) {
  z-index: 999999 !important;
}
</style>
