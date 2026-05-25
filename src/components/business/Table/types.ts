import type {
  PaginationProps as AntPaginationProps,
} from 'antdv-next'
import type { CSSProperties, VNode } from 'vue'
// 从 vue 导入 ComputedRef
import type { ComputedRef, Ref } from 'vue'

import type { FormProps, FormSchema } from '../Form/types'

/** 滚动配置 */
export interface TableScroll {
  x?: string | number | true
  y?: string | number
  scrollToFirstRowOnChange?: boolean
}

/** 展开行配置 */
export interface TableExpandable {
  expandedRowKeys?: string[]
  defaultExpandedRowKeys?: string[]
  expandedRowRender?: (record: Recordable, index: number, indent: number, expanded: boolean) => VNode
  expandIcon?: (props: { expanded: boolean, record: Recordable, onExpand: (record: Recordable, e: Event) => void }) => VNode
  expandRowByClick?: boolean
  onExpand?: (expanded: boolean, record: Recordable) => void
  onExpandedRowsChange?: (expandedRows: string[]) => void
  defaultExpandAllRows?: boolean
  indentSize?: number
  expandIconColumnIndex?: number
  rowExpandable?: (record: Recordable) => boolean
  columnTitle?: string | VNode
  fixed?: boolean | 'left' | 'right'
}

// ============================================
// 基础类型
// ============================================

/** 通用记录类型 */
export type Recordable<T = any> = Record<string, T>

/** 通用函数类型 */
export type Fn<P extends any[] = any[], R = any> = (...args: P) => R

/** 可为空的类型 */
export type Nullable<T> = T | null | undefined

/** 数组元素类型 */
export type ArrayElement<T> = T extends (infer E)[] ? E : never

// ============================================
// 表格列类型
// ============================================

/** 编辑组件类型 */
export type ComponentType
  = | 'Input'
    | 'InputNumber'
    | 'Select'
    | 'ApiSelect'
    | 'Checkbox'
    | 'Switch'
    | 'DatePicker'
    | 'TimePicker'
    | 'RangePicker'
    | 'Radio'
    | 'RadioGroup'
    | 'CheckboxGroup'
    | 'Cascader'
    | 'TreeSelect'
    | 'ApiTreeSelect'
    | 'ApiRadioGroup'
    | 'ApiCascader'

/** 表格列配置 */
export interface BasicColumn {
  /** 列唯一标识 */
  key?: string

  /** 对应数据字段 */
  dataIndex?: string | string[]

  /** 列标题 */
  title?: string | VNode | ((options: { sortOrder: string | boolean, filters: Recordable, sortColumn: BasicColumn }) => VNode)

  /** 默认隐藏 */
  defaultHidden?: boolean

  /** 权限控制 */
  auth?: string | string[]

  /** 是否显示 */
  ifShow?: boolean | ((column: BasicColumn) => boolean)

  /** 是否可编辑 */
  edit?: boolean

  /** 整行编辑 */
  editRow?: boolean

  /** 编辑组件类型 */
  editComponent?: ComponentType

  /** 编辑组件属性 */
  editComponentProps?: Recordable

  /** 编辑值映射 */
  editValueMap?: (value: any) => string | number

  /** 单元格格式化处理 */
  format?: string | ((text: any, record: Recordable, index: number) => string | VNode)

  /** 自定义渲染函数（优先级高于 format） */
  customRender?: (options: { text: any, record: Recordable, index: number, column: BasicColumn }) => VNode | string | number

  /** 列宽 */
  width?: string | number

  /** 最小列宽 */
  minWidth?: string | number

  /** 列对齐方式 */
  align?: 'left' | 'center' | 'right'

  /** 表头对齐方式 */
  headerAlign?: 'left' | 'center' | 'right'

  /** 是否固定列 */
  fixed?: boolean | 'left' | 'right'

  /** 是否省略显示 */
  ellipsis?: boolean | { showTitle?: boolean }

  /** 自定义单元格样式 */
  cellStyle?: CSSProperties | ((record: Recordable, index: number) => CSSProperties)

  /** 自定义表头样式 */
  headerStyle?: CSSProperties

  /** 排序配置 */
  sorter?: boolean | ((a: Recordable, b: Recordable) => number) | { compare: (a: Recordable, b: Recordable) => number, multiple: number }

