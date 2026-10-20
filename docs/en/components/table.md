# Table

`BasicTable` shapes the table into a "config-driven + imperative instance" component: data source, pagination, columns, search form and row selection all come in through props, and the page gets a method bag back through `@register` to drive the table imperatively. What it removes is the repeated labour of admin list pages — the loading state, pagination parameter assembly, response unwrapping, column visibility caching and selection bookkeeping every list writes again are folded into one hook here. The base is `@tanstack/vue-table` (sorting / filtering / the row model are handed to it, and `BasicTable.vue:288-291` explains specifically why the **sorting-stage** model is the one taken — the filtering model cannot see the sorted result), while `<table>` / `<thead>` / `<tbody>` and the cells are rendered by the component itself: it no longer borrows any third-party table's DOM.

Source: `packages/core/ui-kit/table-ui/src/` (`BasicTable.vue` / `useTable.ts` / `types.ts` / `features.ts` / `hooks/` / `components/`). The exported list is in `src/index.ts`.

## useTable: registration and instance

```ts
// packages/core/ui-kit/table-ui/src/useTable.ts:20-22
export function useTable(
  props?: Partial<BasicTableProps>,
): [(instance: TableActionType) => void, Ref<null | TableActionType>];
```

The second element of the return value is a **`Ref<TableActionType | null>`**, not a method bag: instance methods have to be called as `xxxRef.value?.reload()` (the usage comment at `useTable.ts:7-19` shows exactly this shape).

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

The moment `register` receives the instance it merges in the initial props handed to `useTable(props)` (`useTable.ts:26-34` → `setProps` at `BasicTable.vue:729-731`). The table's `setProps` **genuinely works**: it folds the new values into the internal `propsRef` (`propsRef.value = { ...unref(propsRef), ...p }`) instead of doing `Object.assign(props, …)`. `setModalProps` / `setDrawerProps` over in [Modal and drawer](/en/components/modal-drawer) behave the same way — they write into `propOverrides`, which `merged = { ...props, ...propOverrides }` then recomputes, so the earlier "silent no-op" claim was retired together with the reimplementation.

## Frequently used BasicTableProps

The types live at `types.ts:515-775`; the defaults are in the `withDefaults` call at `BasicTable.vue:67-80`: `rowKey: 'id'`, `showIndexColumn: false`, `immediate: true`, `canResize: false`, `resizeHeightOffset: 0`, `showHeader: true`, `size: 'small'`, `tableLayout: 'fixed'`, `scroll: () => ({ y: 440 })`, `defaultExpandAllRows: true` (the comment on the last one explains why it must be written out explicitly: Vue turns an omitted boolean prop into `false`, so leaving it out means treating "not passed" as "passed `false`").

| Prop | Type | Notes |
| --- | --- | --- |
| `api` | `ApiFn` | request function; paginated responses are unwrapped by the table itself |
| `dataSource` | `Recordable[]` | local data, one or the other with `api` |
| `columns` | `BasicColumn[]` | column config |
| `pagination` | `PaginationProps \| boolean` | `false` turns pagination off (`PaginationProps` is at `types.ts:50-73`, the field declaration at `:532`) |
| `fetchSetting` | `{ pageField, sizeField, listField, totalField }` | defaults `pageNum / pageSize / list / total` (`hooks/useDataSource.ts:18-23`, written with `satisfies FetchSetting` rather than a type annotation) |
| `useSearchForm` / `formConfig` | `boolean` / `Partial<FormProps>` | the table's built-in search area, see [Form](/en/components/form) |
| `rowSelection` | `boolean \| TableRowSelection` | passing an object means checkboxes, `type: 'radio'` for single select |
| `actionColumn` | `ActionColumnProps` | the action column; `actions(record)` returns `ActionItem[]` |
| `dragSort` / `dragSortConfig` | `boolean` / object | see drag sorting below |
| `scroll` | `{ x, y, scrollToFirstRowOnChange }` | horizontal / vertical scrolling, the default being `{ y: 440 }` (`BasicTable.vue:76`), so full-height fitting needs an explicit override |
| `immediate` | `boolean` | fetch on mount, default `true` |
| `beforeFetch` / `afterFetch` | `(p) => false \| p` / `(d) => d[]` | intercept the request params, post-process the result |

