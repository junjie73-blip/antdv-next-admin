# 组合式函数

这个仓库里的 `use*` 分三处住着，**判据是"它依赖什么"**：驱动某个 `Basic*` 组件的 hook 和组件同包（`packages/core/ui-kit/<层>/src/`）；要发请求、跳路由的应用级 hook 在 `apps/web/src/composables/`；只碰 DOM / 浏览器 API / 会话 store 的通用件在 `packages/core/hooks`（`@antdv/hooks`），额外拖住某个重运行时的（`useLocale` 牵 vue-i18n）也归这里，但只按子路径暴露。实时通信在 `packages/request`（`@antdv/request`）。本文按这个顺序展开，重点是**前两类怎么把组件驱起来** —— `useTable` / `useForm` / `useModal` / `useCRUD` 这一组接线是全站列表页的骨架，写法上有好几个"照着 vue-vben-admin 的记忆写就会错"的地方。

## 归属与导入（先定坐标）

| 归属 | 位置 | 导入口径 | 典型成员 |
| --- | --- | --- | --- |
| 组件驱动型 | `packages/core/ui-kit/<层>/src/`（`useTable` 在 table-ui、`useForm` 在 form-ui、`useModal` / `useDrawer` 在 popup-ui） | 从该包的根入口引 | `useTable`、`useForm`、`useModal`、`useModalInner`、`useDrawer` |
| 应用级 | `apps/web/src/composables/` | `~/composables`（barrel）或具体文件深路径 | `http` / `request` / `useRequest` / `requestCache`（barrel 只转出了 `@antdv/request`）、`useNotice`、`usePasswordPolicy` |
| 应用无关通用件 | `@antdv/hooks`、`@antdv/request` | 根入口，或按文件名走子路径（`@antdv/hooks/use-print`、`@antdv/request/websocket`） | `useCache`、`useChunkUpload`、`useFileReader`、`usePrint`、`useRouteLoading`、`useWatermark`、`useCRUD`、`usePermission`；`@antdv/hooks/echarts`；`@antdv/request/{sse,websocket}` |

::: warning

本仓库的组合式函数一个都不自动导入 `unplugin-auto-import` 的 `imports` 只列了 `vue` / `@vueuse/core` / `pinia` / `vue-router` 四项（`internal/vite-config/src/plugins/auto-import.ts:24`），**没有配 `dirs`**，antdv-next 的函数式 API 也早就不在里面了。所以 `useTable`、`http`、`usePermission`，以及 `message` / `notification` / `Modal` / `Drawer` 这一类必须显式 `import`。

撞名比漏 import 更阴：`@vueuse/core` 自己就导出 `usePermission`（浏览器的 Permissions API）和 `useWebSocket`，这两个已经躺在 `apps/web/types/auto-imports.d.ts:232` 与 `:293` 里被自动导入了。少写一行 import 不会报错，只会拿到另一个函数的返回值 —— vueuse 的 `usePermission()` 返回的是 `{ permissions }` 一个 ref，压根没有 `hasPermission` 方法。

`@antdv/hooks` 的 `echarts` 故意**不进根 barrel**：它拖进整个图表库的全量注册表，放进根入口会让 `import { usePrint }` 也付出一份图表的解析成本（`packages/core/hooks/src/index.ts:7-11`，`exports` 映射见 `packages/core/hooks/package.json:21-35`：`./echarts` 显式列出 `:26-29`，`"./*"` 通配 `:30-33` 让单文件模块可以直接按文件名引 —— `@antdv/hooks/use-print`、`@antdv/hooks/use-crud` 都走这条，文件名一律 kebab-case）。SSE 与 WebSocket 不住这里 —— 它们在 `@antdv/request`（`packages/request/src/{sse,websocket}/`），与 HTTP 共用一套重连语义。:::

barrel 覆盖面也值得记一笔：`apps/web/src/composables/index.ts` 现在只剩一件事 —— 整包转出 `@antdv/request`（`:6`），让老调用点继续按 `~/composables` 取 `http` / `request`。`useCRUD` 与 `usePermission` 已经迁进 `@antdv/hooks`，`useLocale` / `useLocaleSync` 走 `@antdv/hooks/use-locale`（它唯一牵住 vue-i18n，塞进根 barrel 等于让所有 `@antdv/hooks` 消费者都付一份 i18n 运行时），`useNotice` / `usePasswordPolicy` 仍按应用侧文件路径引：

```ts
import { http } from '~/composables';
import { useCRUD, usePermission } from '@antdv/hooks';
import { useLocaleSync } from '@antdv/hooks/use-locale';
```

`useThemeTransition` 以前也在这排里，现在它住在装配层：`packages/layouts/src/hooks/use-theme-transition.ts:37`（`@antdv/layouts` 有 `"./*"` 通配，可以写 `@antdv/layouts/hooks/use-theme-transition`），全仓只有顶栏那个小部件用它（`packages/layouts/src/widgets/color-toggle/index.vue:8`）。

## 一、驱动组件的 register 模式

所有 `Basic*` 组件都是同一套机制：hook 造一个 `register` 回调，组件在模板上 `@register="register"` 时把自己那一组命令式方法交回来，hook 侧的方法再转发给这个实例。

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

::: danger 第二个返回值不统一，别按直觉写

| Hook | 源码 | 返回 | 用法 |
| --- | --- | --- | --- |
| `useTable(props?)` | `packages/core/ui-kit/table-ui/src/useTable.ts:20-37` | `[register, Ref<null \| TableActionType>]` | 是**实例 ref**：`tableRef.value?.reload()` |
| `useForm(props?)` | `packages/core/ui-kit/form-ui/src/use-antdv-form.ts:13-157` | `[register, FormActionType]` | 是**方法对象**：`formMethods.setFieldsValue(v)` |
| `useModal()` | `packages/core/ui-kit/popup-ui/src/modal/useModal.ts:9-54` | `[register, ModalMethods]` | 方法对象，内部等实例 |
| `useModalInner(cb?)` | `packages/core/ui-kit/popup-ui/src/modal/useModalInner.ts:21-73` | `[register, ModalInnerMethods]` | 在**弹窗组件内部**用 |
| `useDrawer()` | `packages/core/ui-kit/popup-ui/src/drawer/useDrawer.ts:10-57` | `[register, DrawerMethods]` | 同 `useModal` |

