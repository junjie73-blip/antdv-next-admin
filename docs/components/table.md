# 表格

`BasicTable` 把表格做成「配置驱动 + 命令式实例」的形态：数据源、分页、列、搜索表单、行选择都从 props 进来，页面通过 `@register` 拿到一个方法集合去命令式操作表格。它解决的是后台列表页的重复劳动 —— 每个列表都要写的 loading、分页参数拼装、响应解包、列显隐缓存、行选择状态，在这里收成一个 hook。底座是 `@tanstack/vue-table`（排序/过滤/行模型交给它，`BasicTable.vue:276-281` 还专门解释了为什么取的是**排序阶段**的模型 —— 过滤模型看不到排序结果）。DOM 骨架不自建，一律走 `@antdv/shadcn-ui` 的 Table 原语（`Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` / `TableFooter` / `TableCaption` / `TableEmpty`），与仓库其余组件同一套规范；原语只声明 `class` prop，`style` 会透传到它自带的滚动容器 `div[data-slot="table-container"]`（`relative overflow-auto`）上 —— 全局只有这一层负责滚动，`.basic-table-body` 只管 loading 定位、`bordered` 外框与稳定钩子，两层都能滚会把 `sticky top-0` 的表头带走。

源码：`packages/core/ui-kit/table-ui/src/`（`BasicTable.vue` 是"契约 + 装配 + 排版"，逻辑在 `hooks/` 与 `helpers/` 两个目录里，另有 `useTable.ts` / `types.ts` / `features.ts` / `components/`）。导出清单见 `src/index.ts`。

## 内部结构：`BasicTable.vue` 之外的那 19 个文件

`BasicTable.vue` 现在只剩三件事：声明 props/emits/expose（契约）、把 hooks 装配起来（接线）、渲染模板（排版）。其余每一块逻辑都有自己的文件，改行为时只有一个地方要改。

| 文件 | 只负责这件事 |
| --- | --- |
| `hooks/useMergedProps.ts` | `merged*` 这一族派生值的唯一来源（props + `propsRef` 覆盖 + 默认值） |
| `hooks/useDataSource.ts` | 请求、解包、分页拼装、`reload` 与本地数据增删改查 |
| `hooks/usePagination.ts` / `usePaginationModel.ts` | 分页状态 / 把状态换算成 `TablePagination` 要的显式 props |
| `hooks/useColumns.ts` | 列的缓存、显隐、权限过滤与合并 |
| `hooks/useTableRows.ts` | 行的可见性：分页切片 → 树形摊平 → 展开态 |
| `hooks/useRowSelection.ts` / `useSelectionColumn.ts` | 选择态 / 选择列的视图模型（三态全选、点一下抛什么） |
| `hooks/useTableSorting.ts` / `useTableFilters.ts` / `useTableChange.ts` | 表头排序循环 / 筛选面板 / 排序·筛选·分页变化后的统一收尾 |
| `hooks/useStickyColumns.ts` | 固定列的宽度、`left`/`right` 吸边偏移与配套 class |
| `hooks/useTableClasses.ts` | 根节点 → 滚动容器 → `<table>` → 行 → 单元格这五层的 class 与 CSS 变量（`scroll.x` 就在这里变成 `--basic-table-min-width`） |
| `hooks/useLoading.ts` | loading 状态 |
| `hooks/useTableForm.ts` | 内置搜索表单的接线（`getFormProps` / `registerForm` / 时间字段映射） |
| `hooks/useDragSort.ts` | Sortable 的绑定与"DOM 行 ↔ 数据行"的下标换算 |
| `hooks/useTableApi.ts` | 对外 API（`TableActionType`）的装配处，同时是 `emit('register')` 的载荷 |
| `helpers/cellContent.ts` | 单元格内容优先级链：插槽 → `customRender` → `format` → 编辑 → 图片 → 原值 |
| `helpers/renderVNode.ts` | `RenderVNode`：把 `string \| VNode \| 数组` 统一渲染出去 |

::: tip 为什么这么拆 `useStickyColumns` 那类"要看别的 hook 结果"的模块一律**通过参数注入**（`getColumn` / `getHeader` / `visibleColumns`），不反过来 import 兄弟 hook —— 装配关系只在 `BasicTable.vue` 里出现一次，单测也好按参数喂假数据。:::

