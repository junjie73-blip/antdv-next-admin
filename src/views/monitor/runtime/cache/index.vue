<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { getCacheInfo } from '~/api'

import type { CacheInfo } from './types'

import CacheGroupList from './components/CacheGroupList.vue'
import CacheKeyList from './components/CacheKeyList.vue'
import CacheOperationLogPanel from './components/CacheOperationLogPanel.vue'
import CacheValuePanel from './components/CacheValuePanel.vue'

defineOptions({ name: 'MonitorCache' })

/* ============================================================
 * Tab 状态
 * ============================================================ */
type TabKey = 'monitor' | 'logs'
const activeTab = ref<TabKey>('monitor')

/* ============================================================
 * 联动状态（仅 monitor Tab 使用）
 * ============================================================ */
const info = ref<CacheInfo | null>(null)
const currentGroup = ref<{ name: string; prefix: string } | null>(null)
const currentKey = ref<string | null>(null)

function handleGroupChange(group: { name: string; prefix: string } | null) {
  currentGroup.value = group
  currentKey.value = null
}

function handleKeyChange(key: string | null) {
  currentKey.value = key
}

/* ============================================================
 * 顶部概览
 * ============================================================ */
const lastUpdate = ref('')

function updateTimeText() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  lastUpdate.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadInfo() {
  const res = (await getCacheInfo()) as { data?: CacheInfo } | CacheInfo
  info.value = (res as { data?: CacheInfo })?.data ?? (res as CacheInfo) ?? null
}

let infoTimer: ReturnType<typeof setInterval> | null = null
let timeTimer: ReturnType<typeof setInterval> | null = null

function startTimers() {
  stopTimers()
  infoTimer = setInterval(() => {
    if (activeTab.value === 'monitor') void loadInfo()
  }, 30000)
  timeTimer = setInterval(updateTimeText, 5000)
}

function stopTimers() {
  if (infoTimer) {
    clearInterval(infoTimer)
    infoTimer = null
  }
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
}

function refreshInfo() {
  void loadInfo()
  updateTimeText()
}

watch(activeTab, (tab) => {
  // 切回监控时刷新一次概览
  if (tab === 'monitor') {
    void loadInfo()
    updateTimeText()
  }
})

onMounted(() => {
  void loadInfo()
  updateTimeText()
  startTimers()
})

onUnmounted(stopTimers)
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-hidden">
    <!-- ⭐ Tab 切换 -->
    <div
      class="flex shrink-0 items-center gap-1 rounded-lg border border-gray-100 bg-white px-1 dark:border-gray-800 dark:bg-gray-900"
    >
      <button
        v-for="tab in [
          { key: 'monitor', label: '缓存监控', icon: 'carbon:data-base' },
          { key: 'logs', label: '操作日志', icon: 'carbon:document' },
        ]"
        :key="tab.key"
        type="button"
        :class="[
          'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
          activeTab === tab.key
            ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60',
        ]"
        @click="activeTab = tab.key as TabKey"
      >
        <Icon :icon="tab.icon" class="text-sm" />
        {{ tab.label }}
      </button>
    </div>

    <!-- ============================================================
         Tab 1：缓存监控
         ============================================================ -->
    <template v-if="activeTab === 'monitor'">
      <!-- 顶部概览 -->
      <div
        class="shrink-0 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-medium text-gray-800 dark:text-gray-100">缓存监控</h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              按缓存名称、键名逐级浏览 Redis 缓存内容，支持单条与全量清理
            </p>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>更新于 {{ lastUpdate }}</span>
            <button
              type="button"
              class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="刷新"
              @click="refreshInfo"
            >
              <Icon icon="carbon:renew" class="text-sm" />
            </button>
          </div>
        </div>

        <!-- 指标条 -->
        <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">Redis 版本</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ info?.redisVersion || '-' }}
            </span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">连接客户端</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ info?.connectedClients ?? 0 }} 个
            </span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">已用内存</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ info?.usedMemoryHuman || '-' }}
            </span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">运行时间</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100"> {{ info?.uptimeDays ?? 0 }} 天 </span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">命中率</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100"> {{ info?.hitRate || '0.00' }}% </span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-gray-500 dark:text-gray-400">Key 数量</span>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100"> {{ info?.dbKeys ?? 0 }} 个 </span>
          </div>
        </div>
      </div>

      <!-- 三栏布局 -->
      <div class="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <div class="col-span-3 min-h-0">
          <CacheGroupList :current="currentGroup?.name ?? null" @change="handleGroupChange" />
        </div>
        <div class="col-span-4 min-h-0">
          <CacheKeyList
            :prefix="currentGroup?.prefix ?? null"
            :group-name="currentGroup?.name ?? null"
            :current-key="currentKey"
            @change="handleKeyChange"
          />
        </div>
        <div class="col-span-5 min-h-0">
          <CacheValuePanel :cache-key="currentKey" />
        </div>
      </div>
    </template>

    <!-- ============================================================
         Tab 2：操作日志
         ============================================================ -->
    <div v-else class="min-h-0 flex-1">
      <CacheOperationLogPanel />
    </div>
  </div>
</template>