`useTable.ts` 顶部的用法注释已经写成 `tableRef.value?.reload()`（`:18`），跟着它走就对。另外 `drawer/index.ts:15` 把 `useDrawerInner` 作为 `useDrawer` 的**别名**导出（注释 `:14` 说明了这没有额外语义），它没有 `useModalInner` 那套"接收 data 的回调"语义 —— 需要 data 通道时只有 Modal 有。:::

三种"拿不到实例"的表现也各不相同，这决定了你要不要判空：

| Hook | 实例还没注册时 |
| --- | --- |
| `useTable` | ref 保持 `null`，`tableRef.value?.reload()` 静默跳过（所以调用点要么判空要么 `?.`） |
| `useModal` / `useDrawer` | `waitForInstance()` 最多重试 10 次 ×（`nextTick` + 50 ms），仍拿不到就 **抛错** `[useModal] Modal instance not found…` / `[useDrawer] Drawer instance not found…`（`useModal.ts:26-39`、`useDrawer.ts:26-38`） |
| `useForm` | 除 `setFieldsValue` / `resetFields` 外都是**静默 no-op**（`use-antdv-form.ts:43-45` 的 `getFormInstance()` 取不到实例就返回 `null`，方法里再回退成空对象），不重试也不抛错 |

### useTable：初始 props 在 register 那一刻合并

```ts
// packages/core/ui-kit/table-ui/src/useTable.ts:27-34
function register(instance: TableActionType) {
  tableRef.value = instance;
  if (props) {
    instance.setProps(props);
  }
}
```

所以 `useTable({ api })` 和模板上写 `:api="api"` 是同一件事的两个入口，`useTable` 里那份**先**执行。表格 props 的完整口径、响应解包顺序（`listField → items → data → records → 裸数组`）、`fetchSetting` 默认 `pageNum / pageSize / list / total` 都在[表格](/components/table)里写过，这里不再抄一遍。要记的是实例方法清单在 `packages/core/ui-kit/table-ui/src/types.ts:782` 的 `TableActionType`，`reload` / `setProps` / `getSelectRows` / `clearSelectedRowKeys` / `setTableData` / `expandAll` 等，以及转发给内置搜索表单的那一组（`getFormValues`、`updateFormSchema`…）。

### useForm：`pendingValues` 是编辑弹窗能回填的原因

全站列表页的写法都是"先灌值再开窗"：

```ts
formMethods.setFieldsValue(record); // 此刻弹窗还没开
modalMethods.openModal();
```

而 `BasicModal` 默认 `destroyOnHidden: true` —— 弹窗没开时表单组件根本不在组件树上，关掉一次又被销毁一次。`formRef` 里留着的是**上一次 register 的对象引用**，卸载不会让它变 null，于是值写进了一具尸体，表现是"点编辑，弹窗里啥都没有；一保存把这条记录清空了"。

`useForm` 的解法（`packages/core/ui-kit/form-ui/src/use-antdv-form.ts:23, 26-30, 32-41, 53-64, 66-73`）：`getLiveInstance()` 判 `isMounted() === false` 就把值暂存进 `pendingValues`（`:26-30`），多次调用**累加**而不是覆盖（`:60-63`，后写的字段赢），`register` 拿到实例后补写一次并清空（`:36-39`）；显式 `resetFields()` 会把暂存一起清掉（`:68`），否则下次挂载又被旧数据盖回来。**不要**退化回"`openModal` 之后手动 `await nextTick()` 灌值"的写法 —— 那依赖 Modal 的挂载时机，很脆。

### useModal / useModalInner：一个在外面，一个在里面

```ts
// 父页面：命令弹窗
const [modalRegister, modalMethods] = useModal();
modalMethods.openModal(true, { id: row.id, isEdit: true }); // data 透传给内层

// 弹窗组件内部：接 data、控制自己
const [register, { closeModal, setModalProps, changeOkLoading }] =
  useModalInner((data) => {
    isEdit.value = data.isEdit;
  });
```

`useModalInner` 的实现是在 `register` 时**包装** `instance.openModal`：只有 `data !== undefined` 才写 `dataRef` 并触发回调（`modal/useModalInner.ts:38-52`）。所以 `openModal(true)` 或 `openModal(true, undefined)` **不会**触发回调 —— 想靠 data 驱动内层状态，每次都带上对象。

::: warning

生命周期钩子只能在 setup 同期注册 `useModal` / `useDrawer` / `useModalInner` 的 `onUnmounted` 都写在 hook 函数体顶层，注释解释了原因（`useDrawer.ts:12-23` 最详细）：`register` 是子组件 `emit('register', instance)` 的回调，执行时 Vue 的 `currentInstance` 已经指向子组件甚至已清空，在回调里调 `onUnmounted` 只会告警、钩子挂不到任何实例上，于是弹窗实例永远留在引用里。自己写 hook 时同理 —— 别把生命周期调用藏进回调。:::

## 二、useCRUD：把弹窗 + 表单 + 表格接成一条线

`packages/core/hooks/src/use-crud.ts:134` 的 `useCRUD<RecordType, FormValues>(options)` 不碰任何接口，它只编排上面三个 hook 的实例：**校验 → 落库 → 关窗 → 刷新表格**这条固定序列搬进 composable，页面只声明"怎么创建、怎么更新、怎么删、文案叫什么"。它为什么能待在 `@antdv/hooks`：运行时只依赖 `@antdv/popup-ui` 的 `confirm` / `message`（`:8`），对 form-ui 与 table-ui 只取 `*ActionType` 这几个**类型**（`:1-4`），实例由调用方注入，所以不必把组件层拖进图里（同文件 `:10-16` 的注释）。

