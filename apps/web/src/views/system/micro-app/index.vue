<script setup lang="tsx">
import type { MicroAppItem } from '@antdv/types'

import { computed, ref, watch } from 'vue'

import { cn } from '@antdv/shared/cn'
import { buildIframeSandbox, canEscapeSandbox } from '@antdv/shared/iframe'
import { getAllMicroApps, microAppConfig } from '~/config/micro-app'

// 状态
const apps = ref<MicroAppItem[]>(getAllMicroApps())
const isEnabled = computed(() => microAppConfig.enabled)
const searchKeyword = ref('')
const statusFilter = ref<string>('all')
const activeAppKey = ref<string>('')
const iframeLoaded = ref<Record<string, boolean>>({})
const iframeLoading = ref<null | string>(null)

// 当前选中的子应用
const currentApp = computed(() => {
  return apps.value.find((app) => app.name === activeAppKey.value) || null
})

// 筛选后的列表
const filteredApps = computed(() => {
  return apps.value.filter((app) => {
    const matchKeyword =
      !searchKeyword.value ||
      app.title.includes(searchKeyword.value) ||
      app.name.includes(searchKeyword.value) ||
      (app.owner && app.owner.includes(searchKeyword.value))
    const matchStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'running' ? app.active : !app.active)
    return matchKeyword && matchStatus
  })
})

// 样式类名
const statCardClassName = cn(
  'rounded-lg border bg-white p-4 dark:bg-gray-800',
  'border-gray-200 transition-shadow hover:shadow-md dark:border-gray-700',
)

function getStatusTagClass(active: boolean) {
  return cn(
    'rounded-full px-2.5 py-1 text-xs font-medium',
    active
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  )
}

