# 技术栈说明

本项目采用 **Vue 3 + TypeScript + Antdv Next + Tailwind CSS** 技术体系构建，以下为各核心技术的选型理由与项目实践。

## 技术概览

| 技术 | 版本 | 定位 |
|------|------|------|
| Vue | ^3.5.30 | 渐进式前端框架 |
| TypeScript | ~5.9.3 | 类型安全超集 |
| Antdv Next | ^1.3.1 | 企业级 UI 组件库 |
| Tailwind CSS | ^4.2.1 | 原子化 CSS 引擎 |
| Pinia | ^3.0.4 | 状态管理方案 |
| Alova | ^3.5.1 | HTTP 请求客户端 |
| Vite | ^7.3.1 | 构建开发工具 |
| Bun | - | 包管理器与运行时 |

---

## Vue 3.5

### 为什么选择 Vue 3.5

Vue 3.5 是 Vue 3 系列的最新稳定版本，带来了显著的响应式系统性能优化和开发者体验提升：

- **Reactivity API 优化** — 响应式系统内部重构，内存占用降低约 56%，大型应用的响应式追踪性能提升数倍
- **Props 解构** — `<script setup>` 中支持直接解构 props 并保持响应性
- **SSR 改进** — 服务端渲染性能提升，异步组件边界更清晰
- **自定义元素支持** — 与 WebComponent 的互操作性增强
- **TypeScript 类型推断增强** — `defineModel`、`defineProps` 等宏的类型推导更精准

### 在项目中的用法

#### 响应式 API 使用

```vue
<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'

// ref：基本类型响应式
const count = ref(0)
const loading = ref(false)

// reactive：对象类型响应式
const formData = reactive({
  username: '',
  password: '',
})

// computed：计算属性
const doubleCount = computed(() => count.value * 2)
const canSubmit = computed(
  () => formData.username && formData.password,
)

// watch：侦听器
watch(count, (newVal, oldVal) => {
  console.log(`count 变化: ${oldVal} -> ${newVal}`)
})
</script>
```

#### defineModel 双向绑定

```vue
<!-- 父组件 -->
<script setup lang="ts">
import Modal from '@/components/Modal/index.vue'

const visible = ref(false)

function openModal() {
  visible.value = true
}
</script>

<template>
  <a-button @click="openModal">打开弹窗</a-button>
  <Modal v-model:visible="visible" title="示例弹窗">
    <p>弹窗内容</p>
  </Modal>
</template>

<!-- 子组件 Modal -->
<script setup lang="ts">
// defineModel 替代 prop + emit 组合
const visible = defineModel<boolean>('visible', { default: false })
</script>
```

#### useTemplateRef 获取 DOM

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'
import { cn } from '@/utils/cn'

const inputRef = useTemplateRef<HTMLInputElement>('inputEl')

onMounted(() => {
  // 安全获取 DOM 引用，无需 document.querySelector
  inputRef.value?.focus()
})

const inputClassName = cn('w-full', 'px-4', 'py-2', 'border', 'rounded')
</script>

<template>
  <input ref="inputEl" :class="inputClassName" placeholder="自动聚焦" />
</template>
```

---

## TypeScript 5.9

### 为什么选择 TypeScript 5.9

TypeScript 5.9 是当前最新的稳定版本，提供：

- **精确的空值控制** — 更严格的 null/undefined 检查
- **更好的类型收窄** — 控制流分析能力持续增强
- **性能提升** — 编译速度和内存效率优化
- **ECMAScript 新特性跟进** — 对最新 JS 标准的支持更完善

### 在项目中的用法

#### 类型定义规范

```ts
// src/types/user.ts
export interface UserInfo {
  id: string | number
  username: string
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  permissions: string[]
}

// src/types/api.ts
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  pageSize: number
}
```

#### 工具类型使用

```ts
import type { isObject, isArray } from 'es-toolkit'

// 类型守卫函数（替代 typeof）
function processInput(input: unknown) {
  if (isObject(input)) {
    // input 被收窄为 Record<string, unknown>
    return Object.keys(input)
  }
  if (isArray(input)) {
    // input 被收窄为 unknown[]
    return input.length
  }
  return String(input)
}
```

#### 泛型约束

```ts
// 通用表格列配置
export interface TableColumn<T = Record<string, any>> {
  title: string
  dataIndex: keyof T
  width?: number
  fixed?: 'left' | 'right'
  sorter?: boolean
  customRender?: ({ record }: { record: T }) => VNode
}

