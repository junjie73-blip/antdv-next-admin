<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import dayjs from '~/utils/dayjs'

import type { OrgHistoryEvent } from '../types'

import { getOrgHistoryDetail } from '../api'
import { CHANGE_TYPE_MAP, SCOPE_MAP, SOURCE_MAP } from '../constants'
import { displayValue, getFieldDiff } from '../utils'

defineOptions({ name: 'HistoryDiffDrawer' })

interface Props {
  historyId: string | null
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const detail = ref<OrgHistoryEvent | null>(null)

watch(
  () => [props.open, props.historyId] as const,
  async ([open, id]) => {
    if (!open) return
    if (!id) {
      detail.value = null
      return
    }
    loading.value = true
    try {
      detail.value = await getOrgHistoryDetail(id)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const diffs = computed(() => (detail.value ? getFieldDiff(detail.value) : []))
</script>

<template>
  <a-drawer :open="open" title="变更详情" width="720" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 基础信息 -->
        <a-card size="small" class="mb-4" title="基础信息">
          <a-descriptions
            :column="{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }"
            size="small"
            bordered
            :label-style="{ width: '88px', whiteSpace: 'nowrap' }"
          >
            <a-descriptions-item label="时间">
              {{ dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
            </a-descriptions-item>
            <a-descriptions-item label="操作者">
              {{ detail.operatorName ?? '系统' }}
            </a-descriptions-item>
            <a-descriptions-item label="范围">
              {{ SCOPE_MAP[detail.scope ?? ''] ?? '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="变更">
              {{ CHANGE_TYPE_MAP[detail.changeType] ?? detail.changeType }}
            </a-descriptions-item>
            <a-descriptions-item label="来源">
              <a-tag :color="SOURCE_MAP[detail.source]?.color ?? 'blue'">
                {{ SOURCE_MAP[detail.source]?.text ?? detail.source }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="实体类型">
              {{ detail.entityType }}
            </a-descriptions-item>
            <a-descriptions-item label="实体 ID" :span="2">
              <span class="break-all">{{ detail.entityId }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="trace" :span="2">
              <span class="break-all text-slate-500">
                {{ detail.traceId ?? '—' }}
              </span>
            </a-descriptions-item>
            <a-descriptions-item v-if="detail.relatedId" label="关联记录" :span="2">
              <span class="break-all text-slate-500">{{ detail.relatedId }}</span>
            </a-descriptions-item>
            <a-descriptions-item v-if="detail.ipAddress" label="IP" :span="2">
              {{ detail.ipAddress }}
            </a-descriptions-item>
            <a-descriptions-item v-if="detail.summary" label="摘要" :span="2">
              <span class="text-slate-700">{{ detail.summary }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <!-- 字段差异 -->
        <a-card size="small" title="字段差异">
          <a-descriptions
            v-if="diffs.length"
            :column="1"
            size="small"
            bordered
            :label-style="{ width: '160px', whiteSpace: 'nowrap' }"
          >
            <a-descriptions-item v-for="d in diffs" :key="d.field" :label="d.field">
              <div class="flex flex-col gap-1">
                <div class="break-all text-rose-600">
                  <span class="mr-1 text-xs text-slate-400">前</span>
                  {{ displayValue(d.before) }}
                </div>
                <div class="break-all text-emerald-600">
                  <span class="mr-1 text-xs text-slate-400">后</span>
                  {{ displayValue(d.after) }}
                </div>
              </div>
            </a-descriptions-item>
          </a-descriptions>
          <a-empty v-else description="无字段差异" />
        </a-card>
      </template>
      <a-empty v-else description="暂无数据" />
    </a-spin>
  </a-drawer>
</template>
