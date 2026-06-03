# 微前端管理

微前端管理模块用于集中管理所有注册的微前端子应用，提供应用的启动/停止控制、运行状态监控、详细信息查看、在线预览等功能。该模块采用卡片式布局，直观展示每个子应用的核心信息和运行状态。

## 功能概述

| 功能 | 说明 |
|------|------|
| **子应用注册** | 通过配置文件注册子应用，支持动态启停 |
| **启动停止** | 一键切换子应用运行状态，即时生效 |
| **在线预览** | 弹窗嵌入 MicroAppContainer 组件，实时预览子应用 |
| **健康检查** | 配置健康检查地址，可用于监控探活 |
| **重启功能** | 先停止再启动的原子化重启操作 |
| **多维筛选** | 支持关键词、运行状态、加载方式的组合筛选 |
| **详情查看** | 抽屉式详情面板，展示 8 项核心配置信息 |

## 5 个统计卡片

页面顶部展示五个维度的统计指标，采用 5 列网格布局：

```vue
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
  <!-- 总应用数 -->
  <div :class="statCardClassName">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
        <span class="i-carbon-application text-blue-600 dark:text-blue-400 text-xl" />
      </div>
      <div>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalCount }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">总应用数</p>
      </div>
    </div>
  </div>

  <!-- 运行中 -->
  <div :class="statCardClassName">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
        <span class="i-carbon-circle-filled text-green-500 text-xl" />
      </div>
      <div>
        <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ runningCount }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">运行中</p>
      </div>
    </div>
  </div>

  <!-- 已停止 -->
  <div :class="statCardClassName">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <span class="i-carbon-pause-filled text-gray-500 text-xl" />
      </div>
      <div>
        <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">{{ stoppedCount }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">已停止</p>
      </div>
    </div>
  </div>

  <!-- iframe 模式 -->
  <div :class="statCardClassName">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
        <span class="i-carbon-document-text text-purple-600 dark:text-purple-400 text-xl" />
      </div>
      <div>
        <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ iframeCount }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">iframe 模式</p>
      </div>
    </div>
  </div>

  <!-- WebComponent -->
  <div :class="statCardClassName">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
        <span class="i-carbon-code text-cyan-600 dark:text-cyan-400 text-xl" />
      </div>
      <div>
        <p class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{{ webcomponentCount }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">WebComponent</p>
      </div>
    </div>
  </div>
</div>
```

**统计计算逻辑：**

```typescript
// 响应式计算各项统计数据
const totalCount = computed(() => apps.value.length)
const runningCount = computed(() => apps.value.filter(app => app.active).length)
const stoppedCount = computed(() => apps.value.filter(app => !app.active).length)
const iframeCount = computed(() => apps.value.filter(app => app.loader === 'iframe').length)
const webcomponentCount = computed(() => apps.value.filter(app => app.loader === 'webcomponent').length)
```

## 搜索筛选

### 筛选栏 UI

```vue
<div class="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
  <!-- 关键词搜索 -->
  <a-input
    v-model:value="searchKeyword"
    placeholder="搜索应用名称 / 标识 / 负责人"
    allow-clear
    style="width: 280px"
  >
    <template #prefix>
      <span class="i-carbon-search text-gray-400" />
    </template>
  </a-input>

  <!-- 运行状态下拉 -->
  <a-select v-model:value="statusFilter" style="width: 130px" placeholder="运行状态">
    <a-select-option value="all">全部状态</a-select-option>
    <a-select-option value="running">运行中</a-select-option>
    <a-select-option value="stopped">已停止</a-select-option>
  </a-select>

  <!-- 加载方式下拉 -->
  <a-select v-model:value="loaderFilter" style="width: 140px" placeholder="加载方式">
    <a-select-option value="all">全部模式</a-select-option>
    <a-select-option value="webcomponent">WebComponent</a-select-option>
    <a-select-option value="iframe">iframe</a-select-option>
  </a-select>

  <!-- 重置按钮 -->
  <a-button @click="handleResetFilters">重置</a-button>

  <!-- 结果计数 -->
  <span class="ml-auto text-sm text-gray-500 dark:text-gray-400">
    共 {{ filteredApps.length }} 个应用
  </span>
</div>
```