```ts
// apps/web/src/views/components/table/crud/index.vue:212-248（节选）
const [modalRegister, modalMethods] = useModal(); // :90
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
  tableMethods: tableRef, // ⭐ 传 useTable 的那个 Ref，不是方法对象
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

### options（`use-crud.ts:36-95`）

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `containerType` | `'drawer' \| 'modal'` | `'modal'` | 决定用哪套容器方法 |
| `modalMethods` | `Pick<ModalMethods, 'closeModal' \| 'openModal'>` | — | `containerType: 'modal'` 时给 |
| `drawerMethods` | `Pick<DrawerMethods, 'closeDrawer' \| 'openDrawer'>` | — | `'drawer'` 时给 |
| `formMethods` | `Pick<FormActionType, 'clearValidate' \| 'resetFields' \| 'setFieldsValue' \| 'validate'>` | **必填** | `useForm()` 的方法对象 |
| `tableMethods` | `{ value: null \| TableActionType }` | — | `useTable()` 的实例 ref；缺省时不做刷新、批量删除也不自动取选中行 |
| `idKey` | `string` | `'id'` | 编辑/删除取主键用 |
| `onCreate` / `onUpdate` / `onDelete` / `onBatchDelete` | 见源码 | — | 缺省时报"未配置创建/更新/删除 API"（`onBatchDelete` 缺省时逐个 `Promise.all(onDelete)`） |
| `onFetchDetail` | `(id: string) => Promise<RecordType>` | — | 编辑前拉全量字段；失败只 `console.warn` 并退回行数据 |
| `getFormValues` / `getEmptyValues` | `(record) => Values` / `() => Values` | 直接用记录 / `{}` | 回填与新增的初值 |
| `beforeCreate` / `beforeUpdate` / `beforeDelete` | `(...) => boolean \| Promise<boolean>` | — | 返回 `false` 中断；`beforeDelete` 在批量场景**逐条**调用，任一 `false` 整批中止 |
| `onSaved` / `onDeleted` | 回调 | — | `onSaved(isEdit, values)` |
| `messages` | `CRUDMessages` | `DEFAULT_MESSAGES`（`:97-108`） | 键共 12 个（`CRUDMessages` 在 `:21-33`）：创建/更新/删除/批量删除/导出/导入的成功与失败，加 `deleteConfirm` / `batchDeleteConfirm` 两条确认文案 |
| `onExport` / `onImport` | `(params?) => …` / `(file: File) => …` | — | 缺省时调用 `handleExport` / `handleImport` 只弹一条"未配置…功能" |

返回值：`isEditing`、`currentRecord`、`loading` 三个 ref + `handleAdd` / `handleEdit` / `handleDelete` / `handleBatchDelete` / `handleSave` / `handleExport` / `handleImport` / `reset`（`use-crud.ts:376-392`，显式返回类型 `UseCRUDReturn` 在 `:117-133` —— 注释解释了为什么必须显式写：`@antdv/hooks` 是 dist 包，让 TS 推断会把 `IfAny` 漏进 dts 导致构建失败）。

### 固定时序与三处必须知道的边界

| 动作 | 实际做的事（源码行） |
| --- | --- |
| `handleAdd(initialValues?)` | `beforeCreate` → `isEditing=false` → 开容器 → `nextTick` 里 `resetFields()` 再 `setFieldsValue({...empty, ...initialValues})`（`:192-203`） |
| `handleEdit(record)` | `beforeUpdate` → 开容器 → `resetFields` → `nextTick` → `onFetchDetail(record[idKey])`（失败退回行数据）→ `setFieldsValue(getFormValues?.(detail) ?? detail)`（`:206-233`） |
| `handleSave()` | `validate()` → **剔掉值为 `''` 的字段**（`:312-315`）→ 编辑态 `onUpdate(currentRecord[idKey], values)` / 新增态 `onCreate(values)` → 成功提示 → 关容器 → `onSaved` → `tableMethods.value?.reload()`（`:308-336`） |
| `handleDelete(record)` | `beforeDelete` → `onDelete(record)` → 成功提示 → `onDeleted` → 刷新；**不弹确认**（`:237-253`） |
| `handleBatchDelete(records?)` | `records` 缺省时从 `tableMethods.value.getSelectRows()` 取 → 空则警告"请先选择要删除的数据" → 逐条 `beforeDelete` → `confirm()`，`onOk` 里 `onBatchDelete` 或 `Promise.all(onDelete)` → 刷新（`:256-303`） |

::: warning

校验失败与接口失败的区别待遇 `handleSave` 把 `validate()` 和提交放在同一个 `try` 里：校验不过 → 走 `message.error`，但弹窗**保持打开**、`loading` 归 false，用户能改完再试。接口 4xx/5xx 同理。这是刻意的 —— 不要把 `handleSave` 包进你自己的 `try/catch` 再补一次 toast。:::

::: warning

`handleSave` 会删掉空字符串字段 `values[key] === ''` 的键在提交前被过滤掉（`:312-315`，注释写明"提交上去，后端会把可选字段整个覆盖成空"）。语义是"没填 = 不提交这个字段"，好处是可选文本框不会把后端已有值覆盖成空串；代价是**想清空某个字段不能靠留空**，得给它 `null` 或者走一条显式支持清空的接口。:::

::: danger 确认框只该有一次，但两次都不在页面里手搓

- **单条删除**：`handleDelete` 不弹确认。确认由操作项的 `ActionItem.popConfirm` 描述（见下一节），这是 `CODE_STANDARD.md` 的口径。
- **批量删除**：`handleBatchDelete` **内置**一次 `confirm()`（来自 `@antdv/popup-ui`，`use-crud.ts:8`；标题固定「批量删除」，`content` 用 `messages.batchDeleteConfirm` 并由 composable 补上`（N 条）`，`:274-279`）。工具条按钮没有 popconfirm 载体，这唯一一次确认是必要的 —— 页面里**不要再自己弹一层**。

批量确认框的 `onOk` 是异步且非阻塞的，它的 reject 到不了外层 `try`，所以失败提示写在 `onOk` 内部（`:269-273` 的注释记录了这件事）。另外 `loading` 只在 `onOk` 的 `finally` 里归位，取消时由 `onCancel` 归位（`:300-302`）：确认框还开着时它仍是 `true`，这是有意的（此时删与不删都还没定）。:::

::: warning

选中态不归 useCRUD `useCRUD` 删完会 `reload()` 表格，但不会清 `rowSelection`。删掉的行已经不在表上了，勾选还留着就会出现"批量删除（3 条）"点下去只剩 1 条的错位。收尾自己写：

```ts
function clearSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelectedRowKeys?.();
}
```

并且给 `handleBatchDelete` 传**快照**（示例页 `crud/index.vue:342` 的 `[...selectedRows.value]`）而不是引用数组 —— 确认框非阻塞，取消或删完之后数组和表格状态就对不上了。:::

::: danger

API helper 已经把信封剥过一层 `~/api/request.ts` 的 `get/post/put/del` 内部是 `http.Get<R<T>>(…).then(res => res.data)`（`api/request.ts:20-56`），也就是**它们 resolve 出来就是负载本身**。所以 `onCreate: (values) => addTask(values)` 直接给函数就行，别再 `.then(res => res.data)` —— 多剥一次拿到 `undefined`，表现是"保存成功了但表格没新行 / 编辑弹窗回填全空"。:::

行为契约写成了单测：`packages/core/hooks/__tests__/use-crud.test.ts`（23 条，用最小替身把三个组件的方法名与**调用顺序**都断言住了 —— 例如"先 `resetFields` 再 `setFieldsValue`"错了就是弹窗闪一下上一个人的数据）。改 `useCRUD` 前后都跑它。

## 三、权限：usePermission 与按钮级访问

`packages/core/hooks/src/use-permission.ts:68`，数据源是 `useUserStore()` 的 `permissions` / `roles`：

```ts
const {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isAdmin,
  checkPermission,
} = usePermission({ strict: true }); // strict 默认 true（:70）
```

| 方法 | 语义 |
| --- | --- |
| `hasPermission(code)` / `hasRole(role)` | 单条字面量包含（`:102,107` 起） |
| `hasAnyPermission(list)` / `hasAllPermissions(list)` | `some` / `every`（`:107,112`） |
| `hasAnyRole(list)` / `hasAllRoles(list)` | 角色同构 |
| `isAdmin()` | 角色里有 `super` 或 `admin`（`PermissionRole` 枚举在 `packages/core/hooks/src/use-permission.ts:27-32`；实现 `:132`） |
| `checkPermission(perms, { mode })` / `checkRole(roles, { mode })` | `mode: 'any'` 走 any，否则默认 all |
| `permissions` / `roles` | `readonly(computed)`，给模板直接渲染用 |

三条判定口径都在 `use-permission.ts:75-100`：

1. **未登录一律 false**：每个方法先过 `checkAuth()`（`:75`），不看权限表。
2. **`'*'` 是全通哨兵**：`WILDCARD = '*'`（`:66`），用户权限里出现它就万事通过（mock 的 `admin` 账号就是 `permissions: ['*']`，超管不必逐条列举）。
3. **权限表为空时看 `strict`**：`strict: true`（默认）判否，`strict: false` 判是（`:95`）—— 后者只适合本地兜底，别拿去当"宽松模式"上线。

组件层的消费点是表格，但**不是组件自己 import `usePermission`**：`TableAction.vue:93-97` 走 `tableRuntime.checkAuth` / `checkAnyAuth`，由 `apps/web/src/plugins/table-runtime.ts:16-22` 用 `configureTable()` 把 `usePermission()` 接进去（`:13-14` 现取现算，因为权限要等 pinia 装好）。页面不必再写 `v-if` 包按钮。

```ts
// apps/web/src/views/components/table/crud/index.vue:313-340（节选）
const actions = (record: Recordable): ActionItem[] => [
  {
    label: '编辑',
    icon: 'ant-design:edit-outlined',
    auth: 'demo:task:edit',
    onClick: () => handleEdit(record),
  },
  {
    label: '删除',
    icon: 'ant-design:delete-outlined',
    danger: true,
    auth: 'demo:task:remove',
    popConfirm: {
      title: '确定删除这个任务吗？',
      content: `「${record.title}」删除后不可恢复`,
      confirm: () => {
        handleDelete(record);
        clearSelection();
      },
    },
  },
];
```

`ActionItem.popConfirm` 会渲染成 Popconfirm（`title` + `description`），`confirm`/`cancel` 收 `record` 与事件。工具条上的按钮没有 `auth` 载体，就用 `hasPermission` 算 `computed` 开关（示例页的 `canAdd` / `canBatchDelete`）。

模板级声明用 `v-permission`，它的 arg/modifier 口径、和 store 解耦的注入方式都写在[权限、指令与光标](/guide/in-depth/access)。**同一份判定函数**是这两条通道共享的 —— 指令的 `checkers` 就是 `() => usePermission()`（`apps/web/src/directives/index.ts:19-36`，`checkers` 在 `:24`）。

## 四、请求层：`http` / `useRequest` / `requestCache`

出口在 `@antdv/request`（`packages/request/src/index.ts`）；`~/composables` 仍然整包 re-export 它（`composables/index.ts:6`），老调用点一行都不用改。实现分四层：`fetcher`（@vueuse `createFetch` + 拦截器）→ `executor`（缓存 / 去重 / 重试 / 401 重放）→ `http`（五个动词）→ `useRequest`（组合式外壳）。

### http：命令式动词

```ts
import { http } from '~/composables';