## useTable：注册与实例

```ts
// packages/core/ui-kit/table-ui/src/useTable.ts:20-22
export function useTable(
  props?: Partial<BasicTableProps>,
): [(instance: TableActionType) => void, Ref<null | TableActionType>];
```

返回值第二个是 **`Ref<TableActionType | null>`**，不是方法集合：调实例方法要写 `xxxRef.value?.reload()`（`useTable.ts:7-19` 的用法注释就是这个形状）。

```vue
<script setup lang="ts">
import type { BasicColumn } from '@antdv/table-ui';

import { Tag } from '@antdv/common-ui';
import { BasicTable, useTable } from '@antdv/table-ui';

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
      <Tag :color="statusColorMap[record?.status] || 'default'">{{
        record?.status
      }}</Tag>
    </template>
  </BasicTable>
</template>
```

`register` 收到实例后立刻把 `useTable(props)` 的初始 props 合并进去（`useTable.ts:26-34` → `BasicTable.vue:152-155` 的 `setProps`）。表格的 `setProps` **是真能用的**：它把新值并进内部的 `propsRef`（`propsRef.value = { ...unref(propsRef), ...p }`），不是 `Object.assign(props, …)`。[弹窗与抽屉](/components/modal-drawer) 那边的 `setModalProps` / `setDrawerProps` 也一样 —— 它们写的是 `propOverrides`，再由 `merged = { ...props, ...propOverrides }` 重算，早先"静默空操作"的说法已经随重实现一起作废。

## BasicTableProps 常字段

类型定义 `types.ts:515-775`，默认值在 `BasicTable.vue:78-92` 的 `withDefaults`：`rowKey: 'id'`、`showIndexColumn: false`、`immediate: true`、`canResize: false`、`resizeHeightOffset: 0`、`showHeader: true`、`size: 'small'`、`tableLayout: 'fixed'`、`scroll: () => ({ y: 440 })`、`defaultExpandAllRows: true`（最后一条注释解释了为什么必须显式写：Vue 会把缺省布尔 prop 变成 `false`，不写就等于把"没传"当成"传了 false"）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `api` | `ApiFn` | 请求函数，返回分页数据时由表格自己解包 |
| `dataSource` | `Recordable[]` | 本地数据，与 `api` 二选一 |
| `columns` | `BasicColumn[]` | 列配置 |
| `pagination` | `PaginationProps \| boolean` | `false` 关掉分页（`PaginationProps` 在 `types.ts:50-66`，字段声明在 `:532`） |
| `fetchSetting` | `{ pageField, sizeField, listField, totalField }` | 默认 `pageNum / pageSize / list / total`（`hooks/useDataSource.ts:18-23`，用 `satisfies FetchSetting` 而不是类型标注） |
| `useSearchForm` / `formConfig` | `boolean` / `Partial<FormProps>` | 表格自带搜索区，见[表单](/components/form) |
| `rowSelection` | `boolean \| TableRowSelection` | 传对象即 checkbox，`type: 'radio'` 单选 |
| `actionColumn` | `ActionColumnProps` | 操作列，`actions(record)` 返回 `ActionItem[]` |
| `dragSort` / `dragSortConfig` | `boolean` / 对象 | 见下文拖拽排序 |
| `scroll` | `{ x, y, scrollToFirstRowOnChange }` | 横向/纵向滚动，缺省是 `{ y: 440 }`（`BasicTable.vue:87`），要整高自适应得显式覆盖。`x` 走 CSS 变量（容器上的 `--basic-table-min-width` + `<table>` 的 `min-w-[var(--basic-table-min-width)]`），`y` 变成滚动容器的 `max-height`；两者都作用在 shadcn `Table` 自带的那层 `data-slot="table-container"` 上 |
| `immediate` | `boolean` | 挂载即请求，默认 `true` |
| `beforeFetch` / `afterFetch` | `(p) => false \| p` / `(d) => d[]` | 拦截请求参数、二次加工结果 |

**响应解包**：`api` 的返回按 `listField → items → data → records → 裸数组` 顺序嗅探，只接受 `Array.isArray` 的候选（`hooks/useDataSource.ts:50-58` 的 `pickList`）。这就是示例里 `paginationMockApi` 返回 `{ items, total }` 也能直接渲染的原因，不需要额外配 `listField`。数组之外的 `total` 走独立兜底链。

