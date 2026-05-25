基于 Vben Admin Table 官方文档 ，以下是完整的 Table 表格组件生成提示词：

***

```markdown
请使用 Vue 3.3+ + TypeScript 5.0 + Antdv Next 实现一个完整的企业级 Schema 驱动表格组件，完全对标 Vben Admin 的 BasicTable 组件。

## 一、组件架构要求

### 1. 文件结构
```

src/components/Table/
├── index.ts                    # 入口导出
├── BasicTable.vue             # 主组件
├── useTable.ts                # 核心 composable
├── types.ts                   # 完整类型定义
├── helper.ts                  # 工具函数
├── hooks/                     # 组合式函数
│   ├── useColumns.ts          # 列处理
│   ├── useDataSource.ts       # 数据源处理
│   ├── useLoading.ts          # 加载状态
│   ├── usePagination.ts       # 分页处理
│   ├── useRowSelection.ts     # 行选择
│   ├── useTableForm.ts        # 搜索表单集成
│   └── useTableScroll.ts      # 滚动处理
├── components/
│   ├── TableAction.vue        # 操作列组件
│   ├── TableImg.vue           # 图片渲染组件
│   ├── TableSetting.vue       # 表格设置工具
│   ├── ColumnSetting.vue      # 列配置组件
│   ├── HeaderCell.vue         # 表头单元格
│   └── EditCell.vue           # 可编辑单元格
└── settings/
└── componentSettings.ts   # 全局配置

````

### 2. 使用方式支持
- **useTable 方式**（推荐）：`const [register, methods] = useTable(props)`
- **Template ref 方式**：`<BasicTable ref="tableRef" />`
- **Direct props 方式**：`<BasicTable :columns="columns" :dataSource="data" />`

## 二、完整类型定义（TypeScript）

### 核心类型定义必须包含：

