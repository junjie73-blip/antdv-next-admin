# 编码规范

本规范由现有代码沉淀而成，不是理想化模板。文中所有示例都取自仓库里的真实文件，改代码时以本规范为准；规范与某个旧文件冲突时，说明那个文件是待改的历史遗留。

适用范围：`apps/web`、`apps/backend-mock`、`packages/**`、`internal/**`、`scripts/**`。

---

## 1. 总原则

1. **包边界优先于实现便利**。`packages/*` 之间不许 import `pinia` / `vue-router` / 宿主 `~/`，跨包能力一律依赖注入。越界能编译通过，但会被 `pnpm check:dep` / `check:circular` 拦下。
2. **显式优于自动**。`unplugin-auto-import` 只配了 `vue` / `@vueuse/core` / `pinia` / `vue-router` 四个来源，**没有配 `dirs`**；`unplugin-vue-components` 只扫 `src/components`。本仓库的 `use*` 与业务组件都要显式 import，别指望自动导入。
3. **注释解释为什么**。仓库现有代码的注释密度偏高且写的是设计取舍（为什么不那样做、踩过什么坑），新增代码保持同一风格；只写「这行在做什么」的注释一律删掉。
4. **只改当前任务需要的文件**。顺手重构、顺手格式化、顺手升级依赖都不属于当前任务。

---

## 2. 目录组织

### 2.1 应用层 `apps/web/src`

```
src/
├── api/            # 接口定义，按后端域拆文件（system / menu / demo / enterprise…）
│   ├── request.ts  # get / post / put / del + 信封拆解 + ApiBusinessError
│   └── index.ts    # 认证类接口
├── bootstrap/      # 启动期装配（env 解析）
├── components/     # 应用级共享组件（会被 unplugin-vue-components 自动扫到，但仍建议显式 import）
├── composables/    # 应用级组合式函数（useNotice / usePasswordPolicy）
├── config/         # 应用常量与开关（constants / project / color / auth-social / micro-app）
├── directives/     # 全局指令注册中心（v-permission / v-lazy / v-safe-html / v-escape / v-loading）
├── layouts/        # 应用布局入口
├── locales/        # i18n 实例与文案表（lang/zh-CN.ts、lang/en-US.ts）
├── plugins/        # 宿主注入点（request-runtime / table-runtime / ui-runtime / layouts-host）
├── router/         # 路由表（routes / menus）与守卫（guards）
├── settings/       # 项目默认偏好（标题、水印、版权）
├── stores/         # 应用级 store（modules/dict.ts；modules/auth.ts 为历史遗留）
├── styles/         # 全局样式唯一入口 index.css
├── utils/          # 应用工具（ws / excel / securityInit / log-format / deterministic）
└── views/          # 页面，按业务域分目录
```

`views/` 的域目录：`account` / `ai` / `approval` / `components` / `dashboard` / `enterprise` / `error` / `login` / `micro-app` / `project` / `redirect` / `register` / `screen` / `security` / `system`。

### 2.2 页面模块组织

页面**以单文件为主**，复杂时才拆。目录与文件用小写 kebab-case：

```
views/system/user/
├── index.vue           # 页面主入口（当前该页就是单文件）
└── components/         # 页面私有子组件（可选）
views/system/org-chart/ # 多词目录用 kebab-case
views/components/table/crud/
├── index.vue
└── components/
```

拆分信号（满足任一才拆）：

- 单个 `.vue` 超过约 300 行，且模板里有明显独立的区块
- 某段 UI 在本页出现 ≥ 3 次
- 有独立的内部状态，且不需要与主页面共享

拆分时的可选单元（按需取用，不要为了凑齐目录而建空文件）：

| 文件               | 放什么                                        |
| ------------------ | --------------------------------------------- |
| `components/*.vue` | 页面私有子组件，PascalCase 命名               |
| `constants.ts`     | 模块内的映射表、样式类名常量                  |
| `types.ts`         | 模块内类型（跨包共享的类型放 `@antdv/types`） |
| `utils.ts`         | 模块内纯函数                                  |

反例：给每个页面预先建 `actions.ts` / `columns.ts` / `schemas.ts` 再往里塞，是形式主义。表格列与表单 schema 跟着页面走，页面不到 300 行就留在 `index.vue`。

### 2.3 子包目录

子包不按「页面模块」组织，按「能力」组织：

```
packages/core/ui-kit/table-ui/src/
├── BasicTable.vue
├── useTable.ts
├── types.ts
├── hooks/          # 内部分解的子 hook（useTableApi / useTableRows…）
├── components/     # 子包内部组件
└── index.ts        # 唯一出口
```

