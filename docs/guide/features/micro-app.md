# 微前端集成

本项目内置 **MicroAppContainer** 组件，基于 [micro-app](https://micro-z.github.io/micro-app/) 框架实现微前端子应用的加载与管理。支持 WebComponent 和 iframe 两种加载方式。

## 架构概述

```
┌─────────────────────────────────────────────────┐
│              主应用 (antdv-next-admin)            │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │         MicroAppContainer 组件             │   │
│  │                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐        │   │
│  │  │  Loading    │  │   Error     │        │   │
│  │  │  Overlay    │  │   Overlay   │        │   │
│  │  └─────────────┘  └─────────────┘        │   │
│  │                                           │   │
│  │  ┌─────────────────────────────────────┐  │   │
│  │  │  <micro-app>                        │  │   │
│  │  │  ┌─────────────────────────────┐    │  │   │
│  │  │  │      子应用 (WebComponent)    │    │  │   │
│  │  │  │  或 子应用 (iframe sandbox)  │    │  │   │
│  │  │  └─────────────────────────────┘    │  │   │
│  │  └─────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  micro-app.ts (配置中心)                           │
│  └── apps: MicroAppItem[]                         │
└─────────────────────────────────────────────────┘
```

---

## MicroAppContainer 组件

### Props

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `name` | `string` | - | ✅ | 子应用唯一标识，用于生命周期事件命名 |
| `url` | `string` | `undefined` | ❌ | 子应用访问地址 |
| `className` | `string` | `''` | ❌ | 容器额外 CSS 类名 |
| `baseroute` | `string` | `undefined` | ❌ | 子应用基础路由路径 |
| `keepAlive` | `boolean` | `false` | ❌ | 是否缓存子应用状态 |
| `disableMemoryRouter` | `boolean` | `true` | ❌ | 是否禁用 memory 路由（子应用自行管理路由） |
| `disablePatchRequest` | `boolean` | `false` | ❌ | 是否禁用请求补丁（不向子应用请求注入主应用信息） |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `beforeload` | - | 子应用开始加载时触发 |
| `mounted` | - | 子应用加载完成并挂载时触发 |
| `unmount` | - | 子应用卸载时触发 |
| `error` | `error: Error` | 子应用加载出错时触发 |

### Slots

当前版本暂无插槽，后续可扩展加载态/错误态的自定义插槽。

### 基础用法

```vue
<script setup lang="ts">
import MicroAppContainer from '@/components/business/MicroAppContainer.vue'

const currentApp = ref({
  name: 'crm-system',
  url: 'http://localhost:9091',
  baseroute: '/crm',
})

function handleBeforeLoad() {
  console.log('CRM 系统正在加载...')
}

function handleMounted() {
  console.log('CRM 系统加载完成')
}

function handleError(error: Error) {
  console.error('CRM 系统加载失败:', error.message)
}
</script>

<template>
  <MicroAppContainer
    :name="currentApp.name"
    :url="currentApp.url"
    :baseroute="currentApp.baseroute"
    :keep-alive="true"
    @beforeload="handleBeforeLoad"
    @mounted="handleMounted"
    @error="handleError"
  />
</template>
```

### 组件内部状态管理

MicroAppContainer 内部维护三个核心状态：

```ts
// 组件内部状态
const loading = ref(true)       // 加载中
const hasError = ref(false)     // 是否出错
const errorMessage = ref('')    // 错误信息
const retryCount = ref(0)       // 重试次数
```

对应三种 UI 状态：

| 状态 | 条件 | 显示内容 |
|------|------|----------|
| **加载中** | `loading === true` | Spinner + "正在加载子应用..." |
| **错误** | `hasError === true && !loading` | 错误图标 + 错误信息 + 重试/关闭按钮 |
| **未配置** | `!url && !loading` | 占位提示："未配置应用地址" |
| **就绪** | `!hasError && url` | `<micro-app>` 容器 |

---

## 微前端配置文件

### 配置位置

```ts
// src/config/micro-app.ts
import type { MicroAppConfig, MicroAppItem } from '#/micro-app'

export const microAppConfig: MicroAppConfig = { ... }
```

### MicroAppConfig 接口

```ts
interface MicroAppConfig {
  /** 是否启用微前端功能 */
  enabled: boolean
  /** 子应用列表 */
  apps: MicroAppItem[]
}
```

启用方式通过环境变量控制：

```ts
enabled: import.meta.env.VITE_MICRO_APP === 'true'
  || import.meta.env.VITE_MICRO_APP === true
```

### MicroAppItem 接口（子应用配置）

```ts
interface MicroAppItem {
  /** ====== 基本信息 ====== */

  /** 子应用唯一名称（必须唯一，对应 micro-app 的 name 属性） */
  name: string

  /** 子应用访问地址 */
  url: string

  /** 显示标题 */
  title: string

  /** 图标（Iconify 图标名） */
  icon: string

  /** 是否激活（可用/停用） */
  active: boolean

  /** ====== 路由配置 ====== */

  /** 基础路由路径（主应用中访问子应用的路径前缀） */
  baseroute: string

  /** ====== 描述信息 ====== */

  /** 应用描述 */
  description: string

  /** 版本号 */
  version: string

  /** 负责团队/负责人 */
  owner: string

  /** 最后更新时间 */
  lastUpdate: string

  /** ====== 运维配置 ====== */

  /** 健康检查接口路径 */
  healthUrl: string

  /** 加载方式 */
  loader: 'webcomponent' | 'iframe'
}
```

### 完整配置示例

```ts
// src/config/micro-app.ts
export const microAppConfig: MicroAppConfig = {
  enabled: true,
  apps: [
    {
      name: 'sub-app-example',
      url: 'http://localhost:9090',
      title: '子应用示例',
      icon: 'carbon:application',
      active: false,
      baseroute: '/sub-app',
      description: '示例子应用',
      version: '1.0.0',
      owner: '前端团队 A',
      lastUpdate: '2025-01-15 10:30:00',
      healthUrl: '/api/health',
      loader: 'webcomponent',
    },
    {
      name: 'crm-system',
      url: 'http://localhost:9091',
      title: 'CRM 客户管理',
      icon: 'carbon:user-multiple',
      active: true,
      baseroute: '/crm',
      description: '客户关系管理系统',
      version: '2.3.1',
      owner: '业务中台组',
      lastUpdate: '2025-01-14 16:45:00',
      healthUrl: '/crm/health',
      loader: 'webcomponent',
    },
    {
      name: 'data-bi',
      url: 'http://localhost:9092',
      title: '数据 BI 平台',
      icon: 'carbon:chart-line-data',
      active: false,
      baseroute: '/bi',
      description: '商业智能数据分析平台',
      version: '3.0.2',
      owner: '数据团队',
      loader: 'iframe',  // 使用 iframe 加载
    },
  ],
}
```

### 辅助函数

```ts
// 根据名称查找子应用
export function getMicroAppByName(name: string): MicroAppItem | undefined {
  return microAppConfig.apps.find(app => app.name === name)
}

// 获取所有子应用列表
export function getAllMicroApps(): MicroAppItem[] {
  return microAppConfig.apps
}
```

---

## WebComponent vs iframe 加载方式对比

| 维度 | WebComponent | iframe |
|------|-------------|--------|
| **隔离性** | JS 沙箱 + CSS 隔离（micro-app 内置） | 天然完全隔离 |
| **性能** | 更好，共享主应用上下文 | 较差，独立渲染进程 |
| **通信** | `window.dispatchEvent` 自定义事件 | `postMessage` |
| **路由** | 可与主应用路由联动 | 完全独立路由 |
| **样式冲突** | micro-app 自动处理沙箱隔离 | 天然无冲突 |
| **调试** | DevTools 中可直接查看子应用 DOM | 需切换 iframe 上下文 |
| **兼容性** | 需要 modern browser | 兼容性极佳 |
| **适用场景** | 同技术栈、深度集成 | 异构技术栈、独立部署 |

### 选择建议

```
优先选择 WebComponent，当：
  ✅ 子应用与主应用技术栈相近（Vue/React）
  ✅ 需要与主应用共享状态/路由
  ✅ 需要较好的性能表现
  ✅ 子应用可以配合 micro-app 改造

选择 iframe，当：
  ✅ 子应用是 legacy 系统，无法改造
  ✅ 子应用使用 jQuery 等老框架
  ✅ 需要绝对的安全隔离
  ✅ 子应用独立部署，无法控制其代码
```

---

## 子应用注册流程

### 步骤一：环境变量启用

```bash
# .env.development 或 .env.production
VITE_MICRO_APP=true
```

### 步骤二：配置子应用信息

在 `src/config/micro-app.ts` 的 `apps` 数组中添加新条目：

```ts
{
  name: 'my-new-app',           // 唯一标识
  url: 'http://localhost:9099',  // 开发地址
  title: '我的新应用',
  icon: 'carbon:cube',
  active: true,
  baseroute: '/my-app',         // 路由前缀
  description: '新接入的子应用',
  version: '1.0.0',
  owner: '我的团队',
  lastUpdate: new Date().toISOString(),
  healthUrl: '/api/health',
  loader: 'webcomponent',       // 或 'iframe'
}
```

### 步骤三：在页面中使用

```vue
<template>
  <MicroAppContainer
    name="my-new-app"
    url="http://localhost:9099"
    baseroute="/my-app"
    @mounted="onAppMounted"
    @error="onAppError"
  />
</template>
```

### 步骤四：（可选）添加菜单入口

在前端菜单配置或后端菜单数据中添加路由：

```ts
// router/menus.ts
{
  path: '/micro-app/my-new-app',
  name: 'MyNewApp',
  component: () => import('@/views/micro-app/index.vue'),
  meta: {
    title: '我的新应用',
    icon: 'carbon:cube',
  },
}
```

---

## 生命周期事件处理

MicroAppContainer 监听 micro-app 框架的四类生命周期事件：

### 事件监听机制

```ts
// 组件挂载时注册事件监听
onMounted(() => {
  window.addEventListener(`beforeload-${props.name}`, handleBeforeLoad)
  window.addEventListener(`mounted-${props.name}`, handleMounted)
  window.addEventListener(`unmount-${props.name}`, handleUnmount)
  window.addEventListener(`error-${props.name}`, handleError)
})

// 组件卸载时移除事件监听（防内存泄漏）
onUnmounted(() => {
  window.removeEventListener(`beforeload-${props.name}`, handleBeforeLoad)
  window.removeEventListener(`mounted-${props.name}`, handleMounted)
  window.removeEventListener(`unmount-${props.name}`, handleUnmount)
  window.removeEventListener(`error-${props.name}`, handleError)
})
```

### beforeload — 开始加载

```ts
function handleBeforeLoad() {
  loading.value = true
  hasError.value = false
  errorMessage.value = ''
  emit('beforeload')  // 向外抛出事件

  // 可在此处：显示加载进度、初始化通信通道等
}
```

### mounted — 加载完成

```ts
function handleMounted() {
  loading.value = false
  hasError.value = false
  emit('mounted')  // 向外抛出事件

  // 可在此处：发送初始化数据给子应用、建立数据同步等
}
```

### unmount — 卸载

```ts
function handleUnmount() {
  emit('unmount')  // 向外抛出事件

  // 可在此处：清理共享状态、保存子应用数据快照等
}
```

### error — 加载错误

```ts
function handleError(event: Event) {
  const detail = (event as CustomEvent).detail

  loading.value = false
  hasError.value = true
  errorMessage.value = detail?.message
    || `子应用 ${props.name} 加载失败`

  emit('error', new Error(errorMessage.value))

  // 可在此处：上报错误日志、触发告警通知等
}
```

### 完整事件处理示例

```vue
<script setup lang="ts">
import MicroAppContainer from '@/components/business/MicroAppContainer.vue'
import { message } from 'antdv-next'

const appName = ref('crm-system')
const appUrl = ref('http://localhost:9091')

function onBeforeLoad() {
  console.time(`[MicroApp] ${appName.value} load`)
}

function onMounted() {
  console.timeEnd(`[MicroApp] ${appName.value} load`)
  message.success(`${appName.value} 已就绪`)
}

function onUnmount() {
  message.info(`${appName.value} 已卸载`)
}

function onError(error: Error) {
  message.error(`子应用加载异常: ${error.message}`)
  // 上报到错误监控系统
  reportError({
    source: 'micro-app',
    app: appName.value,
    error: error.message,
  })
}

function onRetry() {
  message.info('正在重新加载...')
}
</script>

<template>
  <div class="h-full">
    <div class="mb-4 flex items-center gap-2">
      <span class="font-medium">{{ appName }} 控制面板</span>
      <a-tag color="processing">运行中</a-tag>
    </div>

    <MicroAppContainer
      :name="appName"
      :url="appUrl"
      baseroute="/crm"
      :keep-alive="true"
      @beforeload="onBeforeLoad"
      @mounted="onMounted"
      @unmount="onUnmount"
      @error="onError"
    />
  </div>
</template>
```

### 重试机制

MicroAppContainer 内置了简单的重试机制：

```ts
function handleRetry() {
  hasError.value = false
  loading.value = true
  retryCount.value++  // 递增重试计数
}
```

点击错误状态的「重试加载」按钮会重置错误状态，触发 `<micro-app>` 重新加载子应用。UI 上会显示当前重试次数：

```html
<p v-if="retryCount > 0" class="text-xs text-gray-400">
  第 {{ retryCount }} 次重试
</p>
```

---

## 主子应用通信

虽然 MicroAppContainer 本身不处理通信逻辑，但 micro-app 框架提供了多种通信方式：

### 主应用 → 子应用（数据下发）

```ts
import microApp from '@micro-zoe/micro-app'

// 向指定子应用发送数据
microApp.setData('crm-system', { user: currentUser, token: authToken })

// 向所有子应用广播
microApp.setGlobalData({ theme: 'dark', locale: 'zh-CN' })
```

### 子应用 → 主应用（数据上报）

```ts
// 子应用代码中
window.microApp.dispatch({ type: 'data-changed', payload: newData })
```

```ts
// 主应用监听
import microApp from '@micro-zoe/micro-app'

microApp.addDataListener('crm-system', (data) => {
  console.log('收到 CRM 子应用数据:', data)
})
```

---

## 注意事项

::: warning 开发注意事项
- 子应用必须配置 CORS 允许主应用域名访问
- `baseroute` 需要与子应用的路由配置保持一致
- 生产环境中子应用 URL 应使用实际部署地址
- `disableMemoryRouter` 默认为 `true`，子应用需自行管理路由状态
:::

::: tip 性能建议
- 非活跃子应用建议设置 `active: false` 避免预加载
- 使用 `keepAlive` 缓存频繁切换的子应用状态
- 大型子应用考虑使用 iframe 模式获得更好隔离性
:::
