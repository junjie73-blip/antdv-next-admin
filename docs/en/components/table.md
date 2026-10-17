# Table

`BasicTable` wraps antdv-next's `a-table` into a config-driven component with an imperative instance: data source, pagination, columns, search form and row selection all come in as props, and the page gets a method bag back through `@register`. It exists to kill the boilerplate every admin list page repeats — loading state, pagination parameter assembly, response unwrapping, column visibility caching, selection bookkeeping.

Source: `apps/web/src/components/business/Table/` (`BasicTable.vue` / `useTable.ts` / `types.ts` / `hooks/`); the public surface is listed in `Table/index.ts`.

## useTable: registration and instance

```ts
// apps/web/src/components/business/Table/useTable.ts:24-39
export function useTable(
  props?: Partial<BasicTableProps>,
): [(instance: TableActionType) => void, Ref<null | TableActionType>];
```

The second element is a **`Ref<TableActionType | null>`**, not a method bag: call instance methods as `xxxRef.value?.reload()`. The `methods.reload()` snippet in the header comment of `useTable.ts` is stale — copying it yields a runtime `undefined`.

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

When `register` receives the instance it immediately merges the props passed to `useTable(props)` (`useTable.ts:31-36` → `setProps` at `BasicTable.vue:433-435`). The table's `setProps` **genuinely works**: it writes into an internal `propsRef`, unlike `Object.assign(props, …)` — see the contrast in [Modal and drawer](/en/components/modal-drawer).

## Frequently used BasicTableProps

Declared at `Table/types.ts:437-706`; defaults live in the `withDefaults` call at `BasicTable.vue:45` (`rowKey: 'id'`, `showIndexColumn: false`, `immediate: true`, `canResize: false`, `showHeader: true`).

| Prop | Type | Notes |
| --- | --- | --- |
| `api` | `ApiFn` | request function; paginated responses are unwrapped by the table |
| `dataSource` | `Recordable[]` | local data, mutually exclusive with `api` |
| `columns` | `BasicColumn[]` | column config |
| `pagination` | `AntPaginationProps \| boolean` | `false` disables pagination |
| `fetchSetting` | `{ pageField, sizeField, listField, totalField }` | defaults `pageNum / pageSize / list / total` (`hooks/useDataSource.ts:18-21`) |
| `useSearchForm` / `formConfig` | `boolean` / `Partial<FormProps>` | built-in search area, see [Form](/en/components/form) |
| `rowSelection` | `boolean \| TableRowSelection` | an object means checkboxes; `type: 'radio'` for single select |
| `actionColumn` | `ActionColumnProps` | action column; `actions(record)` returns `ActionItem[]` |
| `dragSort` / `dragSortConfig` | `boolean` / object | see drag sorting below |
| `scroll` | `{ x, y, scrollToFirstRowOnChange }` | horizontal / vertical scrolling |
| `immediate` | `boolean` | fetch on mount, default `true` |
| `beforeFetch` / `afterFetch` | `(p) => false \| p` / `(d) => d[]` | intercept request params, post-process rows |

**Response unwrapping**: whatever `api` resolves to is probed in the order `listField → items → data → records → the raw value`, and only `Array.isArray` candidates are accepted (`useDataSource.ts:40-56`). That is why the demo's `paginationMockApi` can return `{ items, total }` with no `listField` override. `total` is resolved through its own fallback chain.

## Columns (BasicColumn)

`Table/types.ts:101-238`. The fields you actually reach for:

| Field | Notes |
| --- | --- |
| `key` / `dataIndex` | id used by slots and sorting / value path, `dataIndex` accepts `string[]` |
| `title` | `string \| VNode \| (options) => VNode` |
| `width` / `minWidth` / `align` / `headerAlign` / `fixed` | layout |
| `ellipsis` | `boolean \| { showTitle? }` |
| `sorter` | `boolean` (server-side, read it in `onChange`) / comparator / `{ compare, multiple }` |
| `filters` / `onFilter` / `filterMode` / `filteredValue` | filtering; provide `onFilter` for local filtering |
| `format` | `(text, record, index) => string \| VNode`, plain text formatting |
| `customRender` | takes precedence over `format` |
| `edit` / `editRow` / `editComponent` / `editComponentProps` / `editValueMap` | editable cells |
| `ifShow` / `defaultHidden` / `auth` | visibility and per-column permission |
| `resizable` | drag to resize the column |