**子包只从 `index.ts` 或显式登记的 `exports` 子路径导出**，不要让调用方深入到 `src/hooks/xxx.ts` 这种内部路径（`exports` 没登记的路径在别的包里解析不到）。

---

## 3. 命名约定

| 类型 | 规范 | 真实示例 |
| --- | --- | --- |
| 组件文件 | PascalCase | `BasicTable.vue`、`RecordDetailDrawer.vue`、`SettingsPanel.vue` |
| 页面 / 工具目录 | kebab-case | `views/system/org-chart/`、`login-log/`、`micro-app/` |
| 变量 / 函数 | camelCase | `handleSelectionChange`、`clearSelection`、`fetchTaskList` |
| 组件 `name` | PascalCase | `defineOptions({ name: 'SystemUser' })` |
| 类型 / 接口 | PascalCase | `UserRecord`、`TaskFormValues`、`ActionItem` |
| 全局常量 | UPPER_SNAKE_CASE | `LOGIN_PATH`、`NOTIFICATION_TOASTER_ID` |
| 模块内映射表 | UPPER_SNAKE_CASE | `STATUS_COLOR`、`STATUS_LABEL`、`PRIORITY_LABEL` |
| 样式类名常量 | camelCase + `ClassName` 后缀 | `containerClassName`、`toolbarClassName`、`treeCardClassName` |
| 事件 | camelCase 动词短语 | `onChange`、`handleSave`、`beforeDelete` |
| CSS 类 | Tailwind 原子类优先 | `cn('flex', 'items-center', 'gap-2')` |
| 布尔值 | `is` / `has` / `can` / `show` 前缀 | `isEditing`、`hasPermission`、`canAdd`、`showSizeChanger` |

两条容易写错的：

- **样式类名常量用 camelCase**（`containerClassName`），不要写成 `CONTAINER_CLASS_NAME`——它不是一个配置值，而是一个组件内的字符串绑定。
- **映射表用 UPPER_SNAKE**（`STATUS_COLOR`），因为它是不变的查表配置。

---

## 4. Vue 组件规范

### 4.1 `<script setup>`

- 必须 `lang="ts"`（渲染函数用 `lang="tsx"`）
- 必须 `defineOptions({ name: 'PascalCase' })`
- 不写 options API，不用 `mixins`
- 组件自闭合标签带 `/`（`<Icon ... />`），模板属性多于 3 个时换行

### 4.2 import 排序

由 `perfectionist` 插件强制，顺序固定：

```ts
// 1. 类型导入（type-only），按来源字母序
import type { FormSchema } from '@antdv/form-ui';
import type { ActionItem, BasicColumn } from '@antdv/table-ui';

import { computed, onMounted, ref } from 'vue'; // 2. vue 运行时

import { Card, Tag } from '@antdv/common-ui'; // 3. workspace 内部包（字母序）
import { BasicForm, useForm } from '@antdv/form-ui';
import { useCRUD, usePermission } from '@antdv/hooks';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue'; // 4. 第三方（字母序）

import { addTask, getTaskList } from '~/api/demo'; // 5. 别名路径（~ / #）

import RecordDetailDrawer from '../components/RecordDetailDrawer.vue'; // 6. 相对路径
```

`pnpm format` 会自动排；手写时按上面的分组留空行。

### 4.3 props / emits / v-model

```ts
defineProps<{
  collapsed?: boolean;
  horizontal?: boolean;
}>();

defineEmits<{
  toggleCollapsed: [];
  topMenuSelect: [key: string];
}>();

const visible = defineModel<boolean>('visible', { default: false });
```

- 用泛型写法，不用 runtime props 对象
- 布尔 prop 用 `is` / `has` / `show` 前缀，默认值在 `withDefaults` 或解构默认值里给
- 事件名用 camelCase（`@ok`、`@change`、`@register`），不要写 kebab-case

### 4.4 模板结构顺序

`<template>` 内按此顺序，空行分隔：根容器 → 页头 → 工具栏插槽 → 主体（表格 / 表单）→ 弹窗 → 其他。

复杂 class 不写在模板里，抽到 `constants.ts` 或用 `cn()` 组合后在 script 里命名：

```ts
const containerClassName = cn('grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]');
const headerClassName = cn('lg:col-span-2');
```

---

## 5. 状态管理

### 5.1 分层

| 位置 | Store | 职责 |
| --- | --- | --- |
| `packages/stores` | `useUserStore` | 凭证 + 用户信息，**登录态的唯一起点** |
| `packages/stores` | `useAppStore` | 偏好派生视图（主题、布局、语言） |
| `packages/stores` | `useRouteStore` | 菜单即权限、动态路由注册 |
| `packages/stores` | `useTabsStore` | 标签页 |
| `apps/web/src/stores` | `useDictStore` | 字典数据（带 1 小时本地缓存） |

