<template>
  <a-modal v-model:open="open" title="导出任务详情" :width="720" :footer="null" destroy-on-close>
    <div v-if="task" class="space-y-4">
      <!-- 头部 -->
      <div class="flex items-start gap-4 border-b border-slate-100 pb-4">
        <div
          :class="[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            EXPORT_TYPE_MAP[task.export_type]?.color,
          ]"
        >
          <Icon :icon="EXPORT_TYPE_MAP[task.export_type]?.icon ?? 'lucide:file'" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-base font-semibold text-slate-800">
            {{ task.file_name ?? `导出任务 ${task.task_id.slice(0, 8)}` }}
          </h3>
          <div class="mt-1 flex items-center gap-2">
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                STATUS_MAP[task.status]?.badge,
              ]"
            >
              <Icon
                :icon="STATUS_MAP[task.status]?.icon"
                :class="['h-3 w-3', task.status === 'processing' && 'animate-spin']"
              />
              {{ STATUS_MAP[task.status]?.label }}
            </span>
            <span class="font-mono text-xs text-slate-400">
              {{ task.task_id.slice(0, 8) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 进度条（进行中） -->
      <div
        v-if="task.status === 'processing' || task.status === 'pending'"
        class="rounded-lg border border-blue-100 bg-blue-50/50 p-4"
      >
        <div class="mb-2 flex items-center justify-between text-xs">
          <span class="font-medium text-blue-700">生成进度</span>
          <span class="text-blue-600 tabular-nums">{{ task.progress }}%</span>
        </div>
        <a-progress
          :percent="task.progress || 0"
          :show-info="false"
          :status="task.status === 'processing' ? 'active' : 'normal'"
        />
        <div v-if="task.next_retry_at" class="mt-2 flex items-center gap-1 text-xs text-orange-600">
          <Icon icon="lucide:rotate-cw" class="h-3.5 w-3.5" />
          下次重试：{{ dayjs(task.next_retry_at).format('HH:mm:ss') }}
        </div>
      </div>

      <!-- 失败信息 -->
      <div v-if="task.status === 'failed'" class="rounded-lg border border-rose-100 bg-rose-50/50 p-4">
        <div class="mb-1 flex items-center gap-2">
          <Icon icon="lucide:alert-circle" class="h-4 w-4 text-rose-600" />
          <span class="text-sm font-medium text-rose-700">导出失败</span>
          <a-tag v-if="task.error_type" :color="ERROR_TYPE_MAP[task.error_type]?.color" size="small">
            {{ ERROR_TYPE_MAP[task.error_type]?.label ?? task.error_type }}
          </a-tag>
        </div>
        <p class="text-sm text-rose-600">{{ task.error_msg ?? '未知错误' }}</p>
        <div v-if="task.retry_count > 0" class="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Icon icon="lucide:rotate-cw" class="h-3 w-3" />
          已重试 {{ task.retry_count }}/{{ task.max_retries }} 次
        </div>
      </div>

      <!-- 详情字段 -->
      <a-descriptions :column="2" size="small" bordered>
        <a-descriptions-item label="报表编码">
          {{ task.report_code }}
        </a-descriptions-item>
        <a-descriptions-item label="导出格式">
          {{ EXPORT_TYPE_MAP[task.export_type]?.label }}
        </a-descriptions-item>
        <a-descriptions-item label="数据量">
          {{ task.row_count ? task.row_count.toLocaleString('zh-CN') + ' 行' : '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="文件大小">
          {{ formatSize(task.file_size) }}
        </a-descriptions-item>
        <a-descriptions-item label="耗时">
          {{ formatDuration(task.duration_ms) }}
        </a-descriptions-item>
        <a-descriptions-item label="重试次数"> {{ task.retry_count }}/{{ task.max_retries }} </a-descriptions-item>
        <a-descriptions-item label="创建时间">
          {{ dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss') }}
        </a-descriptions-item>
        <a-descriptions-item label="开始时间">
          {{ task.started_at ? dayjs(task.started_at).format('YYYY-MM-DD HH:mm:ss') : '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="完成时间">
          {{ task.completed_at ? dayjs(task.completed_at).format('YYYY-MM-DD HH:mm:ss') : '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="过期时间">
          {{ task.expires_at ? dayjs(task.expires_at).format('YYYY-MM-DD HH:mm:ss') : '—' }}
        </a-descriptions-item>
      </a-descriptions>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <a-button @click="open = false">关闭</a-button>

        <a-button v-if="task.status === 'failed'" type="primary" @click="emit('retry', task)">
          <template #icon>
            <Icon icon="lucide:rotate-cw" class="h-4 w-4" />
          </template>
          重试
        </a-button>

        <a-button v-if="canDownload(task)" type="primary" @click="emit('download', task)">
          <template #icon>
            <Icon icon="lucide:download" class="h-4 w-4" />
          </template>
          下载
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import dayjs from '~/utils/dayjs'

import type { ExportTaskRecord } from '../types'

import { ERROR_TYPE_MAP, EXPORT_TYPE_MAP, STATUS_MAP, canDownload, formatDuration, formatSize } from '../constants'

defineOptions({ name: 'ExportTaskDetailModal' })

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  task: ExportTaskRecord | null
}>()

const emit = defineEmits<{
  retry: [task: ExportTaskRecord]
  download: [task: ExportTaskRecord]
}>()
</script>
