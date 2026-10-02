<template>
  <a-drawer
    v-model:open="open"
    title="慢查询详情"
    :width="800"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions :column="2" size="small" bordered class="mb-4">
          <a-descriptions-item label="状态" :span="2">
            <a-tag :color="STATUS_MAP[detail.status]?.color">
              {{ STATUS_MAP[detail.status]?.label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="调用次数">{{ detail.calls }}</a-descriptions-item>
          <a-descriptions-item label="返回行数">{{ detail.rows }}</a-descriptions-item>
          <a-descriptions-item label="平均耗时">{{ formatMs(detail.meanTimeMs) }}</a-descriptions-item>
          <a-descriptions-item label="最大耗时">{{ formatMs(detail.maxTimeMs) }}</a-descriptions-item>
          <a-descriptions-item label="P95">{{ formatMs(detail.p95TimeMs) }}</a-descriptions-item>
          <a-descriptions-item label="总耗时">{{ formatMs(detail.totalTimeMs) }}</a-descriptions-item>
          <a-descriptions-item label="首次出现">
            {{ dayjs(detail.firstSeenAt).format('YYYY-MM-DD HH:mm:ss') }}
          </a-descriptions-item>
          <a-descriptions-item label="最近出现">
            {{ dayjs(detail.lastSeenAt).format('YYYY-MM-DD HH:mm:ss') }}
          </a-descriptions-item>
          <a-descriptions-item label="指纹" :span="2">
            <code class="text-xs">{{ detail.fingerprint }}</code>
          </a-descriptions-item>
        </a-descriptions>

        <div class="mb-4">
          <div class="mb-2 text-sm font-medium text-gray-700">SQL 样本</div>
          <pre
            class="max-h-[240px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700"
            >{{ detail.querySample }}</pre>
        </div>

        <!-- 索引建议 -->
        <div v-if="detail.indexSuggestion" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div class="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700">
            <Icon icon="lucide:lightbulb" />
            索引建议
          </div>
          <div class="space-y-1 text-xs text-amber-700">
            <div>
              表：<code class="rounded bg-white px-1.5 py-0.5">{{ detail.indexSuggestion.table }}</code>
            </div>
            <div>
              建议索引字段：
              <code v-for="c in detail.indexSuggestion.columns" :key="c" class="mr-1 rounded bg-white px-1.5 py-0.5">
                {{ c }}
              </code>
            </div>
            <div>原因：{{ detail.indexSuggestion.reason }}</div>
          </div>
          <div class="mt-3">
            <a-typography-paragraph :content="suggestSql" :copyable="true" code />
          </div>
        </div>

        <!-- 处理 -->
        <div v-if="detail.status === 'open'" class="mt-6 border-t border-gray-100 pt-4">
          <div class="mb-2 text-sm font-medium text-gray-700">处理说明</div>
          <a-textarea v-model:value="reviewNote" :rows="3" :maxlength="1000" show-count placeholder="可选" />
        </div>

        <div v-else class="rounded-lg bg-gray-50 p-3">
          <div class="text-xs text-gray-500">
            已于
            {{ detail.reviewedAt ? dayjs(detail.reviewedAt).format('YYYY-MM-DD HH:mm:ss') : '—' }}
            处理
          </div>
          <div v-if="detail.reviewNote" class="mt-1 text-sm">{{ detail.reviewNote }}</div>
        </div>
      </template>
    </a-spin>
    <template #footer>
      <div class="mt-3 flex justify-end gap-2">
        <a-button :loading="acting" @click="handleReview('ignored')"> 忽略 </a-button>
        <a-button type="primary" :loading="acting" @click="handleReview('resolved')"> 标记为已解决 </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import dayjs from '~/utils/dayjs'

import type { SlowQueryRecord } from '../api'

import { getSlowQueryDetail, reviewSlowQuery } from '../api'
import { STATUS_MAP, formatMs } from '../constants'

defineOptions({ name: 'SlowQueryDetailDrawer' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ record: SlowQueryRecord | null }>()
const emit = defineEmits<{ reviewed: [] }>()

const loading = ref(false)
const acting = ref(false)
const detail = ref<SlowQueryRecord | null>(null)
const reviewNote = ref('')

const suggestSql = computed(() => {
  const s = detail.value?.indexSuggestion
  if (!s) return ''
  return `CREATE INDEX idx_${s.table}_${s.columns.join('_')} ON ${s.table} (${s.columns.join(', ')});`
})

async function load() {
  if (!props.record) return
  loading.value = true
  try {
    const res: any = await getSlowQueryDetail(props.record.id)
    detail.value = res?.data ?? res
  } finally {
    loading.value = false
  }
}

function onOpenChange(v: boolean) {
  if (!v) {
    detail.value = null
    reviewNote.value = ''
    return
  }
  void load()
}

async function handleReview(status: 'resolved' | 'ignored') {
  if (!detail.value) return
  acting.value = true
  try {
    await reviewSlowQuery(detail.value.id, {
      status,
      note: reviewNote.value || undefined,
    })
    message.success('已处理')
    open.value = false
    emit('reviewed')
  } finally {
    acting.value = false
  }
}

watch(
  () => props.record,
  (v) => {
    if (v && open.value) void load()
  },
)
</script>