**Response unwrapping**: whatever `api` resolves to is probed in the order `listField → items → data → records → the bare array`, and only `Array.isArray` candidates are accepted (`pickList` at `hooks/useDataSource.ts:50-58`). That is why the demo's `paginationMockApi` returns `{ items, total }` and still renders directly, with no extra `listField`. `total` outside the array goes through its own fallback chain.

## Columns (BasicColumn)

`types.ts:110-249`. The fields you actually reach for:

| Field | Notes |
| --- | --- |
| `key` / `dataIndex` | the id used by slots and sorting / the value path, `dataIndex` accepts `string[]` |
| `title` | `string \| VNode \| (options) => VNode` |
| `width` / `minWidth` / `align` / `headerAlign` / `fixed` | layout |
| `ellipsis` | `boolean \| { showTitle? }` |
| `sorter` | `boolean` (handed to the backend / read in `onChange`) / comparator / `{ compare, multiple }` |
| `filters` / `onFilter` / `filterMode` / `filteredValue` | filtering; provide `onFilter` for local filtering |
| `format` | `(text, record, index) => string \| VNode`, plain text formatting |
| `customRender` | takes precedence over `format` |
| `edit` / `editRow` / `editComponent` / `editComponentProps` / `editValueMap` | editable cells |
| `ifShow` / `defaultHidden` / `auth` | visibility and per-column permission |
| `resizable` | drag to resize the column |

Editable columns use **the Table's own `ComponentType` union** (`types.ts:90-108`, 17 keys; the comment at `:89` states it is "aligned with the form-ui `ComponentType` naming, a subset of the intersection"). It is a good deal shorter than the form's list, and it adds four `Api*` entries (`ApiSelect` / `ApiTreeSelect` / `ApiCascader` / `ApiRadioGroup`) — those four are **not registered** in form-ui's `componentMap` (`config.ts:67-101`, 28 entries): the two lines at `:98-99` are the downgraded shells `ASelect: FSelect` and `ATreeSelect: FTreeSelect`, which do not understand the `api` / `resultField` / `labelField` set of parameters. Conversely the form's `Select`, `Cascader`, `DatePicker` and so on do exist in this union and work normally. A name outside the intersection does not blank the cell out either: `TableEditableCell.vue:80` is `getComponent(name) ?? getComponent('Input')`, so `ApiSelect` and its friends quietly degrade into a text input (the case is in `__tests__/cells-and-form.test.ts:193-200`). So do not copy component names between the two from memory.

Slots (all in the `BasicTable.vue` template): `#toolbar` (1180), `#header-{col.key}` (1258), `#index` (1402), `#action` (1415), `#cell-{col.key}` (1431), `#cell-{col.dataIndex}` (1440), bare `#{col.dataIndex}` (1452), `#expandedRowRender` (1519), `#empty` (1546), `#summary` (1557) — the last three (`cell` / bare name) are a `v-if` / `v-else-if` precedence chain, so only one of them takes effect for a given field. The `#actionHeader` / `#indexHeader` slots no longer exist at all (0 hits when grepping the whole directory), so do not write from old notes. Events are in `defineEmits` (`BasicTable.vue:82-114`): `change`, `rowClick`, `rowDbClick`, `register`, `headerEdit`, `cellSave`, `cellCancel`, `cellChange` (kebab spellings such as `@row-click` in a template are normalized by Vue onto the camelCase event of the same name).

Instance methods (`TableActionType`, `types.ts:776-915`; the instance object is built at `BasicTable.vue:1071-1144`): `setProps`, `reload`, `setLoading`, `getRawDataSource`, `get/setColumns`, `updateColumn`, `getVisibleColumns`, `getCacheColumns`, `expandAll`/`collapseAll`/`expandRows`/`collapseRows`, `scrollTo`, `selectRows`, `getSelectRows`, `getSelectRowKeys`, `clearSelectedRowKeys`, `deleteSelectRowByKey`, `getPaginationRef`, `setPagination`, `setShowPagination`, `getShowPagination`, `getDataSource`, `setTableData`, `insertTableDataRecord`, `updateTableDataRecord`, `deleteTableDataRecord`, `findTableDataRecord`, plus `getFormValues`/`setFormValues`/`resetForm`/`submitForm`/`validateForm`/`updateFormSchema`/`appendFormSchema`/`removeFormSchema`/`getForm`, which forward to the built-in search form. Note that `redoHeight` is now an empty stub (`redoHeight: async () => {}` at `BasicTable.vue:1077`), kept only for old callers — calling it does nothing; for table height fitting change `canResize` / `scroll.y`.

