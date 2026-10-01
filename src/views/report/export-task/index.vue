<template>
  <div :class="containerClassName">
    <!-- 统计卡片 -->
    <ExportStatsCards :stats :loading="statsLoading" />

    <!-- 图表区 -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="lg:col-span-1">
        <ExportStatusPie :stats :loading="statsLoading" />
      </div>
      <div class="lg:col-span-2">
        <ExportTrendChart :data="trend" :loading="trendLoading" />
      </div>
    </div>

    <!-- 任务列表 -->
    <a-card :bordered="false">
      <BasicTable
        :columns="exportTaskColumns"
        :api="getExportTaskList"
        :immediate="true"
        :use-search-form="false"
        :scroll="{ x: 1400 }"
        :row-key="exportTaskRowKey"
        :action-column="exportTaskActionColumn"
        :show-table-setting="false"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: onSelectionChange,
        }"
        @register="tableRegister"
      >
        <template #toolbar>
          <div class="flex flex-wrap items-center gap-2">
            <!-- 状态 Tab -->
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="tab in STATUS_TABS"
                :key="tab.value"
                type="button"
                :class="[
                  'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all',
                  activeStatus === tab.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50',
                ]"
                @click="() => handleStatusChange(tab.value)"
              >
                {{ tab.label }}
                <span v-if="getTabCount(tab.value) > 0" class="ml-1 text-[10px] opacity-70">
                  {{ getTabCount(tab.value) }}
                </span>
              </button>
            </div>

            <div class="flex-1" />

            <!-- 刷新 -->
            <a-button size="small" @click="handleRefresh">
              <template #icon>
                <Icon icon="lucide:refresh-cw" class="h-4 w-4" />
              </template>
              刷新
            </a-button>
          </div>
        </template>

        <template #cell-file_name="{ record }">
          <div class="flex items-center gap-2">
            <div
              :class="[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                EXPORT_TYPE_MAP[record.export_type]?.color,
              ]"
            >
              <Icon :icon="EXPORT_TYPE_MAP[record.export_type]?.icon ?? 'lucide:file'" class="h-4 w-4" />
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-slate-800">
                {{ record.file_name ?? `导出任务 ${record.task_id.slice(0, 8)}` }}
              </div>
              <div v-if="record.file_size" class="text-[11px] text-slate-400">
                {{ formatSize(record.file_size) }}
              </div>
            </div>
          </div>
        </template>

        <template #cell-export_type="{ record }">
          <a-tag>{{ EXPORT_TYPE_MAP[record.export_type]?.label ?? record.export_type }}</a-tag>
        </template>

        <template #cell-status="{ record }">
          <div class="flex flex-col gap-1.5">
            <span
              :class="[
                'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                STATUS_MAP[record.status]?.badge,
              ]"
            >
              <Icon
                :icon="STATUS_MAP[record.status]?.icon"
                :class="['h-3 w-3', record.status === 'processing' && 'animate-spin']"
              />
              {{ STATUS_MAP[record.status]?.label }}
            </span>

            <!-- 进度条：只在进行中显示 -->
            <div v-if="record.status === 'processing' || record.status === 'pending'" class="w-32">
              <a-progress
                :percent="record.progress || 0"
                :show-info="false"
                size="small"
                :status="record.status === 'processing' ? 'active' : 'normal'"
              />
            </div>

            <!-- 下次重试时间 -->
            <div
              v-if="record.next_retry_at && record.status === 'pending'"
              class="flex items-center gap-1 text-[11px] text-orange-600"
            >
              <Icon icon="lucide:rotate-cw" class="h-3 w-3" />
              {{ formatNextRetry(record.next_retry_at) }}
            </div>
          </div>
        </template>

        <template #cell-row_count="{ record }">
          <span class="text-sm text-slate-600 tabular-nums">
            {{ record.row_count ? record.row_count.toLocaleString('zh-CN') : '—' }}
          </span>
        </template>

        <template #cell-duration_ms="{ record }">
          <span class="text-sm text-slate-600 tabular-nums">
            {{ formatDuration(record.duration_ms) }}
          </span>
        </template>

        <template #cell-retry_count="{ record }">
          <a-tooltip v-if="record.retry_count > 0" :title="`已重试 ${record.retry_count}/${record.max_retries} 次`">
            <span
              :class="[
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                record.retry_count >= record.max_retries ? 'bg-rose-50 text-rose-700' : 'bg-orange-50 text-orange-700',
              ]"
            >
              <Icon icon="lucide:rotate-cw" class="h-3 w-3" />
              {{ record.retry_count }}/{{ record.max_retries }}
            </span>
          </a-tooltip>
          <span v-else class="text-xs text-slate-400">—</span>
        </template>

        <template #cell-created_at="{ record }">
          <span class="text-xs text-slate-500 tabular-nums">
            {{ dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getExportTaskActions(record, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 详情弹窗 -->
    <ExportTaskDetailModal
      v-model:open="detailOpen"
      :task="currentTask"
      @retry="handleRetry"
      @download="handleDownload"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { BasicTable, useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'
import { useWebSocket } from '~/utils/ws'

import type { ExportStats, ExportTaskActionContext, ExportTaskRecord, ExportTrendItem } from './types'

import { getExportTaskActions } from './actions'
import {
  cancelExportTask,
  deleteExportTask,
  getExportTaskList,
  getExportTaskStats,
  getExportTaskTrend,
  retryExportTask,
} from './api'
import { exportTaskActionColumn, exportTaskColumns, exportTaskRowKey } from './columns'
import ExportStatsCards from './components/ExportStatsCards.vue'
import ExportStatusPie from './components/ExportStatusPie.vue'
import ExportTaskDetailModal from './components/ExportTaskDetailModal.vue'
import ExportTrendChart from './components/ExportTrendChart.vue'
import { EXPORT_TYPE_MAP, STATUS_MAP, STATUS_TABS, containerClassName, formatDuration, formatSize } from './constants'

defineOptions({ name: 'ReportExportTask' })

const [tableRegister, tableMethods] = useTable()

const activeStatus = ref('')
const selectedKeys = ref<string[]>([])

const stats = ref<ExportStats>({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  retrying: 0,
  todayCompleted: 0,
  totalSize: 0,
  avgDuration: 0,
})
const statsLoading = ref(false)

const trend = ref<ExportTrendItem[]>([])
const trendLoading = ref(false)

const detailOpen = ref(false)
const currentTask = ref<ExportTaskRecord | null>(null)

/* ============================================================
 * 数据加载
 * ============================================================ */
async function loadStats() {
  statsLoading.value = true
  try {
    const { data: res } = await getExportTaskStats()
    stats.value = res
  } finally {
    statsLoading.value = false
  }
}

async function loadTrend() {
  trendLoading.value = true
  try {
    const { data: res } = await getExportTaskTrend(7)
    trend.value = res.list
  } finally {
    trendLoading.value = false
  }
}

function handleStatusChange(status: string) {
  console.log(status)

  activeStatus.value = status
  tableMethods.value?.reload({
    searchInfo: { status: status || undefined },
  })
}

function handleRefresh() {
  void loadStats()
  void loadTrend()
  tableMethods.value?.reload()
}

function getTabCount(status: string): number {
  if (!status) return 0
  return (stats.value as any)[status] ?? 0
}

function onSelectionChange(keys: string[]) {
  selectedKeys.value = keys
}

function formatNextRetry(time: string): string {
  const diff = dayjs(time).diff(dayjs(), 'second')
  if (diff <= 0) return '即将重试'
  if (diff < 60) return `${diff}秒后重试`
  return `${Math.floor(diff / 60)}分钟后重试`
}

/* ============================================================
 * 行操作
 * ============================================================ */
const actionCtx: ExportTaskActionContext = {
  onDetail(record) {
    currentTask.value = record
    detailOpen.value = true
  },

  onDownload(record) {
    if (record.file_url) {
      window.open(record.file_url, '_blank')
    }
  },

  async onRetry(record) {
    await retryExportTask(record.task_id)
    message.success('已重新提交')
    handleRefresh()
  },

  async onCancel(record) {
    await cancelExportTask(record.task_id)
    message.success('已取消')
    handleRefresh()
  },

  async onDelete(record) {
    await deleteExportTask(record.task_id)
    message.success('已删除')
    handleRefresh()
  },
}

async function handleRetry(record: ExportTaskRecord) {
  await actionCtx.onRetry(record)
  detailOpen.value = false
}

function handleDownload(record: ExportTaskRecord) {
  actionCtx.onDownload(record)
}

/* ============================================================
 * WebSocket：任务状态变化实时刷新
 * ============================================================ */
const ws = useWebSocket()
let offNotice: (() => void) | null = null

onMounted(() => {
  loadStats()
  loadTrend()

  // 监听到报表通知时刷新
  offNotice = ws.onNotice((item: { source: string }) => {
    if (item.source === 'report') {
      // 简单刷新（也可做防抖）
      setTimeout(() => {
        tableMethods.value?.reload()
        void loadStats()
      }, 1000)
    }
  })
})

onUnmounted(() => {
  offNotice?.()
})
</script>