  /** 筛选配置 */
  filters?: { text: string, value: string, children?: { text: string, value: string }[] }[]

  /** 筛选模式 */
  filterMode?: 'menu' | 'tree'

  /** 筛选搜索配置 */
  filterSearch?: boolean | ((input: string, filter: { text: string, value: string }) => boolean)

  /** 默认筛选值 */
  defaultFilteredValue?: string[]

  /** 受控筛选值 */
  filteredValue?: string[]

  /** 筛选回调 */
  onFilter?: (value: string, record: Recordable) => boolean

  /** 筛选改变回调 */
  onFilterDropdownOpenChange?: (open: boolean) => void

  /** 自定义筛选下拉框 */
  filterDropdown?: VNode | ((props: { setSelectedKeys: (keys: string[]) => void, selectedKeys: string[], confirm: () => void, clearFilters: () => void }) => VNode)

  /** 是否显示筛选图标 */
  filterIcon?: VNode | ((filtered: boolean) => VNode)

  /** 列类名 */
  className?: string

  /** 表头类名 */
  headerClassName?: string

  /** 自定义渲染过滤图标 */
  customFilterIcon?: VNode

  /** 是否可调整列宽 */
  resizable?: boolean
}

// ============================================
// 操作列类型
// ============================================

/** 操作项 */
export interface ActionItem {
  /** 操作标签 */
  label?: string | VNode | ((record: Recordable) => string | VNode)

  /** 操作图标 */
  icon?: string

  /** 点击事件 */
  onClick?: Fn<[Recordable, MouseEvent], void>

  /** 权限 */
  auth?: string | string[]

  /** 是否显示 */
  ifShow?: boolean | ((record: Recordable) => boolean)

  /** 是否禁用 */
  disabled?: boolean | ((record: Recordable) => boolean)

  /** 按钮类型 */
  type?: 'link' | 'primary' | 'ghost' | 'dashed' | 'default' | 'text'

  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large'

  /** 危险按钮 */
  danger?: boolean

  /** 按钮颜色 */
  color?: 'error' | 'success' | 'warning' | string

  /** Popconfirm 配置 */
  popConfirm?: {
    title: string | VNode
    content?: string | VNode
    confirm?: Fn<[Recordable, MouseEvent], void>
    cancel?: Fn<[Recordable, MouseEvent], void>
  }

  /** Dropdown 配置 */
  dropdown?: ActionItem[]

  /** 分割线 */
  divider?: boolean

  /** 自定义渲染 */
  render?: (record: Recordable) => VNode
}

/** 操作列配置 */
export interface ActionColumnProps {
  /** 列宽 */
  width?: number

  /** 列标题 */
  title?: string

  /** 列 key */
  dataIndex?: string

  /** 固定位置 */
  fixed?: 'left' | 'right'

  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'

  /** 操作项 */
  actions?: (record: Recordable) => ActionItem[]

  /** 最多显示数量，超出显示下拉 */
  maxShowCount?: number
}

// ============================================
// 行选择类型
// ============================================

/** 行选择配置 */
export interface TableRowSelection {
  /** 选择类型 */
  type?: 'checkbox' | 'radio'

  /** 选中的行 key */
  selectedRowKeys?: string[] | number[]

  /** 选中的行数据 */
  selectedRows?: Recordable[]

  /** 选择改变回调 */
  onChange?: (selectedRowKeys: string[] | number[], selectedRows: Recordable[], info?: { type: 'all' | 'single' | 'multiple' }) => void

  /** 单行选择回调 */
  onSelect?: (record: Recordable, selected: boolean, selectedRows: Recordable[], nativeEvent: Event) => void

  /** 获取 Checkbox 属性 */
  getCheckboxProps?: (record: Recordable) => { disabled?: boolean, name?: string }

  /** 获取标题 Checkbox 属性 */
  getTitleCheckboxProps?: () => { disabled?: boolean }

  /** 隐藏全选 */
  hideSelectAll?: boolean

  /** 自定义列标题 */
  columnTitle?: string | VNode | ((originalNode: VNode) => VNode)

  /** 列宽 */
  columnWidth?: string | number

  /** 固定列 */
  fixed?: boolean | 'left' | 'right'

  /** 对齐方式 */
  align?: 'left' | 'right' | 'center'

  /** 严格模式 */
  checkStrictly?: boolean

