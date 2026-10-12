# 表格

`BasicTable` 把 antdv-next 的 `a-table` 包成了「配置驱动 + 命令式实例」的形态：数据源、分页、列、搜索表单、行选择都从 props 进来，页面通过 `@register` 拿到一个方法集合去命令式操作表格。它解决的是后台列表页的重复劳动 —— 每个列表都要写的 loading、分页参数拼装、响应解包、列显隐缓存、行选择状态，在这里收成一个 hook。

源码：`apps/web/src/components/business/Table/`（`BasicTable.vue` / `useTable.ts` / `types.ts` / `hooks/`）。导出清单见 `Table/index.ts`。

## useTable：注册与实例

```ts
// apps/web/src/components/business/Table/useTable.ts:24-39
export function useTable(
  props?: Partial<BasicTableProps>,
): [(instance: TableActionType) => void, Ref<null | TableActionType>];
```

返回值第二个是 **`Ref<TableActionType | null>`**，不是方法集合：调实例方法要写 `xxxRef.value?.reload()`。`useTable.ts` 顶部注释里的 `methods.reload()` 是旧写法，照抄会报 undefined。

```vue
<script setup lang="ts">
import type { BasicColumn } from '~/components/business/Table';
import { BasicTable, useTable } from '~/components/business/Table';

const basicColumns: BasicColumn[] = [
  { title: 'Name', dataIndex: 'name', key: 'name', sorter: true, width: 120 },
  { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
];

const [registerBasic, basicTableRef] = useTable({
  columns: basicColumns,
  dataSource: basicData,
  rowSelection: { onChange: (keys) => (basicSelectedKeys.value = keys) },
  bordered: true,
  rowKey: 'key',
  size: 'middle',
});

function handleRefresh() {
  basicTableRef.value?.setLoading(true);
}
</script>

<template>
  <BasicTable @register="registerBasic">
    <template #cell-status="{ record }">
      <a-tag :color="statusColorMap[record?.status] || 'default'">{{
        record?.status
      }}</a-tag>
    </template>
  </BasicTable>
</template>
```

`register` 收到实例后立刻把 `useTable(props)` 的初始 props 合并进去（`useTable.ts:31-36` → `BasicTable.vue:433-435` 的 `setProps`）。表格的 `setProps` **是真能用的**：它把新值写进内部的 `propsRef`，不是 `Object.assign(props, …)`（对比 [弹窗与抽屉](/components/modal-drawer) 里那两个空操作）。

## BasicTableProps 常字段

类型定义 `Table/types.ts:437-706`，默认值在 `BasicTable.vue:45` 的 `withDefaults`（`rowKey: 'id'`、`showIndexColumn: false`、`immediate: true`、`canResize: false`、`showHeader: true`）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `api` | `ApiFn` | 请求函数，返回分页数据时由表格自己解包 |
| `dataSource` | `Recordable[]` | 本地数据，与 `api` 二选一 |
| `columns` | `BasicColumn[]` | 列配置 |
| `pagination` | `AntPaginationProps \| boolean` | `false` 关掉分页 |
| `fetchSetting` | `{ pageField, sizeField, listField, totalField }` | 默认 `pageNum / pageSize / list / total`（`hooks/useDataSource.ts:18-21`） |
| `useSearchForm` / `formConfig` | `boolean` / `Partial<FormProps>` | 表格自带搜索区，见[表单](/components/form) |
| `rowSelection` | `boolean \| TableRowSelection` | 传对象即 checkbox，`type: 'radio'` 单选 |
| `actionColumn` | `ActionColumnProps` | 操作列，`actions(record)` 返回 `ActionItem[]` |
| `showTableSetting` / `tableSetting` | `boolean` / 对象 | 右上角列设置/刷新/密度 |
| `dragSort` / `dragSortConfig` | `boolean` / 对象 | 见下文拖拽排序 |
| `scroll` | `{ x, y, scrollToFirstRowOnChange }` | 横向/纵向滚动 |
| `immediate` | `boolean` | 挂载即请求，默认 `true` |
| `beforeFetch` / `afterFetch` | `(p) => false \| p` / `(d) => d[]` | 拦截请求参数、二次加工结果 |

**响应解包**：`api` 的返回按 `listField → items → data → records → 裸数组` 顺序嗅探，只接受 `Array.isArray` 的候选（`useDataSource.ts:40-56`）。这就是示例里 `paginationMockApi` 返回 `{ items, total }` 也能直接渲染的原因，不需要额外配 `listField`。数组之外的 `total` 走独立兜底链。

## 列（BasicColumn）

`Table/types.ts:101-238`。常用项：

