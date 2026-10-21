# Composables

The `use*` functions in this repo live in three places, and the rule for where one belongs is **"what does it depend on"**: hooks that drive a specific `Basic*` component sit in that component's package (`packages/core/ui-kit/<layer>/src/`); app-level hooks that fire a request or navigate live in `apps/web/src/composables/`; anything that only touches the DOM, a browser API or the session store goes into `packages/core/hooks` (`@antdv/hooks`) — and so does a hook that drags in a heavy runtime (`useLocale` pulls vue-i18n), exposed there through a subpath only. Realtime traffic lives in `packages/request` (`@antdv/request`). This page follows that order, with the emphasis on **how the first two groups drive components** — the `useTable` / `useForm` / `useModal` / `useCRUD` wiring is the skeleton of every list page here, and several parts of it will bite you if you write them from memory of vue-vben-admin.

## Where things live and how you import them

| Group | Location | Import path | Typical members |
| --- | --- | --- | --- |
| Component drivers | `packages/core/ui-kit/<layer>/src/` (`useTable` in table-ui, `useForm` in form-ui, `useModal` / `useDrawer` in popup-ui) | from that package's root entry | `useTable`, `useForm`, `useModal`, `useModalInner`, `useDrawer` |
| App-level | `apps/web/src/composables/` | `~/composables` (barrel) or the file directly | `http` / `request` / `useRequest` / `requestCache` (the barrel only forwards `@antdv/request`), `useNotice`, `usePasswordPolicy` |
| App-agnostic utilities | `@antdv/hooks` | root barrel, heavy ones via subpath | `useCache`, `useChunkUpload`, `useFileReader`, `usePrint`, `useRouteLoading`, `useWatermark`, `useCRUD`, `usePermission`; `@antdv/hooks/echarts`. These hooks never fire a request or read a router instance; their UI-side dependency is the `message` / `confirm` from `@antdv/popup-ui` (a vue-sonner wrapper) used by `usePrint` and `useCRUD`. `usePermission` is the one that reads session state, and only through the `@antdv/stores` user store |

::: warning

Nothing in this repo is auto-imported `unplugin-auto-import` lists only `vue` / `@vueuse/core` / `pinia` / `vue-router` (the four entries at `internal/vite-config/src/plugins/auto-import.ts:24`) — antdv-next's functional APIs (`message`, `notification`, `Modal`, `Drawer`) are no longer in there either. **There is no `dirs` option**, so `useTable`, `http`, `usePermission` and those four all need an explicit import.

Name collisions are nastier than a missing import: `@vueuse/core` already exports `usePermission` (the browser Permissions API) and `useWebSocket`, and both are pre-registered in `apps/web/types/auto-imports.d.ts:232` and `:293`. Forget the import and nothing errors — you just get the other function's return value, and vueuse's `usePermission()` returns a single `{ permissions }` ref with no `hasPermission` method.

`echarts` is deliberately kept out of the `@antdv/hooks` root barrel: it drags in the whole chart registry, and putting it in the root entry would make `import { usePrint }` pay for parsing a chart library (`packages/core/hooks/src/index.ts`; the `exports` map is in `packages/core/hooks/package.json`, where the `"./*"` wildcard is what lets single-file modules be imported by name — `@antdv/hooks/use-print`, `@antdv/hooks/use-crud`). SSE and WebSocket do not live here; they are in `@antdv/request`. :::

Barrel coverage is worth memorising too: `apps/web/src/composables/index.ts` now does one thing — it re-exports the whole of `@antdv/request`, so old call sites keep taking `http` / `request` from `~/composables`. `useCRUD` and `usePermission` moved into `@antdv/hooks`, `useLocale` / `useLocaleSync` come from `@antdv/hooks/use-locale` (it is the only hook that pulls in vue-i18n, and putting it in the root barrel makes every `@antdv/hooks` consumer pay for that runtime), while `useNotice` / `usePasswordPolicy` must still be imported by file path:

```ts
import { http } from '~/composables';
import { useCRUD, usePermission } from '@antdv/hooks';
import { useLocaleSync } from '@antdv/hooks/use-locale';
```

`useThemeTransition` used to be in that list; it now lives in the composition layer: `import { useThemeTransition } from '@antdv/layouts/hooks/use-theme-transition'` (`packages/layouts/src/hooks/use-theme-transition.ts`), and the only consumer left in the repository is the header widget.

## 1. The register pattern that drives components

Every `Basic*` component works the same way: the hook produces a `register` callback, the component hands back its imperative method set via `@register="register"` in the template, and the hook's methods forward to that instance.

```vue
<script setup lang="ts">
import { BasicTable, useTable } from '@antdv/table-ui';

const [register, tableRef] = useTable({
  api: getUserList,
  useSearchForm: true,
});
</script>

<template>
  <BasicTable @register="register" />
</template>
```

::: danger The second return value is not consistent

| Hook | Source | Returns | How you call it |
| --- | --- | --- | --- |
| `useTable(props?)` | `packages/core/ui-kit/table-ui/src/useTable.ts:20-37` | `[register, Ref<null \| TableActionType>]` | it's an **instance ref**: `tableRef.value?.reload()` |
| `useForm(props?)` | `packages/core/ui-kit/form-ui/src/use-antdv-form.ts:13-157` | `[register, FormActionType]` | a **method object**: `formMethods.setFieldsValue(v)` |
| `useModal()` | `packages/core/ui-kit/popup-ui/src/modal/useModal.ts:13-58` | `[register, ModalMethods]` | method object, waits for the instance internally |
| `useModalInner(cb?)` | `modal/useModalInner.ts:21-73` | `[register, ModalInnerMethods]` | used **inside the modal component** |
| `useDrawer()` | `packages/core/ui-kit/popup-ui/src/drawer/useDrawer.ts:10-57` | `[register, DrawerMethods]` | same shape as `useModal` |