```typescript
// BasicColumn - 表格列配置（文档中所有属性）
export interface BasicColumn extends ColumnType<Recordable> {
  // 基础扩展
  defaultHidden?: boolean;              // 默认隐藏
  helpMessage?: string | string[] | VNodeChild | JSXElement;  // 列头帮助文本
  
  // 权限与显示控制
  auth?: RoleEnum | RoleEnum[] | string | string[];  // 权限编码控制显示
  ifShow?: boolean | ((column: BasicColumn) => boolean);  // 业务状态控制显示
  
  // 单元格编辑
  edit?: boolean;                       // 是否开启单元格编辑
  editRow?: boolean;                    // 是否开启行编辑
  editable?: boolean;                     // 是否处于编辑状态
  editComponent?: ComponentType;          // 编辑组件类型
  editComponentProps?: Recordable;        // 编辑组件 props
  editRule?: (text: string, record: Recordable) => Promise<string>;  // 编辑校验
  editValueMap?: (value: any) => string;  // 编辑值映射
  onEditRow?: () => void;                 // 触发行编辑
  
  // 格式化
  format?: CellFormat;                    // 单元格格式化
  
  // 其他
  slots?: {
    customRender?: string;
    title?: string;
  };
}

// ComponentType - 编辑组件类型
export type ComponentType =
  | 'Input'
  | 'InputNumber'
  | 'Select'
  | 'ApiSelect'
  | 'Checkbox'
  | 'Switch'
  | 'DatePicker'
  | 'TimePicker';

// CellFormat - 单元格格式化
export type CellFormat = 
  | string 
  | ((text: string, record: Recordable, index: number) => string | number) 
  | Map<string | number, any>;

// TableActionType - 表格操作方法（useTable 返回）
export interface TableActionType {
  // 基础操作
  setProps: (props: Partial<BasicTableProps>) => void;           // 设置表格参数
  reload: (opt?: FetchParams) => Promise<void>;                  // 刷新表格
  redoHeight: () => void;                                        // 重新计算高度
  setLoading: (loading: boolean) => void;                        // 设置加载状态
  
  // 数据操作
  getDataSource: <T = Recordable>() => T[];                      // 获取表格数据
  getRawDataSource: <T = Recordable>() => T;                     // 获取接口原始数据
  setTableData: <T = Recordable>(values: T[]) => void;           // 设置表格数据
  
  // 列操作
  getColumns: (opt?: GetColumnsParams) => BasicColumn[];         // 获取列配置
  setColumns: (columns: BasicColumn[] | string[]) => void;      // 设置列配置
  
  // 分页操作
  setPagination: (info: Partial<PaginationProps>) => void;       // 设置分页
  getPaginationRef: () => PaginationProps | boolean;            // 获取分页信息
  getShowPagination: () => boolean;                              // 是否显示分页
  setShowPagination: (show: boolean) => Promise<void>;           // 设置显示分页
  
  // 选择操作
  getRowSelection: () => TableRowSelection<Recordable>;          // 获取选择配置
  getSelectRowKeys: () => string[];                              // 获取选中行 keys
  getSelectRows: <T = Recordable>() => T[];                      // 获取选中行数据
  setSelectedRowKeys: (rowKeys: string[] | number[]) => void;   // 设置选中行
  clearSelectedRowKeys: () => void;                             // 清空选中行
  deleteSelectRowByKey: (key: string) => void;                    // 删除选中行
  
  // 数据更新（局部更新）
  updateTableData: (index: number, key: string, value: any) => void;                    // 更新单元格
  updateTableDataRecord: (rowKey: string | number, record: Recordable) => Recordable | void;  // 更新行
  deleteTableDataRecord: (rowKey: string | number | string[] | number[]) => void;       // 删除行
  insertTableDataRecord: (record: Recordable, index?: number) => Recordable | void;    // 插入行
  
  // 表单操作
  getForm: () => FormActionType;                                 // 获取搜索表单实例
  
  // 树形表格
  expandAll: () => void;                                        // 展开所有
  collapseAll: () => void;                                       // 折叠所有
}

// BasicTableProps - 表格整体配置（文档中所有 Props）
export interface BasicTableProps {
  // 数据源
  dataSource?: Recordable[];            // 静态数据
  api?: (...arg: any[]) => Promise<any>; // 接口请求函数
  immediate?: boolean;                  // 是否立即请求（默认 true）
  searchInfo?: Recordable;              // 额外请求参数
  
  // 列配置
  columns: BasicColumn[];               // 列配置
  showIndexColumn?: boolean;            // 显示序号列（默认 true）
  indexColumnProps?: Partial<BasicColumn>;  // 序号列配置
  actionColumn?: Partial<BasicColumn>;  // 操作列配置
  ellipsis?: boolean;                   // 文本省略（默认 true）
  
  // 外观
  title?: string;                       // 表格标题
  titleHelpMessage?: string | string[];   // 标题帮助文本
  striped?: boolean;                    // 斑马纹（默认 true）
  bordered?: boolean;                   // 边框（默认 false）
  inset?: boolean;                      // 取消默认 padding
  size?: 'default' | 'small' | 'large';   // 尺寸
  loading?: boolean;                    // 加载状态
  
  // 功能开关
  canResize?: boolean;                  // 自适应高度（默认 true）
  maxHeight?: number;                   // 最大高度
  resizeHeightOffset?: number;          // 高度偏移量
  clickToRowSelect?: boolean;           // 点击行选中（默认 true）
  clearSelectOnPageChange?: boolean;    // 切页清空选中（默认 false）
  
  // 分页
  pagination?: PaginationProps | false; // 分页配置
  
  // 行选择
  rowSelection?: TableRowSelection<Recordable> | null;  // 选择配置
  
  // 展开行
  expandedRowRender?: (record: Recordable) => VNode | string;
  
  // 合计行
  showSummary?: boolean;                // 显示合计行
  summaryData?: any[];                  // 自定义合计数据
  summaryFunc?: (...arg: any[]) => any[]; // 合计计算方法
  
  // 搜索表单
  useSearchForm?: boolean;              // 使用搜索表单
  formConfig?: Partial<FormProps>;      // 表单配置
  
  // 接口处理
  beforeFetch?: (T: any) => any;        // 请求前处理参数
  afterFetch?: (T: any) => any;        // 请求后处理数据
  handleSearchInfoFn?: (T: any) => any; // 搜索条件处理
  fetchSetting?: FetchSetting;          // 接口字段映射配置
  
  // 排序过滤
  sortFn?: (sortInfo: SorterResult<any>) => any;           // 自定义排序
  filterFn?: (filterInfo: Partial<Recordable<string[]>>) => any;  // 自定义过滤
  
  // 表格设置
  showTableSetting?: boolean;           // 显示表格设置工具
  tableSetting?: TableSetting;          // 表格设置配置
  
  // 其他
  autoCreateKey?: boolean;              // 自动生成 key（默认 true）
  emptyDataIsShowTable?: boolean;       // 空数据时显示表格（默认 true）
  scroll?: { x?: number | string; y?: number | string };  // 滚动配置
  
  // 编辑
  beforeEditSubmit?: (params: {
    record: Recordable;
    index: number;
    key: string | number;
    value: any;
  }) => Promise<any>;                   // 编辑提交前回调
  
  // 事件
  onFetchSuccess?: (params: { items: any[]; total: number }) => void;  // 请求成功
  onFetchError?: (error: Error) => void;                               // 请求失败
  onSelectionChange?: (params: { keys: string[]; rows: any[] }) => void; // 选择变化
  onRowClick?: (record: Recordable, index: number, event: MouseEvent) => void;      // 行点击
  onRowDbClick?: (record: Recordable, index: number, event: MouseEvent) => void;    // 行双击
  onRowContextmenu?: (record: Recordable, index: number, event: MouseEvent) => void; // 行右键
  onRowMouseenter?: (record: Recordable, index: number, event: MouseEvent) => void;  // 行移入
  onRowMouseleave?: (record: Recordable, index: number, event: MouseEvent) => void;  // 行移出
  onEditEnd?: (params: { record: Recordable; index: number; key: string; value: any }) => void;     // 编辑结束
  onEditCancel?: (params: { record: Recordable; index: number; key: string; value: any }) => void;  // 编辑取消
  onEditRowEnd?: () => void;            // 行编辑结束
  onEditChange?: (params: { column: BasicColumn; value: any; record: Recordable }) => void;  // 编辑值变化
}

// FetchSetting - 接口字段映射
export interface FetchSetting {
  pageField?: string;                   // 页码字段（默认 page）
  sizeField?: string;                   // 每页条数字段（默认 pageSize）
  listField?: string;                   // 列表字段（默认 items）
  totalField?: string;                  // 总数字段（默认 total）
}

// TableSetting - 表格设置工具配置
export interface TableSetting {
  redo?: boolean;                       // 刷新按钮
  size?: boolean;                       // 尺寸调整
  setting?: boolean;                    // 字段调整
  fullScreen?: boolean;                 // 全屏按钮
}

// ActionItem - 操作按钮配置
export interface ActionItem {
  label: string;                        // 按钮文本
  disabled?: boolean;                     // 是否禁用
  color?: 'success' | 'error' | 'warning'; // 按钮颜色
  type?: string;                        // 按钮类型
  props?: Recordable;                   // 按钮 props
  icon?: string;                        // 图标
  popConfirm?: PopConfirm;              // 气泡确认框
  divider?: boolean;                    // 是否显示分隔线
  auth?: RoleEnum | RoleEnum[] | string | string[];  // 权限控制
  ifShow?: boolean | ((action: ActionItem) => boolean);  // 业务控制显示
  onClick?: Fn;                         // 点击回调
  tooltip?: string | TooltipProps;      // Tooltip 配置
}

// TableActionProps - TableAction 组件属性
export interface TableActionProps {
  actions: ActionItem[];                // 所有操作按钮配置（不再区分普通和dropdown）
  maxShowCount?: number;                // 最大显示数量，默认4个，超出部分放入dropdown
  stopButtonPropagation?: boolean;      // 是否阻止按钮点击事件冒泡
}

// PopConfirm - 气泡确认配置
export interface PopConfirm {
  title: string;                        // 标题
  okText?: string;                      // 确认文本
  cancelText?: string;                  // 取消文本
  confirm: Fn;                          // 确认回调
  cancel?: Fn;                          // 取消回调
  icon?: string;                        // 图标
}

// FetchParams - 刷新参数
export interface FetchParams {
  page?: number;
  searchInfo?: Recordable;
  sortInfo?: SorterResult<any>;
  filterInfo?: Recordable;
}

// GetColumnsParams - 获取列参数
export interface GetColumnsParams {
  ignoreIndex?: boolean;
  ignoreAction?: boolean;
  ignoreSelection?: boolean;
}

// 辅助类型
export type RoleEnum = string | number;
export type Recordable<T = any> = Record<string, T>;
export type Fn = (...args: any[]) => any;
export type SorterResult<T> = { field?: string; order?: 'ascend' | 'descend' };
````

## 三、核心功能实现要求

### 1. useTable 实现

```typescript
// 必须实现以下签名
export function useTable(props?: BasicTableProps): [
  (instance: TableActionType) => void,  // register 函数
  TableActionType                         // 操作方法对象
]
```

### 2. BasicTable.vue 实现要点

**模板结构**：

```vue
<template>
  <div class="basic-table">
    <!-- 表格头部 -->
    <div class="table-header" v-if="title || showTableSetting">
      <div class="header-left">
        <slot name="tableTitle">
          <span class="title">{{ title }}</span>
          <HelpTooltip v-if="titleHelpMessage" :text="titleHelpMessage" />
        </slot>
      </div>
      <div class="header-right">
        <slot name="toolbar" />
        <TableSetting v-if="showTableSetting" v-bind="tableSetting" />
      </div>
    </div>
    
    <!-- 搜索表单 -->
    <BasicForm 
      v-if="useSearchForm" 
      @register="registerForm"
      @submit="handleSearchSubmit"
    />
    
    <!-- 表格主体 -->
    <a-table
      v-bind="tableProps"
      :columns="getColumns"
      :dataSource="getDataSource"
      :pagination="getPagination"
      :loading="getLoading"
      :row-selection="getRowSelection"
      @change="handleTableChange"
      @row-click="handleRowClick"
    >
      <!-- 展开行 -->
      <template #expandedRowRender="record" v-if="expandedRowRender">
        <slot name="expandedRowRender" :record="record" />
      </template>
      
      <!-- 自定义单元格 -->
      <template #bodyCell="{ column, record, index, text }">
        <!-- 编辑单元格 -->
        <EditCell 
          v-if="column.edit && record.editable" 
          :record="record"
          :column="column"
          :value="text"
          @save="handleEditSave"
          @cancel="handleEditCancel"
        />
        <!-- 格式化显示 -->
        <span v-else-if="column.format" v-html="formatCellValue(column.format, text, record, index)" />
        <!-- 图片 -->
        <TableImg v-else-if="column.dataIndex === 'img' && isImageList(text)" :imgList="text" />
        <!-- 操作列 -->
        <TableAction 
          v-else-if="column.key === 'action'" 
          :actions="getActions(record)" 
          :max-show-count="4"
        />
        <!-- 默认 -->
        <span v-else>{{ text }}</span>
      </template>
    </a-table>
  </div>
