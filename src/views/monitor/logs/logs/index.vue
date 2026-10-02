<template>
  <div :class="containerClassName">
    <a-alert
      v-if="!statusLoading && !enabled"
      type="warning"
      show-icon
      message="日志聚合未启用"
      description="未配置 LOKI_URL，无法进行日志检索。请联系管理员配置后使用。"
    />

    <template v-else>
      <!-- 模式切换 -->
      <a-tabs v-model:active-key="mode">
        <a-tab-pane key="quick" tab="快捷检索" />
        <a-tab-pane key="logql" tab="LogQL 查询" />
        <a-tab-pane key="trace" tab="按 TraceId" />
      </a-tabs>

      <!-- 快捷检索 -->
      <div v-if="mode === 'quick'" class="rounded-lg border border-gray-100 bg-white p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <div class="mb-1 text-xs text-gray-500">关键词</div>
            <a-input v-model:value="quickForm.keyword" placeholder="模糊匹配" class="!w-64" allow-clear />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">级别</div>
            <Select
              v-model:value="quickForm.level"
              :options="LEVEL_OPTIONS"
              placeholder="全部"
              allow-clear
              class="!w-32"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">模块</div>
            <a-input v-model:value="quickForm.module" placeholder="如 auth" class="!w-40" allow-clear />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">最近</div>
            <Select v-model:value="quickForm.sinceMinutes" class="!w-32">
              <a-select-option :value="5">5 分钟</a-select-option>
              <a-select-option :value="30">30 分钟</a-select-option>
              <a-select-option :value="60">1 小时</a-select-option>
              <a-select-option :value="360">6 小时</a-select-option>
              <a-select-option :value="1440">24 小时</a-select-option>
            </Select>
          </div>
          <a-button type="primary" :loading="loading" @click="handleQuickSearch">
            <template #icon><Icon icon="lucide:search" /></template>
            查询
          </a-button>
        </div>
      </div>

      <!-- LogQL -->
      <div v-if="mode === 'logql'" class="rounded-lg border border-gray-100 bg-white p-4">
        <div class="mb-1 text-xs text-gray-500">LogQL 查询（如 <code>{service="api"} |= "error"</code>）</div>
        <div class="flex gap-2">
          <a-input
            v-model:value="logqlForm.query"
            placeholder='{service="api"} |= "error"'
            class="flex-1 font-mono text-sm"
            @press-enter="handleLogqlQuery"
          />
          <a-button type="primary" :loading="loading" @click="handleLogqlQuery">
            <template #icon><Icon icon="lucide:play" /></template>
            执行
          </a-button>
        </div>
        <div class="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span>时间范围：</span>
          <a-radio-group v-model:value="logqlForm.range" size="small" button-style="solid">
            <a-radio-button :value="15">15m</a-radio-button>
            <a-radio-button :value="60">1h</a-radio-button>
            <a-radio-button :value="360">6h</a-radio-button>
            <a-radio-button :value="1440">24h</a-radio-button>
          </a-radio-group>
        </div>
      </div>

      <!-- TraceId 查询 -->
      <div v-if="mode === 'trace'" class="rounded-lg border border-gray-100 bg-white p-4">
        <div class="mb-1 text-xs text-gray-500">Trace ID</div>
        <div class="flex gap-2">
          <a-input
            v-model:value="traceForm.traceId"
            placeholder="输入 16-64 位 hex 的 traceId"
            class="flex-1 font-mono text-sm"
            @press-enter="handleTraceQuery"
          />
          <a-button type="primary" :loading="loading" @click="handleTraceQuery">
            <template #icon><Icon icon="lucide:search" /></template>
            查询
          </a-button>
        </div>
      </div>

      <!-- 结果 -->
      <div v-if="logs.length > 0" class="rounded-lg border border-gray-100 bg-white">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <span class="text-sm text-gray-500"> 共 {{ total }} 条，显示 {{ logs.length }} 条 </span>
          <a-button size="small" type="link" @click="copyAll">
            <template #icon><Icon icon="lucide:copy" /></template>
            复制全部
          </a-button>
        </div>
        <div class="max-h-[560px] overflow-y-auto">
          <div v-for="(log, i) in logs" :key="i" class="border-b border-gray-50 px-4 py-2 hover:bg-gray-50">
            <div class="mb-1 flex items-center gap-2 text-xs">
              <a-tag :color="LEVEL_MAP[extractLevel(log.message)]?.color ?? 'default'" class="!m-0 !text-[10px]">
                {{ LEVEL_MAP[extractLevel(log.message)]?.label ?? extractLevel(log.message).toUpperCase() }}
              </a-tag>
              <span class="text-gray-400">
                {{ dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS') }}
              </span>
              <span v-if="log.labels.service" class="text-gray-400">
                {{ log.labels.service }}
              </span>
            </div>
            <pre class="font-mono text-xs break-all whitespace-pre-wrap text-gray-700">{{
              extractMsg(log.message)
            }}</pre>
          </div>
        </div>
      </div>

      <a-empty v-else-if="searched" description="无日志记录" class="py-12" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Select } from 'antdv-next'
import { onMounted, reactive, ref } from 'vue'

import dayjs from '~/utils/dayjs'

import type { LogEntry } from './api'

import { getLogStatus, quickSearchLogs, queryLogs, queryLogsByTrace } from './api'
import { LEVEL_MAP, LEVEL_OPTIONS, containerClassName, extractLevel, extractMsg } from './constants'

defineOptions({ name: 'MonitorLogs' })

const statusLoading = ref(false)
const enabled = ref(false)

const mode = ref<'quick' | 'logql' | 'trace'>('quick')
const loading = ref(false)
const searched = ref(false)
const logs = ref<LogEntry[]>([])
const total = ref(0)

const quickForm = reactive({
  keyword: '',
  level: undefined as any,
  module: '',
  sinceMinutes: 30,
})

const logqlForm = reactive({
  query: '',
  range: 60,
})

const traceForm = reactive({ traceId: '' })

async function loadStatus() {
  statusLoading.value = true
  try {
    const res: any = await getLogStatus()
    enabled.value = (res?.data ?? res)?.enabled ?? false
  } catch {
    enabled.value = false
  } finally {
    statusLoading.value = false
  }
}

async function handleQuickSearch() {
  loading.value = true
  try {
    const res: any = await quickSearchLogs({
      keyword: quickForm.keyword || undefined,
      level: quickForm.level || undefined,
      module: quickForm.module || undefined,
      sinceMinutes: quickForm.sinceMinutes,
      limit: 200,
    })
    const data = res?.data ?? res
    logs.value = data?.logs ?? []
    total.value = data?.total ?? 0
    searched.value = true
  } finally {
    loading.value = false
  }
}

async function handleLogqlQuery() {
  if (!logqlForm.query.trim()) {
    message.warning('请输入 LogQL 查询')
    return
  }
  const end = Date.now()
  const start = end - logqlForm.range * 60_000
  loading.value = true
  try {
    const res: any = await queryLogs({
      start,
      end,
      query: logqlForm.query.trim(),
      limit: 500,
      direction: 'backward',
    })
    const data = res?.data ?? res
    logs.value = data?.logs ?? []
    total.value = data?.total ?? 0
    searched.value = true
  } finally {
    loading.value = false
  }
}

async function handleTraceQuery() {
  if (!traceForm.traceId.trim()) {
    message.warning('请输入 TraceId')
    return
  }
  loading.value = true
  try {
    const res: any = await queryLogsByTrace(traceForm.traceId.trim(), 500)
    const data = res?.data ?? res
    logs.value = data?.logs ?? []
    total.value = data?.total ?? 0
    searched.value = true
  } finally {
    loading.value = false
  }
}

async function copyAll() {
  const text = logs.value.map((l) => `${dayjs(l.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')} ${l.message}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch {
    message.warning('复制失败，请手动选择')
  }
}

onMounted(loadStatus)
</script>