### 组合筛选逻辑

```typescript
const searchKeyword = ref('')
const statusFilter = ref<string>('all')
const loaderFilter = ref<string>('all')

// 计算属性：多条件组合筛选
const filteredApps = computed(() => {
  return apps.value.filter((app) => {
    // 1. 关键词匹配（应用名称/标识/负责人）
    const matchKeyword = !searchKeyword.value
      || app.title.includes(searchKeyword.value)
      || app.name.includes(searchKeyword.value)
      || (app.owner && app.owner.includes(searchKeyword.value))

    // 2. 运行状态匹配
    const matchStatus = statusFilter.value === 'all' || (
      statusFilter.value === 'running' ? app.active : !app.active
    )

    // 3. 加载方式匹配
    const matchLoader = loaderFilter.value === 'all' || app.loader === loaderFilter.value

    return matchKeyword && matchStatus && matchLoader
  })
})
```

### 重置筛选

```typescript
function handleResetFilters() {
  searchKeyword.value = ''
  statusFilter.value = 'all'
  loaderFilter.value = 'all'
}
```

## 子应用卡片信息展示

### 卡片结构

每个子应用以卡片形式展示，包含头部信息、描述、元信息、地址和操作按钮五个区域：

```vue
<div
  v-for="app in filteredApps"
  :key="app.name"
  :class="appCardClassName"
  @click="handleViewDetail(app)"
>
  <!-- 卡片头部：图标 + 名称 + 状态标签 -->
  <div class="flex items-start justify-between mb-3">
    <div class="flex items-center gap-3">
      <!-- 应用图标（运行中渐变背景，停止灰度背景） -->
      <div
        class="w-11 h-11 rounded-xl flex items-center justify-center"
        :class="app.active
          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
          : 'bg-gray-100 dark:bg-gray-700'"
      >
        <span
          v-if="app.icon"
          :class="[app.icon, app.active ? 'text-white' : 'text-gray-500']"
          class="text-xl"
        />
      </div>
      <!-- 名称和标识 -->
      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white leading-tight">
          {{ app.title }}
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ app.name }}
        </p>
      </div>
    </div>
    <!-- 状态标签 -->
    <span :class="getStatusTagClass(!!app.active)">
      {{ app.active ? '运行中' : '已停止' }}
    </span>
  </div>

  <!-- 应用描述（最多显示2行） -->
  <p v-if="app.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
    {{ app.description }}
  </p>

  <!-- 元信息行：版本/负责人/加载方式 -->
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
    <span v-if="app.version">
      <span class="i-carbon-tag text-xs mr-0.5" />v{{ app.version }}
    </span>
    <span v-if="app.owner">
      <span class="i-carbon-user text-xs mr-0.5" />{{ app.owner }}
    </span>
    <span :class="getLoaderBadgeClass(app.loader)">
      {{ app.loader === 'iframe' ? 'iframe' : 'WebComponent' }}
    </span>
  </div>

  <!-- 访问地址（等宽字体显示） -->
  <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900/60 rounded-md mb-4">
    <span class="i-carbon-link text-gray-400 text-xs shrink-0" />
    <span class="text-xs text-gray-600 dark:text-gray-400 truncate font-mono">
      {{ app.url }}
    </span>
  </div>

  <!-- 操作按钮组（阻止冒泡避免触发卡片点击） -->
  <div class="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700" @click.stop>
    <a-button :type="app.active ? 'default' : 'primary'" size="small" @click="handleToggleStatus(app)">
      {{ app.active ? '停止' : '启动' }}
    </a-button>
    <a-button size="small" @click="handlePreview(app)">预览</a-button>
    <a-popconfirm title="确定要重启该应用吗？" @confirm="handleRestart(app)">
      <a-button size="small" :disabled="!app.active">重启</a-button>
    </a-popconfirm>
  </div>
</div>
```

### 状态标签样式

```typescript
function getStatusTagClass(active: boolean) {
  return cn(
    'px-2.5 py-1 rounded-full text-xs font-medium',
    active
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  )
}

function getLoaderBadgeClass(loader?: string) {
  if (loader === 'iframe') {
    return cn(
      'px-2 py-0.5 rounded text-xs',
      'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    )
  }
  return cn(
    'px-2 py-0.5 rounded text-xs',
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  )
}
```