</template>
```

### 3. 内置组件实现

**TableAction.vue**：

* Props：`actions: ActionItem[]`, `maxShowCount?: number`（默认4）, `stopButtonPropagation?: boolean`

* 所有操作按钮统一通过 `actions` 传入，不再区分普通按钮和 dropdown 按钮

* 根据 `maxShowCount` 自动拆分显示：前 N 个直接显示，超出部分自动收入 dropdown 菜单

* 支持权限控制（`auth`）和业务控制（`ifShow`）

* 支持 `popConfirm` 气泡确认

* 支持 `divider` 分隔线

* 支持 `tooltip` 提示

**TableAction 实现逻辑**：

```typescript
// 1. 过滤权限和业务控制
const visibleActions = computed(() => {
  return props.actions.filter(action => {
    // 权限检查
    if (action.auth && !hasPermission(action.auth)) return false
    // 业务显示控制
    if (typeof action.ifShow === 'function') return action.ifShow(action)
    return action.ifShow !== false
  })
})

// 2. 自动拆分显示按钮和 dropdown 按钮
const displayActions = computed(() => {
  const maxCount = props.maxShowCount ?? 4
  return visibleActions.value.slice(0, maxCount)
})

const dropdownActions = computed(() => {
  const maxCount = props.maxShowCount ?? 4
  return visibleActions.value.slice(maxCount)
})
```

**TableImg.vue**：

* Props：`imgList: string[]`, `size?: number`, `simpleShow?: boolean`, `showBadge?: boolean`, `margin?: number`, `srcPrefix?: string`

* 支持图片预览

* `simpleShow` 模式只显示第一张 + 计数 Badge

**TableSetting.vue**：

* 包含刷新、尺寸调整、字段调整、全屏按钮

* 调用 `TableActionType` 方法实现功能

**EditCell.vue**：

* 支持 `ComponentType` 所有编辑组件

* 支持 `editRule` 校验

* 支持 `editValueMap` 值映射

* 触发 `edit-change`, `edit-end`, `edit-cancel` 事件

### 4. 关键 Hooks 实现

**useDataSource.ts**：

```typescript
// 处理 api 请求和静态数据
// 实现 beforeFetch/afterFetch 拦截
// 处理 fetchSetting 字段映射
// 实现 reload 方法
// 处理分页、排序、过滤参数
```

**useColumns.ts**：

```typescript
// 处理 columns 权限过滤（auth）
// 处理 columns 业务过滤（ifShow）
// 处理默认隐藏（defaultHidden）
// 处理序号列、选择列、操作列的自动插入
// 实现 setColumns/getColumns
```

**useRowSelection.ts**：

```typescript
// 处理 rowSelection 配置
// 实现 clickToRowSelect（点击行选中）
// 管理 selectedRowKeys 和 selectedRows
// 实现 clearSelectOnPageChange
```

**useTableForm.ts**：

```typescript
// 集成 BasicForm 组件
// 处理 formConfig 配置
// 实现 getForm 方法
// 处理搜索条件合并（searchInfo + form values）
// 调用 handleSearchInfoFn 处理搜索条件
```

**useTableScroll.ts**：

```typescript
// 实现 canResize 自适应高度
// 计算表格可用高度（窗口高度 - 其他元素高度 - resizeHeightOffset）
// 处理 maxHeight
// 监听窗口 resize
```

### 5. 数据请求流程

```
1. reload() 调用
2. 合并参数：{ ...searchInfo, ...formValues, ...pagination, ...sortInfo, ...filterInfo }
3. beforeFetch 处理参数
4. 调用 api(params)
5. afterFetch 处理响应
6. 根据 fetchSetting 解析 list 和 total
7. 更新 dataSource 和 pagination
8. 触发 fetch-success 事件
```

### 6. 编辑功能实现

**单元格编辑**：

* 点击单元格进入编辑状态（显示 EditCell 组件）

* 编辑组件根据 `editComponent` 动态渲染

* 失去焦点或回车触发保存，调用 `beforeEditSubmit`

* 返回 false 阻止提交，否则更新数据并触发 `edit-end`

**行编辑**：

* 通过 `onEditRow` 或外部调用开启行编辑模式

* 整行所有 `edit: true` 的列同时进入编辑状态

* 保存时批量提交所有编辑单元格

## 四、代码示例要求

### 示例 1：基础用法（useTable + api）

```typescript
const columns: BasicColumn[] = [
  { title: '姓名', dataIndex: 'name', width: 120 },
  { title: '年龄', dataIndex: 'age', width: 80 },
  { title: '地址', dataIndex: 'address', ellipsis: true },
];