The header comment in `useTable.ts` already shows `tableRef.value?.reload()` (`:18`) — follow it. Also note that `drawer/index.ts:15` exports `useDrawerInner` as a plain **alias** of `useDrawer` (`export { useDrawer as useDrawerInner }`, with the reason in the comment at `:14`); it has none of `useModalInner`'s "receive payload via callback" semantics. Only Modal has a data channel. :::

What happens when the instance isn't there yet also differs per hook, and that decides whether you need a null check:

| Hook | Before an instance registers |
| --- | --- |
| `useTable` | ref stays `null`, `tableRef.value?.reload()` silently does nothing (guard or optional chaining at every call site) |
| `useModal` / `useDrawer` | `waitForInstance()` retries up to 10 times × (`nextTick` + 50 ms), then **throws** `[useModal] Modal instance not found…` (`useModal.ts:26-39`, `useDrawer.ts:26-38`) |
| `useForm` | everything except `setFieldsValue` / `resetFields` is a **silent no-op** (`use-antdv-form.ts:43-45` returns `{}` when there is no instance) — no retry, no throw |

### useTable: initial props merge at register time

```ts
// packages/core/ui-kit/table-ui/src/useTable.ts:27-34
function register(instance: TableActionType) {
  tableRef.value = instance;
  if (props) {
    instance.setProps(props);
  }
}
```

So `useTable({ api })` and `:api="api"` in the template are two entry points to the same thing; the one passed to `useTable` runs **first**. The full props contract, the response-unwrapping sniff order (`listField → items → data → records → bare array`) and the `fetchSetting` defaults `pageNum / pageSize / list / total` are covered in [Table](/en/components/table) and won't be duplicated here. What matters is that the instance methods are declared as `TableActionType` (`packages/core/ui-kit/table-ui/src/types.ts:776`): `reload` / `setProps` / `getSelectRows` / `clearSelectedRowKeys` / `setTableData` / `expandAll` and friends, plus the set forwarded to the built-in search form (`getFormValues`, `updateFormSchema`, …).

### useForm: `pendingValues` is why edit modals can prefill

Every list page in this app follows the "fill first, then open" order:

```ts
formMethods.setFieldsValue(record); // the modal is not open yet
modalMethods.openModal();
```

`BasicModal` defaults to `destroyOnHidden: true` — while the modal is closed the form component isn't in the tree at all, and closing it destroys the form again. `formRef` still holds the **object reference from the previous register**, because unmounting doesn't null it out, so the values are written into a corpse. Symptom: "click edit, the modal is empty; save, and you've blanked the record".

`useForm`'s fix (`packages/core/ui-kit/form-ui/src/use-antdv-form.ts:23, 26-30, 32-41, 53-64, 66-73`): when `isMounted() === false`, stash the values in `pendingValues`; repeated calls **merge** rather than replace (later fields win), and `register` replays them onto the live instance. An explicit `resetFields()` also clears the stash, otherwise the next mount gets overwritten by stale data. Do **not** regress this into "call `openModal` then manually `await nextTick()` before filling" — that depends on the modal's mount timing and is fragile.

### useModal / useModalInner: one outside, one inside

```ts
// parent page: command the modal
const [modalRegister, modalMethods] = useModal();
modalMethods.openModal(true, { id: row.id, isEdit: true }); // payload goes to the inner hook

// inside the modal component: receive payload, control itself
const [register, { closeModal, setModalProps, changeOkLoading }] =
  useModalInner((data) => {
    isEdit.value = data.isEdit;
  });
```

`useModalInner` implements this by **wrapping** `instance.openModal` at register time: `dataRef` is written and the callback fires only when `data !== undefined` (`modal/useModalInner.ts:38-52`). So `openModal(true)` — or `openModal(true, undefined)` — does **not** trigger the callback. If your inner state depends on the payload, always pass an object.

::: warning

Lifecycle hooks must be registered during setup The `onUnmounted` in `useModal` / `useDrawer` / `useModalInner` sits at the top level of the hook body, and the comments explain why (`useDrawer.ts:12-23` is the most detailed): `register` is the callback of the child's `emit('register', instance)`. At that moment Vue's `currentInstance` points at the child — or has already been cleared — so calling `onUnmounted` inside the callback only warns, attaches to nothing, and the modal instance stays in the reference forever. Same rule for your own hooks: never hide a lifecycle call inside a callback. :::

## 2. useCRUD: modal + form + table in one declaration

`useCRUD<RecordType, FormValues>(options)` (`packages/core/hooks/src/use-crud.ts:134`) doesn't know anything about your API. It orchestrates the three instances above and owns the fixed sequence **validate → persist → close → reload**, leaving the page to declare only "how to create, update, delete" and "what the messages say".

```ts
// apps/web/src/views/components/table/crud/index.vue:212-248 (abridged)
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();
const [tableRegister, tableRef] = useTable();

const {
  isEditing,
  handleAdd,
  handleBatchDelete,
  handleDelete,
  handleEdit,
  handleSave,
  loading: submitting,
} = useCRUD<TaskRecord, TaskFormValues>({
  containerType: 'modal',
  modalMethods,
  formMethods,
  tableMethods: tableRef, // ⭐ the Ref from useTable, not a method object
  idKey: 'id',
  onCreate: (values) => addTask(values),
  onUpdate: (id, values) => updateTask(Number(id), values),
  onDelete: (record) => deleteTask(record.id),
  onFetchDetail: (id) => getTaskDetail(Number(id)),
  getEmptyValues: () => ({
    priority: 'middle',
    progress: 0,
    status: 'pending',
  }),
  messages: {
    batchDeleteConfirm: '确定删除选中的任务吗？',
    createSuccess: '任务已创建',
    deleteSuccess: '任务已删除',
    updateSuccess: '任务已更新',
  },
});
```