## Drag sorting (dragSort)

Wired into `BasicTable` only recently: after the component mounts it binds Sortable to its own `<tbody>`, the reorder mutates the internal data source straight away, and the page only writes the new order back into its own state inside `onDragEnd`.

```ts
// packages/core/ui-kit/table-ui/src/types.ts:689-703
dragSort?: boolean;
dragSortConfig?: {
  handle?: string;
  animation?: number;
  disabled?: ((record: Recordable) => boolean) | boolean;
  onDragEnd?: (newData: Recordable[], oldData: Recordable[]) => void;
  canDrop?: (dragRecord: Recordable, dropRecord: Recordable) => boolean;
};
```

The binding logic is at `BasicTable.vue:300-349`: every configuration option passed to `useDragSort` is a **getter** (written as `get handle() { return getMergedProps.value.dragSortConfig?.handle }`) reading the merged props, so swapping `dragSortConfig` for a new reference does not require rebuilding Sortable; `watch(() => getMergedProps.value.dragSort)` (`:344-349`) calls `destroySortable()` and then `syncDragSort()` again (which runs `querySelector('.basic-table-tbody')` after `await nextTick()`, `:333-342`), and inside `onDragEnd`, besides the callback, `dataSource.setTableData(newData)` also runs — the comment states this step is there so that "reset data" falls back to the snapshot taken **after** the drag rather than before it.

::: warning Two limits worth knowing

1. **With client-side pagination only the current page is reordered.** When `pagination` is on and the data is a local `dataSource`, row indices only cover the current page — for "the order I drag out is the order of the whole set", set `pagination: false` or use server-side pagination (the literal comment at `types.ts:682-688`).
2. **The leading-row index offset is defended**: `hooks/useDragSort.ts:33-46` measures, per event, how many rows precede the first `<tr>` carrying `data-row-key`, then restores the data index with `dataIndex(i) = i - leadingOffset()`. The `<tbody>` is drawn by this component, and the current implementation never inserts a measurement row (the comment at `:26-32` writes it as a defence against "the caller may insert rows"), so this normally returns 0; should a placeholder or group row ever be added before the data rows, this code still does not need to be revisited.
:::

## TreeTable