const [registerTable, { reload, getSelectRows }] = useTable({
  title: '用户列表',
  api: fetchUserList,
  columns,
  rowSelection: { type: 'checkbox' },
  pagination: { pageSize: 10 },
  useSearchForm: true,
  formConfig: {
    schemas: searchSchemas,
    labelWidth: 100,
  },
  actionColumn: {
    width: 200,
    title: '操作',
    dataIndex: 'action',
  },
});
```

### 示例 2：TableAction 权限与业务控制（自动拆分显示）

```vue
<template>
  <BasicTable @register="registerTable">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'action'">
        <TableAction
          :actions="[
            {
              label: '编辑',
              onClick: handleEdit.bind(null, record),
              auth: 'user:edit',  // 权限控制
            },
            {
              label: '删除',
              color: 'error',
              popConfirm: {
                title: '确认删除？',
                confirm: handleDelete.bind(null, record),
              },
              auth: 'user:delete',
            },
            {
              label: '启用',
              ifShow: () => record.status === 'disabled',  // 业务控制
              onClick: handleEnable.bind(null, record),
            },
            {
              label: '禁用',
              ifShow: () => record.status === 'enabled',
              onClick: handleDisable.bind(null, record),
            },
            {
              label: '详情',
              onClick: handleDetail.bind(null, record),
            },
            {
              label: '复制',
              onClick: handleCopy.bind(null, record),
            },
          ]"
          :max-show-count="4"  // 前4个直接显示，超出部分自动放入dropdown
        />
      </template>
    </template>
  </BasicTable>