## 列（BasicColumn）

`types.ts:110-247`。常用项：

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

可编辑列的 `editComponent` 用的是 **Table 自己的 `ComponentType` 联合**（`types.ts:90-107`，17 个键；`:89` 的注释写明它是"与 form-ui `ComponentType` 命名对齐，取交集内子集"）。它比表单少一大截，也多了四个 `Api*`（`ApiSelect` / `ApiTreeSelect` / `ApiCascader` / `ApiRadioGroup`）—— 这四个在 form-ui 的 `componentMap`（`packages/core/ui-kit/form-ui/src/config.ts:67-101`，28 项）里**没有注册**：`:97-98` 那两条是 `ASelect: FSelect`、`ATreeSelect: FTreeSelect` 的降级壳，不认 `api` / `resultField` / `labelField` 这套参数。反过来表单的 `Select`、`Cascader`、`DatePicker` 等在这个联合里是有的，能正常用。交集之外的名字到了单元格里不会白屏：`TableEditableCell.vue:80` 是 `getComponent(name) ?? getComponent('Input')`，`ApiSelect` 这类会安静退化成文本输入（用例见 `__tests__/cells-and-form.test.ts:205-218`）。所以两边不要凭印象互抄组件名。

插槽（都在 `BasicTable.vue` 模板里）：`#toolbar`(593)、`#toolbar-actions`(595)、`#header-{col.key}`(660)、`#index`(794)、`#action`(807)、`#cell-{col.key}`(823)、`#cell-{col.dataIndex}`(832)、裸 `#{col.dataIndex}`(844)、`#expandedRowRender`(911)、`#empty`(938)、`#summary`(949) —— 后三个 `cell`/裸名是 `v-if`/`v-else-if` 的优先级链，同一个字段只会有一个生效。已经没有 `#actionHeader` / `#indexHeader` 这两个插槽（全目录检索 0 命中），别照着旧笔记写。

`#toolbar` 与 `#toolbar-actions` 的分工照[公共组件 · 页面外壳](/components/common-ui)那套：表格内部就是一台 `PageToolbar`，`title` prop 与 `#toolbar` 落进左栏（筛选/说明那一组，标题带 `data-table="toolbar-title"` 钩子），`#toolbar-actions` 转发到 `PageToolbar` 的 `#actions`（右栏，页面级操作：导出 / 打印 / 批量），窄屏自动折成独占一行右对齐。用例见 `apps/web/src/views/system/log/index.vue`、`apps/web/src/views/system/login-log/index.vue`。

事件在 `defineEmits`（`BasicTable.vue:93-125`）：`change`、`rowClick`、`rowDbClick`、`register`、`headerEdit`、`cellSave`、`cellCancel`、`cellChange`（模板里 `@row-click` 这种 kebab 写法 Vue 会归一化到同名 camel 事件）。

实例方法（`TableActionType`，`types.ts:782-912`；实例对象在 `hooks/useTableApi.ts:78-136` 装配，同时是 `emit('register')` 的载荷与 `defineExpose` 的出口）：`setProps`、`reload`、`setLoading`、`getRawDataSource`、`get/setColumns`、`updateColumn`、`getVisibleColumns`、`getCacheColumns`、`expandAll`/`collapseAll`/`expandRows`/`collapseRows`、`scrollTo`、`selectRows`、`getSelectRows`、`getSelectRowKeys`、`clearSelectedRowKeys`、`deleteSelectRowByKey`、`getPaginationRef`、`setPagination`、`setShowPagination`、`getShowPagination`、`getDataSource`、`setTableData`、`insertTableDataRecord`、`updateTableDataRecord`、`deleteTableDataRecord`、`findTableDataRecord`，以及转发给内置搜索表单的 `getFormValues`/`setFormValues`/`resetForm`/`submitForm`/`validateForm`/`updateFormSchema`/`appendFormSchema`/`removeFormSchema`/`getForm`。注意 `redoHeight` 现在是空 stub（`hooks/useTableApi.ts:82` 的 `redoHeight: async () => {}`），只为兼容旧调用方保留，调它不做任何事；表格高度自适应请改 `canResize` / `scroll.y`。`scrollTo` 滚的是那层 `data-slot="table-container"`（找不到才退回 `.basic-table-body`）；`updateFormSchema` / `appendFormSchema` / `removeFormSchema` 三个至今是空实现（搜索表单的 schema 由 `formConfig` 声明式给出，没有命令式入口）。