- 认证统一用 `@antdv/stores` 的 `useUserStore()`（`token` / `permissions` / `roles` / `initToken()` / `logout()`）。
- `apps/web/src/stores/modules/auth.ts` 里的 `useAuthStore` 是未使用的历史遗留，**不要在新代码里引用，也不要往里加字段**。
- `apps/web/src/stores/index.ts` 只做 re-export，不放实现。

### 5.2 写法

- setup 语法（`defineStore('user', () => {...})`），不用 options 语法
- 不存 DOM、组件实例、定时器句柄
- 模块级单例（如 `~/utils/ws` 的连接）要在注释里写明「单例」与清理责任方
- 派生数据用 `computed`，不要在模板里现算

### 5.3 持久化

- 显式写 `cache`（`@antdv/shared/cache`，SM4 加密），key 统一放 `@antdv/enums` 的 `CacheKey`
- `useDictStore` 的缓存格式带 `loadedAt`，超过 1 小时视为过期——新增缓存照此模式写，不要无限期信任本地数据
- **不要**引入 `pinia-plugin-persistedstate` 做全量持久化（会连敏感字段一起落盘）

---

## 6. HTTP 请求

### 6.1 分层

```
组件 → api/*.ts（业务函数）→ ~/api/request（get/post/put/del）→ @antdv/request（http）
```

- `@antdv/request` 只负责传输：CSRF、令牌刷新、401 收尾、去重、超时、qs 序列化。凭证从哪取、登录页在哪，由 `apps/web/src/plugins/request-runtime.ts` 的 `configureRequest()` 注入。
- `~/api/request.ts` 负责**信封拆解**：后端约定 HTTP 恒为 200，成败放在 `{ code, data, message }` 的 `code` 上；`unwrap()` 在 `code !== 200` 时抛 `ApiBusinessError`。
- 因此业务函数拿到的就是 `data` 本身，**不要再 `.data` 一次**（再取一次会得到 `undefined`，表现是「保存成功但表格没新行」）。

### 6.2 接口定义

所有接口集中在 `apps/web/src/api/<域>.ts`，返回类型显式写出：

```ts
import { get, post } from '~/api/request';

export interface TaskRecord {
  id: number;
  title: string;
  status: 'blocked' | 'done' | 'pending' | 'running';
}

export function getTaskList(params: Record<string, unknown>) {
  return get<{ list: TaskRecord[]; total: number }>('/demo/task/list', params);
}

export function updateTask(id: number, values: Record<string, unknown>) {
  return post<TaskRecord>(`/demo/task/update/${id}`, values);
}
```

组件里只 `import { getTaskList } from '~/api/demo'`，**不要**在组件里直接 `http.Get`。

### 6.3 参数与方法的坑

- `get(url, params)` 的**第二个实参就是查询串本身**，不要再包 `{ params }`。包一层后发出去的是 `?params=[object Object]`，表现是「搜索框输什么都一样、翻页还是第一页」。
- 路径与方法以后端为准，不要臆测：本仓库更新用 `POST /xxx/update/:id`、删除用 `DELETE /xxx/remove/:id`（见 `api/system.ts`）。后端是 POST 就别写 PUT。
- 分页参数是 `pageNum` / `pageSize`，表格的搜索条件会被 `useDataSource` 摊平到顶层，直接把 `params` 转给接口即可。

### 6.4 错误处理

- 传输错误（4xx / 5xx / 超时 / 401）由 `@antdv/request` 统一处理，业务代码**不需要** try/catch 再弹一次 toast。
- 业务错误（`code !== 200`）会抛 `ApiBusinessError`，需要额外反馈时 catch：

```ts
try {
  await updateTask(id, values);
} catch (error) {
  message.error(error instanceof Error ? error.message : '操作失败');
}
```

- 只在需要**额外**逻辑（成功后刷新、失败后回滚）时 catch，纯粹为了 toast 而 catch 是重复提示。

### 6.5 服务端查询（可选）

需要缓存、重试、失效策略的只读查询走 `@antdv/request/vue-query` 的 `setupVueQuery(app)`；普通列表 / 表单提交继续用 `api/*.ts`，不要为了统一而把所有请求塞进 vue-query。

---

## 7. 实时通信

### 7.1 WebSocket

**必须用单例** `~/utils/ws`：