</template>
```

**TableAction 自动拆分逻辑说明**：

* 所有操作按钮统一通过 `actions` 传入

* 组件根据 `maxShowCount`（默认4）自动拆分：

  * 前 N 个按钮直接显示在操作列

  * 超出 N 个的按钮自动收入 "更多" dropdown 菜单

* 权限控制和业务控制过滤后再进行拆分计算

* 示例：传入6个按钮，maxShowCount=4，则显示：编辑、删除、启用、禁用 + "更多" dropdown（包含：详情、复制）

````

### 示例 3：可编辑单元格
```typescript
const columns: BasicColumn[] = [
  {
    title: '商品名称',
    dataIndex: 'name',
    edit: true,                           // 开启编辑
    editComponent: 'Input',
    editComponentProps: { maxlength: 50 },
    editRule: async (text, record) => {
      if (!text) return '商品名称不能为空';
      if (text.length < 2) return '至少2个字符';
      return '';  // 校验通过
    },
  },
  {
    title: '单价',
    dataIndex: 'price',
    edit: true,
    editComponent: 'InputNumber',
    editComponentProps: { min: 0, precision: 2 },
  },
  {
    title: '数量',
    dataIndex: 'qty',
    edit: true,
    editComponent: 'InputNumber',
    editComponentProps: { min: 1 },
  },
  {
    title: '合计',
    dataIndex: 'total',
    format: (text, record) => record.price * record.qty,
  },
];
````