Editable cells use **the table's own `ComponentType` union** (`types.ts:81-98`, which includes `ApiSelect` / `ApiTreeSelect` / `ApiCascader` / `ApiRadioGroup`). Those `Api*` components are not registered in the form's `componentMap`, and the form's `Select` is not in this list — do not cross the two unions.

Slots (`BasicTable.vue` template): `#toolbar` (703), `#actionHeader` (756), `#indexHeader` (763), `#header-{key}` (770), `#action` (782), `#index` (792), `#cell-{key}` (806-813), `#cell-{dataIndex}` (816-826), bare `#{dataIndex}` (829-833), `#expandedRowRender` (853), `#summary` (875), `#empty` (882). Events: `change`, `row-click`, `row-db-click`, `header-edit`, `cell-save`, `cell-cancel`, `cell-change`, `register` (`BasicTable.vue:60-95`).

Instance methods (`TableActionType`, `types.ts:711-841`): `setProps`, `reload`, `redoHeight`, `setLoading`, `get/setColumns`, `updateColumn`, `getVisibleColumns`, `getCacheColumns`, `expandAll`/`collapseAll`/`expandRows`/`collapseRows`, `scrollTo`, `selectRows`, `getSelectRows`, `getSelectRowKeys`, `clearSelectedRowKeys`, `deleteSelectRowByKey`, `getPaginationRef`, `setPagination`, `setShowPagination`, `getShowPagination`, `getDataSource`, `setTableData`, `insertTableDataRecord`, `updateTableDataRecord`, `deleteTableDataRecord`, `findTableDataRecord`, plus the search-form forwarders `getFormValues`/`setFormValues`/`resetForm`/`submitForm`/`validateForm`/`updateFormSchema`/`appendFormSchema`/`removeFormSchema`/`getForm`.

## Drag sorting (dragSort)

Wired into `BasicTable` only recently: after mount the component binds Sortable to its own `<tbody>`, the reorder mutates the internal data source, and the page only writes the new order back into its own state inside `onDragEnd`.

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

Binding logic at `BasicTable.vue:228-273`: every option is passed as a **getter**, so swapping the `dragSortConfig` object does not require rebuilding Sortable; `watch(() => props.dragSort)` calls `destroySortable()` then `syncDragSort()` (which queries `.ant-table-tbody` after `nextTick`), and `onDragEnd` additionally runs `dataSource.setTableData(newData)`.

::: warning Two limits worth knowing

1. **With client-side pagination only the current page is reordered.** When `pagination` is on and the data is a local `dataSource`, row indices only cover the visible page — for "the order I drag out is the order of the whole set", set `pagination: false` or use server-side pagination (this is the literal comment at `types.ts:617-624`).
2. The `ant-table-measure-row` index offset **is already fixed**: `hooks/useDragSort.ts:46-54` measures, per event, how many rows precede the first `<tr>` carrying `data-row-key`, then maps indices through `dataIndex(i) = i - leadingOffset()`. antd injects that measure row under sticky headers / horizontal scroll, so indexing the data source with the raw `oldIndex` would shift every row. :::

## TreeTable

The two-pane tree-plus-table page: `apps/web/src/components/business/TreeTable/`. In `TreeTableProps` (`TreeTable/types.ts`) only `treeData` and `tableColumns` are required; the rest default at `TreeTable.vue:16-31` (`treeTitle: '目录'` → "Catalog", `treeWidth: 260`, `treeMinWidth: 200`, `treeMaxWidth: 480`, `tableTitle: '列表'` → "List", `tableRowKey: 'id'`, `tablePageSize: 10`, `showSearch: true`, `treeDefaultExpandAll: true`, `treeEmptyText`/`tableEmptyText: '暂无数据'` → "No data"). The right pane is a `BasicTable`; `tableApi` receives `{ treeKey, page, pageSize }` and must resolve `{ list, total }`. The only emitted event is `treeSelect(key, node)`.

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