const list = await http.Get<R<TaskRecord[]>>('/demo/task/list', { pageNum: 1 });
await http.Post('/demo/task', values);
await http.Delete('/demo/task/1', undefined, { body: { force: true } }); // DELETE 可带体
```

`http` 同时提供大写（`Get`/`Post`/…）和小写两套别名（`http.ts:29-40`），指向同一批函数；`request` 是未大写的原始对象（`ImportExport.vue`、`markdown-editor/utils.ts`、`Upload/api.ts` 用的就是它）。返回值是**完整响应体**（`{ code, data, message }` 那层信封），要负载自己 `.data`，或者直接用 `~/api/request.ts` 的 `get/post/put/del`。

`ExecuteOptions`（`executor.ts:12-37`）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `cache` | `false` | **只对 GET 生效**（`canCache = enableCache && method === 'GET'`，`:309,375`） |
| `cacheTime` | `5 * 60 * 1000` | 毫秒 |
| `cacheKey` | 自动生成 | 形状 `METHOD:url:JSON(body)`（`:307-308`）；流式 body 用 `[stream]` 占位并**同时关掉去重**（`:308,310`） |
| `forceRefresh` | `false` | 跳过缓存读 |
| `cacheOnly` | `false` | 未命中直接抛 `RequestError('缓存未命中')` |
| `staleWhileRevalidate` | `false` | 立即返回旧值 + 后台静默刷新（后台失败不报，`:18,320`） |
| `dedupe` | `true` | 同一 key 的并发请求复用同一个 Promise |
| `retries` / `retryDelay` | `3` / `300` | 指数退避 + 抖动，封顶 10 s（`:229-246,374`） |
| `timeout` | `30_000` | 超时抛 `status/code 408` |
| `responseType` | `'json'` | `blob` / `arrayBuffer` / `text` 时**跳过信封校验**直接透传 |
| `signal` | — | 与超时信号合并（`timeout.ts`） |
| `params` / `body` | — | POST/PUT 也能带 query；两处都给时**位置参数覆盖 `opts.params`** |

::: warning

默认重试对所有动词生效 `retries` 的 3 次重试包在 `runRequest` 外面，不区分方法（`:374-389`）。`isRetryable` 只放过 `400_001 / 401_001 / 403_001 / 404_001` 这几个不重试，`status === 0`（网络断开）与 5xx 都会重试（`:138-144`）。也就是说**一个 500 的 POST 会被打三次** —— 非幂等的创建接口要么后端做幂等键，要么调用侧传 `retries: 0`。:::

### 拦截器干了什么（排障时要知道的四件事）

`fetcher.ts:160-326` 的 `createFetcher()`：

- **凭证只从注入的 runtime 拿**：`beforeFetch` 里 `getRequestRuntime().tokens.access()`（`:185-195`），不回退去读缓存 —— 缓存里存的是 JWE 密文，当凭证发出去必然 401（这个口径由应用侧的注入实现，`apps/web/src/plugins/request-runtime.ts:19-24`：`access` 读 user store，`refresh` 读缓存）。无 access 有 refresh 就先刷新，刷新失败直接 `forceLogout()`；`isTokenExpired(token, 60)` 提前 60 s 续期（`packages/request/src/fetcher.ts:214`）。
- **CSRF 只对写操作**：`STATE_CHANGING` 的方法才带 `X-CSRF-Token`（`:233-245`，头名在 `:165-171` 的 `initCsrfProtection({ headerName: 'X-CSRF-Token', doubleSubmit: true, autoRotate: true })` 里定），另外顺带一组安全头（`nosniff`、`X-Frame-Options: DENY`…`:248-262`）。
- **`AUTH_ENDPOINTS` 白名单**（`:18-27`，判定 `:36`）：登录/登出/刷新/租户选项等接口不注入 token、也不参与 401 重放，避免死循环。
- **业务码在非 200 时抛 `RequestError`**：`afterFetch` 见 `payload.code !== 200` 就抛并标记 `handled = true`（`:264-301`），`onFetchError` 因此不会重复弹一条 toast。5xx 走"服务器繁忙，请稍后重试"，其余取 `message`/`msg`（`resolveErrorMessage`，`:329`）；`401` 在 `SILENT_CODES` 里（`:29`，判定 `:350`），**不弹通知**，由跳转登录表达。

401 的重放逻辑在 `executor.ts:260-275`：拿到 401 先 `refreshAccessToken()` 再重放一次；刷新失败 → `forceLogout()`；认证接口、已在登出流程中、或已经重放过 → 直接抛。`forceLogout` 走注入的 `onLogout()`（应用侧接成 `useUserStore().logout()`，`request-runtime.ts:18`）这个唯一出口，并用**改 hash** 的方式回登录页（本应用是 `createWebHashHistory`，写 `location.href = '/login'` 会触发整页重载，打断正在跑的导航）。

`RequestError`（`error.ts:26-52`）带 `status` / `code` / `data` / `handled` / `retryCount`；`ErrorCode` 里业务码是六位（`400_001`、`401_001`…），HTTP 码原样（`408`、`502`）。

### useRequest：响应式外壳（目前无调用点）

`useRequest(url | (() => string), config)`（`useRequest.ts:63-193`）在 `ExecuteOptions` 之上加 `immediate`（**默认 `true`**，`:68`，一进 setup 就发一次 GET）、`initialData`、`debounce` / `throttle`、`updateDataOnError`、`onSuccess` / `onError` / `onFinally`。返回：

| 键 | 说明 |
| --- | --- |
| `data` / `loading` / `error` / `status` | `data` 是 `shallowRef`（`:76`），`status` 是 `'idle' \| 'loading' \| 'success' \| 'error'` |
| `send(method?, arg?)` | `:141-145`，GET/HEAD/DELETE 的参数当 query，其余当 body；`get/post/put/patch/delete` 是它的快捷方法 |
| `refresh()` | 用最近一次的方法与参数重发（`:152`） |
| `abort()` | 中断当前请求；`onScopeDispose(abort)` 已自动挂（`:155`） |
| `forceRefresh()` | 带 `forceRefresh: true` 绕过缓存（`:156-163`） |
| `invalidate()` | 按 URL 清掉本接口的缓存（`:171-173`） |
| `onSuccess` / `onError` / `onFinally` | `@vueuse` 的 `EventHook.on`，可多个订阅者 |

::: warning

两个必须知道的现状 1）**全仓没有业务调用点** —— `useRequest` 只被 `packages/request/__tests__/structure.spec.ts:36,77` 断言"它还在导出清单里"。声明式取数走的是 `@tanstack/vue-query`（`apps/web/src/api/query.ts:1,9,33` 把增强后的 fetch 接进 `useQuery`），别新页面里两套混用。2）**`data` 是完整响应体，不是负载** —— `afterFetch` 把解析后的 `payload` 原样返回，`executor` 把整个信封交给上层，所以 `useRequest().data.value` 是 `{ code, data, message }`。要用它直接绑 `:options` 之前先确认接口到底带不带信封，本项目 mock 一律带。:::

`requestCache`（`executor.ts:60-115`）是给缓存管理用的：`clear` / `delete(key)` / `clearByUrl(url)` / `clearByPattern(re)` / `has` / `get` / `set` / `size`，底层是模块级 `Map` + LRU，上限 `MAX_CACHE_SIZE = 200`（`:48`，淘汰 `:128-136`）。当前仓库里没有调用方 —— 需要"写完立刻让列表缓存失效"时，`invalidate()` 比手动清更省事。

## 五、界面与环境：useLocale / useLocaleSync / useThemeTransition

`useLocale()`（`packages/core/hooks/src/use-locale.ts:62-84`）给模板用：`{ availableLocales, locale, setLocale, t }`。**写语言只有一条路** —— `setLocale` 改的是偏好（`appStore.updateSetting({ locale })`，`:75`），效应由 `useLocaleSync` 统一展开；任何组件都不该再自己写 `i18n.global.locale`，两处各写一份迟早漂移（表现是"菜单变英文、分页器还是中文"，`:30-32` 的注释记的就是这件事）。

`useLocaleSync()`（`:41-56`）是 locale 效应的唯一出口，`apps/web/src/App.vue:14` 在根组件调一次，**现在不返回任何东西**。它 `watch` 偏好并展开三件事：i18n 文案、`<html lang>`、dayjs locale（注意 dayjs 用小写短码 `zh-cn`，与偏好里的 BCP 47 不同源，`:22-25`）。以前这里有第四件 —— 按需动态 import antd 的语言包对象交给 `ConfigProvider :locale`（那一版还留过一个"注释掉这一步，整站内置文案全英文"的缺陷），随 antd 依赖一起删了，动机记在 `:34-37`；组件内置文案现在由 `@antdv/common-ui` 的 `ConfigProvider` 按 `'en-US' | 'zh-CN'` 自己展开（`App.vue:41-44` 取值、`:48-51` 挂 provider）。语言包名一律用本语言自称（`localeLabels`，`:16-19`）。语言切换的 UI 已经搬进装配层：`packages/layouts/src/widgets/language-toggle/index.vue:28` 只读宿主注入的 `layoutHost.locales`（注释 `:22-27` 说明了这个约定），那份候选表在 `apps/web/src/plugins/layouts-host.ts:35-38` 由 `localeLabels` 生成；写入仍然是改偏好这一个动作，口径详见[国际化](/guide/in-depth/internationalization)。

`useThemeTransition()`（`packages/layouts/src/hooks/use-theme-transition.ts:37-114`，早先在应用侧 `src/composables/` 下，重构时整体搬进了装配层，现在应用里没有这份源码）负责带圆形扩散动画的主题切换：

| 成员 | 说明 |
| --- | --- |
| `switchThemeWithAnimation(target, event?)` | 中心取点击坐标，没给就屏幕中心（`:40-57`）；渲染色没变就只更新 store 直接返回 |
| `toggleThemeWithAnimation(event?)` | 取反当前**渲染**态（`:102-107`，`isDarkNow` 会把 `auto` 解析成实际深浅） |
| `isDarkNow(theme)` | 导出的独立函数（`:13`），`auto` 模式下按系统偏好解析（模块级只查一次 `createSystemDark()`） |

三处实现约束值得抄进自己的 View Transition 代码里：`startViewTransition` 的回调**必须同步改 DOM、不能 `await`**（`:18-24` 的注释 + `:66-69` 的实现）；store 更新放在动画结束之后（`:92-96`），避免响应式反过来打断动画；不支持 `startViewTransition` 的浏览器直接切（`:59-63`）。切暗用 `::view-transition-new(root)` 扩散、切亮用 `::view-transition-old(root)` 收缩（`:73-90`）。消费方现在只剩一个：装配层的顶栏小部件 `packages/layouts/src/widgets/color-toggle/index.vue:8`（偏好抽屉的外观面板改成挂 `<ThemeToggle>`，不再自己调动画）。

## 六、应用级 hooks 的现状（别照着抄的两个）

`apps/web/src/composables/` 下还有两个 hook，设计是好的，但**当前没接线**，抄之前先补接口：

| Hook | 状态 | 说明 |
| --- | --- | --- |
| `useNotice()`（`useNotice.ts:62`，全文 196 行） | 无调用方，且 `import … from '~/api/notice'`（`:5-10`）指向**不存在的模块** —— `apps/web/src/api/` 下只有 `demo/menu/mock/query/request/screen/security/system` | 设计：模块级单例状态（`list` / `unreadCount` / `loading` 在函数外声明）、首次调用才挂 WS 监听并拉未读数、推送去重 + 只留 20 条、撤回时未读则减一、`read`/`readAll` 乐观更新并在失败时回滚。接上通知接口后即可用；顶栏铃铛已经随小部件搬进 `packages/layouts/src/widgets/notification/`，推送通道由 `apps/web/src/plugins/layouts-host.ts:9` 注入。 |
| `usePasswordPolicy()`（`usePasswordPolicy.ts:24`，全文 79 行） | 无调用方，且依赖不存在的 `~/api/auth`（`:1,5`）；仓库里**根本没有密码策略接口** —— `apps/web/src/api/` 下只有 `demo/menu/mock/query/request/screen/security/system`，`security.ts:6-51` 是安全评分 / 事件 / 告警，没有任何 policy 导出 | 设计：模块级 `cachedPolicy` 全生命周期只拉一次，`onMounted(load)` —— **必须在组件 setup 里调**；`policyText` 给表单 `helpMessage`，`validate(value)` 返回 `{ ok, message }`；拉取失败退回默认策略（6-64 位、四个 `require*` 全 false）并 `console.warn`。要接它得先有后端端点，不是改 import 路径就行。 |

WebSocket 这一侧的口径是：业务代码订**应用级单例** `useWebSocket()`（`apps/web/src/utils/ws.ts:340`，返回 `{ notice, status, onNotice, onRevoke, onForceLogout, … }`，订阅函数**返回解订函数**（`:360` 起），配套 `onUnmounted(off)`），而不是直接用 `@antdv/request/websocket` 那个底层实现（`ws.ts:5` 正是这么 import 的）—— `CODE_STANDARD.md` 第 6 节写的名字 `useWs()` 已经不存在了，以 `~/utils/ws` 的导出为准。它内部才用包里的 `useWebSocket`，并按 token 变化重建连接（`:346`）。`VITE_WS_URL` 未配时不会真连，但订阅照挂不炸（`:104-105` 与 `:312` 的注释）。

## 七、`@antdv/hooks` 与 `@antdv/request`：库无关通用件

### 概览

| 导出 | 签名与关键默认值 | 本仓库调用点 |
| --- | --- | --- |
| `useCache(key, options?)` | `{ defaultValue = null, expire = 0, deep = true, immediate = false }`（`use-cache.ts:45-50`），`expire` **单位是秒**，`0` = 不过期 | 无（仅单测覆盖） |
| `useChunkUpload(options?)` | `{ chunkSize = 5 MB, concurrent = 3, createWorker?, workerUrl? }`（`use-chunk-upload.ts:35-37`） | `views/components/upload/index.vue:435`；`packages/core/ui-kit/common-ui/src/components/chunk-upload/composables/useChunkUploader.ts:53` 在它上面又包了一层 |
| `useFileReader()` | 无 options；`read(file, readAs = 'readAsDataURL')` | `packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue` |
| `usePrint(options)` | `target` **必填**，`title = document.title`，`showHeader/showFooter = true`；返回 `void` | `views/system/{login-log,online,user}` 三处 |
| `useRouteLoading(options?)` | `{ minDuration = 300, auto = true }` | `packages/layouts/src/basic/layout.vue:8` |
| `useWatermark(options?)` | `{ content?, enabled?, style? }`，样式默认 `200×150 / rotate 330 / alpha 0.15 / 14px / #666666` | `packages/layouts/src/basic/layout.vue:9` |
| `useCRUD(options)` | 见第二节 | `views/components/table/crud/index.vue:220` |
| `usePermission(options?)` | 见第三节 | `directives/index.ts:13`、`plugins/table-runtime.ts:1` |
| `useEcharts(option?, options?)`（`@antdv/hooks/echarts`） | `{ autoResize = true, resizeStrategy = 'raf', resizeDelay = 100, renderer = 'canvas', applyInitial = true, debug = false }` | 无（图表页走 `@antdv/common-ui/charts`；只有 `packages/core/hooks/__tests__/echarts.test.ts`） |
| `useSSE(options)`（`@antdv/request/sse`） | `url` 必填；`{ reconnectEnabled = true, reconnectInterval = 1000, maxReconnectAttempts = 5, reconnectDelayMultiplier = 2, maxReconnectDelay = 30000, withCredentials = false }` | 无（仅单测） |
| `useWebSocket(options)`（`@antdv/request/websocket`） | `url` 是 **`() => string \| URL`**；`autoConnect = false`；`heartbeat` / `reconnect` 都不传就不开 | `utils/ws.ts:5`（唯一入口，业务侧不要直连） |

