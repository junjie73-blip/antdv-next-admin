# 常用功能

一句话：**组件都在 `packages/core/ui-kit/` 下那八个包里（`apps/web/src/components/` 已整目录迁空），图标原子在 `@antdv/icons`，通用 hooks 在 `@antdv/hooks`；`Basic*` 系列统一用 `[register, methods]` 的注册式写法驱动。**

## 三层拆分

| 层 | 位置 | 放什么 |
| --- | --- | --- |
| 应用级整件 | `packages/core/ui-kit/common-ui`（根入口 + `/avatar-uploader`、`/chunk-upload`、`/import-export` 子路径） | `ImportExport`、`AvatarUploader`、分片上传、`ReloadPrompt` 都在这；`TreeTable` 在 `@antdv/table-ui`，`MicroAppContainer` 在 `@antdv/common-ui`；`BasicTable`/`TableAction`、`BasicForm`、`BasicModal`/`BasicDrawer` 在 `@antdv/{table-ui,form-ui,popup-ui}`。原来放这批件的 `apps/web/src/components/` 已经整目录迁空，`TenantSelect` 连同它引用的租户 store 一起删了 |
| 库无关基础件 | `packages/core/base/icons`（`@antdv/icons`）+ `packages/core/ui-kit/*` | `IconifyIcon`、`IconPicker`、`SvgIcon` 在 `@antdv/icons`；`Loading` + `v-loading` 在 `@antdv/common-ui`；`Scrollbar` 在 `@antdv/common-ui`；`shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui` 各自一包。这批包一律不依赖 antdv-next，组件也不靠自动导入，宿主必须显式 import |
| 通用组合式 | `packages/core/hooks`（`@antdv/hooks`，消费 dist 产物） | 根入口只收轻量件：`useCRUD` / `useCache` / `useChunkUpload` / `useFileReader` / `usePermission` / `usePrint` / `useRouteLoading` / `useWatermark`；`useEcharts` 走子路径 `@antdv/hooks/echarts`，避免 `import { usePrint }` 也付出一份图表库；`useLocale` / `useLocaleSync` 走 `@antdv/hooks/use-locale`（它是唯一牵 vue-i18n 的组合式函数，塞进根入口等于让所有消费者都付一份 i18n 运行时）。SSE 与 WebSocket 不在这里，实时通信统一在 `@antdv/request` |
| 应用级 hooks | `apps/web/src/composables/` | 只剩 `useNotice`、`usePasswordPolicy` 与请求出口 `index.ts`（现在只 `export * from '@antdv/request'`，页面仍从 `~/composables` 拿 `http`）；`useLocale` / `useLocaleSync` 已迁到 `@antdv/hooks/use-locale`，消费点是 `App.vue`、`plugins/layouts-host.ts`、`views/{login,register}/index.vue`；`useCRUD`、`usePermission` 已迁到 `@antdv/hooks`，消费点在 `directives/index.ts:13`、`plugins/table-runtime.ts:1`、`views/components/table/crud/index.vue:34` |

## 注册式（register-props）模式

所有 `Basic*` + `use*` 都是同一套机制：hook 造一个 `register` 回调，组件 `@register="register"` 时把自己暴露的实例方法交回来，hook 侧的命令再转发给这个实例。

```vue
<script setup lang="ts">
import { BasicTable, useTable } from '@antdv/table-ui';

const [register, tableRef] = useTable({ api: fetchUsers, useSearchForm: true });
</script>

<template>
  <BasicTable @register="register" />
</template>
```

::: warning 第二个返回值不统一，别看 vue-vben-admin 的记忆写代码

| Hook | 返回 | 用法 |
| --- | --- | --- |
| `useTable(props?)` | `[register, Ref<null \| TableActionType>]` | 第二个是**实例 ref**：`tableRef.value?.reload()`，判空 |
| `useForm(props?)` | `[register, FormActionType]` | 第二个是**方法对象**：`methods.setFieldsValue(values)` |
| `useModal()` / `useDrawer()` | `[register, methods]` | 方法对象内部 `waitForInstance()`：最多重试 10 次 × (nextTick + 50ms)，拿不到实例抛错而不是静默 |
| ::: |

注册时传入的初始 props 通过 `instance.setProps(props)` 合并进组件，因此 `useTable({ api })` 和模板上写 `:api` 是同一件事的两个入口，opts 版本先执行。

## useForm 的"待写入值"机制