The tree-plus-table composite page: `packages/core/ui-kit/table-ui/src/components/TreeTable.vue`, imported from the package root as `import { TreeTable } from '@antdv/table-ui'`. The reason it lives in table-ui rather than common-ui is that the component renders a `BasicTable` internally, and the `table-ui → common-ui` dependency edge already exists — the reverse reference would turn the two packages into a cycle. Its types (`TreeDataNode` / `TreeTableProps` / `TreeTableFetchParams` / `TreeTableEmits`) sit in the same package at `types.ts:1072-1108`. In `TreeTableProps` only `treeData` and `tableColumns` are required, the rest carry defaults (`TreeTable.vue:31-44`: `treeTitle: '目录'`, `treeDefaultExpandAll: true`, `treeSearchPlaceholder: '请输入关键词搜索'`, `treeWidth: 260`, `treeMinWidth: 200`, `treeMaxWidth: 480`, `tableTitle: '列表'`, `tableRowKey: 'id'`, `tablePageSize: 10`, `showSearch: true`, `treeEmptyText`/`tableEmptyText: '暂无数据'`). The table on the right is yet another `BasicTable` inside the component; `tableApi` receives `{ treeKey, page, pageSize }` and returns `{ list, total }` (`page` is converted by the component from `BasicTable`'s `pageNum`, `TreeTable.vue:136-142`), and the only emitted event is `treeSelect(key, node)`.

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

The divider in between is draggable — `treeMinWidth` / `treeMaxWidth` are the clamps of that drag. The tree's search box filters by title and auto-expands the matched path.

## Live examples

- **`#/components/table/crud`** — two cards: "增删改查（useCRUD）" and "这个示例省掉了什么". The first hands create / edit / delete / batch delete entirely to `useCRUD` (`views/components/table/crud/index.vue:216-250`, with `useCRUD<TaskRecord, TaskFormValues>` on `:220`), and no hand-written `isEditing` flag or branching `handleSave` is left in the page; the table mounts the search form with `:use-search-form="true"`, uses the `row-selection` checkboxes, renders tags and a progress bar through the three slots `#cell-status`/`#cell-priority`/`#cell-progress`, and sets `row-key="id"`. Its data source is the mock `demo/task` endpoint family, so a row you add is still there after a refresh. Button-level permission is visible on this page: the action column is declared through `ActionItem.auth` (`:308-330`, `demo:task:edit` on `:319`, `demo:task:remove` on `:326`), and delete goes through `popConfirm` (`:327`); logging in as the `custom` account, which lacks `demo:task:remove`, makes both the row delete and the batch delete entry disappear together. The second card only explains the division of labour — `useTable` owns the data source and pagination, `useModal`/`useForm` own the container and the form, and `useCRUD` merely moves the fixed "validate → persist → close → refresh" sequence elsewhere. Details in [Composables](/en/guide/in-depth/composables).
- **`#/components/table/basic`** — four cards: Basic Table (column sorting with `sorter: true`, department filtering with `filters` + `onFilter`, row selection, the `#cell-status`/`#cell-salary` slots, Refresh through `setLoading`, Bulk Action through `getSelectRows`), Pagination (`api` plus `pagination: { pageSize: 3, showSizeChanger: true }`, the mock returning `{ items, total }`), Expandable / Tree Data (`defaultExpandAllRows`), and the Empty and Loading states. This page's titles, buttons and `showTotal` text are in English, unlike the rest of the gallery, which is in Chinese.
- **`#/components/table/drag-sort`** — four cards: whole-row dragging (`dragSort: true` plus `rowClassName: cn('cursor-move')`), handle dragging (`handle: '.drag-handle'`, with ⠿ placed in `#cell-dragHandle`), restricting rows (`disabled` in both boolean and function form, `canDrop` blocking rows marked `locked`, with the configuration bound in the template as a `computed`), and Save order. The Save order button **issues no request**: the comment at `views/components/table/drag-sort/index.vue:203-210` states that `src/api` has no reusable order-saving endpoint, and `handleSaveOrder()` (`:205`) merely records the current order in a local ref, while the success toast reads verbatim "已保存 N 条顺序（本地模拟，未调用后端接口）" (`:208`) — "saved the order of N rows (local simulation, no backend call)". Reloading restores the initial order.
- **`#/components/table/tree-table`** — a single card, "组织架构 - 员工管理". Clicking a department node on the left triggers `tableApi`; the demo's `fetchTableData` slices `mockEmployees[treeKey]` and `setTimeout`s 300 ms to fake latency (`views/components/table/tree-table/index.vue:224-242`), never touching the backend.
- **`#/components/table/animation`** — three cards: a basic table plus "刷新数据" (turn `setLoading(true)` on and switch it off after 2000 ms, `views/components/table/animation/index.vue:83-86`), the skeleton loading animation (five `Skeleton` rows from `@antdv/shadcn-ui` rendered under `v-if="loading"`, the last one `w-4/5`, `:123-129`; a button toggles `loading`, which is not antd's `:loading` + `active` pair of attributes), and the row animation card.

::: danger

The demo page is wrong about its third card The third card's alert reads "添加/删除行时会有平滑的过渡动画效果" — "rows animate smoothly when added or removed" (`views/components/table/animation/index.vue:145`), yet this card **has no add or delete row control**, and `BasicTable.vue` contains no `TransitionGroup` or row transition style either (0 hits when grepping the whole table-ui directory) — the behaviour this line of text advertises does not exist in the current implementation. To see animation, go to the first two cards: the loading state and the skeleton.
:::
