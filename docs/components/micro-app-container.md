# MicroAppContainer 微前端容器组件

基于 [micro-app](https://micro-z.github.io/micro-app/) 的微前端子应用容器组件，提供加载状态、错误处理、重试机制等完整的生命周期管理。

## 基础用法

```vue
<script setup lang="ts">
import { MicroAppContainer } from '@/components/business'
</script>

<template>
  <MicroAppContainer
    name="sub-app"
    url="http://localhost:8081/"
    :keep-alive="true"
    @mounted="handleMounted"
    @error="handleError"
  />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `name` | 子应用名称（必填） | `string` | - |
| `url` | 子应用访问地址 | `string` | - |
| `className` | 自定义容器类名 | `string` | - |
| `baseroute` | 基础路由前缀 | `string` | - |
| `keepAlive` | 是否缓存子应用 | `boolean` | - |
| `disableMemoryRouter` | 是否禁用内存路由 | `boolean` | `true` |
| `disablePatchRequest` | 是否禁用请求补丁 | `boolean` | `false` |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `beforeload` | 子应用开始加载 | - |
| `mounted` | 子应用挂载完成 | - |
| `unmount` | 子应用卸载 | - |
| `error` | 子应用加载错误 | `(error: Error) => void` |

## 功能详解

### 加载状态 UI

当子应用正在加载时，显示内置的 Loading 遮罩层：

```
┌─────────────────────────┐
│                         │
│         ◌ (Spin)        │  ← 加载动画
│                         │
│   正在加载子应用...      │  ← 提示文本
│                         │
└─────────────────────────┘
```

- 使用 Antdv Next 的 Spin 组件作为加载指示器
- 背景使用半透明白色 + 模糊效果 (`backdrop-blur-sm`)
- 如果发生重试，会显示重试次数提示

### 错误状态处理

当子应用加载失败时，展示错误信息面板：

```
┌──────────────────────────────┐
│                              │
│        ⚠ (Error Icon)       │  ← 错误图标
│                              │
│      子应用加载失败           │  ← 标题
│                              │
│   子应用 xxx 加载失败        │  ← 错误信息
│   http://localhost:8081/     │  <- URL 地址
│                              │
│   [重试加载]   [关闭提示]     │  ← 操作按钮
│                              │
└──────────────────────────────┘
```

**错误状态包含：**
- 红色圆形背景的错误图标
- 错误标题和详细信息
- 失败的 URL 地址（等宽字体显示）
- 重试和关闭两个操作按钮

### 无 URL 占位态

当未配置 `url` 属性时，显示占位提示：

```
┌─────────────────────────┐
│                         │
│     📱 (App Icon)       │  ← 应用图标（低透明度）
│                         │
│    未配置应用地址        │  ← 提示文字
│ 请在微前端管理中设置访问URL │  ← 副标题
│                         │
└─────────────────────────┘
```

适合在微前端管理后台中使用——先创建容器占位，后续再配置实际 URL。

### 生命周期事件监听

MicroAppContainer 通过自定义事件监听 micro-app 的生命周期：

```vue
<script setup lang="ts">
function handleBeforeLoad() {
  console.log('子应用开始加载...')
  // 可以在此处显示全局 loading
}

function handleMounted() {
  console.log('子应用已挂载')
  // 可以在此处隐藏 loading、初始化通信
}

function handleUnmount() {
  console.log('子应用已卸载')
  // 清理相关资源
}

function handleError(error: Error) {
  console.error('子应用加载失败:', error.message)
  // 上报错误到监控系统
}
</script>

<template>
  <MicroAppContainer
    name="my-sub-app"
    url="http://localhost:8081/"
    @beforeload="handleBeforeLoad"
    @mounted="handleMounted"
    @unmount="handleUnmount"
    @error="handleError"
  />
</template>
```

底层实现原理：通过 `window.addEventListener` 监听 micro-app 发出的生命周期事件：

```ts
// 内部实现示意
window.addEventListener(`beforeload-${props.name}`, handleBeforeLoad)
window.addEventListener(`mounted-${props.name}`, handleMounted)
window.addEventListener(`unmount-${props.name}`, handleUnmount)
window.addEventListener(`error-${props.name}`, handleError)
```

组件卸载时自动移除所有事件监听器。

## WebComponent vs iframe 模式

MicroAppContainer 底层使用 **WebComponent** 模式（而非 iframe），这是 micro-app 的核心优势：

### WebComponent 模式（本项目使用）

```
┌──────────────────────────────────────┐
│           主应用 (Host)              │
│  ┌──────────────────────────────┐   │
│  │  <micro-app> (Shadow DOM)    │   │
│  │  ┌────────────────────────┐  │   │
│  │  │    子应用 (Sub App)     │  │   │
│  │  │                        │  │   │
│  │  └────────────────────────┘  │   │
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

**优势：**
- ✅ 性能优异：无额外浏览器进程开销
- ✅ 样式隔离：Shadow DOM 天然隔离
- ✅ JS 沙箱：代理沙箱隔离运行环境
- ✅ 资源预加载：支持预加载子应用资源
- ✅ 数据通信：提供完善的通信 API
- ✅ 与主应用共享上下文：可复用主应用的依赖

### iframe 模式对比

```
┌──────────────────────────────────────┐
│           主应用 (Host)              │
│  ┌──────────────────────────────┐   │
│  │  <iframe> (独立文档)          │   │
│  │  ┌────────────────────────┐  │   │
│  │  │    子应用 (独立页面)     │  │   │
│  │  │                        │  │   │
│  │  └────────────────────────┘  │   │
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

**劣势：**
- ❌ 性能开销大：每个 iframe 是独立的浏览器渲染进程
- ❌ 通信复杂：postMessage 跨域通信繁琐
- ❌ 样式完全隔离：难以统一主题风格
- ❌ 全局事件无法穿透：弹窗/下拉菜单受限

## 典型使用场景

### 微前端管理页面

在系统管理中动态切换不同的子应用：

```vue
<script setup lang="ts">
import { MicroAppContainer } from '@/components/business'
import { ref, computed } from 'vue'

const currentApp = ref<string | null>(null)

const apps = [
  { name: 'app-vue', label: 'Vue 子应用', url: 'http://localhost:8081/' },
  { name: 'app-react', label: 'React 子应用', url: 'http://localhost:8082/' },
  { name: 'app-vite', label: 'Vite 子应用', url: '' }, // 未配置
]

function switchApp(name: string, url?: string) {
  currentApp.value = name
}
</script>

<template>
  <div class="flex gap-4 h-[600px]">
    <!-- 应用列表 -->
    <div class="w-48 bg-white rounded-lg p-4 space-y-2">
      <button
        v-for="app in apps"
        :key="app.name"
        :class="cn(
          'w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
          currentApp === app.name ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50',
        )"
        @click="switchApp(app.name, app.url)"
      >
        {{ app.label }}
      </button>
    </div>

    <!-- 微前端容器 -->
    <div class="flex-1 bg-white rounded-lg overflow-hidden">
      <MicroAppContainer
        v-if="currentApp"
        :name="currentApp!"
        :url="apps.find(a => a.name === currentApp)?.url"
        :keep-alive="true"
      />
      <div v-else class="h-full flex items-center justify-center text-gray-400">
        请选择一个子应用
      </div>
    </div>
  </div>
</template>
```

### 嵌入外部系统

将第三方系统嵌入到当前应用中：

```vue
<script setup lang="ts">
const externalUrl = 'https://external-system.example.com/'
</script>

<template>
  <div class="relative h-full">
    <MicroAppContainer
      name="external-system"
      :url="externalUrl"
      baseroute="/external"
      :disable-memory-router="true"
      @error="(e) => message.error('外部系统加载失败')"
    />
  </div>
</template>
```