```ts
import { useWebSocket } from '~/utils/ws';

const ws = useWebSocket();
const off = ws.onNotice((notice) => {
  /* ... */
});
onUnmounted(() => off()); // 订阅函数返回解订函数
```

- 禁止自己 `new WebSocket`
- 禁止在多个组件里各自调 `useWebSocket()`（底层已经是单例，但每处调用都要解订）
- 禁止把监听器重复挂到 `socket.on('message')` 上
- 消息类型：`notice`（站内通知）、`force-logout`（强制下线，短横线）、`connected`（连接确认）；`noticeTypeConfig` 里维护类型 → 文案 / 图标 / 颜色的映射

### 7.2 SSE

走 `@antdv/request` 的 SSE 出口，不要在页面里手写 `EventSource`。AI 对话的流式渲染见 `ai-flow` 的 `composables/`。

---

## 8. 样式

### 8.1 优先级

1. Tailwind 原子类
2. `cn()` 合并（`clsx` + `tailwind-merge`，来自 `@antdv/shared/utils/cn`）
3. `:deep()` 修改第三方组件内部
4. `<style scoped>`（仅在前三者都做不到时）

### 8.2 规则

- 全局样式**只从** `apps/web/src/styles/index.css` 一条链引入：先引 `@antdv/design`，再逐条引各 `ui-kit` 子包的 `style.css`。分成多条 JS import 会让工具类静默不生成。
- 子包组件样式随组件放，`@antdv/design` 只登记它们的 Tailwind 扫描路径。
- 设计变量只来自 `@antdv/design` 的 token（`default` / `dark` + 13 套 `[data-theme]` 预设），不要自己另起一套色值。
- 不要写 `!important`；确实需要覆盖第三方时用 `:deep()` + 提高选择器特异性。
- 类名常量按第 3 节命名为 `xxxClassName`；需要条件组合时用 `cn()` 而不是模板里拼字符串。

---

## 9. 表格（BasicTable + useTable）

### 9.1 基本结构

```vue
<script setup lang="ts">
import type {
  ActionItem,
  BasicColumn,
  FetchParams,
  Recordable,
} from '@antdv/table-ui';

import { computed, ref } from 'vue';

import { BasicTable, useTable } from '@antdv/table-ui';
import { getTaskList } from '~/api/demo';

// 第二个返回值是 Ref<TableActionType | null>，不是方法对象：
// 调实例方法必须写 tableRef.value?.reload()
const [tableRegister, tableRef] = useTable();
const selectedRows = ref<Recordable[]>([]);

async function fetchTaskList(params: FetchParams) {
  return getTaskList(params as unknown as Record<string, unknown>);
}

const columns = computed<BasicColumn[]>(() => [
  { title: '任务标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 140 },
]);
</script>

<template>
  <BasicTable
    :columns="columns"
    :api="fetchTaskList"
    :use-search-form="true"
    :form-config="{ schemas: searchSchemas, labelWidth: 72 }"
    :action-column="{ width: 180, title: '操作', fixed: 'right', actions }"
    :row-selection="{ type: 'checkbox', onChange: handleSelectionChange }"
    :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
    :scroll="{ x: 1100 }"
    row-key="id"
    @register="tableRegister"
  >
    <template #toolbar> ... </template>
    <template #cell-status="{ record }"> ... </template>
  </BasicTable>
</template>
```

### 9.2 约定

- 列定义用 `computed<BasicColumn[]>`，不要传静态数组（权限 / 字典变化时要能重算）
- 自定义单元格用 `#cell-<field>` 插槽；表头样式用 `#headerCell`，不要覆盖 cell 的全局样式
- 数据源必须由 `api` prop 注入，表格内部不内置请求；返回结构是 `{ list, total }`
- 操作列用 `ActionItem[]`，权限码写在 `auth` 字段，由 `TableAction` 内部问 `usePermission`，页面**不再**手写 `v-if="hasPermission(...)"` 包按钮
- 不可逆操作（删除）用 `popConfirm` 描述确认框，不要在模板里另拼 `Modal.confirm`
- 列多时给 `:scroll="{ x: ... }"` 或 `table-layout="fixed"`，避免列宽错乱

---

## 10. CRUD（useCRUD）

`useCRUD` 在 `@antdv/hooks`，把「校验 → 落库 → 关窗 → 刷新」这条固定序列收敛掉。分工必须清楚：

- `useTable` 管数据源与分页
- `useModal` / `useDrawer` + `useForm` 管容器与表单实例
- `useCRUD` 只接这三样，持有 `isEditing` 与当前行