| 字段 | 说明 |
| --- | --- |
| `key` / `dataIndex` | 插槽与排序用的标识 / 取值字段，`dataIndex` 支持 `string[]` |
| `title` | `string \| VNode \| (options) => VNode` |
| `width` / `minWidth` / `align` / `headerAlign` / `fixed` | 布局 |
| `ellipsis` | `boolean \| { showTitle? }` |
| `sorter` | `boolean`（交给后端/`onChange`）/ 比较函数 / `{ compare, multiple }` |
| `filters` / `onFilter` / `filterMode` / `filteredValue` | 筛选；本地筛选给 `onFilter` |
| `format` | `(text, record, index) => string \| VNode`，纯文本格式化 |
| `customRender` | 优先级高于 `format` |
| `edit` / `editRow` / `editComponent` / `editComponentProps` / `editValueMap` | 可编辑单元格 |
| `ifShow` / `defaultHidden` / `auth` | 显隐与列权限 |
| `resizable` | 拖列宽 |

可编辑列的 `editComponent` 用的是 **Table 自己的 `ComponentType` 联合**（`types.ts:81-98`，含 `ApiSelect` / `ApiTreeSelect` / `ApiCascader` / `ApiRadioGroup`），这套 `Api*` 组件 Form 的 `componentMap` 里没有 —— 反过来 Form 的 `Select` 也不在这个列表里。两边不要混着写。

插槽（`BasicTable.vue` 模板）：`#toolbar`(703)、`#actionHeader`(756)、`#indexHeader`(763)、`#header-{key}`(770)、`#action`(782)、`#index`(792)、`#cell-{key}`(806-813)、`#cell-{dataIndex}`(816-826)、裸 `#{dataIndex}`(829-833)、`#expandedRowRender`(853)、`#summary`(875)、`#empty`(882)。事件：`change`、`row-click`、`row-db-click`、`header-edit`、`cell-save`、`cell-cancel`、`cell-change`、`register`（`BasicTable.vue:60-95`）。

实例方法（`TableActionType`，`types.ts:711-841`）：`setProps`、`reload`、`redoHeight`、`setLoading`、`get/setColumns`、`updateColumn`、`getVisibleColumns`、`getCacheColumns`、`expandAll`/`collapseAll`/`expandRows`/`collapseRows`、`scrollTo`、`selectRows`、`getSelectRows`、`getSelectRowKeys`、`clearSelectedRowKeys`、`deleteSelectRowByKey`、`getPaginationRef`、`setPagination`、`setShowPagination`、`getShowPagination`、`getDataSource`、`setTableData`、`insertTableDataRecord`、`updateTableDataRecord`、`deleteTableDataRecord`、`findTableDataRecord`，以及转发给内置搜索表单的 `getFormValues`/`setFormValues`/`resetForm`/`submitForm`/`validateForm`/`updateFormSchema`/`appendFormSchema`/`removeFormSchema`/`getForm`。

## 拖拽排序（dragSort）

新近才接进 `BasicTable`：组件挂载后把 Sortable 绑到自己的 `<tbody>` 上，排完直接改内部数据源，页面只在 `onDragEnd` 里把新顺序写回自己的状态。

```ts
// apps/web/src/components/business/Table/types.ts:617-638
dragSort?: boolean;
dragSortConfig?: {
  handle?: string;
  animation?: number;
  disabled?: ((record: Recordable) => boolean) | boolean;
  onDragEnd?: (newData: Recordable[], oldData: Recordable[]) => void;
  canDrop?: (dragRecord: Recordable, dropRecord: Recordable) => boolean;
};
```

绑定逻辑 `BasicTable.vue:228-273`：所有配置项都是**读值函数**，所以 `dragSortConfig` 换成新引用不需要重建 Sortable；`watch(() => props.dragSort)` 会 `destroySortable()` 后重新 `syncDragSort()`（`nextTick` 后查 `.ant-table-tbody`），`onDragEnd` 里除了回调还会 `dataSource.setTableData(newData)`。

::: warning 两个边界

1. **前端分页只重排当前页**。`pagination` 开着且数据是本地 `dataSource` 时，行下标只覆盖当前页 —— 要「拖出来的顺序就是全量顺序」，配 `pagination: false` 或走服务端分页（`types.ts:617-624` 的注释原文）。
2. `ant-table-measure-row` 的下标错位**已经修掉了**：`hooks/useDragSort.ts:46-54` 每次事件现量「第一个带 `data-row-key` 的 `<tr>` 前面有几行」，再用 `dataIndex(i) = i - leadingOffset()` 还原数据下标。antd 在固定表头/横向滚动时会插这一行，直接用 `oldIndex` 索引数据源会整体错位。:::

## TreeTable

