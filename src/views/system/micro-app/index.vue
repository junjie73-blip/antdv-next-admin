<script setup lang="tsx">
import type { MicroAppItem } from '#/micro-app'
import { computed, ref } from 'vue'
import { getAllMicroApps, microAppConfig } from '@/config/micro-app'
import { cn } from '@/utils/cn'

// 状态管理
const apps = ref<MicroAppItem[]>(getAllMicroApps())
const isEnabled = computed(() => microAppConfig.enabled)
const searchKeyword = ref('')
const statusFilter = ref<string>('all')
const loaderFilter = ref<string>('all')
const drawerVisible = ref(false)
const currentApp = ref<MicroAppItem | null>(null)
const previewVisible = ref(false)

// 统计数据
const totalCount = computed(() => apps.value.length)
const runningCount = computed(() => apps.value.filter(app => app.active).length)
const stoppedCount = computed(() => apps.value.filter(app => !app.active).length)
const iframeCount = computed(() => apps.value.filter(app => app.loader === 'iframe').length)
const webcomponentCount = computed(() => apps.value.filter(app => app.loader === 'webcomponent').length)

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
    const matchLoader = loaderFilter.value === 'all' || app.loader === loaderFilter.value
    return matchKeyword && matchStatus && matchLoader
  })
})

// 样式类名
const statCardClassName = cn(
  'p-4 rounded-lg border bg-white dark:bg-gray-800',
  'border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow',
)