## 详情抽屉（Descriptions 8项配置）

### MicroAppItem 完整接口定义

```typescript
interface MicroAppItem {
  /** 子应用唯一标识 */
  name: string
  /** 子应用访问地址 */
  url: string
  /** 显示名称 */
  title: string
  /** 图标（Iconify 图标名） */
  icon?: string
  /** 是否运行中 */
  active?: boolean
  /** 基础路由（用于路由前缀匹配） */
  baseroute?: string
  /** 应用描述 */
  description?: string
  /** 版本号 */
  version?: string
  /** 负责人/团队 */
  owner?: string
  /** 最后更新时间 */
  lastUpdate?: string
  /** 健康检查地址 */
  healthUrl?: string
  /** 加载方式：iframe / webcomponent */
  loader?: 'iframe' | 'webcomponent'
}
```

### 详情抽屉内容

```vue
<BasicDrawer v-model:open="drawerVisible" :title="currentApp?.title ?? '应用详情'" width="520">
  <template v-if="currentApp">
    <!-- 头部大图标 + 名称 + 状态 -->
    <div class="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
      <div
        class="w-14 h-14 rounded-xl flex items-center justify-center"
        :class="currentApp.active
          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
          : 'bg-gray-100 dark:bg-gray-700'"
      >
        <span
          v-if="currentApp.icon"
          :class="[currentApp.icon, currentApp.active ? 'text-white' : 'text-gray-500']"
          class="text-2xl"
        />
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ currentApp.title }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ currentApp.name }}
        </p>
      </div>
      <span :class="getStatusTagClass(!!currentApp.active)" class="text-sm px-3 py-1">
        {{ currentApp.active ? '运行中' : '已停止' }}
      </span>
    </div>

    <!-- 应用描述 -->
    <div v-if="currentApp.description" class="mb-6 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
      <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {{ currentApp.description }}
      </p>
    </div>

    <!-- 8 项详细信息（Descriptions 组件） -->
    <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item label="应用标识">
        <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">
          {{ currentApp.name }}
        </code>
      </a-descriptions-item>

      <a-descriptions-item label="访问地址">
        <a-typography-link :href="currentApp.url" target="_blank">
          {{ currentApp.url }}
        </a-typography-link>
      </a-descriptions-item>

      <a-descriptions-item label="基础路由">
        <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">
          {{ currentApp.baseroute ?? '/' }}
        </code>
      </a-descriptions-item>

      <a-descriptions-item label="版本号">
        <a-tag color="blue">v{{ currentApp.version ?? '-' }}</a-tag>
      </a-descriptions-item>

      <a-descriptions-item label="负责团队">
        {{ currentApp.owner ?? '-' }}
      </a-descriptions-item>

      <a-descriptions-item label="加载方式">
        <a-tag :color="currentApp.loader === 'iframe' ? 'purple' : 'processing'">
          {{ currentApp.loader === 'iframe' ? 'iframe' : 'WebComponent' }}
        </a-tag>
      </a-descriptions-item>

      <a-descriptions-item label="健康检查">
        <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">
          {{ currentApp.healthUrl ?? '-' }}
        </code>
      </a-descriptions-item>

      <a-descriptions-item label="最后更新">
        {{ currentApp.lastUpdate ?? '-' }}
      </a-descriptions-item>
    </a-descriptions>

    <!-- 底部操作按钮 -->
    <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
      <a-button
        :type="currentApp.active ? 'default' : 'primary'"
        block
        size="large"
        @click="handleToggleStatus(currentApp!)"
      >
        {{ currentApp.active ? '停止应用' : '启动应用' }}
      </a-button>
      <a-button
        block
        size="large"
        @click="handlePreview(currentApp!); drawerVisible = false"
      >
        打开预览
      </a-button>
    </div>
  </template>
</BasicDrawer>
```

## 预览弹窗（MicroAppContainer 嵌入）

