<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <!-- 进行中 -->
    <div
      class="group rounded-xl border border-gray-200/70 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm"
    >
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500">进行中</p>
          <p class="mt-1.5 text-2xl font-semibold text-slate-800 tabular-nums">
            {{ loading ? '—' : stats.pending + stats.processing }}
          </p>
          <div v-if="!loading && stats.retrying > 0" class="mt-1 flex items-center gap-1 text-[11px] text-orange-600">
            <Icon icon="lucide:rotate-cw" class="h-3 w-3" />
            {{ stats.retrying }} 个待重试
          </div>
          <div v-else class="mt-1 text-[11px] text-slate-400">
            {{ stats.pending }} 排队 · {{ stats.processing }} 生成
          </div>
        </div>
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon icon="lucide:loader-2" class="animate-spin-slow h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- 今日完成 -->
    <div
      class="group rounded-xl border border-gray-200/70 bg-white p-4 transition-all hover:border-emerald-200 hover:shadow-sm"
    >
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500">今日完成</p>
          <p class="mt-1.5 text-2xl font-semibold text-slate-800 tabular-nums">
            {{ loading ? '—' : stats.todayCompleted }}
          </p>
          <div class="mt-1 text-[11px] text-slate-400">累计 {{ stats.completed }} 个</div>
        </div>
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Icon icon="lucide:check-circle-2" class="h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- 失败 -->
    <div
      class="group rounded-xl border border-gray-200/70 bg-white p-4 transition-all hover:border-rose-200 hover:shadow-sm"
    >
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500">失败</p>
          <p class="mt-1.5 text-2xl font-semibold text-slate-800 tabular-nums">
            {{ loading ? '—' : stats.failed }}
          </p>
          <div class="mt-1 text-[11px] text-slate-400">
            {{
              stats.completed + stats.failed > 0
                ? `失败率 ${((stats.failed / (stats.completed + stats.failed)) * 100).toFixed(1)}%`
                : '暂无数据'
            }}
          </div>
        </div>
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <Icon icon="lucide:x-circle" class="h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- 平均耗时 -->
    <div
      class="group rounded-xl border border-gray-200/70 bg-white p-4 transition-all hover:border-violet-200 hover:shadow-sm"
    >
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500">平均耗时</p>
          <p class="mt-1.5 text-2xl font-semibold text-slate-800 tabular-nums">
            {{ loading ? '—' : formatDuration(stats.avgDuration) }}
          </p>
          <div class="mt-1 text-[11px] text-slate-400">已用存储 {{ formatSize(stats.totalSize) }}</div>
        </div>
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Icon icon="lucide:timer" class="h-5 w-5" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import type { ExportStats } from '../types'

import { formatDuration, formatSize } from '../constants'

defineOptions({ name: 'ExportStatsCards' })

defineProps<{
  stats: ExportStats
  loading?: boolean
}>()
</script>

<style scoped>
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