### options (`use-crud.ts:36-95`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `containerType` | `'drawer' \| 'modal'` | `'modal'` | picks which container method set to use |
| `modalMethods` | `Pick<ModalMethods, 'closeModal' \| 'openModal'>` | — | pass when `containerType: 'modal'` |
| `drawerMethods` | `Pick<DrawerMethods, 'closeDrawer' \| 'openDrawer'>` | — | pass when `'drawer'` |
| `formMethods` | `Pick<FormActionType, 'clearValidate' \| 'resetFields' \| 'setFieldsValue' \| 'validate'>` | **required** | the method object from `useForm()` |
| `tableMethods` | `{ value: null \| TableActionType }` | — | the instance ref from `useTable()`; without it nothing reloads and batch delete can't auto-collect selected rows |
| `idKey` | `string` | `'id'` | primary key for edit/delete |
| `onCreate` / `onUpdate` / `onDelete` / `onBatchDelete` | see source | — | missing ones report "未配置创建/更新/删除 API"; with no `onBatchDelete` it falls back to `Promise.all(onDelete)` |
| `onFetchDetail` | `(id: string) => Promise<RecordType>` | — | fetch full record before editing; on failure it only `console.warn`s and keeps the row data |
| `getFormValues` / `getEmptyValues` | `(record) => Values` / `() => Values` | use the record / `{}` | prefill and blank-form defaults |
| `beforeCreate` / `beforeUpdate` / `beforeDelete` | `(...) => boolean \| Promise<boolean>` | — | returning `false` aborts; in batch mode `beforeDelete` runs **per record** and any `false` stops the whole batch |
| `onSaved` / `onDeleted` | callbacks | — | `onSaved(isEdit, values)` |
| `messages` | `CRUDMessages` | `use-crud.ts:97-108` | twelve keys, a pair each for success/failure/confirm |
| `onExport` / `onImport` | `(params?) => …` / `(file: File) => …` | — | calling `handleExport` / `handleImport` without them only shows "未配置…功能" |

Return value: refs `isEditing`, `currentRecord`, `loading`, plus `handleAdd` / `handleEdit` / `handleDelete` / `handleBatchDelete` / `handleSave` / `handleExport` / `handleImport` / `reset` (`use-crud.ts:376-392`).

### The fixed sequences and the boundaries you must know

| Action | What actually runs (source lines) |
| --- | --- |
| `handleAdd(initialValues?)` | `beforeCreate` → `isEditing = false` → open container → in `nextTick`: `resetFields()` then `setFieldsValue({ ...empty, ...initialValues })` (`:159-170`) |
| `handleEdit(record)` | `beforeUpdate` → open container → `resetFields` → `nextTick` → `onFetchDetail(record[idKey])` (falls back to the row) → `setFieldsValue(getFormValues?.(detail) ?? detail)` (`:173-201`) |
| `handleSave()` | `validate()` → **strip fields whose value is `''`** → `onUpdate(currentRecord[idKey], values)` when editing, else `onCreate(values)` → success message → close → `onSaved` → `tableMethods.value?.reload()` (`:275-304`) |
| `handleDelete(record)` | `beforeDelete` → `onDelete(record)` → success message → `onDeleted` → reload; **no confirmation dialog** (`:204-220`) |
| `handleBatchDelete(records?)` | defaults to `tableMethods.value.getSelectRows()` → empty selection warns "请先选择要删除的数据" → `beforeDelete` per record → `Modal.confirm`, whose `onOk` runs `onBatchDelete` or `Promise.all(onDelete)` → reload (`:223-272`) |

::: warning

Validation failure vs API failure `handleSave` puts `validate()` and the submit in the same `try`: a rejected validation goes through `message.error`, but the modal **stays open**, `loading` returns to `false`, and the user can fix the field and retry. API 4xx/5xx behave the same way. That's intentional — don't wrap `handleSave` in your own `try/catch` and toast twice. :::

::: warning

handleSave drops empty-string fields Keys whose value is `''` are deleted before submit (`:279-283`). The semantics are "not filled in = don't send this field", which stops optional text inputs from blanking stored values; the flip side is that **you cannot clear a field by leaving it empty** — send `null`, or use an endpoint that explicitly supports clearing. :::

::: danger

One confirmation per delete — and neither is hand-rolled in the page

- **Single delete**: `handleDelete` shows no dialog. Confirmation is described by the row action's `ActionItem.popConfirm` (next section), which is the `CODE_STANDARD.md` rule.
- **Batch delete**: `handleBatchDelete` **includes** one `Modal.confirm` (fixed title 「批量删除」; the `content` is `messages.batchDeleteConfirm` with `（N 条）` appended by the composable). Toolbar buttons have no popconfirm host, so this single confirmation is required — do **not** add another layer in the page.

The confirm dialog's `onOk` is async and non-blocking, so its rejection never reaches the outer `try`; the failure toast therefore lives inside `onOk` (`:239-271` documents exactly this). Also note `loading` only resets in `onOk`'s `finally`: while the dialog is open it stays `true`, intentionally — nothing has been decided yet. :::

::: warning

Selected-row state is not useCRUD's job `useCRUD` reloads the table after a delete but never clears `rowSelection`. The deleted rows are gone from the table while the checkboxes remain, so you get "批量删除（3 条）" that deletes one. Clean up yourself:

```ts
function clearSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelectedRowKeys?.();
}
```