```ts
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();
const [tableRegister, tableRef] = useTable();

const {
  isEditing,
  handleAdd,
  handleEdit,
  handleSave,
  handleDelete,
  handleBatchDelete,
  loading: submitting,
} = useCRUD<TaskRecord, TaskFormValues>({
  containerType: 'modal',
  modalMethods,
  formMethods,
  tableMethods: tableRef,
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
    createSuccess: '任务已创建',
    updateSuccess: '任务已更新',
    deleteSuccess: '任务已删除',
    batchDeleteConfirm: '确定删除选中的任务吗？',
  },
});
```

约定：

- **编辑前用 `onFetchDetail` 拉详情**。列表接口为省流量常裁字段，直接拿行数据回填会把没下发的字段提交成空值（「改个状态，备注没了」）。
- 单条删除的确认由操作项的 `popConfirm` 负责，`handleDelete` 自己不弹；**批量删除保留 `useCRUD` 内置的那一次确认**，页面不要再补一层。
- 批量删除前先取快照（`[...selectedRows.value]`），确认框是非阻塞的，传引用会和表格选中态对不上。
- 删完要清选中态：`tableRef.value?.clearSelectedRowKeys?.()`。
- 新增页面优先用 `useCRUD`；`views/system/user` 是手写版本（`isEditing` + `currentRecord` 约 120 行），属于历史样本，不要照着它再抄一遍。

---

## 11. 表单（BasicForm + useForm）

### 11.1 schema 必须可重算

schema 依赖响应式数据（字典、选项、编辑态）时，用 `computed` 包裹整个数组：

```ts
const editSchemas = computed<FormSchema[]>(() => [
  {
    field: 'title',
    label: '任务标题',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入任务标题', maxlength: 40 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    defaultValue: 'pending',
    componentProps: { options: statusOptions.value, placeholder: '请选择状态' },
  },
]);
```

**不要**传静态数组，字典异步到位后 schema 不会更新。

### 11.2 组件与属性

- 常用 `component`：`Input`、`InputTextArea`、`InputNumber`、`Select`、`RadioGroup`、`DatePicker`
- 栅格用 `colProps: { span: 8 | 12 | 24 }`
- 日期固定 `valueFormat: 'YYYY-MM-DD'`。不写的话表单值是 dayjs 对象，提交后被 `String()` 成 `"Mon Oct 12 2026 …"` 这种没法看的串
- 单位写进 `label`（如「进度（%）」），不用 `addonAfter`（该属性已废弃，会播报 deprecation 警告，端到端巡检会当真错误收）
- 搜索表单与编辑表单分开两份 schema，不要复用（字段、必填、栅格都不一样）

### 11.3 实例方法

`useForm()` 返回 `[register, formMethods]`；`formMethods` 提供 `validate` / `resetFields` / `clearValidate` / `setFieldsValue`。手写 CRUD 时才直接调，用 `useCRUD` 时交给它。

---

## 12. 权限

三道口子，按场景选：

| 场景               | 写法                                                 |
| ------------------ | ---------------------------------------------------- |
| 模板里控制按钮显隐 | `v-permission="'user:create'"`                       |
| 脚本里判断         | `const { hasPermission, hasRole } = usePermission()` |
| 表格操作项         | `ActionItem` 的 `auth: 'demo:task:edit'`             |

- 超管权限码是 `['*']`，`hasPermission` 会全通
- 权限列表是登录后异步回填的：`v-permission` 通过 `watch(() => useUserStore().permissions)` 订阅，数据到位后自己翻正，不需要页面手动触发重渲染
- 不要在 `packages/*` 里直接 `useUserStore()`；指令的判定函数由 `apps/web/src/directives/index.ts` 注入
- 路由级权限由后端菜单树驱动（`useRouteStore` 的「菜单即权限」），不要在页面里再写一套路由守卫

---

## 13. 路由

### 13.1 路由表

- 静态路由在 `apps/web/src/router/routes.ts` 的 `constantRoutes`，**不参与权限判断的页面必须标 `requiresAuth: false`**（否则未登录页 / 兜底 404 会被动态菜单守卫判成无权限）
- 隐藏页标 `hidden: true`；无布局页标 `layout: 'blank'`
- 业务页面走文件约定式路由（`vite-plugin-vue-layouts-next`）生成，不要手写进 `constantRoutes`
- 标签页「刷新当前」依赖 `/redirect/:path(.*)` 这条显式路由，不要删

### 13.2 守卫

守卫在 `packages/router`，只做登录校验、动态菜单注册、标题、进度条、权限过滤。它不 import store / api，状态由应用注入。

### 13.3 路径顺序

服务端与前端兜底路由都是「先具体、后通配」：

```
✅ /user/export → /user/options → /user/detail/:id → /user/:id
❌ /user/:id 放前面，会吃掉 /user/export
```