// 使用示例
const userColumns: TableColumn<UserInfo>[] = [
  { title: '用户名', dataIndex: 'username' },
  { title: '邮箱', dataIndex: 'email', width: 200 },
]
```

---

## Antdv Next 组件库

### 为什么选择 Antdv Next

Antdv Next（`antdv-next`）是 Ant Design Vue 的下一代版本，具备以下优势：

- **原生 TypeScript 编写** — 完整的类型定义，零 `any`
- **更小的包体积** — 按需引入 Tree-shaking 友好
- **Design Token 体系** — 主题定制通过 token 配置即可完成
- **Tailwind CSS 深度集成** — 通过 `@antdv-next/tailwind` 插件无缝协作
- **CSS-in-JS 支持** — 基于 `@antdv-next/cssinjs` 运行时样式注入

### 在项目中的用法

#### 组件自动导入

本项目配置了 `unplugin-auto-import` 和 `unplugin-vue-components`，Antdv Next 组件无需手动导入：

```vue
<template>
  <!-- 直接使用，无需 import -->
  <a-button type="primary" @click="handleClick">
    提交
  </a-button>
  <a-table :columns="columns" :data-source="data" />
  <a-modal v-model:open="visible" title="确认">
    <p>确定执行此操作？</p>
  </a-modal>
</template>
```

#### ConfigProvider 全局配置

```vue
<!-- App.vue -->
<script setup lang="ts">
import { ConfigProvider, StyleProvider } from 'antdv-next'
import { getThemeConfig } from '@/settings/theme'
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

const themeConfig = computed(() => getThemeConfig(
  appStore.themeStyle,
  appStore.themeMode === 'dark',
  appStore.borderRadius,
  appStore.primaryColor,
))
</script>

<template>
  <StyleProvider>
    <ConfigProvider :theme="themeConfig">
      <router-view />
    </ConfigProvider>
  </StyleProvider>
</template>
```

#### 自定义组件封装

项目中封装了 `Modal` 和 `Drawer` 组件替代 Antdv Next 原生组件：

```vue
<script setup lang="ts">
// 使用项目封装的 Modal 组件
import Modal from '@/components/Modal/index.vue'

const modalVisible = ref(false)
</script>

<template>
  <Modal v-model:visible="modalVisible" title="用户信息">
    <a-form :model="formData">
      <a-form-item label="姓名">
        <a-input v-model:value="formData.name" />
      </a-form-item>
    </a-form>
  </Modal>
</template>
```

---

## Tailwind CSS v4

### 为什么选择 Tailwind CSS v4

Tailwind CSS v4 是一次重大架构升级：

- **基于 Oxide 引擎** — Rust 编写的核心引擎，构建速度提升 ~10x
- **CSS-first 配置** — 无需 `tailwind.config.js`，直接在 CSS 中用 `@theme` 定义
- **原生嵌套语法** — 不再需要额外插件支持嵌套
- **更好的默认值** — 预设设计系统更加现代化

### 在项目中的用法

#### cn() 工具函数

项目禁止在模板中直接写 Tailwind 类名字符串，而是通过 `cn()` 函数在 `<script setup>` 中预先定义：

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

// ✅ 正确做法：在 script 中定义类名变量
const cardClassName = cn(
  'rounded-lg',
  'bg-white',
  'shadow-sm',
  'p-6',
  'dark:bg-gray-800',
)

const buttonClassName = cn(
  'px-4',
  'py-2',
  'rounded-md',
  'bg-primary',
  'text-white',
  'hover:bg-primary/90',
  'transition-colors',
  'disabled:opacity-50',
)
</script>

<template>
  <!-- ✅ 在模板中使用预定义的类名变量 -->
  <div :class="cardClassName">
    <button :class="buttonClassName">操作按钮</button>
  </div>
</template>
```

#### ❌ 错误示范

```vue
<template>
  <!-- ❌ 禁止：将 cn 参数写在模板中 -->
  <div :class="cn('bg-red-500', 'text-white')">
    内容
  </div>
</template>
```

#### 暗色模式

```vue
<script setup lang="ts">
const containerClassName = cn(
  'bg-white',
  'text-gray-900',
  'dark:bg-gray-900',
  'dark:text-gray-100',
)
</script>
```

---

## Pinia 3 状态管理

### 为什么选择 Pinia 3

Pinia 是 Vue 官方推荐的状态管理库，Pinia 3 带来了：

- **Composition API 风格** — 与 Vue 3 `<script setup>` 完美契合
- **更轻量的体积** — 相比 Vuex 更小的打包体积
- **完整的 TypeScript 支持** — 推断类型无需手动声明
- **DevTools 集成** — 时间旅行调试、状态快照
- **插件生态** — `pinia-plugin-persistedstate` 持久化等

### 在项目中的用法

#### Store 定义（Setup Store）

```ts
// src/stores/modules/user.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cache } from '@/utils/cache'

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string | null>(cache.getItem('auth_token'))
  const userInfo = ref<UserInfo | null>(null)

  // Getters
  const isLoggedIn = computed(() => !!token.value)
  const roles = computed(() => userInfo.value?.roles || [])
  const permissions = computed(() => userInfo.value?.permissions || [])

  // Actions
  function setToken(newToken: string) {
    token.value = newToken
    cache.setItem('auth_token', newToken, 24 * 60 * 60)
  }

  function logout() {
    token.value = null
    userInfo.value = null
    cache.removeItem('auth_token')
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    roles,
    permissions,
    setToken,
    logout,
  }
})
```

#### Store 间调用

```ts
// 在其他 Store 中引用 UserStore
export const useAppStore = defineStore('app', () => {
  const userStore = useUserStore()

  const isAdmin = computed(() =>
    userStore.roles.includes('super') || userStore.roles.includes('admin'),
  )

  return { isAdmin }
})
```