const appCardClassName = cn(
  'p-5 rounded-lg border cursor-pointer',
  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  'hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600',
  'transition-all duration-200',
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

function handleViewDetail(app: MicroAppItem) {
  currentApp.value = app
  drawerVisible.value = true
}

function handlePreview(app: MicroAppItem) {
  currentApp.value = app
  previewVisible.value = true
}

function handleResetFilters() {
  searchKeyword.value = ''
  statusFilter.value = 'all'
  loaderFilter.value = 'all'
}
</script>

<template>
  <div class="p-6">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        微前端管理
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        管理和监控所有注册的微前端子应用
      </p>
    </div>

    <!-- 未启用提示 -->
    <div
      v-if="!isEnabled"
      class="p-4 mb-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
    >
      <div class="flex items-center gap-2">
        <span class="i-carbon-warning-alt text-yellow-500 text-xl" />
        <p class="text-sm text-yellow-800 dark:text-yellow-200">
          微前端功能未启用。请在 .env 文件中设置 VITE_MICRO_APP=true 启用。
        </p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div :class="statCardClassName">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <span class="i-carbon-application text-blue-600 dark:text-blue-400 text-xl" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ totalCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              总应用数
            </p>
          </div>
        </div>
      </div>

      <div :class="statCardClassName">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <span class="i-carbon-circle-filled text-green-500 text-xl" />
          </div>
          <div>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">
              {{ runningCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              运行中
            </p>
          </div>
        </div>
      </div>

      <div :class="statCardClassName">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <span class="i-carbon-pause-filled text-gray-500 text-xl" />
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {{ stoppedCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              已停止
            </p>
          </div>
        </div>
      </div>

      <div :class="statCardClassName">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <span class="i-carbon-document-text text-purple-600 dark:text-purple-400 text-xl" />
          </div>
          <div>
            <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {{ iframeCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              iframe 模式
            </p>
          </div>
        </div>
      </div>

      <div :class="statCardClassName">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
            <span class="i-carbon-code text-cyan-600 dark:text-cyan-400 text-xl" />
          </div>
          <div>
            <p class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {{ webcomponentCount }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              WebComponent
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索与筛选栏 -->
    <div class="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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

      <a-select
        v-model:value="statusFilter"
        style="width: 130px"
        placeholder="运行状态"
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

      <a-select
        v-model:value="loaderFilter"
        style="width: 140px"
        placeholder="加载方式"
      >
        <a-select-option value="all">
          全部模式
        </a-select-option>
        <a-select-option value="webcomponent">
          WebComponent
        </a-select-option>
        <a-select-option value="iframe">
          iframe
        </a-select-option>
      </a-select>

      <a-button @click="handleResetFilters">
        重置
      </a-button>

      <span class="ml-auto text-sm text-gray-500 dark:text-gray-400">
        共 {{ filteredApps.length }} 个应用
      </span>
    </div>

    <!-- 应用卡片网格 -->
    <div
      v-if="filteredApps.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      <div
        v-for="app in filteredApps"
        :key="app.name"
        :class="appCardClassName"
        @click="handleViewDetail(app)"
      >
        <!-- 卡片头部：图标 + 名称 + 状态 -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center"
              :class="app.active
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                : 'bg-gray-100 dark:bg-gray-700'"
            >
              <span
                v-if="app.icon"
                :class="[app.icon,
                         app.active ? 'text-white' : 'text-gray-500']"
                class="text-xl"
              />
              <span
                v-else
                :class="app.active ? 'text-white' : 'text-gray-400'"
                class="i-carbon-application text-xl"
              />
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                {{ app.title }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ app.name }}
              </p>
            </div>
          </div>
          <span :class="getStatusTagClass(!!app.active)">
            {{ app.active ? '运行中' : '已停止' }}
          </span>
        </div>

        <!-- 描述 -->
        <p
          v-if="app.description"
          class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2"
        >
          {{ app.description }}
        </p>

        <!-- 元信息行 -->
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

        <!-- 地址 -->
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900/60 rounded-md mb-4">
          <span class="i-carbon-link text-gray-400 text-xs shrink-0" />
          <span class="text-xs text-gray-600 dark:text-gray-400 truncate font-mono">
            {{ app.url }}
          </span>
        </div>

        <!-- 操作按钮 -->
        <div
          class="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700"
          @click.stop
        >
          <a-button
            :type="app.active ? 'default' : 'primary'"
            size="small"
            @click="handleToggleStatus(app)"
          >
            {{ app.active ? '停止' : '启动' }}
          </a-button>
          <a-button
            size="small"
            @click="handlePreview(app)"
          >
            预览
          </a-button>
          <a-popconfirm
            title="确定要重启该应用吗？"
            ok-text="确定"
            cancel-text="取消"
            @confirm="() => { app.active = false; setTimeout(() => { app.active = true }, 500); }"
          >
            <a-button
              size="small"
              :disabled="!app.active"
            >
              重启
            </a-button>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="text-center py-16"
    >
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span class="i-carbon-application text-4xl text-gray-400" />
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-base">
        未找到匹配的子应用
      </p>
      <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">
        尝试调整搜索条件或筛选器
      </p>
      <a-button
        type="link"
        class="mt-3"
        @click="handleResetFilters"
      >
        清除筛选条件
      </a-button>
    </div>

    <!-- 详情抽屉 -->
    <BasicDrawer
      v-model:open="drawerVisible"
      :title="currentApp?.title ?? '应用详情'"
      width="520"
    >
      <template v-if="currentApp">
        <!-- 头部信息 -->
        <div class="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
          <div
            class="w-14 h-14 rounded-xl flex items-center justify-center"
            :class="currentApp.active
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
              : 'bg-gray-100 dark:bg-gray-700'"
          >
            <span
              v-if="currentApp.icon"
              :class="[currentApp.icon,
                       currentApp.active ? 'text-white' : 'text-gray-500']"
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
          <span
            :class="getStatusTagClass(!!currentApp.active)"
            class="text-sm px-3 py-1"
          >
            {{ currentApp.active ? '运行中' : '已停止' }}
          </span>
        </div>

        <!-- 描述 -->
        <div
          v-if="currentApp.description"
          class="mb-6 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {{ currentApp.description }}
          </p>
        </div>

        <!-- 详细信息表格 -->
        <a-descriptions
          :column="1"
          bordered
          size="small"
        >
          <a-descriptions-item label="应用标识">
            <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{{ currentApp.name }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="访问地址">
            <a-typography-link
              :href="currentApp.url"
              target="_blank"
            >
              {{ currentApp.url }}
            </a-typography-link>
          </a-descriptions-item>
          <a-descriptions-item label="基础路由">
            <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{{ currentApp.baseroute ?? '/' }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="版本号">
            <a-tag color="blue">
              v{{ currentApp.version ?? '-' }}
            </a-tag>
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
            <code class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{{ currentApp.healthUrl ?? '-' }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="最后更新">
            {{ currentApp.lastUpdate ?? '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <!-- 底部操作 -->
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

    <!-- 预览弹窗 -->
    <BasicModal
      v-model:open="previewVisible"
      :title="`${currentApp?.title} - 预览`"
      width="90%"
      :style="{ maxWidth: '1200px', height: '80vh' }"
      :footer="null"
    >
      <div class="h-[calc(80vh-100px)] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <MicroAppContainer
          v-if="currentApp"
          :name="currentApp.name"
          :url="currentApp.url"
          :baseroute="currentApp.baseroute"
        />
      </div>
    </BasicModal>
  </div>
</template>
