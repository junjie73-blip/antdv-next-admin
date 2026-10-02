<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import { MONITOR_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { JobRecord, JobStatus } from '../api'

import { getQueueJobDetail, getQueueJobs, removeQueueJob, retryQueueJob } from '../api'
import { JOB_STATUS_OPTIONS, STATUS_MAP, formatDuration } from '../constants'

defineOptions({ name: 'QueueJobDrawer' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ queueName: string | null }>()
const emit = defineEmits<{ changed: [] }>()

const loading = ref(false)
const jobs = ref<JobRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const status = ref<JobStatus | undefined>('failed')
const keyword = ref('')

/* 详情子弹窗 */
const detailOpen = ref(false)
const jobDetail = ref<JobRecord | null>(null)
const detailLoading = ref(false)

const title = computed(() => `队列详情 · ${props.queueName ?? ''}`)

async function load() {
  if (!props.queueName) return
  loading.value = true
  try {
    const res: any = await getQueueJobs(props.queueName, {
      status: status.value,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
    })
    const data = res?.data ?? res ?? {}
    jobs.value = data.list ?? []
    total.value = data.total ?? 0
  } finally {
    loading.value = false
  }
}

watch(
  () => props.queueName,
  (v) => {
    if (v && open.value) {
      pageNum.value = 1
      void load()
    }
  },
)

watch(open, (v) => {
  if (v && props.queueName) {
    pageNum.value = 1
    void load()
  } else {
    jobs.value = []
  }
})

watch(status, () => {
  pageNum.value = 1
  void load()
})

async function handleViewDetail(job: JobRecord) {
  if (!props.queueName) return
  detailLoading.value = true
  detailOpen.value = true
  try {
    const res: any = await getQueueJobDetail(props.queueName, job.id)
    jobDetail.value = res?.data ?? res ?? job
  } finally {
    detailLoading.value = false
  }
}

async function handleRetry(job: JobRecord) {
  if (!props.queueName) return
  await retryQueueJob(props.queueName, job.id)
  message.success('已重新入队')
  await load()
  emit('changed')
}

async function handleRemove(job: JobRecord) {
  if (!props.queueName) return
  await removeQueueJob(props.queueName, job.id)
  message.success('已删除')
  await load()
  emit('changed')
}

function handlePageChange(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
  void load()
}

async function handleRefresh() {
  pageNum.value = 1
  await load()
}
</script>

<template>
  <a-drawer
    v-model:open="open"
    :title="title"
    :width="880"
    :destroy-on-close="true"
    @after-open-change="(v: boolean) => v && load()"
  >
    <!-- 筛选 -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <a-radio-group v-model:value="status" button-style="solid" size="small">
        <a-radio-button v-for="o in JOB_STATUS_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-radio-button>
      </a-radio-group>

      <a-input-search
        v-model:value="keyword"
        placeholder="搜索 Job ID"
        style="width: 220px"
        allow-clear
        size="small"
        @search="handleRefresh"
      />

      <div class="flex-1" />

      <a-button size="small" :loading="loading" @click="handleRefresh">
        <template #icon><Icon icon="carbon:renew" /></template>
        刷新
      </a-button>
    </div>

    <!-- 列表 -->
    <a-spin :spinning="loading">
      <div v-if="jobs.length === 0 && !loading" class="flex flex-col items-center gap-2 py-12 text-xs text-gray-400">
        <Icon icon="carbon:document-blank" class="text-3xl" />
        <span>无匹配 Job</span>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="job in jobs"
          :key="job.id"
          class="rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200 dark:border-gray-800 dark:hover:border-gray-700"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <a-tag :color="STATUS_MAP[job.status]?.color" class="!m-0 !text-[10px]">
                  {{ STATUS_MAP[job.status]?.label ?? job.status }}
                </a-tag>
                <code class="font-mono text-gray-700 dark:text-gray-200">{{ job.id }}</code>
                <span class="text-gray-400">·</span>
                <span class="text-gray-500">{{ job.name }}</span>
              </div>

              <div
                v-if="job.status === 'failed' && job.failedReason"
                class="mt-1 truncate text-xs text-red-500"
                :title="job.failedReason"
              >
                {{ job.failedReason }}
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                <span>尝试 {{ job.attemptsMade }}/{{ job.maxAttempts }}</span>
                <span>进度 {{ job.progress }}</span>
                <span v-if="job.duration">耗时 {{ formatDuration(job.duration) }}</span>
                <span>{{ dayjs(job.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</span>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <a-button
                v-if="job.status === 'failed'"
                size="small"
                :loading="loading"
                v-permission="MONITOR_PERMS.queue.manage"
                @click="handleRetry(job)"
              >
                <template #icon><Icon icon="carbon:renew" /></template>
                重试
              </a-button>
              <a-button size="small" @click="handleViewDetail(job)"> 查看 </a-button>
              <a-popconfirm title="删除该 Job？" ok-type="danger" @confirm="handleRemove(job)">
                <a-button size="small" danger v-permission="MONITOR_PERMS.queue.manage">
                  <template #icon><Icon icon="carbon:trash-can" /></template>
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="mt-4 flex justify-end">
        <a-pagination
          v-model:current="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :show-size-changer="true"
          :page-size-options="['10', '20', '50']"
          :show-total="(t: number) => `共 ${t} 条`"
          size="small"
          @change="handlePageChange"
        />
      </div>
    </a-spin>

    <!-- Job 详情弹窗 -->
    <a-modal v-model:open="detailOpen" title="Job 详情" :width="720" :footer="null">
      <a-spin :spinning="detailLoading">
        <template v-if="jobDetail">
          <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded bg-gray-50 px-2 py-1.5 dark:bg-gray-800/40">
              <div class="text-gray-500">ID</div>
              <code class="font-mono">{{ jobDetail.id }}</code>
            </div>
            <div class="rounded bg-gray-50 px-2 py-1.5 dark:bg-gray-800/40">
              <div class="text-gray-500">状态</div>
              <a-tag :color="STATUS_MAP[jobDetail.status]?.color" class="!m-0">
                {{ STATUS_MAP[jobDetail.status]?.label }}
              </a-tag>
            </div>
            <div class="rounded bg-gray-50 px-2 py-1.5 dark:bg-gray-800/40">
              <div class="text-gray-500">尝试次数</div>
              {{ jobDetail.attemptsMade }} / {{ jobDetail.maxAttempts }}
            </div>
            <div class="rounded bg-gray-50 px-2 py-1.5 dark:bg-gray-800/40">
              <div class="text-gray-500">耗时</div>
              {{ formatDuration(jobDetail.duration) }}
            </div>
          </div>

          <div class="mb-3">
            <div class="mb-1 text-xs font-medium text-gray-600">参数（data）</div>
            <pre
              class="max-h-[200px] overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-[11px] dark:border-gray-800 dark:bg-gray-800/40"
              >{{ JSON.stringify(jobDetail.data, null, 2) }}</pre>
          </div>

          <div v-if="jobDetail.returnvalue != null" class="mb-3">
            <div class="mb-1 text-xs font-medium text-gray-600">返回值</div>
            <pre
              class="max-h-[150px] overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-[11px] dark:border-gray-800 dark:bg-gray-800/40"
              >{{ JSON.stringify(jobDetail.returnvalue, null, 2) }}</pre>
          </div>

          <div v-if="jobDetail.failedReason">
            <div class="mb-1 text-xs font-medium text-red-600">失败原因</div>
            <pre
              class="max-h-[200px] overflow-auto rounded border border-red-100 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >{{ jobDetail.failedReason }}
{{ jobDetail.stacktrace?.join('\n') }}</pre>
          </div>
        </template>
      </a-spin>
    </a-modal>
  </a-drawer>
</template>
