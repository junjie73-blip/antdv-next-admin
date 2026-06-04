<script setup lang="tsx">
import type { MicroAppItem } from '#/micro-app'
import { computed, ref, watch } from 'vue'
import { getAllMicroApps, microAppConfig } from '@/config/micro-app'
import { cn } from '@/utils/cn'

// 状态
const apps = ref<MicroAppItem[]>(getAllMicroApps())
const isEnabled = computed(() => microAppConfig.enabled)
const searchKeyword = ref('')
const statusFilter = ref<string>('all')
const activeAppKey = ref<string>('')
const iframeLoaded = ref<Record<string, boolean>>({})
const iframeLoading = ref<string | null>(null)

// 当前选中的子应用
const currentApp = computed(() => {
  return apps.value.find(app => app.name === activeAppKey.value) || null
})

// 筛选后的列表
const filteredApps = computed(() => {
  return apps.value.filter((app) => {
    const matchKeyword = !searchKeyword.value
      || app.title.includes(searchKeyword.value)
      || app.name.includes(searchKeyword.value)
      || (app.owner && app.owner.includes(searchKeyword.value))
    const matchStatus = statusFilter.value === 'all' || (
      statusFilter.value === 'running' ? app.active : !app.active
    )
    return matchKeyword && matchStatus
  })
})

// 样式类名
const statCardClassName = cn(
  'p-4 rounded-lg border bg-white dark:bg-gray-800',
  'border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow',
)

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
    return cn('px-2 py-0.5 rounded text-xs', 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400')
  }
  return cn('px-2 py-0.5 rounded text-xs', 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')
}

// 操作函数
function handleToggleStatus(app: MicroAppItem) {
  app.active = !app.active
}

function handleSelectApp(app: MicroAppItem) {
  activeAppKey.value = app.name
}

function handleIframeLoad(name: string) {
  iframeLoaded.value[name] = true
  iframeLoading.value = null
}

function handleIframeError(name: string) {
  iframeLoaded.value[name] = false
  iframeLoading.value = null
}

function _handleResetFilters() {
  searchKeyword.value = ''
  statusFilter.value = 'all'
}

function handleRefreshIframe() {
  if (!currentApp.value)
    return
  iframeLoaded.value[currentApp.value.name] = false
  const iframeEl = document.querySelector(`iframe[data-app="${currentApp.value.name}"]`) as HTMLIFrameElement
  if (iframeEl) {
    // 强制刷新 iframe
    const src = iframeEl.src
    iframeEl.src = 'about:blank'
    setTimeout(() => {
      iframeEl.src = src
    }, 50)
  }
}

// 获取子应用预览 URL（使用主应用自身页面作为演示）
function getAppPreviewUrl(app: MicroAppItem): string {
  // 如果配置了 url 且是外部地址，直接使用
  if (app.url?.startsWith('http')) {
    // 演示模式：将外部地址映射到本应用的对应页面
    const routeMap: Record<string, string> = {
      'sub-app-example': '/#/dashboard',
      'crm-system': '/#/system/user',
      'data-bi': '/#/dashboard/echarts',
      'workflow-engine': '/#/system/role',
      'file-manager': '/#/system/dict',
      'message-center': '/#/system/notice',
    }
    const mappedRoute = routeMap[app.name]
    if (mappedRoute) {
      return window.location.origin + mappedRoute
    }
  }
  // 默认：映射到系统内的演示页面
  const demoRoutes: Record<string, string> = {
    'sub-app-example': '/#/dashboard',
    'crm-system': '/#/system/user',
    'data-bi': '/#/dashboard/echarts',
    'workflow-engine': '/#/system/role',
    'file-manager': '/#/system/dict',
    'message-center': '/#/system/notice',
  }
  const route = demoRoutes[app.name] || '/#/dashboard'
  return window.location.origin + route
}