function getLoaderBadgeClass(loader?: string) {
  if (loader === 'iframe') {
    return cn(
      'rounded px-2 py-0.5 text-xs',
      'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    )
  }
  return cn(
    'rounded px-2 py-0.5 text-xs',
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  )
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
  if (!currentApp.value) return
  iframeLoaded.value[currentApp.value.name] = false
  const iframeEl = document.querySelector(
    `iframe[data-app="${currentApp.value.name}"]`,
  ) as HTMLIFrameElement
  if (iframeEl) {
    // 强制刷新 iframe
    const src = iframeEl.src
    iframeEl.src = 'about:blank'
    setTimeout(() => {
      iframeEl.src = src
    }, 50)
  }
}

// 获取子应用预览 URL
function previewUrl(app: MicroAppItem): string {
  return app.url ?? ''
}

/**
 * 预览 iframe 的 sandbox。
 *
 * 不再硬编码 `allow-scripts allow-same-origin`：那两个同时给就是浏览器告警的
 * "sandbox 可被逃逸"组合（框架脚本能顺着同源身份爬到顶层文档读主应用 token）。
 * 默认不给同源身份，只有注册表里显式 `sameOrigin: true` 的同域子应用才打开，
 * 打开后由 `previewEscapable` 在界面上标出来，让人看见这个决定。
 */
function sandboxFor(app: MicroAppItem): string {
  return buildIframeSandbox({ sameOrigin: app.sameOrigin })
}

const previewSandbox = computed(() =>
  currentApp.value ? sandboxFor(currentApp.value) : '',
)
const previewEscapable = computed(() => canEscapeSandbox(previewSandbox.value))

/** 「同源预览」标签的提示文案 */
const sandboxWarningTitle =
  '该子应用注册时打开了 sameOrigin：iframe 同时拥有 allow-scripts 与 allow-same-origin，' +
  '其脚本可以顺着同源身份访问顶层文档。仅对同域部署、确需共享登录态的子应用开放。'

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
  <div class="flex h-full flex-col gap-4 p-4">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
          微前端管理
        </h1>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          子应用注册与预览（iframe 嵌套模式）
        </p>
      </div>
      <a-button v-if="isEnabled && currentApp" @click="handleRefreshIframe">
        <Icon icon="carbon:restart" class="mr-1" />
        刷新预览
      </a-button>
    </div>

    <!-- 未启用提示 -->
    <div
      v-if="!isEnabled"
      class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20"
    >
      <span class="i-carbon-warning-alt mr-2 text-yellow-500"></span>
      <span class="text-sm text-yellow-800 dark:text-yellow-200">
        微前端功能未启用，请在 .env 中设置 VITE_MICRO_APP=true
      </span>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="flex min-h-0 flex-1 gap-4">
      <!-- 左侧：应用列表 -->
      <div
        class="flex w-[320px] shrink-0 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <!-- 统计概览 -->
        <div class="grid grid-cols-3 gap-2">
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ apps.length }}
            </p>
            <p class="text-[10px] text-gray-500">总数</p>
          </div>
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-lg font-bold text-green-600">
              {{ apps.filter((a) => a.active).length }}
            </p>
            <p class="text-[10px] text-gray-500">运行</p>
          </div>
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-lg font-bold text-gray-500">
              {{ apps.filter((a) => !a.active).length }}
            </p>
            <p class="text-[10px] text-gray-500">停止</p>
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
              <span class="i-carbon-search text-xs text-gray-400"></span>
            </template>
          </a-input>
          <a-select v-model:value="statusFilter" size="small" class="w-full">
            <a-select-option value="all"> 全部状态 </a-select-option>
            <a-select-option value="running"> 运行中 </a-select-option>
            <a-select-option value="stopped"> 已停止 </a-select-option>
          </a-select>
        </div>

        <!-- 应用列表 -->
        <Scrollbar root-class="min-h-0 flex-1">
          <div class="space-y-2">
            <div
              v-for="app in filteredApps"
              :key="app.name"
              :class="
                cn(
                  'cursor-pointer rounded-lg border p-3 transition-all duration-150',
                  'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
                  activeAppKey === app.name
                    ? 'border-blue-400 bg-blue-50/50 shadow-sm dark:border-blue-500 dark:bg-blue-900/20'
                    : 'hover:border-blue-300 hover:shadow-sm',
                )
              "
              @click="handleSelectApp(app)"
            >
              <!-- 应用头部 -->
              <div class="mb-1.5 flex items-center gap-2">
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                  :class="
                    app.active
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      : 'bg-gray-100 dark:bg-gray-700'
                  "
                >
                  <span
                    v-if="app.icon"
                    :class="[
                      app.icon,
                      app.active ? 'text-white' : 'text-gray-500',
                    ]"
                  ></span>
                </div>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {{ app.title }}
                  </p>
                  <p class="truncate text-[10px] text-gray-400">
                    {{ app.name }}
                  </p>
                </div>
                <span
                  :class="getStatusTagClass(!!app.active)"
                  class="shrink-0 px-1.5 py-0.5 text-[10px]"
                >
                  {{ app.active ? '运行' : '停止' }}
                </span>
              </div>

              <!-- 元信息 -->
              <div class="flex items-center gap-2 text-[10px] text-gray-500">
                <span>v{{ app.version ?? '-' }}</span>
                <span :class="getLoaderBadgeClass(app.loader)">{{
                  app.loader === 'iframe' ? 'iframe' : 'WC'
                }}</span>
              </div>
            </div>

            <!-- 空状态 -->
            <div
              v-if="filteredApps.length === 0"
              class="flex flex-col items-center justify-center py-8 text-gray-400"
            >
              <span class="i-carbon-application mb-2 text-3xl opacity-30"></span>
              <p class="text-xs">无匹配的子应用</p>
            </div>
          </div>
        </Scrollbar>
      </div>

      <!-- 右侧：iframe 预览区域 -->
      <div
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
      >
        <!-- 预览头部信息栏 -->
        <div
          v-if="currentApp"
          class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg"
              :class="
                currentApp.active
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gray-100 dark:bg-gray-700'
              "
            >
              <span
                v-if="currentApp.icon"
                :class="[
                  currentApp.icon,
                  currentApp.active ? 'text-white' : 'text-gray-500',
                ]"
                class="text-base"
              ></span>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ currentApp.title }}
              </p>
              <p class="text-[10px] text-gray-500">
                {{ previewUrl(currentApp) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- 打开同源身份意味着 sandbox 可被逃逸，必须让人在界面上看到 -->
            <a-tooltip v-if="previewEscapable" :title="sandboxWarningTitle">
              <a-tag color="orange">同源预览</a-tag>
            </a-tooltip>
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
        <div class="relative flex-1 bg-white dark:bg-gray-800">
          <!--
            未启用时不做"假预览"。
            过去这里会把子应用 URL 映射到本站页面（/#/dashboard 之类）来"演示"嵌入效果，
            代价是同源 + 可脚本的 iframe，等于把主应用会话暴露给一个自己套自己的框架，
            也让注册表看起来"跑通了"，其实一个真子应用都没接进来。
          -->
          <div
            v-if="!isEnabled"
            class="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-gray-400"
          >
            <span class="i-carbon-document-blurred mb-2 text-5xl opacity-20"></span>
            <p class="text-sm">预览未启用</p>
            <p class="mt-1 max-w-md text-xs opacity-70">
              设置 VITE_MICRO_APP=true 并重启后，这里会按注册表里的 URL 加载子应用
            </p>
          </div>

          <template v-else>
            <!-- 加载态 -->
            <div
              v-if="currentApp && !iframeLoaded[currentApp.name]"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900"
            >
              <a-spin size="large" />
              <p class="mt-2 text-xs text-gray-500">
                正在加载子应用 {{ currentApp.title }}...
              </p>
            </div>

            <!-- iframe 嵌入子应用 -->
            <iframe
              v-if="currentApp"
              :key="currentApp.name"
              :data-app="currentApp.name"
              :src="previewUrl(currentApp)"
              class="h-full w-full border-0"
              :style="{ minHeight: '500px' }"
              frameborder="0"
              allow="clipboard-write; autoplay; fullscreen"
              :sandbox="previewSandbox"
              @load="handleIframeLoad(currentApp.name)"
              @error="handleIframeError(currentApp.name)"
            ></iframe>

            <!-- 无选中状态 -->
            <div
              v-if="!currentApp"
              class="flex h-full flex-col items-center justify-center text-gray-400"
            >
              <span class="i-carbon-application mb-3 text-5xl opacity-20"></span>
              <p class="text-sm">选择左侧子应用开始预览</p>
              <p class="mt-1 text-xs opacity-60">支持 iframe 嵌套模式</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