And pass a **snapshot** to `handleBatchDelete` (`[...selectedRows.value]`), not a live array — the confirm dialog is non-blocking, so cancelling or completing the delete would leave the array out of sync with the table (example page: `crud/index.vue:342`). :::

::: danger

The API helpers already unwrapped the envelope `get/post/put/del` in `~/api/request.ts` are `http.Get<R<T>(… ).then(res => res.data)` internally (`api/request.ts:20-56`), i.e. **they resolve to the payload itself**. So `onCreate: (values) => addTask(values)` passes the function straight through — don't add another `.then(res => res.data)`. Unwrapping twice yields `undefined`, whose symptom is "save succeeded but the new row isn't in the table / the edit modal prefills empty". :::

The behaviour is pinned by unit tests: `packages/core/hooks/__tests__/use-crud.test.ts` (23 cases, minimal stubs for the three components that record **call order**, so requirements like "resetFields before setFieldsValue" are actually asserted — getting it wrong shows up as the modal flashing the previous record). Run that file before and after touching `useCRUD`.

## 3. Permissions: usePermission and button-level access

`packages/core/hooks/src/use-permission.ts:68`, reading `permissions` / `roles` off `useUserStore()`:

```ts
const {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isAdmin,
  checkPermission,
} = usePermission({ strict: true }); // strict defaults to true
```

| Method | Semantics |
| --- | --- |
| `hasPermission(code)` / `hasRole(role)` | literal membership, one item |
| `hasAnyPermission(list)` / `hasAllPermissions(list)` | `some` / `every` |
| `hasAnyRole(list)` / `hasAllRoles(list)` | same, on roles |
| `isAdmin()` | role contains `super` or `admin` (`PermissionRole` enum at `packages/core/hooks/src/use-permission.ts:27-32`) |
| `checkPermission(perms, { mode })` / `checkRole(roles, { mode })` | `mode: 'any'` → any, otherwise all |
| `permissions` / `roles` | `readonly(computed)`, renderable directly |

Three decision rules, all in `use-permission.ts:75-100`:

1. **Signed out ⇒ everything is false**: every method runs `checkAuth()` first, before looking at the permission table.
2. **`'*'` is the wildcard sentinel**: if it appears in the user's list, everything passes (the mock `admin` account is literally `permissions: ['*']`, so superusers need no enumeration).
3. **Empty table defers to `strict`**: `strict: true` (default) fails, `strict: false` succeeds — the loose version is a local fallback only, never a production "permissive mode".

The component-side consumer is the table, but the component does **not** import `usePermission` itself: `TableAction.vue:93-97` goes through `tableRuntime.checkAuth` / `checkAnyAuth`, and `apps/web/src/plugins/table-runtime.ts:16-22` wires `usePermission()` in via `configureTable()` (`:13-14` reads it lazily, because permissions are backfilled after login), so pages don't wrap buttons in `v-if`.

```ts
// apps/web/src/views/components/table/crud/index.vue:313-340 (abridged)
const actions = (record: Recordable): ActionItem[] => [
  {
    label: '编辑',
    icon: 'ant-design:edit-outlined',
    auth: 'demo:task:edit',
    onClick: () => handleEdit(row),
  },
  {
    label: '删除',
    icon: 'ant-design:delete-outlined',
    danger: true,
    auth: 'demo:task:remove',
    popConfirm: {
      title: '确定删除这个任务吗？',
      content: `「${row.title}」删除后不可恢复`,
      confirm: () => {
        handleDelete(row);
        clearSelection();
      },
    },
  },
];
```