  /** 保留已移除的选中项 */
  preserveSelectedRowKeys?: boolean

  /** 自定义单元格渲染 */
  renderCell?: (checked: boolean, record: Recordable, index: number, originNode: VNode) => VNode

  /** 单元格属性 */
  onCell?: (record: Recordable, rowIndex: number) => Recordable
}

// ============================================
// 数据获取类型
// ============================================

/** 分页字段配置 */
export interface FetchSetting {
  /** 当前页字段 */
  pageField?: string

  /** 每页条数字段 */
  sizeField?: string

  /** 列表字段 */
  listField?: string

  /** 总数字段 */
  totalField?: string
}

/** 数据获取参数 */
export interface FetchParams {
  /** 搜索参数 */
  searchInfo?: Recordable

  /** 分页参数 */
  page?: number

  /** 每页条数 */
  pageSize?: number

  /** 排序字段 */
  sortInfo?: Recordable

  /** 筛选信息 */
  filterInfo?: Recordable
}

/** API 函数类型 */
export type ApiFn = (params: FetchParams) => Promise<Recordable>

// ============================================
// 表格属性类型
// ============================================

/** 表格属性 */
export interface BasicTableProps {
  /** 列配置 */
  columns?: BasicColumn[]

  /** 数据源 */
  dataSource?: Recordable[]

  /** 行选择配置 */
  rowSelection?: TableRowSelection | boolean

  /** 是否显示边框 */
  bordered?: boolean

  /** 表格标题 */
  title?: string | VNode | ((data: Recordable[]) => VNode)

  /** 分页配置 */
  pagination?: AntPaginationProps | boolean

  /** 是否可调整列宽 */
  canResize?: boolean

  /** 调整高度偏移量 */
  resizeHeightOffset?: number

  /** 是否显示序号列 */
  showIndexColumn?: boolean

  /** 序号列配置 */
  indexColumnProps?: Partial<BasicColumn>

  /** 操作列配置 */
  actionColumn?: ActionColumnProps

  /** 是否显示表格设置 */
  showTableSetting?: boolean

  /** 表格设置配置 */
  tableSetting?: {
    /** 是否显示刷新 */
    redo?: boolean
    /** 是否显示列设置 */
    setting?: boolean
    /** 是否显示全屏 */
    fullScreen?: boolean
  }

  /** 数据获取 API */
  api?: ApiFn

  /** 默认参数 */
  params?: Recordable

  /** 数据获取前处理 */
  beforeFetch?: (params: FetchParams) => FetchParams | false

  /** 数据获取后处理 */
  afterFetch?: (data: Recordable[]) => Recordable[]

  /** 数据字段配置 */
  fetchSetting?: FetchSetting

  /** 立即执行数据获取 */
  immediate?: boolean

  /** 搜索表单配置 */
  searchInfo?: Recordable

  /** 是否显示搜索表单 */
  useSearchForm?: boolean

  /** 搜索表单 schema */
  formConfig?: Partial<FormProps> & { schemas?: FormSchema[] }

  /** 提交前处理搜索参数 */
  handleSearchInfoFn?: (values: Recordable) => Recordable

  /** 行 key */
  rowKey?: string | ((record: Recordable) => string)

  /** 展开行渲染 */
  expandedRowRender?: (record: Recordable, index: number, indent: number, expanded: boolean) => VNode

  /** 展开图标 */
  expandIcon?: (props: { expanded: boolean, record: Recordable, onExpand: (record: Recordable, e: Event) => void }) => VNode

  /** 默认展开所有行 */
  defaultExpandAllRows?: boolean

  /** 默认展开的行 */
  defaultExpandedRowKeys?: string[]

  /** 展开的行 */
  expandedRowKeys?: string[]

  /** 展开行改变回调 */
  onExpand?: (expanded: boolean, record: Recordable) => void

  /** 展开行改变回调 */
  onExpandedRowsChange?: (expandedRows: string[]) => void

  /** 是否可展开 */
  rowExpandable?: (record: Recordable) => boolean

  /** 树形数据配置 */
  childrenColumnName?: string

  /** 缩进大小 */
  indentSize?: number

  /** 是否启用树形数据 */
  isTree?: boolean

