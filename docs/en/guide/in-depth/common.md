# Reusable components

In one sentence: **app-level composite components live in `apps/web/src/components/business/`, library-agnostic primitives in `@antdv/icons` and `@antdv/ui-kit/*`, generic hooks in `@antdv/composables`; the `Basic*` family is driven by one `[register, methods]` convention.**

## The three layers

| Layer | Where | What lives there |
| --- | --- | --- |
| App business components | `apps/web/src/components/business/` | `BasicTable`/`TableAction`, `BasicForm`, `BasicModal`, `BasicDrawer`, `TreeTable`, `Description`, `CountTo`, `MarkdownEditor`, `ImportExport`, `TenantSelect`, `MicroAppContainer` |
| Library-agnostic primitives | `packages/icons` (`@antdv/icons`) + `packages/ui-kit/*` | `IconifyIcon`, `IconPicker`, `SvgIcon` in `@antdv/icons`; `Loading` + `v-loading` in `@antdv/loading-ui`; `Scrollbar` in `@antdv/scrollbar-ui`; `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui` one package each. None of these depends on antdv-next, and none relies on auto-import — the host must import them explicitly |
| Generic composables | `packages/composables` (`@antdv/composables`) | The root barrel only exports the light ones: `useCache` / `useChunkUpload` / `useFileReader` / `usePrint` / `useRouteLoading` / `useWatermark`; `echarts` / `sse` / `websocket` must be imported from subpaths so that `import { usePrint }` does not pay for a chart library |
| App-level hooks | `apps/web/src/composables/` | `useCRUD`, `usePermission`, `http` (the request layer's exit) |

## The register-props pattern

Every `Basic*` + `use*` pair works the same way: the hook produces a `register` callback, the component emits its instance methods into it, and the hook's command methods forward to that instance.

```vue
<script setup lang="ts">
import { BasicTable, useTable } from '~/components/business/Table';

const [register, tableRef] = useTable({ api: fetchUsers, useSearchForm: true });
</script>

<template>
  <BasicTable @register="register" />
</template>
```

::: warning The second return value is not uniform — do not code from vben muscle memory

| Hook | Returns | Usage |
| --- | --- | --- |
| `useTable(props?)` | `[register, Ref<null | TableActionType>]` | The second value is an **instance ref**: `tableRef.value?.reload()`, null-check it |
| `useForm(props?)` | `[register, FormActionType]` | The second value is a **methods object**: `methods.setFieldsValue(values)` |
| `useModal()` / `useDrawer()` | `[register, methods]` | Internally `waitForInstance()`: up to 10 retries of (nextTick + 50ms), then throws instead of failing silently |
| ::: |

Initial props passed to the hook are merged via `instance.setProps(props)` at register time, so `useTable({ api })` and a template `:api` binding are two entrances to the same thing — the hook version lands first.

## useForm's pending-values mechanism

Every list page does `formMethods.setFieldsValue(record)` before `openModal()`. But `BasicModal` defaults to `destroyOnHidden: true`: before mount (and after the previous close) the stored form reference is a corpse, so values were written into it and the edit dialog never repopulated. `useForm` detects `isMounted() === false`, parks the values in `pendingValues` (successive calls merge, later fields win), and replays them when a live instance registers; `resetFields` clears the parked values too. This behavior is a bug fix — do not regress it back to "manual nextTick after openModal".

## BasicTable's key options (`BasicTableProps` in `Table/types.ts`)

| Key | Purpose |
| --- | --- |
| `api` / `params` / `immediate` | data source, default params, fetch on mount |
| `columns` / `actionColumn` / `showIndexColumn` | columns, action column, index column |
| `fetchSetting` / `beforeFetch` / `afterFetch` | pagination field mapping, request hooks |
| `useSearchForm` / `formConfig` | built-in search form and its schema |
| `rowSelection` / `pagination` / `canResize` | selection, pagination, height auto-fit |
| `tableSetting: { redo, setting, fullScreen }` | toolbar at the top right |

Instance methods come from `TableActionType`: `reload` / `setProps` / `setColumns` / `expandAll` / `getSelectRows` and friends. Split columns, search schemas and row actions into `columns.ts` / `schemas.ts` / `actions.ts` as `CODE_STANDARD.md` section 8 mandates; `actions.ts` stays stateless and receives side effects through a ctx.

## useCRUD: wiring a modal CRUD together

`src/composables/useCRUD.ts` takes `formMethods` (required) plus `modalMethods` / `drawerMethods` (chosen by `containerType: 'modal' | 'drawer'`), a `tableMethods` reference (**the instance ref returned by `useTable()`**), the callbacks `onCreate / onUpdate / onDelete / onBatchDelete / onFetchDetail / onExport`, and a `messages` table; it returns `isEditing / currentRecord / loading` and `handleAdd / handleEdit / handleDelete / handleBatchDelete / handleSave`.

Confirmation has two separate rules — don't remember it as "all built-in confirms are off": **a single delete confirms nothing** (the action item's `popConfirm` owns it, which is what avoids a double prompt), while **batch delete includes exactly one `Modal.confirm`** (toolbar buttons have no popconfirm host, and the count in the message is appended by the composable). Full sequences and edge cases live in [Composables](/en/guide/in-depth/composables); the working sample is `#/components/table/crud`.

## Worth mentioning

- `CountTo`: animated number, props in `CountTo/types.ts` (`startVal` / `endVal` / `duration` / `autoplay` / `decimals`).
- `MarkdownEditor`: a tiptap-based wrapper with an `ImageUploadConfig` hooking into the Minio upload settings.
- `Description`, `TreeTable`, `ImportExport`: detail panes, tree tables, import/export.
- Global registration: `@antdv/icons` ships `createIconInstaller()` (`packages/icons/src/index.ts:13-31`) and the `@antdv/loading-ui` barrel re-exports the directive under the name `vLoading` (`packages/ui-kit/loading-ui/src/index.ts:9`); the app uses no installer and imports everything explicitly so tree-shaking survives (the component resolvers were withdrawn from `internal/vite-config`, so a bare tag is never injected).

## Related pages

- Every `use*`'s signature, defaults and gotchas: [Composables](/en/guide/in-depth/composables)
- Style merging (`cn()`) and naming rules: [Conventions](/en/guide/project/protocol)
- Request layer and caching: [Server interaction and API contract](/en/guide/essentials/request)
- Loading states: [Global loading](/en/guide/in-depth/loading)