#### 持久化配置

```ts
// 项目使用 pinia-plugin-persistedstate
// 缓存统一使用 localStorageCacheStorage
import { cache } from '@/utils/cache'

// 直接使用 cache 工具进行持久化
cache.setItem('key', value, expireSeconds)
cache.getItem('key')
```

---

## Alova HTTP 客户端

### 为什么选择 Alova

Alova 是新一代请求工具库，相比传统 Axios 方案具有显著优势：

| 特性 | Axios | Alova |
|------|-------|-------|
| 请求共享 | 需手动实现 | 内置，相同请求自动去重 |
| 响应缓存 | 需手动实现 | GET 请求自动缓存 |
| Mock 数据 | 需额外库 | `@alova/mock` 原生集成 |
| 体积 | ~14KB (gzip) | ~6KB (gzip) |
| 状态管理 | 外部管理 | 内置 useRequest/useWatcher |

### 在项目中的用法

#### 实例配置

```ts
// src/utils/request/alova.ts
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import { getToken } from '@/utils/token'

const http = createAlova({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  requestAdapter: adapterFetch(),

  // 请求拦截
  beforeRequest(config) {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },

  // 响应拦截
  responded: {
    onSuccess(response) {
      if (response.status >= 200 && response.status < 300) {
        return response.json()
      }
      throw new Error(`HTTP ${response.status}`)
    },
    onError(err) {
      message.error('网络请求失败')
      throw err
    },
  },
})

export default http
```

#### 业务接口定义

```ts
// src/api/index.ts
import http from '@/utils/request/alova'

// 用户相关
export const userApi = {
  // 获取用户列表
  getList: (params: { page: number; pageSize: number }) =>
    http.Get('/users', { params }),

  // 创建用户
  create: (data: CreateUserDTO) =>
    http.Post('/users', data),

  // 更新用户
  update: (id: string | number, data: UpdateUserDTO) =>
    http.Put(`/users/${id}`, data),

  // 删除用户
  remove: (id: string | number) =>
    http.Delete(`/users/${id}`),
}
```

#### 组件中使用

```vue
<script setup lang="ts">
import { userApi } from '@/api'

const loading = ref(false)
const tableData = ref<UserInfo[]>([])

async function fetchUsers() {
  loading.value = true
  try {
    const res = await userApi.getList({ page: 1, pageSize: 10 })
    tableData.value = res.data
  }
  finally {
    loading.value = false
  }
}
</script>
```

---

## Vite 7 构建工具

### 为什么选择 Vite 7

Vite 是下一代前端构建工具，Vite 7 进一步强化了：

- **极速冷启动** — 基于 ES Module 的按需编译，大型项目秒开
- **即时热更新** — HMR 速度不受项目规模影响
- **优化的构建输出** — Rollup 打包，产物高度优化
- **丰富的插件生态** — Vue、TS、CSS 等开箱即用

### 在项目中的用法

#### 关键插件配置

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntdvNextResolver } from '@antdv-next/auto-import-resolver'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [AntdvNextResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
})
```

#### 开发命令

```bash
# 启动开发服务器
bun run dev

# 构建生产版本
bun run build

# 预览生产构建
bun run preview

# 文档开发
bun run docs:dev

# 文档构建
bun run docs:build
```

---

## Bun 包管理器

### 为什么选择 Bun

Bun 是一个全能型的 JavaScript 运行时和包管理器：

- **极速安装** — 比 npm/pnpm 快 10~20 倍
- **内置运行时** — 兼容 Node.js 生态
- **TypeScript 原生支持** — 无需额外编译步骤
- **统一的工具链** — 包管理 + 运行时 + 打包一体化

### 在项目中的用法

```bash
# 安装依赖
bun install

# 添加新依赖
bun add lodash-es
bun add -D @types/lodash-es

# 运行脚本
bun run dev
bun run build

# 执行 lint
bun run lint:fix

# 类型检查
bun run type-check
```

::: tip 依赖审计
引入新的依赖包后，建议执行 `bun audit` 命令检查安全漏洞。
:::

---

## 技术栈协同关系图

```
┌─────────────────────────────────────────────┐
│                  应用层 (App.vue)             │
│  ConfigProvider → Theme → Locale → RouterView │
├─────────────────────────────────────────────┤
│              状态管理层 (Pinia 3)              │
│   UserStore │ AppStore │ RouteStore          │
├──────────────────┬──────────────────────────┤
│   视图层 (Vue 3.5)  │   样式层 (Tailwind v4)   │
│   Antdv Next       │   cn() 工具函数           │
│   自动导入组件      │   暗色模式 / 原子化         │
├──────────────────┴──────────────────────────┤
│            通信层 (Alova 3)                    │
│   请求共享 / 响应缓存 / Token 注入 / Mock      │
├─────────────────────────────────────────────┤
│            构建层 (Vite 7 + Bun)               │
│   HMR / Tree-shaking / 代码分割 / 压缩         │
└─────────────────────────────────────────────┘
```