---

## 14. 应用启动与宿主注入

`apps/web/src/main.ts` 的顺序是硬约束，改动前先读文件里的注释：

1. `createApp` → `app.use(pinia)` → `app.use(i18n)`
2. `configureRequestRuntime()`（凭证来源与登录页路径，第一发请求前必须接好）
3. `configureUiKitRuntimes()`（ui-kit 的文案靠注入的 `t`，不认 vue-i18n；漏接的症状是按钮上出现 `shell.exitFullContent` 这类裸 key）
4. `configureLayoutsHost()`、`configureTableRuntime()`
5. `getPreferences()`（幂等的「第一次赢」，必须早于路由，否则被包默认值占位）
6. `bootstrap()`：`await useUserStore().initToken()` → `setupRouter(app)` → `app.mount('#app')`

要点：

- **`initToken()` 必须早于 `setupRouter`**：`app.use(router)` 会立刻发起首次导航，守卫在那一刻就去取 `/menus`。晚一步的表现是「每次刷新都要重登」（`token` 里还是 JWE 密文）。
- 新增宿主能力时，在 `plugins/` 下开一个 `configureXxx()`，不要在子包里读 `~/`。
- `app.directive` 注册的五个指令名固定：`safe-html` / `escape` / `permission` / `lazy` / `loading`。

---

## 15. 安全

### 15.1 XSS

- 默认插值已自动转义
- 渲染 HTML 用 `v-safe-html`
- 文本 / URL / JS 片段转义用 `v-escape`（`v-escape="value"`、`v-escape:url="url"`、`v-escape:js="code"`）
- 处理用户提供的 URL 用 `@antdv/shared` 的 `sanitizeUrl`

### 15.2 CSRF

`initSecuritySystem({ csrfHeaderName: 'X-CSRF-Token', enableDoubleSubmit: true, autoRotateToken: true })` 在入口初始化。新增写接口不需要单独处理，但改传输层时要保证这个头继续带上。

### 15.3 凭证

- 内存里的 `token` 是明文，落盘的是 `cache`（SM4）里的 JWE 密文；**不要把密文当凭证用**
- 不把 token 拼进 URL，不在 console 打印 token
- `password` / `token` 不进 `localStorage`
- 用户信息只 pick 需要的字段，不要把接口返回的整个 user 对象塞进 store

---

## 16. 环境变量

- 只有 `VITE_` 前缀会暴露给前端；密钥**不进** `VITE_*`
- 环境文件：`.env` / `.env.development` / `.env.production`（在 `apps/web` 下）
- `vite-plugin-env-parse` 会生成 `types/env.d.ts`，新变量加完重新跑 dev 才有类型
- 现有变量：`VITE_APP_BASE_API`（请求基地址）、`VITE_SENTRY_DSN`
- 分支判断用 `import.meta.env.DEV` / `PROD`，不要自己读 `NODE_ENV`

---

## 17. 国际化

- i18n 实例在 `apps/web/src/locales/index.ts`，文案表 `lang/zh-CN.ts` / `lang/en-US.ts`，两边 key 必须同步
- locale 的**唯一真相**是偏好里的 `locale`（`@antdv/hooks` 的 `useLocaleSync`），不要在别处再存一份，否则切换时只有一半界面跟着变
- 框架层文案必须走 `$t()`；ui-kit 包（布局壳 / 菜单 / 标签栏）不认 vue-i18n，靠 `configureUiKitRuntimes()` 注入的 `t`
- 业务页面当前以中文直写为主；新增多语言页面时，同时补 `zh-CN` 与 `en-US` 两份 key，key 命名用 `模块.功能.描述`

---

## 18. TypeScript

### 18.1 禁止 `any`

用 `unknown` + 类型守卫：

```ts
// ❌
function parse(data: any) {
  /* ... */
}

// ✅
function parse(data: unknown): User {
  if (!isUser(data)) throw new Error('invalid');
  return data;
}
```

确实需要「任意记录」时用 `@antdv/table-ui` 的 `Recordable`，而不是 `any`。

### 18.2 类型导入与来源

- 类型导入一律 `import type`
- 跨包共享类型放 `@antdv/types`；只在单个包内使用的类型留在该包的 `types.ts`
- 给组件 props 用泛型约束，不要用 `Object` / `Function`

### 18.3 类型断言

- 优先类型守卫（`isPromptOutput`、`isUser` 这类带 `value is T` 的谓词）
- `as unknown as T` 只用在边界（接口返回 → 业务类型、`Recordable` → 具体记录），并在注释里说明为什么形状对不上
- 禁止 `@ts-ignore`；能用 `@ts-expect-error` 并写明原因