`usePrint` 是唯一有必填字段的；`useEcharts` / `useSSE` / `useWebSocket` 走目录子路径，其余单文件模块按 `"./*"` 通配引（`@antdv/hooks/use-cache` 也行，但仓库内约定从根入口引）。

### 挑出来会咬人的几条

- **`useCache` 的单一数据源是 `cache` 单例**（`use-cache.ts:52`），不再叠一层 `useStorage` —— 曾经有两份隐形的值。`value.value = null` 是**删除**而不是"存了个 null"（`:108-113`）；嵌套对象要改得动得靠 `deep: true`（`flush: 'sync'` 的深 watch + `internalWrite` 标志防双写，`:69-113`）；跨标签页靠 `storage` 事件回读（`:131`）。
- **`useChunkUpload` 不给 worker 就是主线程模式**：只切片、不算 hash，`hash` 恒为空串（`:69`）。`uploadFile()`（`:228`）每次先 `cancel()`（`:208`）；**卸载不会自动 terminate worker**，得自己 `cancel()`（`terminateWorker` 在 `:177-181`）。`pause` / `resume`（`:187,194`）复用同一个 Promise（`:71-74` 记录了原因 —— 以前 `resume()` 里再调一次上传，导致 `await uploadFile()` 永不 resolve）。
- **`useFileReader` 返回的三个 ref 是 `readonly()` 包过的**（`:52-54`），外部写不进去；失败信息固定成"文件读取失败"，底层 `FileError` 的 code 被丢掉。
- **`usePrint` 调用即打印，返回 `void`**；`.no-print { display: none !important }` 在打印文档里可用（`:102`）；`afterprint` 后 100 ms 收尾、`onload` 兜底 1000 ms，`finished` 标志保证幂等（`:149-166`）。`title` 与日期过了 `escapeHtml`，目标元素的 `innerHTML` 是原样插入的 —— 打印对象必须可信。
- **`useRouteLoading` 需要 `vue-router` 实例**（`use-route-loading.ts:2` 运行时 `useRouter`），`progress` 是假的渐近值（封顶 90，`:149`），`isSlow` 阈值写死 3000 ms（`:159-160`），成功多等 200 ms、失败等 500 ms 再隐藏。`auto: true` 已经装了一对 `beforeEach`/`afterEach`，**不要再加 `watch(() => route.path)`**（双触发），也别调 `next()`（vue-router 5 已废弃该用法）。
- **`useWatermark` 只在 `onMounted` 时 `enabled` 和 `content` 都为真才画**（`:102`）—— 只给 `content` 不给 `enabled` 是"没水印也没报错"。它依赖 `onMounted`/`onUnmounted`（`:5`），必须在组件 setup 里调，运行时依赖 `watermark-plus`。
- **`useEcharts` 必须先 `setupEcharts()`**（`echarts/setup.ts:39-70`，模块级 `installed` 标志，重复调用是 no-op）。注册表只有 8 个图表 + 10 个组件 + `CanvasRenderer`：**`renderer: 'svg'` 不会生效**，除非你自己 `echarts.use([SvgRenderer])`。零尺寸容器会被拒掉并重试（`initWithRetry`，最多 5 次 × 100 ms，`use-echarts.ts:201-215`）；ready 之前的 `setOption` 排队、init 时补刷，不会丢（`pendingOptions`，`:114,190-191,235`）；所有图表共享一个 `window` resize 监听并用 rAF 合并（`:70`、`resize` 走 `attempt` 包一层 `:132`）；`containerRef` 要绑到真实 DOM 节点上。
- **`useSSE` 的 `headers` 字段是摆设**：`EventSource` 不能设请求头，实现里只读了 `url` 与 `withCredentials`（`packages/request/src/sse/useSSE.ts:53-62`）—— 凭证放 query 或 cookie。事件名两套通道：业务帧走 `on('event:message', cb)`（`SSEEventManager` 把 `event:` 前缀路由进单独一张表），原始 `MessageEvent` 走 `on(SSEEventType.Message)`；心跳/注释帧（`data === ''`）被吞掉不进业务。`lastEventId` 自动作为 query 续传（`:57-58`）；`onUnmounted` 会断开，所以必须在组件里用。
- **`useWebSocket`（包里那个）没有任何生命周期清理** —— 连接、心跳定时器、重连定时器都比组件活得久，必须自己 `disconnect()`；`autoDisconnect` 字段还在类型里但已 `@deprecated` 且是空操作（`packages/request/src/websocket/useWebSocket.ts:19-20`）。`heartbeat` 与 `reconnect` 都是"**传了对象才生效**"的 opt-in：`enabled: !!reconnect`（`:58`），所以那些 `DEFAULT_*` 常量只有在你给了对应对象时才会补上缺省字段（心跳 30 s ping / 5 s pong 超时 / 载荷 `{"type":"ping"}`；重连 1000 ms × 2 退避、上限 30 s、最多 5 次，`retries <= 0` 表示无限）。`heartbeat.pongMessage` 匹配的帧会被消费掉不给业务；心跳超时用自定义 close code `4000` 走重连分支。

