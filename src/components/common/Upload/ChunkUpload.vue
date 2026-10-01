<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed } from 'vue'

import { cn } from '~/utils/cn'

import type { ChunkUploadInstance, ChunkUploadProps, ChunkUploadTask } from './types'

import { useChunkUploader } from './composables/useChunkUploader'
import { STATUS_COLOR } from './constants'
import { formatBytes, formatDuration } from './utils'

defineOptions({ name: 'ChunkUpload' })

const props = withDefaults(defineProps<ChunkUploadProps>(), {
  chunkSize: 0,
  concurrency: 3,
  maxRetry: 3,
  autoStart: true,
  resume: true,
  multiple: true,
})

const emit = defineEmits<{
  success: [task: ChunkUploadTask]
  error: [task: ChunkUploadTask]
  change: [tasks: ChunkUploadTask[]]
  complete: [tasks: ChunkUploadTask[]]
}>()

// ============================================================
// 核心
// ============================================================
const uploader = useChunkUploader({
  chunkSize: props.chunkSize,
  concurrency: props.concurrency,
  maxRetry: props.maxRetry,

  onUpdate: (task) => {
    emit('change', uploader.getTasks())
    if (task.status === 'success') {
      emit('success', task)
      notifyCompleteIfAllDone()
    }
  },

  onError: (task) => emit('error', task),
  onMergeStart: (task) => {
    message.success(`文件 ${task.filename} 已进入合并阶段`)
  },
})

function notifyCompleteIfAllDone() {
  const all = uploader.getTasks()
  const allSettled = all.every((t) => t.status === 'success' || t.status === 'error' || t.status === 'canceled')
  if (allSettled && all.some((t) => t.status === 'success')) {
    emit('complete', all)
  }
}

const tasks = computed(() => Array.from(uploader.tasks.value.values()))

// ============================================================
// 选择文件
// ============================================================
function handleSelectFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return

  if (props.maxCount && tasks.value.length + files.length > props.maxCount) {
    message.warning(`最多同时上传 ${props.maxCount} 个文件`)
    input.value = ''
    return
  }

  const valid: File[] = []
  for (const f of files) {
    if (props.maxSize && f.size > props.maxSize * 1024 * 1024) {
      message.warning(`${f.name} 超过 ${props.maxSize}MB，已跳过`)
      continue
    }
    valid.push(f)
  }

  if (valid.length === 0) {
    input.value = ''
    return
  }

  uploader.addFiles(valid)
  if (props.autoStart) uploader.start()
  input.value = ''
}

// ============================================================
// 展示辅助
// ============================================================
function getPercent(task: ChunkUploadTask): number {
  if (task.total === 0) return 0
  return Math.min(100, Math.round((task.loaded / task.total) * 100))
}

/** 状态文案 */
function getStatusText(task: ChunkUploadTask): string {
  switch (task.status) {
    case 'waiting':
      return '等待中'
    case 'hashing':
      return '计算中'
    case 'uploading':
      return '上传中'
    case 'paused':
      return '已暂停'
    case 'merging':
      return getMergeStatusText(task.mergeStatus)
    case 'success':
      return '已完成'
    case 'error':
      return '上传失败'
    case 'canceled':
      return '已取消'
    default:
      return task.status
  }
}

/** 合并阶段细分文案 */
function getMergeStatusText(status?: 'pending' | 'merging' | 'uploading' | 'completed' | 'failed'): string {
  switch (status) {
    case 'pending':
      return '准备合并'
    case 'merging':
      return '合并中'
    case 'uploading':
      return '上传中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '合并失败'
    default:
      return '合并中'
  }
}

function getStatusColor(task: ChunkUploadTask): string {
  return STATUS_COLOR[task.status] ?? 'default'
}

// ============================================================
// 操作
// ============================================================
function handlePause(uid: string) {
  uploader.pause(uid)
}
function handleResume(uid: string) {
  uploader.resume(uid)
}
function handleRetry(uid: string) {
  uploader.retry(uid)
}
function handleRemove(uid: string) {
  uploader.remove(uid)
}
function handleStartOne(uid: string) {
  uploader.start(uid)
}
function handleStartAll() {
  uploader.start()
}
function handlePauseAll() {
  uploader.pause()
}
function handleResumeAll() {
  uploader.resume()
}
function handleClear() {
  uploader.clear()
}

// ============================================================
// 暴露实例
// ============================================================
const instance: ChunkUploadInstance = {
  addFiles: (files) => uploader.addFiles(files),
  start: (uid) => uploader.start(uid),
  pause: (uid) => uploader.pause(uid),
  resume: (uid) => uploader.resume(uid),
  cancel: (uid) => uploader.cancel(uid),
  remove: (uid) => uploader.remove(uid),
  retry: (uid) => uploader.retry(uid),
  clear: () => uploader.clear(),
  getTasks: () => uploader.getTasks(),
}
defineExpose(instance)

// ============================================================
// 按钮可见性
// ============================================================
const hasWaiting = computed(() => tasks.value.some((t) => t.status === 'waiting'))
const hasActive = computed(() => tasks.value.some((t) => ['uploading', 'hashing', 'merging'].includes(t.status)))
const hasPaused = computed(() => tasks.value.some((t) => t.status === 'paused'))
</script>