---

## 19. 性能

- 大列表用虚拟滚动（`vue-virtual-scroller` 或表格的 `virtual`）
- 图表 / 大对象用 `shallowRef` / `markRaw`，避免深层响应式代理
- 频繁触发的回调（搜索、resize、滚动）用 `@vueuse/core` 的 `useDebounceFn` / `useThrottleFn`
- 路由与重组件懒加载（`defineAsyncComponent` / 动态 `import()`）
- 不在 `setup` 顶层做重计算；用 `computed` 工厂函数
- 表格列定义、表单 schema 用 `computed`，避免每次渲染重建
- `@antdv/common-ui` 的重依赖按域走子路径导出（`ai-flow` / `workflow` / `lowcode` / `report` / `im`），不要从根入口整包引入

---

## 20. 包边界与子包构建

### 20.1 依赖方向

```
apps/web  →  layouts / stores / router / request / 全部 ui-kit
packages  ✗→  pinia / vue-router / 宿主 ~/      （stores 可用 pinia；layouts 可读 stores + vue-router）
ui-kit 下层  ✗→  ui-kit 上层                    （shadcn-ui 是地基，不能被上层反向依赖）
```

- 跨包能力一律依赖注入：`configureXxx()` 在 `apps/web/src/plugins/` 里接线
- 子包禁止 import 宿主 `~/api`、`~/stores`、`~/config`
- 新增跨包依赖后跑 `pnpm check:dep` 与 `pnpm check:circular`

### 20.2 构建标准

禁止「某些包 build、某些包只热更新」的混配：

- 每个子包必须有 `build`；纯 JSON / CSS 预设包（`tsconfig`、`stylelint-config`、`commitlint-config`）除外，例外要在守卫脚本里登记理由
- `stub` 不能是唯一构建方式；要留必须与真 `build` 并存
- 按源码发布（`exports` 指向 `./src/**`）的包：`vite.config.mts` 写 `defineLibraryConfig()`，`build` 用 `vite build`，**不挂自己的 `dev` / `watch`**（热更新由宿主应用的 dev server 提供）
- 按产物发布（`exports` 指向 `./dist/**`）的包与 `internal/*`、`scripts/*`：`build` 用 `pnpm exec tsdown`，`files` 必须列出 `dist`
- 提交前跑 `pnpm check:builds`；`exports` 每个子路径是否有产物由包内 `antdv:validate-dist` 在构建期把关

### 20.3 Lint 规则归属

改 lint 规则改 `internal/lint-configs/*`，**不要**在子包或应用里本地覆盖。格式与静态检查走 oxlint / oxfmt（`vsh lint` / `vsh lint --format`），ESLint / Stylelint / cspell 是补充门禁。

---

## 21. 测试

- 单测放在被测文件同目录的 `__tests__/<name>.spec.ts`（如 `packages/core/hooks/__tests__/use-crud.test.ts`、`apps/web/src/api/__tests__/`）
- 单测环境 `happy-dom` + `vitest`；`@vue/test-utils` 做组件测试
- e2e 在 `apps/web/playwright.config.ts`，**chromium / firefox / webkit 三引擎全绿才算通过**
- 只读查询优先断言行为，不要断言实现细节（内部 ref 名、私有方法）
- 状态 / 数据模型变更必须同步更新 `apps/backend-mock` 的 SQLite 数据与测试

常用命令：`pnpm test:unit`、`pnpm test:e2e`、串行跑单测 `pnpm exec turbo run test:unit --concurrency=1`。

---

## 22. AI 编排引擎（ai-flow）

位置：`packages/core/ui-kit/common-ui/src/ai-flow/`。核心原则：**引擎不绑供应商、不碰密钥、不 import 宿主**。

### 22.1 目录分层

```
ai-flow/
├── core/          # 纯 TS，不 import vue，不持跨进程状态（可独立单测）
│   ├── provider.ts     # Provider 抽象 + OpenAI 兼容实现
│   ├── registry.ts     # 节点语义注册表（内置八种节点即注册表条目）
│   ├── runner.ts       # 运行器：边路由 / 并发 / 重试 / 超时 / 取消
│   ├── tools.ts        # 工具注册表 + 工具循环
│   ├── memory.ts       # 会话记忆窗口化（字符预算，非 token）
│   ├── prompt.ts       # 提示词组装与渲染
│   ├── output-parser.ts# 结构化输出解析（json / schema / expression）
│   ├── validate.ts     # 图校验
│   ├── errors.ts       # 带 code 的可诊断错误
│   └── types.ts        # 对外契约
├── config.ts      # 全局接线点（configureAiFlow / createConfiguredAiRunner）
├── composables/   # use-ai-flow 等 Vue 侧封装
└── components/    # AiFlowCanvas / AiNodeInspector / AiRunPanel
```

