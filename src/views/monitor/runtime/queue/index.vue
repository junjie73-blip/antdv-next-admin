<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { onMounted, onUnmounted, ref } from 'vue'

import { MONITOR_PERMS } from '~/enums/permissions'

import type { QueueOverview } from './api'

import { cleanQueue, getQueueOverview, pauseQueue, resumeQueue } from './api'
import QueueJobDrawer from './components/QueueJobDrawer.vue'
import { QUEUE_LABEL, cardClassName, containerClassName, queueHealthColor } from './constants'

defineOptions({ name: 'MonitorQueue' })

const loading = ref(false)
const queues = ref<QueueOverview[]>([])
const lastUpdate = ref('')

/** 当前打开详情的队列 */
const detailOpen = ref(false)
const currentQueue = ref<string | null>(null)

/** 卡片上正在进行的操作（防止重复点击） */
const actingName = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const res: any = await getQueueOverview()
    queues.value = res?.data ?? res ?? []
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    lastUpdate.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } finally {
    loading.value = false
  }
}

async function handlePause(q: QueueOverview) {
  actingName.value = q.name
  try {
    await pauseQueue(q.name)
    message.success(`已暂停「${QUEUE_LABEL[q.name] ?? q.name}」`)
    await load()
  } finally {
    actingName.value = null
  }
}

async function handleResume(q: QueueOverview) {
  actingName.value = q.name
  try {
    await resumeQueue(q.name)
    message.success(`已恢复「${QUEUE_LABEL[q.name] ?? q.name}」`)
    await load()
  } finally {
    actingName.value = null
  }
}

async function handleClean(q: QueueOverview, status: 'completed' | 'failed') {
  actingName.value = q.name
  try {
    const res: any = await cleanQueue(q.name, { status, limit: 1000 })
    const removed = (res?.data ?? res)?.removed ?? 0
    message.success(`已清理 ${removed} 个${status === 'completed' ? '已完成' : '失败'} Job`)
    await load()
  } finally {
    actingName.value = null
  }
}

function handleOpenDetail(q: QueueOverview) {
  currentQueue.value = q.name
  detailOpen.value = true
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void load()
  timer = setInterval(() => void load(), 10_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div :class="containerClassName">
    <!-- 顶部概览 -->
    <div :class="cardClassName" class="shrink-0">
      <div class="flex items-center justify-between p-4 pb-3">
        <div>
          <h2 class="text-base font-medium text-gray-800 dark:text-gray-100">队列监控</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            查看 BullMQ 队列积压、失败、暂停状态，支持暂停 / 恢复 / 清理操作
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span>更新于 {{ lastUpdate }}</span>
          <button
            type="button"
            class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            :disabled="loading"
            title="刷新"
            @click="load"
          >
            <Icon
              :icon="loading ? 'carbon:circle-dashed' : 'carbon:renew'"
              :class="['text-sm', loading && 'animate-spin']"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- 队列卡片网格 -->
    <a-spin :spinning="loading && queues.length === 0">
      <a-empty v-if="!loading && queues.length === 0" description="未检测到队列" class="py-12" />

      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="q in queues"
          :key="q.name"
          :class="cardClassName"
          class="relative overflow-hidden transition-all hover:shadow-md"
        >
          <!-- 顶部状态条 -->
          <div
            :class="[
              'absolute inset-x-0 top-0 h-1',
              {
                'bg-green-500': queueHealthColor(q) === 'green',
                'bg-blue-500': queueHealthColor(q) === 'blue',
                'bg-orange-500': queueHealthColor(q) === 'orange',
                'bg-red-500': queueHealthColor(q) === 'red',
                'bg-gray-400': queueHealthColor(q) === 'gray',
              },
            ]"
          />

          <div class="p-4">
            <!-- 标题行 -->
            <div class="mb-3 flex items-start justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                    {{ QUEUE_LABEL[q.name] ?? q.name }}
                  </span>
                  <a-tag v-if="q.isPaused" color="default" class="!m-0 !text-[10px]"> 已暂停 </a-tag>
                </div>
                <div class="mt-0.5 font-mono text-[11px] text-gray-400" :title="q.name">
                  {{ q.name }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <a-tag v-if="q.workers > 0" color="green" class="!m-0 !text-[10px]"> {{ q.workers }} 消费者 </a-tag>
                <a-tag v-else color="red" class="!m-0 !text-[10px]">无消费者</a-tag>
              </div>
            </div>

            <!-- 状态统计 -->
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800/40">
                <div class="text-[11px] text-gray-500">等待</div>
                <div class="mt-0.5 text-lg font-semibold text-gray-800 tabular-nums dark:text-gray-100">
                  {{ q.counts.wait }}
                </div>
              </div>
              <div class="rounded-lg bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30">
                <div class="text-[11px] text-blue-500">执行中</div>
                <div class="mt-0.5 text-lg font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                  {{ q.counts.active }}
                </div>
              </div>
              <div
                :class="[
                  'rounded-lg px-2 py-1.5',
                  q.counts.failed > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-gray-50 dark:bg-gray-800/40',
                ]"
              >
                <div :class="['text-[11px]', q.counts.failed > 0 ? 'text-red-500' : 'text-gray-500']">失败</div>
                <div
                  :class="[
                    'mt-0.5 text-lg font-semibold tabular-nums',
                    q.counts.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100',
                  ]"
                >
                  {{ q.counts.failed }}
                </div>
              </div>
            </div>

            <!-- 次要信息 -->
            <div class="mt-2 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
              <span>已完成 {{ q.counts.completed }}</span>
              <span>延迟 {{ q.counts.delayed }}</span>
            </div>

            <!-- 操作 -->
            <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
              <div class="flex items-center gap-1">
                <a-button
                  v-if="!q.isPaused"
                  type="link"
                  size="small"
                  :loading="actingName === q.name"
                  v-permission="MONITOR_PERMS.queue.manage"
                  @click="handlePause(q)"
                >
                  <template #icon><Icon icon="carbon:pause" /></template>
                  暂停
                </a-button>
                <a-button
                  v-else
                  type="link"
                  size="small"
                  :loading="actingName === q.name"
                  v-permission="MONITOR_PERMS.queue.manage"
                  @click="handleResume(q)"
                >
                  <template #icon><Icon icon="carbon:play" /></template>
                  恢复
                </a-button>
              </div>

              <div class="flex items-center gap-1">
                <a-popconfirm
                  v-if="q.counts.failed > 0"
                  title="清理失败 Job"
                  :description="`将删除「${QUEUE_LABEL[q.name] ?? q.name}」中所有失败 Job，确定继续？`"
                  ok-text="清理"
                  ok-type="danger"
                  @confirm="handleClean(q, 'failed')"
                >
                  <a-button type="link" size="small" danger v-permission="MONITOR_PERMS.queue.manage">
                    清理失败
                  </a-button>
                </a-popconfirm>

                <a-button type="primary" size="small" ghost @click="handleOpenDetail(q)"> 详情 </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- Job 详情抽屉 -->
    <QueueJobDrawer v-model:open="detailOpen" :queue-name="currentQueue" @changed="load" />
  </div>
</template>