```vue
<BasicModal
  v-model:open="previewVisible"
  :title="`${currentApp?.title} - 预览`"
  width="90%"
  :style="{ maxWidth: '1200px', height: '80vh' }"
  :footer="null"
>
  <div class="h-[calc(80vh-100px)] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
    <!-- 嵌入微前端容器组件 -->
    <MicroAppContainer
      v-if="currentApp"
      :name="currentApp.name"
      :url="currentApp.url"
      :baseroute="currentApp.baseroute"
    />
  </div>
</BasicModal>
```

**MicroAppContainer 组件 Props：**

| Prop | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 子应用唯一标识，用于容器识别 |
| `url` | `string` | 子应用的访问地址 |
| `baseroute` | `string?` | 基础路由前缀，用于路径匹配 |

## 配置文件结构

### micro-app.ts 配置示例

```typescript
import type { MicroAppConfig, MicroAppItem } from '#/micro-app'

export const microAppConfig: MicroAppConfig = {
  // 开关：是否启用微前端功能（从环境变量读取）
  enabled: import.meta.env.VITE_MICRO_APP === 'true'
    || import.meta.env.VITE_MICRO_APP === true,

  // 注册的子应用列表
  apps: [
    {
      name: 'sub-app-example',
      url: 'http://localhost:9090',
      title: '子应用示例',
      icon: 'carbon:application',
      active: false,
      baseroute: '/sub-app',
      description: '示例子应用，用于演示微前端集成能力',
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
      description: '客户关系管理系统，包含客户、商机、合同等模块',
      version: '2.3.1',
      owner: '业务中台组',
      lastUpdate: '2025-01-14 16:45:00',
      healthUrl: '/crm/health',
      loader: 'webcomponent',
    },
    // ... 更多应用
  ] as MicroAppItem[],
}

// 辅助函数：根据名称查找应用
export function getMicroAppByName(name: string): MicroAppItem | undefined {
  return microAppConfig.apps.find(app => app.name === name)
}

// 辅助函数：获取所有应用列表
export function getAllMicroApps(): MicroAppItem[] {
  return microAppConfig.apps
}
```

### 环境变量配置

```env
# .env 文件
VITE_MICRO_APP=true
```

## 核心操作函数

### 启动/停止切换

```typescript
function handleToggleStatus(app: MicroAppItem) {
  // 直接修改 active 状态（响应式更新视图）
  app.active = !app.active
}
```

### 重启应用（先停后启）

```html
<a-popconfirm
  title="确定要重启该应用吗？"
  ok-text="确定"
  cancel-text="取消"
  @confirm="() => {
    app.active = false;
    setTimeout(() => { app.active = true }, 500);
  }"
>
  <a-button size="small" :disabled="!app.active">重启</a-button>
</a-popconfirm>
```

### 查看详情

```typescript
function handleViewDetail(app: MicroAppItem) {
  currentApp.value = app
  drawerVisible.value = true
}
```

### 打开预览

```typescript
function handlePreview(app: MicroAppItem) {
  currentApp.value = app
  previewVisible.value = true
}
```

## 空状态处理

当筛选条件没有匹配的应用时，显示友好的空状态提示：

```vue
<div v-else class="text-center py-16">
  <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
    <span class="i-carbon-application text-4xl text-gray-400" />
  </div>
  <p class="text-gray-500 dark:text-gray-400 text-base">
    未找到匹配的子应用
  </p>
  <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">
    尝试调整搜索条件或筛选器
  </p>
  <a-button type="link" class="mt-3" @click="handleResetFilters">
    清除筛选条件
  </a-button>
</div>
```

## 技术要点

1. **配置驱动**：子应用列表通过 `src/config/micro-app.ts` 配置文件管理，便于维护
2. **响应式状态**：直接修改对象的 `active` 属性即可触发视图更新（Vue 3 响应式原理）
3. **环境开关**：通过 `VITE_MICRO_APP` 环境变量控制功能启用/禁用
4. **事件隔离**：卡片内操作按钮使用 `@click.stop` 阻止事件冒泡，避免误触打开详情
5. **加载方式**：支持 iframe 和 WebComponent 两种微前端加载方案
6. **暗色模式**：全面适配 Tailwind CSS 的 `dark:` 变体，支持明暗主题切换
7. **Iconify 图标**：使用 Unocss 的 `i-carbon-*` 类名直接引用 Carbon Icons 图标集