`ActionItem.popConfirm` renders as a `Popconfirm` (title + description); `confirm`/`cancel` receive the record and the event. Toolbar buttons have no `auth` host, so compute the flag from `hasPermission` (the example's `canAdd` / `canBatchDelete`).

For template-level declarations use `v-permission`; its arg/modifier grammar and how it's decoupled from the store are in [Access, directives and cursors](/en/guide/in-depth/access). Both channels share **the same decision function** — the directive's `checkers` is `() => usePermission()` (`apps/web/src/directives/index.ts:21-33`).

## 4. The request layer: `http`, `useRequest`, `requestCache`

The public exit is `@antdv/request` (`packages/request/src/index.ts`); `~/composables` still re-exports the whole package (`composables/index.ts:6`), so existing call sites are unchanged. Four layers underneath: `fetcher` (@vueuse `createFetch` + interceptors) → `executor` (cache / dedupe / retry / 401 replay) → `http` (five verbs) → `useRequest` (reactive wrapper).

### http: imperative verbs

```ts
import { http } from '~/composables';

const list = await http.Get<R<TaskRecord[]>>('/demo/task/list', { pageNum: 1 });
await http.Post('/demo/task', values);
await http.Delete('/demo/task/1', undefined, { body: { force: true } }); // DELETE may carry a body
```

`http` exposes both capitalized (`Get`/`Post`/…) and lowercase aliases pointing at the same functions (`http.ts:29-40`); `request` is the un-capitalized original object (used by `ImportExport.vue`, `markdown-editor/utils.ts`, `Upload/api.ts`). What resolves is the **full response body** — the `{ code, data, message }` envelope. Take `.data` yourself, or use `get/post/put/del` from `~/api/request.ts`.

`ExecuteOptions` (`executor.ts:12-37`):

| Field | Default | Notes |
| --- | --- | --- |
| `cache` | `false` | **GET only** (`canCache = enableCache && method === 'GET'`, `:307`) |
| `cacheTime` | `5 * 60 * 1000` | milliseconds |
| `cacheKey` | generated | shape `METHOD:url:JSON(body)`; streaming bodies use a `[stream]` placeholder **and disable dedupe** (`:302-308`) |
| `forceRefresh` | `false` | skip the cache read |
| `cacheOnly` | `false` | miss throws `RequestError('缓存未命中')` |
| `staleWhileRevalidate` | `false` | return the stale value immediately, refresh silently in the background (background failures swallowed) |
| `dedupe` | `true` | concurrent requests with the same key share one Promise |
| `retries` / `retryDelay` | `3` / `300` | exponential backoff + jitter, capped at 10 s (`:225-246`) |
| `timeout` | `30_000` | timeout throws with `status`/`code` `408` |
| `responseType` | `'json'` | `blob` / `arrayBuffer` / `text` **skip the envelope check** and pass straight through |
| `signal` | — | merged with the timeout signal (`timeout.ts`) |
| `params` / `body` | — | POST/PUT can carry a query too; when both are given the **positional argument wins over `opts.params`** |

::: warning

Retries apply to every verb by default The `retries` wrapper sits around `runRequest` and doesn't look at the method (`:363-389`). `isRetryable` only exempts `400_001 / 401_001 / 403_001 / 404_001`; `status === 0` (network down) and any 5xx are retried (`:137-144`). In other words **a 500 on a POST is hammered three times** — non-idempotent create endpoints need an idempotency key on the server, or `retries: 0` on the call site. :::

### What the interceptors do (four things you need when debugging)

`fetcher.ts:160-326`:

- **The store is the only credential source.** `beforeFetch` reads `useUserStore().token` and never falls back to the cache — the cached value is JWE ciphertext and sending it as a credential always 401s (`:188-228`). No access token but a refresh token → refresh first, refresh failure → `forceLogout()`; `isTokenExpired(token, 60)` renews 60 s early.
- **CSRF only on writes**: `POST/PUT/PATCH/DELETE` attach `X-CSRF-Token` (`:231-243`), along with a batch of security headers (`nosniff`, `X-Frame-Options: DENY`, …).
- **The `AUTH_ENDPOINTS` allow-list** (`:18-27`): login/logout/refresh/tenant options get no token injection and are excluded from 401 replay, which is what prevents the loop.
- **A non-200 business code throws `RequestError`**: `afterFetch` throws when `payload.code !== 200` and marks `handled = true` (`:264-301`), so `onFetchError` won't toast again. 5xx maps to "服务器繁忙，请稍后重试", everything else prefers `message` then `msg` (`resolveErrorMessage`, `:329-347`); `401` is in `SILENT_CODES` — **no notification**, the redirect to login is the signal.

401 replay lives in `executor.ts:248-275`: on 401 call `refreshAccessToken()` and replay once; refresh failure → `forceLogout()`; auth endpoints, an in-flight logout, or an already-replayed request throw directly. `forceLogout` goes through the single exit `useUserStore().logout()` and returns to login **by rewriting the hash** (this app uses `createWebHashHistory`; assigning `location.href = '/login'` triggers a full page reload and interrupts the running navigation).

`RequestError` (`error.ts:26-52`) carries `status` / `code` / `data` / `handled` / `retryCount`; `ErrorCode` uses six-digit business codes (`400_001`, `401_001`, …) and raw HTTP codes (`408`, `502`).

### useRequest: the reactive wrapper (currently no call sites)

`useRequest(url | (() => string), config)` (`packages/request/src/useRequest.ts:63-193`) adds, on top of `ExecuteOptions`: `immediate` (**default `true`**, `:68` — a GET fires as soon as setup runs), `initialData`, `debounce` / `throttle`, `updateDataOnError`, and `onSuccess` / `onError` / `onFinally`. Returns:

| Key | Notes |
| --- | --- |
| `data` / `loading` / `error` / `status` | `data` is a `shallowRef` (`:76`); `status` is `'idle' \| 'loading' \| 'success' \| 'error'` |
| `send(method?, arg?)` | `:141-145`, for GET/HEAD/DELETE the argument becomes the query, otherwise the body; `get/post/put/patch/delete` are shortcuts |
| `refresh()` | resend the last method + argument (`:152`) |
| `abort()` | cancel in-flight; `onScopeDispose(abort)` is already wired (`:155`) |
| `forceRefresh()` | rerun bypassing the cache (`:156-163`) |
| `invalidate()` | drop this URL's cache entries (`:171-173`) |
| `onSuccess` / `onError` / `onFinally` | `@vueuse` `EventHook.on`, multiple subscribers allowed |

::: warning

Two things you have to know 1) **there is no business call site anywhere in the repository** — `useRequest` is only asserted to still be in the export list by `packages/request/__tests__/structure.spec.ts:36,77`. Declarative fetching goes through `@tanstack/vue-query` (`apps/web/src/api/query.ts:1,9,33` wire the hardened fetch into `useQuery`), so don't mix the two in a new page. 2) **`data` is the whole response body, not the payload** — `afterFetch` returns the parsed `payload` unchanged and the executor hands the entire envelope up, so `useRequest().data.value` is `{ code, data, message }`. Check whether an endpoint carries an envelope before binding `:options` straight to it; every mock endpoint here does. :::

`requestCache` (`executor.ts:60-115`) exists for cache management: `clear` / `delete(key)` / `clearByUrl(url)` / `clearByPattern(re)` / `has` / `get` / `set` / `size`, backed by a module-level `Map` with LRU eviction at `MAX_CACHE_SIZE = 200`. Nothing calls it today — when you need "invalidate the list cache right after a write", `invalidate()` is cheaper than manual clearing.

## 5. UI environment: useLocale / useLocaleSync / useThemeTransition