左树右表的复合页：`apps/web/src/components/business/TreeTable/`。`TreeTableProps`（`TreeTable/types.ts`）里 `treeData` 与 `tableColumns` 必填，其余有默认值（`TreeTable.vue:16-31`：`treeTitle: '目录'`、`treeWidth: 260`、`treeMinWidth: 200`、`treeMaxWidth: 480`、`tableTitle: '列表'`、`tableRowKey: 'id'`、`tablePageSize: 10`、`showSearch: true`、`treeDefaultExpandAll: true`、`treeEmptyText`/`tableEmptyText: '暂无数据'`）。右侧表格内部又是一个 `BasicTable`，`tableApi` 收 `{ treeKey, page, pageSize }` 并返回 `{ list, total }`，事件只有 `treeSelect(key, node)`。

```vue
<TreeTable
  tree-title="组织架构"
  :tree-data="orgTree"
  table-title="员工列表"
  :table-columns="columns"
  :table-api="fetchTableData"
  table-row-key="id"
  :tree-width="280"
  @tree-select="handleTreeSelect"
/>
```

中间的分隔条可以拖（`treeMinWidth`/`treeMaxWidth` 就是这个拖拽的夹取值），树的搜索框按标题过滤并自动展开命中路径。

## 在线示例

- **`#/components/table/crud`** — 两张卡片：「增删改查（useCRUD）」与「这个示例省掉了什么」。第一张把新增 / 编辑 / 删除 / 批量删除全部交给 `useCRUD` 编排（`views/components/table/crud/index.vue:205-237`），页面里没有手写 `isEditing` 与 `handleSave` 的分支；表格用 `:use-search-form="true"` 挂搜索表单、`row-selection` 复选框、`#cell-status`/`#cell-priority`/`#cell-progress` 三个插槽渲染 tag 与进度条，`row-key="id"`。数据源是 mock 的 `demo/task` 系列接口，新增一行后刷新仍在。按钮级权限在这一页是可见的：操作列由 `ActionItem.auth` 声明（`:281-305`），删除走 `popConfirm`；用 `custom` 账号登录时它没有 `demo:task:remove`，删除与批量删除两个入口一起消失。第二张卡片只解释分工 —— `useTable` 管数据源与分页、`useModal`/`useForm` 管容器与表单、`useCRUD` 只把「校验 → 落库 → 关窗 → 刷新」这条固定序列搬过去。细节见 [组合式函数](/guide/in-depth/composables)。
- **`#/components/table/basic`** — 五张卡片：Basic Table（列排序 `sorter: true`、部门筛选 `filters` + `onFilter`、行选择、`#cell-status`/`#cell-salary` 插槽、Refresh 走 `setLoading`、Bulk Action 走 `getSelectRows`）、Pagination（`api` + `pagination: { pageSize: 3, showSizeChanger: true }`，mock 返回 `{ items, total }`）、Expandable / Tree Data（`defaultExpandAllRows`）、Empty 与 Loading 状态。这一页的标题、按钮、`showTotal` 文案是英文，其余示例页是中文。
- **`#/components/table/drag-sort`** — 四张卡片：整行拖动（`dragSort: true` + `rowClassName: cn('cursor-move')`）、手柄拖拽（`handle: '.drag-handle'`，`#cell-dragHandle` 放 ⠿）、禁止某些行（`disabled` 布尔与函数两种形态、`canDrop` 拦住 `locked` 行，配置由模板绑一个 `computed`）、保存顺序。「保存顺序」按钮**不发请求**：`views/components/table/drag-sort/index.vue:181-186` 的注释写明 `src/api` 没有可复用的排序保存接口，`handleSaveOrder()` 只是把当前顺序记进本地 ref，成功提示原文是「已保存 N 条顺序（本地模拟，未调用后端接口）」，刷新即回初始顺序。
- **`#/components/table/tree-table`** — 单张卡片「组织架构 - 员工管理」。点左侧部门节点触发 `tableApi`，示例的 `fetchTableData` 对 `mockEmployees[treeKey]` 做切片并 `setTimeout` 300ms 模拟延迟（`views/components/table/tree-table/index.vue:223-…`），不碰后端。
- **`#/components/table/animation`** — 三张卡片：基础表格 + 「刷新数据」（`setLoading(true)` 后 2000ms 关掉）、骨架屏加载动画（`a-skeleton :loading="loading" active` 包一段静态内容，按钮切换 `loading`）、行动画效果。

::: danger 示例页自己说错了第三张卡片的 alert 写「添加/删除行时会有平滑的过渡动画效果」（`views/components/table/animation/index.vue:138`），但这个卡片**没有添加/删除行的入口**，`BasicTable.vue` 里也没有任何 `TransitionGroup` 或行过渡样式 —— 这行文案描述的行为在当前实现里不存在。要看动画请往前两张卡：loading 态和骨架屏。:::
