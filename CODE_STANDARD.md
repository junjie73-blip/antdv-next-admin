## 1. 目录组织

```
views/system/user/
├── index.vue           # 页面主入口
├── actions.ts          # 表格行操作（无状态，ctx 注入）
├── columns.ts          # 表格列定义
├── schemas.ts          # 表单 schema（搜索 / 弹窗）
├── constants.ts        # 常量 / 映射 / 样式类名
├── types.ts            # 模块类型
├── utils.ts            # 模块工具
└── components/         # 子组件（可选）
```

**模块必须拆到这个粒度**，不要把所有逻辑堆在 `index.vue`。

---

## 2. 命名

| 类型        | 规范                         | 示例                          |
| ----------- | ---------------------------- | ----------------------------- |
| 组件文件    | 大驼峰                       | `UserTable.vue`               |
| 页面目录    | 小写                         | `views/system/user/`          |
| 变量 / 函数 | 小驼峰                       | `handleAdd` / `fetchUserList` |
| 常量        | 大写下划线                   | `USER_STATUS_MAP`             |
| 类型 / 接口 | 大驼峰                       | `UserRecord`                  |
| CSS 类      | Tailwind 优先，复杂用 `cn()` | `cn("flex", "gap-2")`         |

---

## 3. Vue 组件规范

### 3.1 `<script setup>`

- **必须** `lang="ts"` 或 `lang="tsx"`
- `defineOptions({ name: "..." })` 显式命名
- import 顺序：类型 → 三方库 → 项目内部 → 相对路径

### 3.2 类型定义

- `defineProps<{...}>()` 泛型写法，**不用 runtime props**
- `defineEmits<{ event: [args] }>()` 泛型写法
- `defineModel` 用于 v-model 双向绑定

```ts
defineProps<{
  collapsed?: boolean;
  horizontal?: boolean;
}>();

defineEmits<{
  toggleCollapsed: [];
  topMenuSelect: [key: string];
}>();
```

### 3.3 组合式函数

- 复用的逻辑抽到 `composables/`
- 有副作用的返回值显式列出
- 命名 `useXxx`

---

## 4. 状态管理（Pinia）

### 4.1 定义

```ts
export const useUserStore = defineStore("user", () => {
  const token = ref<string | null>(null);
  // ...
  return { token, login, logout };
});
```

- 用 setup 语法（不用 options）
- 不在 store 里存 DOM / 组件实例

### 4.2 Store 职责

| Store           | 职责                             |
| --------------- | -------------------------------- |
| `useUserStore`  | **唯一**的用户态 + 登录/登出入口 |
| `useAppStore`   | 主题、布局、语言、设置           |
| `useRouteStore` | 动态路由                         |
| `useDictStore`  | 字典数据                         |

> ❌ `useAuthStore` 已废弃，**不要使用**

### 4.3 持久化

- 关键数据手动写 `localStorage`（或走 `cache`）
- **不要**用 `pinia-plugin-persistedstate` 全量持久化（会漏敏感数据）

---

## 5. HTTP 请求

### 5.1 API 定义

所有接口在 `api/*.ts` 集中定义：

```ts
// api/system.ts
export function getUserList(params) {
  return get<{ list: any[]; total: number }>("/user/list", params);
}
```

组件里只 import 函数，不直接 `http.Get`。

### 5.2 路径约定（与后端一致）

| 操作 | 方法   | 路径                                     |
| ---- | ------ | ---------------------------------------- |
| 列表 | GET    | `/xxx/list`                              |
| 详情 | GET    | `/xxx/detail/:id` 或 `/xxx/:id`          |
| 创建 | POST   | `/xxx`                                   |
| 更新 | POST   | `/xxx/update/:id`（**部分后端用 POST**） |
| 删除 | DELETE | `/xxx/remove/:id` 或 `/xxx/:id`          |

**后端用什么方法就用什么方法，不要臆测**。

### 5.3 错误处理

alova 已统一处理：
- 401 → 自动刷新，失败跳登录
- 4xx → 弹后端 message
- 5xx → 弹"服务器繁忙"

业务组件**不需要** try/catch 做 toast，只在需要**额外**逻辑（如成功后刷新列表）时 catch。

---

## 6. WebSocket

**必须用单例** `useWs()`：