`useLocale()` (`packages/core/hooks/src/use-locale.ts:62-84`) is the template-facing one: `{ availableLocales, locale, setLocale, t }`. **There is exactly one way to write**: `setLocale` changes the preference (`appStore.updateSetting({ locale })`, `:75`) and `useLocaleSync` expands the effect. No component should touch `i18n.global.locale` directly — two writers always drift, and the symptom is "the menu switched to English but the pagination is still Chinese" (the comment at `:30-32` records exactly that).

`useLocaleSync()` (`:41-56`) is the single exit for locale side effects; `apps/web/src/App.vue:14` calls it once at the root and it **returns nothing now**. It watches the preference and expands three things: i18n messages, `<html lang>`, and the dayjs locale (note dayjs uses lowercase short codes — `zh-cn`, not the BCP 47 value stored in preferences, `:22-25`). There used to be a fourth: an on-demand dynamic import of antd's locale object fed to `ConfigProvider :locale` — that step carried a defect where commenting it out left every built-in string in English. It went away with the antd dependency (the motive is at `:34-37`); component built-in text is now expanded by `@antdv/common-ui`'s own `ConfigProvider` from `'en-US' | 'zh-CN'` (`App.vue:41-44` computes it, `:48-51` mounts the provider). Language names are always endonyms (`localeLabels`, `:16-19`). The language-switch UI moved into the composition layer: `packages/layouts/src/widgets/language-toggle/index.vue:28` reads only the host-injected `layoutHost.locales` (the comment at `:22-27` explains the convention), and that candidate table is built from `localeLabels` in `apps/web/src/plugins/layouts-host.ts:35-38`; writing is still the single preference update. The wider contract is in [Internationalization](/en/guide/in-depth/internationalization).

`useThemeTransition()` (`packages/layouts/src/hooks/use-theme-transition.ts:37-114`) owns the circular-expanding theme switch:

| Member | Notes |
| --- | --- |
| `switchThemeWithAnimation(target, event?)` | centre = click coordinates, falling back to screen centre; if the rendered colour doesn't change it only updates the store and returns |
| `toggleThemeWithAnimation(event?)` | inverts the current **rendered** state (`isDarkNow` resolves `auto` to light/dark) |
| `isDarkNow(theme)` | exported standalone function; in `auto` mode it resolves via the system preference (a module-level `createSystemDark()` queried once) |

Three implementation constraints worth copying into any View Transition code: the `startViewTransition` callback **must mutate the DOM synchronously — no `await`** or the snapshot timing is wrong and the animation dies (`:71-75`); the store update happens after the animation finishes (`:104-105`) so reactivity can't interrupt it; browsers without `startViewTransition` just switch (`:64-68`). To dark uses `::view-transition-new(root)` expanding, to light uses `::view-transition-old(root)` contracting (`:80-99`). There is exactly one consumer left: the header widget `packages/layouts/src/widgets/color-toggle/index.vue:15` (the drawer's appearance panel mounts `<ThemeToggle>` instead of driving the animation itself).

## 6. App-level hooks that aren't wired (don't copy these yet)

Two more hooks live in `apps/web/src/composables/`. The design is sound but they are **currently disconnected** — add the API modules before using them:

| Hook | Status | Notes |
| --- | --- | --- |
| `useNotice()` (`useNotice.ts:62`, 196 lines) | no consumers, and `import … from '~/api/notice'` (`:5-10`) points at a **module that doesn't exist** — under `apps/web/src/api/` there is only `demo/menu/mock/query/request/screen/security/system` | Design: module-level singleton state (`list` / `unreadCount` / `loading` declared outside the function, `:34-38`), WS listener + unread count initialised only on the first call (`:64-68`), push de-duplication and a 20-item cap, unread count decremented when a pushed message is revoked, and optimistic `read`/`readAll` with rollback on failure (`:135-170`). Wire the notice api and it works; the header bell already moved into `packages/layouts/src/widgets/notification/` with the widget, and the push channel is host-injected from `apps/web/src/plugins/layouts-host.ts:9`. |
| `usePasswordPolicy()` (`usePasswordPolicy.ts:24`, 79 lines) | no consumers, depends on the missing `~/api/auth` (`:1,5`); the repository has **no password-policy endpoint at all** — `security.ts:6-51` is the security score / events / alerts, nothing policy-shaped | Design: a module-level `cachedPolicy` fetched once per app lifetime (`:17`, `:28-43`), `onMounted(load)` — **must be called inside a component setup**; `policyText` feeds a form `helpMessage`, `validate(value)` returns `{ ok, message }` (`:60-76`); on fetch failure it falls back to the default policy (6–64 chars, all four `require*` false) and `console.warn`s. Adopting it needs a backend first, not just an import-path change. |

On the WebSocket side the rule is: business code subscribes to the **app-level singleton** `useWebSocket()` (`apps/web/src/utils/ws.ts:340`, returning `{ notice, status, onNotice, onRevoke, onForceLogout, … }`, where each subscription function **returns an unsubscribe** (from `:360`), paired with `onUnmounted(off)`) — not the low-level `@antdv/request/websocket` implementation (`ws.ts:5` is exactly that import). `CODE_STANDARD.md` §6 still names it `useWs()`; that export no longer exists, so trust `~/utils/ws`. The singleton is the only place that instantiates the package composable and rebuilds the socket when the token changes (`:346`). With `VITE_WS_URL` unset it never really connects, but subscriptions still attach harmlessly (the comments at `:104-105` and `:312`).

## 7. `@antdv/hooks` and `@antdv/request`: the library-agnostic set

### Overview