The divider between panes is draggable — `treeMinWidth` / `treeMaxWidth` are its clamps. The tree's search box filters by title and auto-expands the matching path.

## Live examples

- **`#/components/table/crud`** — two cards: "增删改查（useCRUD）" and "这个示例省掉了什么". The first hands create / edit / delete / batch delete entirely to `useCRUD` (`views/components/table/crud/index.vue:205-237`); there is no hand-written `isEditing` flag and no branching `handleSave` left in the page. The table enables the search form (`:use-search-form="true"`), checkbox `row-selection`, three slots (`#cell-status`, `#cell-priority`, `#cell-progress`) that render tags and a progress bar, and `row-key="id"`. Its data source is the mock `demo/task` endpoint family, so a row you create survives a refresh. Button-level permissions are observable here: the action column is declared through `ActionItem.auth` (`:281-305`) and delete uses `popConfirm`; logging in as `custom`, which lacks `demo:task:remove`, makes both the row delete and the batch delete entry disappear. The second card only explains the division of labour — `useTable` owns the data source and pagination, `useModal`/`useForm` own the container and form instance, and `useCRUD` merely moves the fixed "validate → persist → close → refresh" sequence elsewhere. Details in [Composables](/en/guide/in-depth/composables).
- **`#/components/table/basic`** — five cards. Basic Table shows `sorter: true` column sorting, department `filters` + `onFilter`, row selection, the `#cell-status`/`#cell-salary` slots, Refresh via `setLoading`, Bulk Action via `getSelectRows`. Pagination uses `api` with `pagination: { pageSize: 3, showSizeChanger: true }` against a mock that resolves `{ items, total }`. Expandable / Tree Data relies on `defaultExpandAllRows`. The last card shows the empty and loading states. Note this page's card titles, buttons and `showTotal` text are in English, unlike the rest of the gallery.
- **`#/components/table/drag-sort`** — four cards: whole-row dragging (`dragSort: true` plus `rowClassName: cn('cursor-move')`), handle dragging (`handle: '.drag-handle'`, a `#cell-dragHandle` slot rendering ⠿), restricted rows (`disabled` in both boolean and function form, `canDrop` blocking rows marked `locked`, with the config bound in the template as a `computed`), and Save order. The Save order button **issues no request**: the comment at `views/components/table/drag-sort/index.vue:181-186` states that `src/api` has no reusable order-saving endpoint, so `handleSaveOrder()` merely records the current order in a local ref. The success toast says exactly "已保存 N 条顺序（本地模拟，未调用后端接口）" — "saved the order of N rows (local simulation, no backend call)". Reloading restores the initial order.
- **`#/components/table/tree-table`** — a single card, "组织架构 - 员工管理" (Organization / Employee list). Clicking a department node calls `tableApi`; the demo's `fetchTableData` slices `mockEmployees[treeKey]` behind a 300 ms `setTimeout` to fake latency (`views/components/table/tree-table/index.vue:223-…`). Nothing leaves the browser.
- **`#/components/table/animation`** — three cards: a basic table plus "刷新数据" (Refresh data), which sets loading and clears it after 2000 ms; a skeleton card, where a button toggles `loading` around `a-skeleton :loading="loading" active` wrapping static content; and a "行动画效果" (Row animation) card.

::: danger The demo contradicts itself The third card's alert reads "添加/删除行时会有平滑的过渡动画效果" — "rows animate smoothly when added or removed" (`views/components/table/animation/index.vue:138`), yet the card **has no add or delete control**, and `BasicTable.vue` contains no `TransitionGroup` or row transition style at all. The behaviour the text advertises does not exist in the current implementation; the loading and skeleton cards are the ones that actually show animation. :::