## 拖拽排序（dragSort）

新近才接进 `BasicTable`：组件挂载后把 Sortable 绑到自己的 `<tbody>` 上，排完直接改内部数据源，页面只在 `onDragEnd` 里把新顺序写回自己的状态。

```ts
// packages/core/ui-kit/table-ui/src/types.ts:689-710
dragSort?: boolean;
dragSortConfig?: {
  handle?: string;
  animation?: number;
  disabled?: ((record: Recordable) => boolean) | boolean;
  onDragEnd?: (newData: Recordable[], oldData: Recordable[]) => void;
  canDrop?: (dragRecord: Recordable, dropRecord: Recordable) => boolean;
};
```

绑定逻辑 `BasicTable.vue:294-339`：传给 `useDragSort` 的每个配置项都是 **getter**（`get handle() { return getMergedProps.value.dragSortConfig?.handle }` 这种写法，`:296-310`），读的是合并后的 props，所以 `dragSortConfig` 换成新引用不需要重建 Sortable；`watch(() => getMergedProps.value.dragSort)`（`:333-339`）会 `destroySortable()` 后重新 `syncDragSort()`（`:323-331`：`await nextTick()` 之后 `querySelector('.basic-table-tbody')` 再 `initSortable(tbody)`），挂载时同样走这一次 `syncDragSort()`（`:561`）。`onDragEnd` 里除了回调还会 `dataSource.setTableData(newData)`（`:311-316`）—— 注释写明这一步是为了让「重置数据」退回拖**之后**的那份快照，而不是拖之前。绑定目标就是 shadcn `TableBody` 渲染出来的那层 `<tbody>`，本组件给它挂的钩子是 `class="basic-table-tbody"`（`:762`）。

::: warning 两个边界

1. **前端分页只重排当前页**。`pagination` 开着且数据是本地 `dataSource` 时，行下标只覆盖当前页 —— 要「拖出来的顺序就是全量顺序」，配 `pagination: false` 或走服务端分页（`types.ts:682-688` 的注释原文）。
2. **前导行的下标错位有防御**：`hooks/useDragSort.ts:44-59` 的 `snapshotRows()` 在每次拖拽开始前量一次「第一个带 `data-row-key` 的 `<tr>` 前面有几行」（`filter` 与 `onStart` 各调一次，`:101`、`:109`），再用 `dataIndex(i) = i - leadingRowCount`（`:41-42`）还原数据下标；认记录优先按 `data-row-key` 查表（`:62-67`），下标换算只是兜底。`<tbody>` 由本组件自绘（`BasicTable.vue:762`），当前实现里并不会插测量行 —— `:21-31` 的注释把它写成"首条数据行之前可能有测量行 / 占位行"的防御前提，所以这段常态返回 0；一旦将来在数据行前面加了占位/分组行，也不用回来改这里。:::

## TreeTable

左树右表的复合页：`packages/core/ui-kit/table-ui/src/components/TreeTable.vue`，从包根入口引 `import { TreeTable } from '@antdv/table-ui'`。之所以住在 table-ui 而不是 common-ui：组件内部渲染的就是 `BasicTable`，而 `table-ui → common-ui` 这条依赖已经存在，反向引用会让两个包成环。类型（`TreeDataNode` / `TreeTableProps` / `TreeTableFetchParams` / `TreeTableEmits`）在同一个包的 `types.ts:1078-1110`。`TreeTableProps` 里 `treeData` 与 `tableColumns` 必填，其余有默认值（`TreeTable.vue:31-44`：`treeTitle: '目录'`、`treeDefaultExpandAll: true`、`treeSearchPlaceholder: '请输入关键词搜索'`、`treeWidth: 260`、`treeMinWidth: 200`、`treeMaxWidth: 480`、`tableTitle: '列表'`、`tableRowKey: 'id'`、`tablePageSize: 10`、`showSearch: true`、`treeEmptyText`/`tableEmptyText: '暂无数据'`）。右侧表格内部又是一个 `BasicTable`，`tableApi` 收 `{ treeKey, page, pageSize }` 并返回 `{ list, total }`（`page` 是组件从 `BasicTable` 的 `pageNum` 换算过来的，`TreeTable.vue:136-142`），事件只有 `treeSelect(key, node)`。

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