| Export | Signature and key defaults | Used here by |
| --- | --- | --- |
| `useCache(key, options?)` | `{ defaultValue = null, expire = 0, deep = true, immediate = false }` (`use-cache.ts:45-50`), `expire` is in **seconds**, `0` = never | nothing (unit tests only) |
| `useChunkUpload(options?)` | `{ chunkSize = 5 MB, concurrent = 3, createWorker?, workerUrl? }` (`use-chunk-upload.ts:35-37`) | `views/components/upload/index.vue:435`; `packages/core/ui-kit/common-ui/src/components/chunk-upload/composables/useChunkUploader.ts:53` wraps it |
| `useFileReader()` | no options; `read(file, readAs = 'readAsDataURL')` | `packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue` |
| `usePrint(options)` | `target` **required**, `title = document.title`, `showHeader/showFooter = true`; returns `void` | `views/system/{login-log,online,user}` — three pages |
| `useRouteLoading(options?)` | `{ minDuration = 300, auto = true }` | `packages/layouts/src/basic/layout.vue:8` |
| `useWatermark(options?)` | `{ content?, enabled?, style? }`, style defaults `200×150 / rotate 330 / alpha 0.15 / 14px / #666666` | `packages/layouts/src/basic/layout.vue:9` |
| `useCRUD(options)` | see section 2 | `views/components/table/crud/index.vue:220` |
| `usePermission(options?)` | see section 3 | `directives/index.ts:13`, `plugins/table-runtime.ts:1` |
| `useEcharts(option?, options?)` (`@antdv/hooks/echarts`) | `{ autoResize = true, resizeStrategy = 'raf', resizeDelay = 100, renderer = 'canvas', applyInitial = true, debug = false }` | nothing (chart pages use `@antdv/common-ui/charts`; only `packages/core/hooks/__tests__/echarts.test.ts`) |
| `useSSE(options)` (`@antdv/request/sse`) | `url` required; `{ reconnectEnabled = true, reconnectInterval = 1000, maxReconnectAttempts = 5, reconnectDelayMultiplier = 2, maxReconnectDelay = 30000, withCredentials = false }` | nothing (unit tests only) |
| `useWebSocket(options)` (`@antdv/request/websocket`) | `url` is **`() => string \| URL`**; `autoConnect = false`; omit `heartbeat` / `reconnect` and both stay off | `utils/ws.ts:5` — the only entry point; business code must not call it directly |

`usePrint` is the only one with a required field; `useEcharts` / `useSSE` / `useWebSocket` go through a directory subpath, while the remaining single-file modules are reachable through the `"./*"` wildcard (`@antdv/hooks/use-cache` works too, but the repo convention is the root barrel).

### The ones that actually bite

- **`useCache`'s single source of truth is the `cache` singleton** (`use-cache.ts:52`) — the stacked `useStorage` layer used to keep a second invisible copy. `value.value = null` means **delete**, not "store a null" (`:108-113`); nested mutations only persist with `deep: true` (a `flush: 'sync'` deep watch guarded by `internalWrite` to avoid double writes, `:69-113`); cross-tab sync rides the `storage` event (`:131`).
- **`useChunkUpload` without a worker runs in "main-thread mode"**: chunks are only sliced and read, and `hash` stays `''` (`:69`). `uploadFile()` (`:228`) calls `cancel()` first (`:208`); **unmounting does not terminate the worker** — call `cancel()` yourself (`terminateWorker` at `:177-181`). `pause` / `resume` (`:187`, `:194`) must reuse the same Promise (`:71-74` records why — an earlier version called the scheduler again inside `resume()`, so `await uploadFile()` never resolved).
- **The three refs `useFileReader` returns are `readonly()`-wrapped** (`:52-54`), so writes from outside are no-ops; the error message is hardcoded to "文件读取失败" and the underlying `FileError` code is discarded.
- **`usePrint` prints immediately and returns `void`**; `.no-print { display: none !important }` is available inside the print document (`:102`); cleanup runs 100 ms after `afterprint` with a 1000 ms `onload` fallback, made idempotent by a `finished` flag (`:149-166`). `title` and the date go through `escapeHtml`, but the target's `innerHTML` is inserted raw — only print trusted content.
- **`useRouteLoading` requires a `vue-router` instance** (runtime `useRouter` at `use-route-loading.ts:2`); `progress` is a fake asymptote (capped at 90, `:149`), the `isSlow` threshold is hardcoded at 3000 ms (`:159-160`), and hiding waits an extra 200 ms on success / 500 ms on error. `auto: true` already installs one `beforeEach`/`afterEach` pair — **don't add `watch(() => route.path)`** (double trigger) and never call `next()` (deprecated in vue-router 5).
- **`useWatermark` only paints in `onMounted` when both `enabled` and `content` are truthy** (`:102`) — passing `content` without `enabled` yields "no watermark, no error". It depends on `onMounted`/`onUnmounted` (`:5`), so it must run in a component setup, and it needs `watermark-plus` at runtime.
- **`useEcharts` requires `setupEcharts()` first** (`echarts/setup.ts:39-70`, module-level `installed` flag so repeated calls are no-ops). The registry contains 8 charts + 10 components + `CanvasRenderer` only: **`renderer: 'svg'` will not work** unless you `echarts.use([SvgRenderer])` yourself. Zero-size containers are refused and retried (`initWithRetry`, up to 5 × 100 ms, `use-echarts.ts:201-215`); `setOption` calls before ready are queued and flushed on init, nothing is lost (`pendingOptions`, `:114,190-191,235`); all charts share one `window` resize listener coalesced through a rAF (`:70`, and `resize` is wrapped in `attempt` at `:132`); bind `containerRef` to the real DOM node.
- **`useSSE`'s `headers` option is decorative**: `EventSource` can't set request headers, and the implementation only reads `url` and `withCredentials` (`packages/request/src/sse/useSSE.ts:53-62`) — put credentials in the query string or a cookie. Two event channels: business frames arrive on `on('event:message', cb)` (`SSEEventManager` routes the `event:` prefix into a separate map) while the raw `MessageEvent` arrives on `on(SSEEventType.Message)`; heartbeat/comment frames (`data === ''`) are swallowed. `lastEventId` is appended as a query parameter for resume (`:57-58`); `onUnmounted` disconnects, so it must be used inside a component.
- **`useWebSocket` (the package one) has no lifecycle cleanup at all** — the socket, heartbeat timer and reconnect timer outlive your component; call `disconnect()` yourself. `autoDisconnect` is still in the types but `@deprecated` and a no-op (`packages/request/src/websocket/useWebSocket.ts:19-20`). Both `heartbeat` and `reconnect` are **opt-in by presence**: `enabled: !!reconnect` (`:58`), so the `DEFAULT_*` constants only fill in fields of an object you actually passed (heartbeat: 30 s ping / 5 s pong timeout / payload `{"type":"ping"}`; reconnect: 1000 ms × 2 backoff, capped at 30 s, max 5 attempts, `retries <= 0` = unlimited). Frames matching `heartbeat.pongMessage` are consumed and never reach business handlers; a heartbeat timeout closes with custom code `4000` so `onclose` takes the reconnect branch.