  /** 树形数据配置 */
  treeConfig?: {
    /** 子节点字段名 */
    childrenField?: string
    /** 是否显示展开图标 */
    showExpandIcon?: boolean
    /** 是否默认展开所有行 */
    defaultExpandAll?: boolean
    /** 展开的节点 keys */
    expandedKeys?: string[]
    /** 展开节点改变回调 */
    onExpandChange?: (expandedKeys: string[], record: Recordable) => void
    /** 是否异步加载子节点 */
    loadData?: (record: Recordable) => Promise<Recordable[]>
    /** 是否显示连接线 */
    showLine?: boolean
    /** 缩进大小 */
    indent?: number
  }

  /** 滚动配置 */
  scroll?: TableScroll

  /** 是否启用虚拟滚动 */
  virtual?: boolean

  /** 虚拟滚动配置 */
  virtualConfig?: {
    /** 每行高度 */
    itemHeight?: number
    /** 缓冲区大小 */
    bufferSize?: number
    /** 是否启用动态高度 */
    dynamic?: boolean
  }

  /** 是否启用拖拽排序 */
  dragSort?: boolean

  /** 拖拽排序配置 */
  dragSortConfig?: {
    /** 拖拽手柄选择器 */
    handle?: string
    /** 是否启用动画 */
    animation?: number
    /** 是否禁用 */
    disabled?: boolean | ((record: Recordable) => boolean)
    /** 拖拽完成回调 */
    onDragEnd?: (newData: Recordable[], oldData: Recordable[]) => void
    /** 是否可以放置 */
    canDrop?: (dragRecord: Recordable, dropRecord: Recordable) => boolean
  }

  /** 行类名 */
  rowClassName?: string | ((record: Recordable, index: number) => string)

  /** 单元格类名 */
  cellClassName?: string | ((record: Recordable, index: number, column: BasicColumn) => string)

  /** 行点击事件 */
  onRowClick?: (record: Recordable, index: number, event: Event) => void

  /** 行双击事件 */
  onRowDoubleClick?: (record: Recordable, index: number, event: Event) => void

  /** 行上下文菜单 */
  onRowContextMenu?: (record: Recordable, index: number, event: Event) => void

  /** 行鼠标进入 */
  onRowMouseEnter?: (record: Recordable, index: number, event: Event) => void

  /** 行鼠标离开 */
  onRowMouseLeave?: (record: Recordable, index: number, event: Event) => void

  /** 表格改变回调 */
  onChange?: (pagination: any, filters: any, sorter: any, extra: { currentDataSource: Recordable[] }) => void

  /** 加载状态 */
  loading?: boolean

  /** 空数据提示 */
  locale?: Recordable

  /** 表格布局 */
  tableLayout?: 'auto' | 'fixed'

  /** 粘性头部 */
  sticky?: boolean | { offsetHeader?: number, offsetSummary?: number, offsetScroll?: number, getContainer?: () => HTMLElement }

  /** 汇总行 */
  summary?: (data: Recordable[]) => VNode

  /** 自定义空数据展示 */
  emptyText?: string | VNode

  /** 是否显示表头 */
  showHeader?: boolean

  /** 是否显示排序按钮 */
  showSorterTooltip?: boolean | { title?: string }

  /** 表格尺寸 */
  size?: 'small' | 'middle' | 'large'
}

// ============================================
// 表格实例方法类型
// ============================================

/** 表格实例方法 */
export interface TableActionType {
  // 基础操作
  /** 设置属性 */
  setProps: (props: Partial<BasicTableProps>) => void

  /** 重新加载数据 */
  reload: (opt?: FetchParams) => Promise<void>

  /** 重新计算高度 */
  redoHeight: () => Promise<void>

  /** 设置加载状态 */
  setLoading: (value: boolean) => void

  /** 获取原始数据 */
  getRawDataSource: () => Recordable[]

  // 列操作
  /** 设置列 */
  setColumns: (columns: BasicColumn[] | string[]) => void

  /** 获取列 */
  getColumns: () => BasicColumn[]

  /** 更新列 */
  updateColumn: (column: Partial<BasicColumn>, key: string) => void

  /** 获取可见列 */
  getVisibleColumns: () => BasicColumn[]

  /** 获取缓存列 */
  getCacheColumns: () => BasicColumn[]

  // 行操作
  /** 展开所有 */
  expandAll: () => void

  /** 折叠所有 */
  collapseAll: () => void