`useSSE` / `useEcharts` / `useCache` 目前**没有业务调用点**（只有 `packages/core/hooks/__tests__/` 与 `packages/request/__tests__/` 下的单测），它们是能力储备而不是现成功能 —— 要用先确认对应后端（SSE 端点、图表页）接得住。

## 八、新增一个组合式函数

放哪儿，按依赖判：

| 依赖 | 放哪 | 附带要求 |
| --- | --- | --- |
| 依赖某个 `Basic*` 组件的实例 | 与该组件同目录 `useXxx.ts` | 从该目录 `index.ts` 导出 `register` + 类型（`UseXxxReturnType` 进 `types.ts`） |
| 读 store / 发请求 / 动路由 / 用 `import.meta.env` | `apps/web/src/composables/` | 需要暴露给页面的加进 `composables/index.ts`，并**显式**写 import |
| 只碰 DOM / 浏览器 API，谁都能复用 | `packages/core/hooks/src/`（文件名 kebab-case） | 轻量件进根 barrel；带重依赖的另开子路径并同步 `package.json` 的 `exports` |
| 实时通信 / HTTP 语义 | `packages/request/src/{sse,websocket}/` | 不许把 pinia、`~/` 别名、`import.meta.env.` 写进这个包（守卫用例见 `packages/request/__tests__/structure.spec.ts:40-52`） |