`useSSE`, `useEcharts` and `useCache` currently have **no business call sites** (only the unit tests under `packages/core/hooks/__tests__/` and `packages/request/__tests__/`). They are capability reserves, not working features — confirm the backend (an SSE endpoint, a chart page) can actually serve them before adopting one.

## 8. Adding a new composable

Where it goes, decided by dependencies:

| Depends on | Put it in | Also required |
| --- | --- | --- |
| An instance of some `Basic*` component | `useXxx.ts` next to that component | export `register` + types from that directory's `index.ts` (`UseXxxReturnType` lives in `types.ts`) |
| A store / requests / the router / `import.meta.env` | `apps/web/src/composables/` | add to `composables/index.ts` if pages need it, and **always** import explicitly |
| Only the DOM or browser APIs, reusable verbatim elsewhere | `packages/core/hooks/src/` (kebab-case file names) | light ones into the root barrel; heavy ones get their own subpath **and** a matching `exports` entry in `package.json` |
| Real-time / HTTP semantics | `packages/request/src/{sse,websocket}/` | pinia, the `~/` alias and `import.meta.env.` must not appear in this package (guard spec: `packages/request/__tests__/structure.spec.ts:40-52`) |

Rules to keep:

1. **Don't rely on auto-import** — there is no `dirs` config; even `@vueuse/core` helpers (`useDebounceFn`, `tryOnScopeDispose`) must be imported explicitly.
2. **Lifecycle calls at the top level of the function body**, never inside a callback (see section 1).
3. **Register cleanup when you allocate**: `onScopeDispose` / `tryOnScopeDispose` / `onUnmounted`. If you deliberately don't (as with `useWebSocket`), say so in the type comments so the caller knows they own it.
4. **Document intentional module-level state**: `useNotice`, `usePasswordPolicy` and `utils/ws` are cross-component singletons — the comment must say "shared by every call", otherwise the next person assumes each call is fresh state.
5. **Types and defaults in one place**: the options interface carries per-field types and comments, defaults live in the destructuring (every table in this page was read off that pattern).
6. **Ship a unit test**: it lives with the package — `packages/core/hooks/__tests__/<name>.test.ts`, with minimal component stubs plus a call-order array as the reference (copy `use-crud.test.ts`); run `pnpm --filter @antdv/hooks test:unit`.
7. After changing a dist-published package such as `@antdv/hooks`, rebuild it (`pnpm --filter @antdv/hooks build`) before `apps/web` can see it; `@antdv/request` is consumed from source, so saving is enough (see [Utilities](/en/guide/essentials/utils)).

## Live examples

- **`#/components/table/crud`** — the complete `useCRUD` + `useTable` / `useForm` / `useModal` wiring: table-owned search area (`useSearchForm` + `formConfig.schemas`), `actionColumn` with `auth` and `popConfirm`, toolbar "add / batch delete" gated by `hasPermission`, and a `BasicForm` inside the modal (`:schemas` + `:show-action-button-group="false"`). The page ends with a "what this example skipped" comparison table. Best seen as the `custom` account: it holds `demo:task:add` / `edit` but **not** `demo:task:remove`, so the delete and batch-delete controls disappear entirely while the table and editing keep working.
- **`#/components/directive`** — `v-permission` arg/modifier grammar and the disabled fallback; the decision source is `usePermission()`.
- **`#/components/upload`** — `useChunkUpload`: chunking, progress, concurrency.
- **`#/components/table/basic`** — `useTable` registration and instance methods only (`setLoading`, `getSelectRows`); [Table](/en/components/table) has the full props contract.

## Related pages

- [Utilities](/en/guide/essentials/utils) — the three-layer split, the `@antdv/hooks` inventory and package rebuilds
- [Table](/en/components/table) — `BasicTable` / `useTable` props, slots and instance methods
- [Form](/en/components/form) — `useForm` / `FormSchema` and `componentMap`
- [Modal and drawer](/en/components/modal-drawer) — container props behind `useModal` / `useModalInner` / `useDrawer`
- [Access, directives and cursors](/en/guide/in-depth/access) — route pruning, `v-permission`, the 403/404 fallback
- [Server interaction and API contract](/en/guide/essentials/request) — envelope shape and the `/api` prefix
- [Internationalization](/en/guide/in-depth/internationalization), [Theming](/en/guide/in-depth/theme), [Global loading](/en/guide/in-depth/loading)
- [组合式函数（本页中文版）](/guide/in-depth/composables)