- **`#/components/table/crud`** — 两张卡片：「增删改查（useCRUD）」与「这个示例省掉了什么」。第一张把新增 / 编辑 / 删除 / 批量删除全部交给 `useCRUD` 编排（`views/components/table/crud/index.vue:216-250`，`useCRUD<TaskRecord, TaskFormValues>` 在 `:220`），页面里没有手写 `isEditing` 与 `handleSave` 的分支；表格用 `:use-search-form="true"` 挂搜索表单、`row-selection` 复选框、`#cell-status`/`#cell-priority`/`#cell-progress` 三个插槽渲染 tag 与进度条，`row-key="id"`。数据源是 mock 的 `demo/task` 系列接口，新增一行后刷新仍在。按钮级权限在这一页是可见的：操作列由 `ActionItem.auth` 声明（`:308-330`，`demo:task:edit` 在 `:319`、`demo:task:remove` 在 `:326`），删除走 `popConfirm`（`:327`）；用 `custom` 账号登录时它没有 `demo:task:remove`，删除与批量删除两个入口一起消失。第二张卡片只解释分工 —— `useTable` 管数据源与分页、`useModal`/`useForm` 管容器与表单、`useCRUD` 只把「校验 → 落库 → 关窗 → 刷新」这条固定序列搬过去。细节见 [组合式函数](/guide/in-depth/composables)。
- **`#/components/table/basic`** — 四张卡片：Basic Table（列排序 `sorter: true`、部门筛选 `filters` + `onFilter`、行选择、`#cell-status`/`#cell-salary` 插槽、Refresh 走 `setLoading`、Bulk Action 走 `getSelectRows`）、Pagination（`api` + `pagination: { pageSize: 3, showSizeChanger: true }`，mock 返回 `{ items, total }`）、Expandable / Tree Data（`defaultExpandAllRows`）、Empty 与 Loading 状态。这一页的标题、按钮、`showTotal` 文案是英文，其余示例页是中文。
- **`#/components/table/drag-sort`** — 四张卡片：整行拖动（`dragSort: true` + `rowClassName: cn('cursor-move')`）、手柄拖拽（`handle: '.drag-handle'`，`#cell-dragHandle` 放 ⠿）、禁止某些行（`disabled` 布尔与函数两种形态、`canDrop` 拦住 `locked` 行，配置由模板绑一个 `computed`）、保存顺序。「保存顺序」按钮**不发请求**：`views/components/table/drag-sort/index.vue:203-210` 的注释写明 `src/api` 没有可复用的排序保存接口，`handleSaveOrder()`（`:205`）只是把当前顺序记进本地 ref，成功提示原文是「已保存 N 条顺序（本地模拟，未调用后端接口）」（`:208`），刷新即回初始顺序。
- **`#/components/table/tree-table`** — 单张卡片「组织架构 - 员工管理」。点左侧部门节点触发 `tableApi`，示例的 `fetchTableData` 对 `mockEmployees[treeKey]` 做切片并 `setTimeout` 300ms 模拟延迟（`views/components/table/tree-table/index.vue:224-242`），不碰后端。
- **`#/components/table/animation`** — 三张卡片：基础表格 + 「刷新数据」（`setLoading(true)` 后 2000ms 关掉，`views/components/table/animation/index.vue:83-86`）、骨架屏加载动画（`v-if="loading"` 下渲染 5 行 `@antdv/shadcn-ui` 的 `Skeleton`，最后一行 `w-4/5`，`:123-129`；按钮切换 `loading`，不是 antd 那套 `:loading`+`active` 属性）、行动画效果。

::: danger

示例页自己说错了第三张卡片的 alert 写「添加/删除行时会有平滑的过渡动画效果」（`views/components/table/animation/index.vue:145`），但这个卡片**没有添加/删除行的入口**，`BasicTable.vue` 里也没有任何 `TransitionGroup` 或行过渡样式（table-ui 全目录检索 0 命中）—— 这行文案描述的行为在当前实现里不存在。要看动画请往前两张卡：loading 态和骨架屏。:::