```ts
const ws = useWs();
const off = ws.onNotice((notice) => { ... });
onUnmounted(() => off());
```

❌ 不要自己 `new WebSocket`。
❌ 不要在多个组件里各自调 `useWebSocket`。
❌ 不要把监听器挂在 `socket.on("message")` 上多次。

**消息类型**：

```ts
type: "notice"          // 站内通知
type: "force-logout"    // 强制下线（短横线）
type: "connected"       // 连接确认
```

---

## 7. 样式

### 7.1 优先级

1. Tailwind 原子类
2. `cn()` 合并（`clsx` + `tailwind-merge`）
3. `:deep()` 修改第三方组件
4. `<style scoped>`（仅在必须时）

### 7.2 复杂样式抽离

```ts
// constants.ts
export const containerClassName = cn("space-y-4");
export const cardClassName = cn("shadow-sm", "rounded-lg");
```

模板里引用：

```vue
<div :class="containerClassName">
```

---

## 8. 表格（BasicTable + useTable）

标准用法：

```vue
<script setup lang="ts">
const [tableRegister, tableMethods] = useTable();

async function fetchApi(params: Record<string, any>) {
  return await getUserList(params);
}
</script>

<template>
  <BasicTable
    :columns="userColumns"
    :api="fetchApi"
    :immediate="true"
    :use-search-form="true"
    :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
    :action-column="userActionColumn"
    :row-key="userRowKey"
    :pagination="userPagination"
    @register="tableRegister"
  >
    <template #cell-status="{ record }"> ... </template>
    <template #action="{ record }"> ... </template>
  </BasicTable>
</template>

```

- `columns.ts` 定义列
- `schemas.ts` 定义搜索/弹窗表单
- `actions.ts` 定义行操作（无状态 + ctx）
- `pagination.ts` 定义分页配置
- `api.ts` 定义 API 函数
- `constants.ts` 定义常量值
- `types.ts` 定义类型
---

## 9. CRUD（useCRUD）

```ts
const { isEditing, handleAdd, handleEdit, handleSave, handleDelete } = useCRUD<UserRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "userId",
  getEmptyValues: () => ({ ...USER_EMPTY_VALUES }),
  getFormValues: (record) => ({ ... }),
  onCreate: async (values) => { await addUser(values); },
  onUpdate: async (id, values) => { await updateUser(id, values); },
  onDelete: async (record) => { await deleteUser(record.userId); },
  messages: {
    createSuccess: "创建成功",
    updateSuccess: "更新成功",
    deleteSuccess: "删除成功",
  },
});
```

**删除确认由操作项的 `popConfirm` 负责**，关闭 `useCRUD` 内置 Modal.confirm，避免双重确认。

---

## 10. 权限

### 10.1 按钮级

```vue
<a-button v-permission="'user:create'">新增</a-button>
```

### 10.2 路由级

后端返回菜单树 → `useRouteStore.initBackendRoutes()` → 动态注册。

### 10.3 Store 读取

```ts
const userStore = useUserStore();
if (userStore.hasPermission("user:create")) { ... }
```

---

## 11. 安全

### 11.1 XSS

- 默认插值自动转义
- 渲染 HTML 用 `v-safe-html`
- 处理用户 URL 用 `sanitizeUrl`

### 11.2 CSRF

**当前实现是前端生成 token（无效）**。如果需要真正的 CSRF 防护，改为后端 `Set-Cookie` 下发。

### 11.3 Token

- 存储用 `cache`（SM4 加密）
- **不要**把 token 拼进 URL
- **不要**在 console 打印 token

### 11.4 敏感字段

- `password` / `token` 不要进 `localStorage`
- 用户信息只 pick 需要的字段

---

## 12. 环境变量

- `VITE_` 前缀才会暴露给前端
- 敏感配置（密钥）**不进** `VITE_*`
- `.env.development` / `.env.production` 分开

---

## 13. 表单 Schema 工厂

当 schema 依赖响应式数据（如字典异步加载）时，**必须用 `computed`**：

```ts
export function useUserFormSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
  isEditing: Ref<boolean>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "password",
      label: "密码",
      component: "InputPassword",
      ifShow: () => !isEditing.value,   // ← 用函数，不用布尔
    },
    {
      field: "status",
      label: "状态",
      component: "RadioGroup",
      componentProps: () => ({ options: statusOptions.value }),
    },
  ]);
}
```