写的时候守这几条：

1. **不要依赖自动导入** —— 本项目不配 `dirs`，从 `@vueuse/core` 借的函数（`useDebounceFn`、`tryOnScopeDispose` 等）也要显式 import。
2. **生命周期调用放在函数体顶层**，不要藏在回调里（原因见第一节）。
3. **需要收尾的一律注册清理**：`onScopeDispose` / `tryOnScopeDispose` / `onUnmounted`；确实不做的（如 `useWebSocket`）要在类型注释里写明白，让调用方知道自己负责。
4. **模块级状态是有意为之就要说明**：`useNotice`、`usePasswordPolicy`、`utils/ws` 都是跨组件共享的单例，注释里写清"多处调用共享同一份"，否则后来人会以为每次调用都是新状态。
5. **类型和默认值同源**：options 接口逐字段带类型注释，默认值在解构处给（本文的表格就是照这个规则从源码里读的）。
6. **配单测**：跟包放，`packages/core/hooks/__tests__/<name>.test.ts`，依赖组件用最小替身 + 调用顺序数组（参考 `use-crud.test.ts`）；跑 `pnpm --filter @antdv/hooks test:unit`。
7. 改 `@antdv/hooks` 这类走 dist 的包要重新构建（`pnpm --filter @antdv/hooks build`）才被 `apps/web` 看到；`@antdv/request` 按源码消费，保存即生效（见[工具](/guide/essentials/utils)）。