  /** 展开指定行 */
  expandRows: (keys: string[]) => void

  /** 折叠指定行 */
  collapseRows: (keys: string[]) => void

  /** 滚动到指定行 */
  scrollTo: (pos: { left?: number, top?: number }) => void

  /** 选中行 */
  selectRows: (keys: string[]) => void

  /** 获取选中行 */
  getSelectRows: () => Recordable[]

  /** 获取选中行 keys */
  getSelectRowKeys: () => string[]

  /** 清空选中 */
  clearSelectedRowKeys: () => void

  /** 删除选中行 */
  deleteSelectRowByKey: (key: string) => void

  // 分页操作
  /** 获取分页配置 */
  getPaginationRef: () => AntPaginationProps | boolean

  /** 设置分页 */
  setPagination: (pagination: Partial<AntPaginationProps>) => void

  /** 设置是否显示分页 */
  setShowPagination: (show: boolean) => void | Promise<void>

  /** 获取是否显示分页 */
  getShowPagination: () => boolean

  // 表单操作
  /** 获取表单值 */
  getFormValues: () => Recordable

  /** 设置表单值 */
  setFormValues: (values: Recordable) => void

  /** 重置表单 */
  resetForm: () => void

  /** 提交表单 */
  submitForm: () => Promise<void>

  /** 验证表单 */
  validateForm: () => Promise<Recordable>

  /** 更新表单 schema */
  updateFormSchema: (schema: Partial<FormSchema>, field: string) => void

  /** 追加表单 schema */
  appendFormSchema: (schema: FormSchema, prefixField?: string, first?: boolean) => void

  /** 删除表单 schema */
  removeFormSchema: (field: string) => void

  /** 获取表单实例 */
  getForm: () => Recordable

  // 数据操作
  /** 插入数据 */
  insertTableDataRecord: (record: Recordable | Recordable[], index?: number) => void

  /** 删除数据 */
  deleteTableDataRecord: (key: string | string[]) => void

  /** 更新数据 */
  updateTableDataRecord: (key: string, record: Recordable) => void

  /** 查找数据 */
  findTableDataRecord: (key: string) => Recordable | undefined

  /** 获取数据 */
  getDataSource: () => Recordable[]

  /** 设置数据 */
  setTableData: (data: Recordable[]) => void
}

// ============================================
// Hook 返回类型
// ============================================

/** useTable 返回类型 */
export interface UseTableReturn extends TableActionType {
  /** 获取属性 */
  getProps: () => BasicTableProps
}

/** useColumns 配置 */
export interface UseColumnsOptions {
  columns: BasicColumn[] | Ref<BasicColumn[]>
  cacheKey?: string
  showIndexColumn?: boolean | Ref<boolean | undefined>
  indexColumnProps?: Partial<BasicColumn>
  actionColumn?: ActionColumnProps | Ref<ActionColumnProps | undefined>
}

/** useColumns 返回 */
export interface UseColumnsReturn {
  columnsRef: Ref<BasicColumn[]>
  cacheColumnsRef: Ref<BasicColumn[]>
  setColumns: (columns: BasicColumn[] | string[]) => void
  getColumns: () => BasicColumn[]
  getCacheColumns: () => BasicColumn[]
  setCacheColumns: (columns: BasicColumn[]) => void
  updateColumn: (column: Partial<BasicColumn>, key: string) => void
}

/** useDataSource 配置 */
export interface UseDataSourceOptions {
  api?: ApiFn | Ref<ApiFn | undefined>
  params?: Recordable | Ref<Recordable | undefined>
  dataSource?: Recordable[] | Ref<Recordable[] | undefined>
  beforeFetch?: (params: FetchParams) => FetchParams | false
  afterFetch?: (data: Recordable[]) => Recordable[]
  fetchSetting?: FetchSetting
  rowKey?: string | ((record: Recordable) => string) | Ref<string | ((record: Recordable) => string) | undefined>
  immediate?: boolean
  pagination?: { getPagination: () => AntPaginationProps | false, setPagination: (pagination: Partial<AntPaginationProps>) => void }
  loading: { setLoading: (value: boolean) => void }
}