全站列表页都是先 `formMethods.setFieldsValue(record)` 再 `openModal()`。而 `BasicModal` 默认 `destroyOnHidden: true`：表单还没挂载、或上一次弹窗销毁后， `formRef` 里留着的是死引用 —— 值写进"尸体"，编辑弹窗回填不上。`useForm` 的处理是：实例 `isMounted() === false` 时把值暂存进 `pendingValues`（多次调用合并、后写覆盖）， `register` 拿到活实例后再补写；`resetFields` 会连暂存一起清掉。这个行为是修复出来的，不要退化回"openModal 后手动 nextTick"的脆弱写法。

## BasicTable 常用 options（`packages/core/ui-kit/table-ui/src/types.ts` 的 `BasicTableProps`）

| 键 | 作用 |
| --- | --- |
| `api` / `params` / `immediate` | 数据源、默认参数、是否立即拉取 |
| `columns` / `actionColumn` / `showIndexColumn` | 列、操作列、序号列 |
| `fetchSetting` / `beforeFetch` / `afterFetch` | 分页字段名映射、请求前后钩子 |
| `useSearchForm` / `formConfig` | 内置搜索表单开关与 schema |
| `rowSelection` / `pagination` / `canResize` | 选择、分页、高度自适应 |

实例方法在 `TableActionType`：`reload` / `setProps` / `setColumns` / `expandAll` / `getSelectRows` 等。列/搜索/行操作按 `CODE_STANDARD.md` 第 8 节拆进 `columns.ts` / `schemas.ts` / `actions.ts`，`actions.ts` 保持无状态、副作用走 ctx。

## useCRUD：把弹窗式增删改查接成一条线

`packages/core/hooks/src/use-crud.ts`（`import { useCRUD } from '@antdv/hooks'`）接收 `formMethods`（必填）+ `modalMethods` / `drawerMethods`（`containerType: 'modal' | 'drawer'`）+ `tableMethods`（`useTable()` 的 **实例 ref**）+ 回调 `onCreate / onUpdate / onDelete / onBatchDelete / onFetchDetail / onExport` 与 `messages` 文案表，返回 `isEditing / currentRecord / loading` 与 `handleAdd / handleEdit / handleDelete / handleBatchDelete / handleSave` 等。

确认框的口径分两条，别记成"内置确认全关掉了"：**单条删除不弹确认**（由操作项的 `popConfirm` 描述，避免双重确认），**批量删除内置一次 `confirm()`**（`@antdv/popup-ui` 的确认框，`use-crud.ts:277`；工具条按钮没有 popconfirm 载体，`content` 的条数由 composable 补上）。完整时序与边界见 [组合式函数](/zh/guide/in-depth/composables)；活样板在 `#/components/table/crud`。

## 其余值得一提的

- `CountTo`：数字滚动，住在 `@antdv/common-ui`（`packages/core/ui-kit/common-ui/src/components/count-to/`），props 在 `types.ts`（`startVal` / `endVal` / `duration` / `autoplay` / `decimals`）。
- `MarkdownEditor`：基于 tiptap 的编辑器封装，住在 `@antdv/common-ui`（`packages/core/ui-kit/common-ui/src/components/markdown-editor/`），带 `ImageUploadConfig`（走 Minio 上传配置）；`contentType` 决定 value 是 HTML 还是 Markdown 源码。
- `Description` / `TreeTable` / `ImportExport`：详情列表、树表格、导入导出，三件都在包里（`@antdv/common-ui`、`@antdv/table-ui`、`@antdv/common-ui/import-export`）；导出能力依赖 `@antdv/shared` 的 `excel.ts`。
- 全局注册：`@antdv/icons` 提供 `createIconInstaller()`（`packages/core/base/icons/src/index.ts:19`），`@antdv/common-ui` 的 loading barrel 具名导出 `vLoading`（`packages/core/ui-kit/common-ui/src/components/loading/index.ts:7`）；应用侧不用 installer，一律显式 import，保留 tree-shaking（组件 resolver 已从 `internal/vite-config` 撤掉，裸标签不会被注入）。

## 相关页面

- 每个 `use*` 的签名、默认值与踩坑清单：[组合式函数](/zh/guide/in-depth/composables)
- 样式合并约定（`cn()`）与命名规范：[规范](/zh/guide/project/protocol)
- 请求层与缓存：[HTTP 请求](/zh/guide/essentials/request)
- 加载态全家桶：[全局 Loading](/zh/guide/in-depth/loading)
