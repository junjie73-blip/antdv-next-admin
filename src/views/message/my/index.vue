<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <!-- Tabs -->
      <a-tabs v-model:active-key="activeTab" @change="handleTabChange">
        <a-tab-pane v-for="t in BIZ_TABS" :key="t.key">
          <template #tab>
            <span>
              {{ t.label }}
              <a-badge v-if="unreadOf(t.key) > 0" :count="unreadOf(t.key)" :overflow-count="99" class="ml-1" />
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>

      <!-- 工具栏 -->
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2 pt-2">
        <div class="flex items-center gap-2">
          <a-radio-group v-model:value="readFilter" button-style="solid" size="small" @change="handleFilterChange">
            <a-radio-button :value="undefined">全部</a-radio-button>
            <a-radio-button :value="0">未读</a-radio-button>
            <a-radio-button :value="1">已读</a-radio-button>
          </a-radio-group>

          <a-input-search
            v-model:value="keyword"
            placeholder="搜索标题/内容"
            style="width: 240px"
            allow-clear
            @search="handleSearch"
          />
        </div>

        <div class="flex items-center gap-2">
          <a-button size="small" :disabled="!hasSelection" @click="handleBatchRead">
            批量已读 ({{ selectedIds.length }})
          </a-button>
          <a-button size="small" danger :disabled="!hasSelection" @click="handleBatchDelete"> 批量删除 </a-button>
          <a-button size="small" type="link" @click="handleReadAll"> 全部已读 </a-button>
          <a-button size="small" type="link" danger @click="handleClearRead"> 清空已读 </a-button>
        </div>
      </div>

      <!-- 列表 -->
      <a-spin :spinning="loading">
        <a-empty v-if="list.length === 0 && !loading" description="暂无消息" class="py-12" />

        <div v-else class="space-y-2">
          <div
            v-for="m in list"
            :key="m.messageId"
            class="flex items-start gap-3 rounded-lg border p-3 transition-colors"
            :class="
              m.isRead === 0
                ? 'border-blue-100 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/10'
                : 'border-gray-100 hover:border-gray-200 dark:border-gray-800'
            "
          >
            <a-checkbox
              :checked="selectedIds.includes(m.messageId)"
              @change="(e: any) => toggleSelect(m.messageId, e.target.checked)"
            />

            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              :class="`bg-${BIZ_TYPE_MAP[m.bizType]?.color}-100 text-${BIZ_TYPE_MAP[m.bizType]?.color}-600`"
              :style="{ background: typeBg(m.bizType), color: typeColor(m.bizType) }"
            >
              <Icon :icon="BIZ_TYPE_MAP[m.bizType]?.icon ?? 'lucide:bell'" />
            </div>

            <div class="min-w-0 flex-1 cursor-pointer" @click="handleView(m)">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm" :class="m.isRead === 0 ? 'font-medium text-gray-800' : 'text-gray-600'">
                  {{ m.title }}
                </span>
                <a-tag :color="BIZ_TYPE_MAP[m.bizType]?.color" class="!m-0 !text-[10px]">
                  {{ BIZ_TYPE_MAP[m.bizType]?.label }}
                </a-tag>
                <a-tag v-if="m.priority > 0" :color="PRIORITY_MAP[m.priority]?.color" class="!m-0 !text-[10px]">
                  {{ PRIORITY_MAP[m.priority]?.label }}
                </a-tag>
                <a-tag v-if="m.isTop === 1" color="red" class="!m-0 !text-[10px]"> 置顶 </a-tag>
              </div>
              <div v-if="m.content" class="mt-0.5 line-clamp-1 text-xs text-gray-500">
                {{ m.content }}
              </div>
              <div class="mt-1 text-xs text-gray-400">
                {{ dayjs(m.createdAt).format('YYYY-MM-DD HH:mm') }}
              </div>
            </div>

            <div class="flex shrink-0 flex-col gap-1">
              <a-button v-if="m.isRead === 0" type="link" size="small" @click.stop="handleMarkRead(m)"> 已读 </a-button>
              <a-button type="link" size="small" danger @click.stop="handleDelete(m)"> 删除 </a-button>
            </div>
          </div>
        </div>
        <div v-if="total > pageSize" class="mt-4 flex justify-end border-t border-gray-100 pt-3">
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
    </a-card>

    <!-- 详情弹窗 -->
    <a-modal v-model:open="detailOpen" :title="current?.title" :width="640" :footer="null">
      <template v-if="current">
        <div class="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <a-tag :color="BIZ_TYPE_MAP[current.bizType]?.color">
            {{ BIZ_TYPE_MAP[current.bizType]?.label }}
          </a-tag>
          <span>{{ dayjs(current.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
        </div>
        <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
          {{ current.content || '（无正文）' }}
        </div>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import dayjs from '~/utils/dayjs'

import type { MessageBizType, MessageRecord, UnreadSummary } from './api'

import {
  clearReadMessages,
  deleteMessage,
  deleteMessagesBatch,
  getMyMessageList,
  getUnreadSummary,
  markAllMessagesRead,
  markMessageRead,
  markMessagesReadBatch,
} from './api'
import { BIZ_TABS, BIZ_TYPE_MAP, PRIORITY_MAP, cardClassName, containerClassName } from './constants'

defineOptions({ name: 'MessageCenter' })

const activeTab = ref<string>('all')
const readFilter = ref<number | undefined>(undefined)
const keyword = ref('')
const pageNum = ref(1)
const pageSize = ref(20)
const list = ref<MessageRecord[]>([])
const total = ref(0)
const loading = ref(false)
const summary = ref<UnreadSummary>({ total: 0, byType: {} })
const selectedIds = ref<string[]>([])

const detailOpen = ref(false)
const current = ref<MessageRecord | null>(null)

const hasSelection = computed(() => selectedIds.value.length > 0)

function unreadOf(key: string): number {
  if (key === 'all') return summary.value.total
  return summary.value.byType[key] ?? 0
}

function typeColor(bizType: string): string {
  const map: Record<string, string> = {
    notice: '#3b82f6',
    todo: '#f97316',
    workflow: '#8b5cf6',
    system: '#6b7280',
    announcement: '#10b981',
  }
  return map[bizType] ?? '#6b7280'
}

function typeBg(bizType: string): string {
  const map: Record<string, string> = {
    notice: '#dbeafe',
    todo: '#ffedd5',
    workflow: '#ede9fe',
    system: '#f3f4f6',
    announcement: '#d1fae5',
  }
  return map[bizType] ?? '#f3f4f6'
}

async function loadSummary() {
  try {
    const res: any = await getUnreadSummary()
    summary.value = res?.data ?? res ?? { total: 0, byType: {} }
  } catch {
    /* ignore */
  }
}

async function load() {
  loading.value = true
  try {
    const params: any = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    }
    if (activeTab.value !== 'all') params.bizType = activeTab.value
    if (readFilter.value !== undefined) params.isRead = readFilter.value
    if (keyword.value) params.keyword = keyword.value

    const res: any = await getMyMessageList(params)
    const data = res?.data ?? res ?? {}
    list.value = data.list ?? []
    total.value = data.total ?? 0
    selectedIds.value = []
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  pageNum.value = 1
  void load()
}

function handleFilterChange() {
  pageNum.value = 1
  void load()
}

function handleSearch() {
  pageNum.value = 1
  void load()
}

function handlePageChange(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
  void load()
}

function toggleSelect(id: string, checked: boolean) {
  if (checked) selectedIds.value.push(id)
  else selectedIds.value = selectedIds.value.filter((x) => x !== id)
}

async function handleView(m: MessageRecord) {
  current.value = m
  detailOpen.value = true
  if (m.isRead === 0) {
    await markMessageRead(m.messageId)
    m.isRead = 1
    await Promise.all([loadSummary(), load()])
  }
}

async function handleMarkRead(m: MessageRecord) {
  await markMessageRead(m.messageId)
  await Promise.all([loadSummary(), load()])
}

async function handleBatchRead() {
  if (selectedIds.value.length === 0) return
  await markMessagesReadBatch(selectedIds.value)
  message.success('已标记')
  await Promise.all([loadSummary(), load()])
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return
  Modal.confirm({
    title: '批量删除',
    content: `确定删除选中的 ${selectedIds.value.length} 条消息吗？`,
    onOk: async () => {
      await deleteMessagesBatch(selectedIds.value)
      message.success('已删除')
      await Promise.all([loadSummary(), load()])
    },
  })
}

async function handleDelete(m: MessageRecord) {
  Modal.confirm({
    title: '删除消息',
    content: '确定删除该条消息吗？',
    onOk: async () => {
      await deleteMessage(m.messageId)
      message.success('已删除')
      await Promise.all([loadSummary(), load()])
    },
  })
}

async function handleReadAll() {
  const bizType = activeTab.value !== 'all' ? (activeTab.value as MessageBizType) : undefined
  Modal.confirm({
    title: '全部已读',
    content: '确定将全部消息标记为已读吗？',
    onOk: async () => {
      await markAllMessagesRead(bizType)
      message.success('已全部标记')
      await Promise.all([loadSummary(), load()])
    },
  })
}

async function handleClearRead() {
  Modal.confirm({
    title: '清空已读消息',
    content: '确定清空所有已读消息吗？未读消息将保留。',
    okType: 'danger',
    onOk: async () => {
      const res: any = await clearReadMessages()
      const deleted = (res?.data ?? res)?.deleted ?? 0
      message.success(`已清空 ${deleted} 条`)
      await Promise.all([loadSummary(), load()])
    },
  })
}

onMounted(() => {
  void loadSummary()
  void load()
})
</script>