### 示例 4：树形表格

```typescript
const [registerTable, { expandAll, collapseAll }] = useTable({
  title: '部门列表',
  api: fetchDeptList,
  columns,
  isTreeTable: true,                    // 开启树形
  rowKey: 'id',
  defaultExpandAllRows: false,
});
```

### 示例 5：局部数据更新

```typescript
// 不刷新整个表格，局部更新数据
const [registerTable, { updateTableDataRecord, deleteTableDataRecord }] = useTable({
  /* ... */
});

// 更新指定行
const handleUpdateRow = (row) => {
  updateTableDataRecord(row.id, { ...row, status: 'updated' });
};

// 删除指定行
const handleDeleteRow = (row) => {
  deleteTableDataRecord(row.id);
};

// 插入新行
const handleInsertRow = (record) => {
  insertTableDataRecord(record, 0);  // 插入到第一行
};
```

## 五、性能与边界要求

1. **虚拟滚动**：大数据量时启用虚拟滚动（antdv table 内置）
2. **防抖处理**：resize 监听、频繁 reload 调用需防抖
3. **内存管理**：组件卸载时清理定时器和事件监听
4. **类型安全**：所有 Props、Emits、Slots 必须完整类型定义
5. **错误处理**：api 错误时显示友好提示，不阻断表格功能

## 六、输出要求

1. 提供完整的可运行代码（TypeScript 无类型错误）
2. 包含所有类型的详细 JSDoc 注释
3. 提供 `Table.md` 文档说明（包含所有 Props、Methods、Types、Events）
4. 代码风格使用 Vue 3 `<script setup lang="ts">` 语法
5. 使用 `dayjs` 处理日期，`lodash-es` 处理工具函数

请按以上要求生成完整的表格组件代码库。

```
```

