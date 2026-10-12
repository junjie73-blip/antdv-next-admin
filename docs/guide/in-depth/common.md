# 常用功能

一句话：**应用级复合组件在 `apps/web/src/components/business/`，库无关的基础件在 `@antdv/ui`，通用 hooks 在 `@antdv/composables`；`Basic*` 系列统一用 `[register, methods]` 的注册式写法驱动。**

## 三层拆分

| 层 | 位置 | 放什么 |
| --- | --- | --- |
| 应用业务组件 | `apps/web/src/components/business/` | `BasicTable`/`TableAction`、`BasicForm`、`BasicModal`、`BasicDrawer`、`TreeTable`、`Description`、`CountTo`、`MarkdownEditor`、`ImportExport`、`TenantSelect`、`MicroAppContainer` |
| 库无关基础件 | `packages/ui`（`@antdv/ui`） | `IconifyIcon`、`IconPicker`、`SvgIcon`、`Loading` + `v-loading`、`Scrollbar`，不依赖 antdv-next |
| 通用组合式 | `packages/composables`（`@antdv/composables`） | 根入口只收轻量件：`useCache` / `useChunkUpload` / `useFileReader` / `usePrint` / `useRouteLoading` / `useWatermark`；`echarts` / `sse` / `websocket` 走子路径导入，避免 `import { usePrint }` 也付出一份图表库 |
| 应用级 hooks | `apps/web/src/composables/` | `useCRUD`、`usePermission`、`http`（请求层出口） |

## 注册式（register-props）模式

所有 `Basic*` + `use*` 都是同一套机制：hook 造一个 `register` 回调，组件 `@register="register"` 时把自己暴露的实例方法交回来，hook 侧的命令再转发给这个实例。

```vue
<script setup lang="ts">
import { BasicTable, useTable } from '~/components/business/Table';

const [register, tableRef] = useTable({ api: fetchUsers, useSearchForm: true });
</script>

<template>
  <BasicTable @register="register" />
</template>
```

::: warning 第二个返回值不统一，别看 vben 的记忆写代码

| Hook | 返回 | 用法 |
| --- | --- | --- |
| `useTable(props?)` | `[register, Ref<null | TableActionType>]` | 第二个是**实例 ref**：`tableRef.value?.reload()`，判空 |
| `useForm(props?)` | `[register, FormActionType]` | 第二个是**方法对象**：`methods.setFieldsValue(values)` |
| `useModal()` / `useDrawer()` | `[register, methods]` | 方法对象内部 `waitForInstance()`：最多重试 10 次 × (nextTick + 50ms)，拿不到实例抛错而不是静默 |
| ::: |

注册时传入的初始 props 通过 `instance.setProps(props)` 合并进组件，因此 `useTable({ api })` 和模板上写 `:api` 是同一件事的两个入口，opts 版本先执行。

## useForm 的"待写入值"机制

全站列表页都是先 `formMethods.setFieldsValue(record)` 再 `openModal()`。而 `BasicModal` 默认 `destroyOnHidden: true`：表单还没挂载、或上一次弹窗销毁后， `formRef` 里留着的是死引用 —— 值写进"尸体"，编辑弹窗回填不上。`useForm` 的处理是：实例 `isMounted() === false` 时把值暂存进 `pendingValues`（多次调用合并、后写覆盖）， `register` 拿到活实例后再补写；`resetFields` 会连暂存一起清掉。这个行为是修复出来的，不要退化回"openModal 后手动 nextTick"的脆弱写法。

## BasicTable 常用 options（`Table/types.ts` 的 `BasicTableProps`）

| 键 | 作用 |
| --- | --- |
| `api` / `params` / `immediate` | 数据源、默认参数、是否立即拉取 |
| `columns` / `actionColumn` / `showIndexColumn` | 列、操作列、序号列 |
| `fetchSetting` / `beforeFetch` / `afterFetch` | 分页字段名映射、请求前后钩子 |
| `useSearchForm` / `formConfig` | 内置搜索表单开关与 schema |
| `rowSelection` / `pagination` / `canResize` | 选择、分页、高度自适应 |
| `tableSetting: { redo, setting, fullScreen }` | 右上角工具条 |

实例方法在 `TableActionType`：`reload` / `setProps` / `setColumns` / `expandAll` / `getSelectRows` 等。列/搜索/行操作按 `CODE_STANDARD.md` 第 8 节拆进 `columns.ts` / `schemas.ts` / `actions.ts`，`actions.ts` 保持无状态、副作用走 ctx。

## useCRUD：把弹窗式增删改查接成一条线

`src/composables/useCRUD.ts` 接收 `formMethods`（必填）+ `modalMethods` / `drawerMethods`（`containerType: 'modal' | 'drawer'`）+ `tableMethods`（`useTable()` 的 **实例 ref**）+ 回调 `onCreate / onUpdate / onDelete / onBatchDelete / onFetchDetail / onExport` 与 `messages` 文案表，返回 `isEditing / currentRecord / loading` 与 `handleAdd / handleEdit / handleDelete / handleBatchDelete / handleSave` 等。

确认框的口径分两条，别记成"内置确认全关掉了"：**单条删除不弹确认**（由操作项的 `popConfirm` 描述，避免双重确认），**批量删除内置一次 `Modal.confirm`**（工具条按钮没有 popconfirm 载体，`content` 的条数由 composable 补上）。完整时序与边界见 [组合式函数](/guide/in-depth/composables)；活样板在 `#/components/table/crud`。

## 其余值得一提的

- `CountTo`：数字滚动，props 在 `CountTo/types.ts`（`startVal` / `endVal` / `duration` / `autoplay` / `decimals`）。
- `MarkdownEditor`：基于 tiptap 的编辑器封装，带 `ImageUploadConfig`（走 Minio 上传配置）。
- `Description` / `TreeTable` / `ImportExport`：详情列表、树表格、导入导出，导出能力依赖 `@antdv/shared` 的 `excel.ts`。
- 全局注册：`@antdv/ui` 提供 `createUiInstaller()`（`app.use` 即注册 `v-loading` 和裸写的图标组件）；应用侧更推荐显式 import，保留 tree-shaking。

## 相关页面

- 每个 `use*` 的签名、默认值与踩坑清单：[组合式函数](/guide/in-depth/composables)
- 样式合并约定（`cn()`）与命名规范：[规范](/guide/project/protocol)
- 请求层与缓存：[HTTP 请求](/guide/essentials/request)
- 加载态全家桶：[全局 Loading](/guide/in-depth/loading)