分层铁律：逻辑进 `core/`，接线进 `config.ts`，Vue 响应式只在 `composables/` 与 `components/`。`core/` 里不许出现 `ref` / `computed` / `import.meta.env`。

### 22.2 Provider 模型无关、不碰密钥

- `core/` 没有任何凭据字段：没有 `apiKey`、没有隐式默认 `baseUrl`、不读环境变量
- 发 HTTP 的唯一入口是 `createFetchAiProvider({ baseUrl, fetcher })`，两者都由宿主传入；缺一即抛 `provider-fetcher-missing` / `provider-base-url-missing`。**不许猜默认端点**
- 模型用别名（`configureAiFlow({ models: { default, fast } })`），别名到真实 id 的映射只发生在 `withModelAliases` 一层；换供应商只动配置，`core/` 一行不改

```ts
configureAiFlow({
  provider: createFetchAiProvider({
    baseUrl: '/api/ai', // 走宿主网关，不直连第三方
    fetcher: (url, init) => fetch(url, { ...init, credentials: 'include' }),
  }),
  models: { default: 'gpt-4o-mini', fast: 'gpt-4o-mini' },
});
```

### 22.3 节点与工具走注册表

- 内置八种节点：`start` / `end` / `prompt` / `llm` / `tool` / `transform` / `condition` / `human`，它们本身就是注册表条目
- 运行器里**不许出现** `if (node.type === 'llm')`；覆盖内置节点只需注册同名 `kind`（后注册者胜）
- 新增节点类型 = 写 `AiNodeHandler` 再 `register`，运行器与图校验都不改
- 工具走 `createToolRegistry` / `ToolSpec[]`；引用了未注册的工具名要在**运行前**报 `unknown-tool`，不要等模型点名调用

### 22.4 接线与测试隔离

- `configureAiFlow()` 是增量合并，各功能模块分别注册自己的工具与处理器
- `createAiRunner(options)` 只认显式 options，单测用它配脚本回放的 Provider；`createConfiguredAiRunner()` 才读运行时配置
- `resetAiFlowRuntime()` 隔离全局态
- 缺配置抛带 code 与下一步动作的错误，不做「自动挑一个能用的 Provider」
- `evaluatorContext` 只放常量级配置（租户、时区、特性开关），不放用户数据

### 22.5 运行态与事件

- 运行态可序列化（`runId` / 节点产出 `values` / 事件流），以便画布回放
- 事件通过 `ctx.emit` 派发（`run.started` / `node.started` / `node.chunk` / `node.finished` / `node.output` / `run.awaiting` / `run.finished` / `run.log`）
- 处理器只回答「这一步往哪走、交出什么」；边路由 / 并发 / 重试 / 超时由 runner 统一负责
- 超时与取消通过 `ctx.withTimeout` / `ctx.abort` 向处理器要协作

### 22.6 记忆窗口

- 预算是**字符数**（`maxChars`）不是 token：引擎不绑供应商就没有可信 tokenizer；`estimateTokens` 按「英文约 4 字符/token、中文约 1.5、混合按 2」粗估
- 不做向量召回、不做分层永久记忆；超窗只做两件事：压摘要、留最近若干轮
- 顺序必须是「先落摘要、再裁旧轮」，否则会出现一段历史既不在窗口也没进摘要
- 已有摘要并进新摘要的 `carryover`，不许滚成两条 system

### 22.7 流式

- `data.stream && ctx.provider.stream` 都成立才走流，否则退化到 `invoke`
- 流式循环里自己收口取消（`if (ctx.abort.aborted) break`）：Provider 的 `for-await` 不一定响应 abort，不处理的话 cancel 要等整条流跑完
- SSE 只在 Vue 侧用；`core/` 的流式是与 Provider 无关的 `AsyncIterable`

---

## 23. 提交与协作

- 提交信息符合 **Angular 规范**：`pnpm commit`（cz-git）交互式生成；type 用 `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf` / `build` / `ci` / `style`
- 一次提交只做一件事；格式化改动与逻辑改动分开提交
- 涉及行为变更的提交要补 changeset（`pnpm changeset`）
- 引入新依赖前执行 `pnpm audit`，有安全漏洞先修再用
- 交付前门禁：`pnpm test:unit` + `pnpm check:type` + `pnpm test:e2e`；动了包边界或构建配置再加 `pnpm check`