<template>
  <div class="space-y-3">
    <!-- 工具栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <label
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
      >
        <Icon icon="carbon:upload" />
        <span>选择文件</span>
        <input type="file" class="hidden" :multiple="multiple" :accept="accept" @change="handleSelectFiles" />
      </label>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="hasWaiting"
          type="button"
          class="rounded-md bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          @click="handleStartAll"
        >
          开始全部
        </button>
        <button
          v-if="hasActive"
          type="button"
          class="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-600"
          @click="handlePauseAll"
        >
          暂停全部
        </button>
        <button
          v-if="hasPaused"
          type="button"
          class="rounded-md bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
          @click="handleResumeAll"
        >
          继续全部
        </button>
        <button
          v-if="tasks.length > 0"
          type="button"
          class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="handleClear"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="tasks.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-12 text-gray-400 dark:border-gray-700 dark:text-gray-500"
    >
      <Icon icon="carbon:cloud-upload" class="mb-2 text-4xl" />
      <p class="text-sm">点击"选择文件"开始上传</p>
    </div>

    <!-- 任务列表 -->
    <div v-else class="space-y-2">
      <div
        v-for="task in tasks"
        :key="task.uid"
        class="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-start gap-2">
            <Icon icon="carbon:document" class="mt-0.5 shrink-0 text-base text-gray-400 dark:text-gray-500" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-gray-800 dark:text-gray-100" :title="task.filename">
                {{ task.filename }}
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span class="text-gray-500 dark:text-gray-400">
                  {{ formatBytes(task.loaded) }} / {{ formatBytes(task.total) }}
                </span>
                <span v-if="task.status !== 'merging'" class="text-gray-400 dark:text-gray-500">
                  {{ getPercent(task) }}%
                </span>
                <a-tag :color="getStatusColor(task)" class="!m-0 !text-[10px] !leading-4">
                  {{ getStatusText(task) }}
                </a-tag>

                <span class="text-gray-400 dark:text-gray-500">
                  {{ formatBytes(task.chunkSize) }} × {{ task.totalChunks }} 片
                </span>

                <span v-if="task.status === 'hashing'" class="text-purple-500 dark:text-purple-400">
                  hash {{ task.hashProgress }}%
                </span>

                <span v-if="task.status === 'uploading' && task.speed > 0" class="text-gray-500 dark:text-gray-400">
                  {{ formatBytes(task.speed) }}/s · 剩余 {{ formatDuration(task.remaining) }}
                </span>
                <span v-if="task.retryCount > 0 && task.status === 'uploading'" class="text-amber-500">
                  重试 {{ task.retryCount }} 次
                </span>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <button
              v-if="task.status === 'waiting'"
              type="button"
              class="text-ant-primary rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-950"
              title="开始"
              @click="handleStartOne(task.uid)"
            >
              <Icon icon="carbon:play" />
            </button>

            <!-- 合并中不显示暂停（后端无法中断） -->
            <button
              v-if="['uploading', 'hashing'].includes(task.status)"
              type="button"
              class="rounded p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950"
              title="暂停"
              @click="handlePause(task.uid)"
            >
              <Icon icon="carbon:pause" />
            </button>

            <button
              v-if="task.status === 'paused'"
              type="button"
              class="text-ant-primary rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-950"
              title="继续"
              @click="handleResume(task.uid)"
            >
              <Icon icon="carbon:play" />
            </button>
            <button
              v-if="task.status === 'error'"
              type="button"
              class="text-ant-primary rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-950"
              title="重试"
              @click="handleRetry(task.uid)"
            >
              <Icon icon="carbon:renew" />
            </button>
            <button
              type="button"
              class="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="移除"
              @click="handleRemove(task.uid)"
            >
              <Icon icon="carbon:close" />
            </button>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <!-- 合并中：脉动动画（无具体进度） -->
          <div v-if="task.status === 'merging'" class="h-full w-full animate-pulse rounded-full bg-purple-500" />
          <!-- 其他状态：按百分比 -->
          <div
            v-else
            :class="
              cn(
                'h-full rounded-full transition-all duration-300',
                task.status === 'error' && 'bg-red-500',
                task.status === 'success' && 'bg-green-500',
                task.status === 'paused' && 'bg-amber-500',
                task.status === 'hashing' && 'bg-purple-500',
                task.status === 'uploading' && 'bg-blue-500',
                task.status === 'waiting' && 'bg-gray-300 dark:bg-gray-700',
                task.status === 'canceled' && 'bg-gray-300 dark:bg-gray-700',
              )
            "
            :style="{
              width: `${task.status === 'hashing' ? task.hashProgress : getPercent(task)}%`,
            }"
          />
        </div>

        <!-- 错误提示 -->
        <div v-if="task.error && task.status === 'error'" class="mt-1 text-xs text-red-500 dark:text-red-400">
          {{ task.error }}
        </div>

        <!-- 成功提示：显示文件信息 -->
        <div v-if="task.status === 'success'" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span class="text-green-600 dark:text-green-400">已上传并入库</span>
          <a
            v-if="task.result?.url"
            :href="task.result.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-ant-primary hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            查看文件
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