/** useDataSource 返回 */
export interface UseDataSourceReturn {
  dataSourceRef: Ref<Recordable[]>
  rawDataSourceRef: Ref<Recordable[]>
  fetch: (opt?: FetchParams) => Promise<void>
  reload: (opt?: FetchParams) => Promise<void>
  setTableData: (data: Recordable[]) => void
  insertTableDataRecord: (record: Recordable | Recordable[], index?: number) => void
  deleteTableDataRecord: (key: string | string[]) => void
  updateTableDataRecord: (key: string, record: Recordable) => void
  findTableDataRecord: (key: string) => Recordable | undefined
}

/** useRowSelection 配置 */
export interface UseRowSelectionOptions {
  rowSelection?: TableRowSelection | boolean | Ref<TableRowSelection | boolean | undefined>
  dataSourceRef?: Ref<Recordable[]>
  rowKey?: string | ((record: Recordable) => string) | Ref<string | ((record: Recordable) => string)>
  clearSelectOnPageChange?: boolean
}

/** useRowSelection 返回 */
export interface UseRowSelectionReturn {
  selectedRowKeysRef: Ref<string[]>
  selectedRowsRef: Ref<Recordable[]>
  getRowSelection: ComputedRef<TableRowSelection | null>
  clearSelectedRowKeys: () => void
  deleteSelectRowByKey: (key: string) => void
  setSelectedRowKeys: (keys: string[]) => void
  getSelectRows: () => Recordable[]
}

/** usePagination 配置 */
export interface UsePaginationOptions {
  pagination?: AntPaginationProps | boolean | Ref<AntPaginationProps | boolean | undefined>
  fetchSetting?: FetchSetting
}

/** usePagination 返回 */
export interface UsePaginationReturn {
  paginationRef: Ref<AntPaginationProps | false>
  getPagination: ComputedRef<AntPaginationProps | false>
  setPagination: (pagination: Partial<AntPaginationProps>) => void
  setShowPagination: (show: boolean) => void
  getShowPagination: () => boolean
}

/** useTableScroll 配置 */
export interface UseTableScrollOptions {
  scroll?: TableScroll | Ref<TableScroll | undefined>
  canResize?: boolean | Ref<boolean | undefined>
  resizeHeightOffset?: number | Ref<number | undefined>
}

/** useTableScroll 返回 */
export interface UseTableScrollReturn {
  scrollRef: Ref<TableScroll | undefined>
  getScroll: ComputedRef<TableScroll | undefined>
  redoHeight: () => Promise<void>
  scrollTo: (pos: { left?: number, top?: number }) => void
}

/** useTableForm 配置 */
export interface UseTableFormOptions {
  formConfig?: Partial<FormProps> & { schemas?: FormSchema[] }
  fetch: (opt?: FetchParams) => Promise<void>
  getBindValues: () => BasicTableProps
}

/** useTableForm 返回 */
export interface UseTableFormReturn {
  formRef: Ref<Recordable>
  formMethods: Recordable
  getFormProps: ComputedRef<Partial<FormProps>>
  handleSearchInfoFn: (values: Recordable) => Recordable
  replaceFormSlotKey: (key: string) => string
  getFormSlotKeys: ComputedRef<string[]>
  getForm: () => Recordable
}

// ============================================
// 其他类型
// ============================================

/** 表格大小 */
export type TableSize = 'small' | 'middle' | 'large'

/** 表格设置 */
export interface TableSetting {
  redo?: boolean
  setting?: boolean
  fullScreen?: boolean
}

/** 展开行配置 */
export interface TableExpandableConfig {
  /** 展开图标列标题 */
  columnTitle?: string | VNode

  /** 展开图标列宽 */
  columnWidth?: string | number

  /** 是否固定展开列 */
  fixed?: boolean | 'left' | 'right'

  /** 展开行渲染 */
  expandedRowRender?: (record: Recordable, index: number, indent: number, expanded: boolean) => VNode

  /** 展开图标 */
  expandIcon?: (props: { expanded: boolean, record: Recordable, onExpand: (record: Recordable, e: MouseEvent) => void }) => VNode

  /** 点击行展开 */
  expandRowByClick?: boolean

  /** 是否可展开 */
  rowExpandable?: (record: Recordable) => boolean

  /** 展开改变回调 */
  onExpand?: (expanded: boolean, record: Recordable) => void

  /** 展开行改变回调 */
  onExpandedRowsChange?: (expandedRows: string[]) => void
}