## 在线示例

- **`#/components/table/crud`** — `useCRUD` + `useTable` / `useForm` / `useModal` 的完整接线：表格自带搜索区（`useSearchForm` + `formConfig.schemas`）、`actionColumn` 的 `auth` 与 `popConfirm`、工具条按 `hasPermission` 出"新增 / 批量删除"、弹窗里 `BasicForm` 的 `:schemas` + `:show-action-button-group="false"`。页面底部还有一张"这个示例省掉了什么"的对照表。用 `custom` 账号登录最直观：它有 `demo:task:add` / `edit`，**没有** `demo:task:remove`，所以"删除 / 批量删除"整排消失，而表格与编辑照常。
- **`#/components/directive`** — `v-permission` 的 arg / modifier 写法与降级态，判定源就是 `usePermission()`。
- **`#/components/upload`** — `useChunkUpload` 的分片、进度与并发。
- **`#/components/table/basic`** — 只用 `useTable` 的注册与实例方法（`setLoading`、`getSelectRows`），[表格](/components/table)那篇有完整 props 口径。

## 相关页面

- [工具](/guide/essentials/utils) —— 三层分工、`@antdv/hooks` 清单与子包构建
- [表格](/components/table) —— `BasicTable` / `useTable` 的 props、插槽、实例方法清单
- [表单](/components/form) —— `useForm` / `FormSchema` 与 `componentMap`
- [弹窗与抽屉](/components/modal-drawer) —— `useModal` / `useModalInner` / `useDrawer` 的容器 props
- [权限、指令与光标](/guide/in-depth/access) —— 路由级裁剪、`v-permission`、兜底页 403/404
- [服务端交互与接口约定](/guide/essentials/request) —— 信封约定与 `/api` 前缀
- [国际化](/guide/in-depth/internationalization)、[主题](/guide/in-depth/theme)、[全局 loading](/guide/in-depth/loading)
- [组合式函数（本文英文页）](/en/guide/in-depth/composables)