// 初始选中第一个
watch(
  () => filteredApps.value,
  (list) => {
    if (list.length > 0 && !activeAppKey.value) {
      handleSelectApp(list[0])
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full flex flex-col p-4 gap-4">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
          微前端管理
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          子应用注册与预览（iframe 嵌套模式）
        </p>
      </div>
      <a-button
        v-if="currentApp"
        @click="handleRefreshIframe"
      >
        <Icon
          icon="carbon:refresh"
          class="mr-1"
        />
        刷新预览
      </a-button>
    </div>

    <!-- 未启用提示 -->
    <div
      v-if="!isEnabled"
      class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
    >
      <span class="i-carbon-warning-alt text-yellow-500 mr-2" />
      <span class="text-sm text-yellow-800 dark:text-yellow-200">
        微前端功能未启用，请在 .env 中设置 VITE_MICRO_APP=true
      </span>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="flex gap-4 min-h-0 flex-1">
      <!-- 左侧：应用列表 -->
      <div
        class="w-[320px] shrink-0 flex flex-col gap-3 overflow-y-auto rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-3"
      >
        <!-- 统计概览 -->
        <div class="grid grid-cols-3 gap-2">
          <div
            :class="statCardClassName"
            class="p-2 text-center"
          >
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ apps.length }}
            </p>
            <p class="text-[10px] text-gray-500">
              总数
            </p>
          </div>
          <div
            :class="statCardClassName"
            class="p-2 text-center"
          >
            <p class="text-lg font-bold text-green-600">
              {{ apps.filter(a => a.active).length }}
            </p>
            <p class="text-[10px] text-gray-500">
              运行
            </p>
          </div>
          <div
            :class="statCardClassName"
            class="p-2 text-center"
          >
            <p class="text-lg font-bold text-gray-500">
              {{ apps.filter(a => !a.active).length }}
            </p>
            <p class="text-[10px] text-gray-500">
              停止
            </p>
          </div>
        </div>

        <!-- 搜索筛选 -->
        <div class="flex flex-col gap-2">
          <a-input
            v-model:value="searchKeyword"
            placeholder="搜索子应用..."
            size="small"
            allow-clear
          >
            <template #prefix>
              <span class="i-carbon-search text-gray-400 text-xs" />
            </template>
          </a-input>
          <a-select
            v-model:value="statusFilter"
            size="small"
            class="w-full"
          >
            <a-select-option value="all">
              全部状态
            </a-select-option>
            <a-select-option value="running">
              运行中
            </a-select-option>
            <a-select-option value="stopped">
              已停止
            </a-select-option>
          </a-select>
        </div>

        <!-- 应用列表 -->
        <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
          <div
            v-for="app in filteredApps"
            :key="app.name"
            :class="cn(
              'p-3 rounded-lg border cursor-pointer transition-all duration-150',
              'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
              activeAppKey === app.name
                ? 'border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-900/20 shadow-sm'
                : 'hover:border-blue-300 hover:shadow-sm',
            )"
            @click="handleSelectApp(app)"
          >
            <!-- 应用头部 -->
            <div class="flex items-center gap-2 mb-1.5">
              <div
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-sm"
                :class="app.active
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gray-100 dark:bg-gray-700'"
              >
                <span
                  v-if="app.icon"
                  :class="[app.icon,
                           app.active ? 'text-white' : 'text-gray-500']"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ app.title }}
                </p>
                <p class="text-[10px] text-gray-400 truncate">
                  {{ app.name }}
                </p>
              </div>
              <span
                :class="getStatusTagClass(!!app.active)"
                class="shrink-0 text-[10px] px-1.5 py-0.5"
              >
                {{ app.active ? '运行' : '停止' }}
              </span>
            </div>

            <!-- 元信息 -->
            <div class="flex items-center gap-2 text-[10px] text-gray-500">
              <span>v{{ app.version ?? '-' }}</span>
              <span :class="getLoaderBadgeClass(app.loader)">{{ app.loader === 'iframe' ? 'iframe' : 'WC' }}</span>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-if="filteredApps.length === 0"
            class="flex flex-col items-center justify-center py-8 text-gray-400"
          >
            <span class="i-carbon-application text-3xl mb-2 opacity-30" />
            <p class="text-xs">
              无匹配的子应用
            </p>
          </div>
        </div>
      </div>

      <!-- 右侧：iframe 预览区域 -->
      <div class="flex-1 flex flex-col min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
        <!-- 预览头部信息栏 -->
        <div
          v-if="currentApp"
          class="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center"
              :class="currentApp.active
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                : 'bg-gray-100 dark:bg-gray-700'"
            >
              <span
                v-if="currentApp.icon"
                :class="[currentApp.icon,
                         currentApp.active ? 'text-white' : 'text-gray-500']"
                class="text-base"
              />
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ currentApp.title }}
              </p>
              <p class="text-[10px] text-gray-500">
                {{ getAppPreviewUrl(currentApp) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span :class="getStatusTagClass(!!currentApp.active)">
              {{ currentApp.active ? '运行中' : '已停止' }}
            </span>
            <a-button
              :type="currentApp.active ? 'default' : 'primary'"
              size="small"
              @click="handleToggleStatus(currentApp!)"
            >
              {{ currentApp.active ? '停止' : '启动' }}
            </a-button>
          </div>
        </div>

        <!-- iframe 容器 -->
        <div class="flex-1 relative bg-white dark:bg-gray-800">
          <!-- 加载态 -->
          <div
            v-if="!iframeLoaded[currentApp!.name]"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900"
          >
            <a-spin size="large" />
            <p class="mt-2 text-xs text-gray-500">
              正在加载子应用 {{ currentApp?.title }}...
            </p>
          </div>

          <!-- iframe 嵌入子应用 -->
          <iframe
            v-if="currentApp"
            :data-app="currentApp.name"
            :src="getAppPreviewUrl(currentApp)"
            class="w-full h-full border-0"
            :style="{ minHeight: '500px' }"
            frameborder="0"
            allow="clipboard-write; autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            @load="handleIframeLoad(currentApp!.name)"
            @error="handleIframeError(currentApp!.name)"
          />

          <!-- 无选中状态 -->
          <div
            v-if="!currentApp"
            class="h-full flex flex-col items-center justify-center text-gray-400"
          >
            <span class="i-carbon-application text-5xl mb-3 opacity-20" />
            <p class="text-sm">
              选择左侧子应用开始预览
            </p>
            <p class="text-xs mt-1 opacity-60">
              支持 iframe 嵌套模式
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
