<script setup lang="ts">
import { computed } from 'vue'
import { getAllMicroApps, microAppConfig } from '@/config/micro-app'
import { cn } from '@/utils/cn'

const apps = computed(() => getAllMicroApps())
const isEnabled = computed(() => microAppConfig.enabled)

const cardClassName = computed(() =>
  cn(
    'p-4 rounded-lg border',
    'bg-white dark:bg-gray-800',
    'border-gray-200 dark:border-gray-700',
    'hover:shadow-md transition-shadow',
  ),
)

const statusClassName = computed(() => (active: boolean) =>
  cn(
    'px-2 py-1 rounded-full text-xs font-medium',
    active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ),
)
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        微前端管理
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        当前状态：{{ isEnabled ? '已启用' : '未启用' }}
      </p>
    </div>

    <div
      v-if="!isEnabled"
      class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
    >
      <p class="text-yellow-800 dark:text-yellow-200">
        微前端功能未启用。请在 .env 文件中设置 VITE_MICRO_APP=true 启用。
      </p>
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="app in apps"
        :key="app.name"
        :class="cardClassName"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span
              v-if="app.icon"
              :class="app.icon"
              class="text-2xl"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ app.title }}
            </h3>
          </div>
          <span :class="statusClassName(app.active ?? false)">
            {{ app.active ? '运行中' : '已停止' }}
          </span>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {{ app.name }}
        </p>

        <p class="text-xs text-gray-500 dark:text-gray-500 mb-4 truncate">
          {{ app.url }}
        </p>

        <div class="flex gap-2">
          <a-button
            type="primary"
            size="small"
            @click="() => {}"
          >
            启动
          </a-button>
          <a-button
            size="small"
            @click="() => {}"
          >
            停止
          </a-button>
        </div>
      </div>
    </div>

    <div
      v-if="isEnabled && apps.length === 0"
      class="text-center py-12"
    >
      <p class="text-gray-500 dark:text-gray-400">
        暂无子应用配置
      </p>
    </div>
  </div>
</template>