**不要**传静态数组，字典异步加载后 schema 不会更新。

---

## 14. actions.ts 规范

行操作**保持无状态**，副作用通过 ctx 注入：

```ts
export interface UserActionContext {
  onEdit: (record: UserRecord) => void;
  onDelete: (record: UserRecord) => void | Promise<void>;
}

export function getUserActions(record: UserRecord, ctx: UserActionContext): ActionItem[] {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => ctx.onEdit(record),
    },
    {
      label: "删除",
      danger: true,
      popConfirm: {
        title: "删除用户",
        content: `确定删除「${record.username}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ];
}
```

- **不**在 actions.ts 里 import store / 发请求 / 弹 message
- 这些都通过 `ctx` 由 `index.vue` 注入

---

## 15. 路由注册顺序

**具体路径放 `/:id` 前面**，否则会被 `:id` 吃掉：

```
✅ 正确顺序
GET /user/export
GET /user/options
GET /user/detail/:id
GET /user/:id

❌ 错误顺序
GET /user/:id          ← 会匹配 /user/export
GET /user/export
```

---

## 16. 常见坑

| 现象                 | 修复                                             |
| -------------------- | ------------------------------------------------ |
| 用户信息闪空         | `setUserInfo` 直接用参数，别请求 `/auth/profile` |
| `userId` 是 NaN      | 保持 UUID 字符串，别 `Number()`                  |
| 强制下线收不到       | WS 消息类型是 `force-logout`                     |
| 每个页面都连 WS      | 用 `useWs()` 单例                                |
| 登出后主题丢了       | `logout` 不 `reload`，只清 auth key              |
| 路由注册顺序乱       | 具体路径放 `/:id` 前面                           |
| 搜索字段被吃         | 后端 Zod `.strict()` 会拒绝未知字段              |
| 字典选项不更新       | schema 用 `computed` 工厂函数                    |
| 双重删除确认         | 关闭 `useCRUD` 内置 Modal.confirm                |
| 表格列宽错乱         | `scroll={{ x: ... }}` 或 `table-layout="fixed"`  |
| 表头样式丢失         | 用 `#headerCell` 插槽，不要覆盖 cell 样式        |
| `deptIds` 类型不匹配 | 前端 `Array`，后端也要 `Array`                   |
| `updateUser` 404     | 后端是 `POST /user/update/:id`，不是 PUT         |
| `deleteUser` 404     | 后端是 `DELETE /user/remove/:id`                 |

---

## 17. 组件复用

### 17.1 何时抽组件

- 同一个 UI 出现 ≥ 3 次
- 组件 > 200 行
- 有独立的内部状态

### 17.2 何时不抽

- 只出现 1 次
- 强耦合父组件状态
- 抽出来反而不清晰

### 17.3 组件通信

| 场景     | 方式                   |
| -------- | ---------------------- |
| 父子     | props / emit           |
| 深层嵌套 | `provide` / `inject`   |
| 跨模块   | Pinia store / eventBus |
| 全局     | Pinia store            |

---

## 18. 国际化

- 所有用户可见文本走 `$t("key")`
- 翻译 key 用 `模块.功能.描述`（如 `system.user.create`）
- `locales/zh-CN.json` / `locales/en-US.json` 保持 key 同步

---

## 19. TypeScript

### 19.1 禁止 `any`

用 `unknown` + 类型守卫：

```ts
// ❌ 错误
function parse(data: any) { ... }

// ✅ 正确
function parse(data: unknown): User {
  if (!isUser(data)) throw new Error("invalid");
  return data;
}
```

### 19.2 泛型约束

```ts
// ✅ 正确
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // ...
}
```

### 19.3 类型导入

```ts
import type { UserRecord } from "./types";
```

---

## 20. 性能

- 大列表用虚拟滚动（`virtual` 属性）
- 图表组件用 `shallowRef` / `markRaw`
- 频繁触发的回调用 `useDebounceFn` / `useThrottleFn`
- 路由懒加载（`defineAsyncComponent` / 动态 import）
- 避免在 `setup` 里做重计算，用 `computed` 工厂函数