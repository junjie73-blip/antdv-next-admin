<template>
  <a-modal v-model:open="open" title="加签 / 转办历史" :width="640" :footer="null">
    <a-spin :spinning="loading">
      <div v-if="logs.length === 0" class="py-8">
        <a-empty description="暂无流转记录" />
      </div>
      <a-timeline v-else class="py-2">
        <a-timeline-item v-for="log in logs" :key="log.logId" :color="colorOf(log.actionType)">
          <div class="flex items-center gap-2">
            <a-tag :color="colorOf(log.actionType)" class="!m-0">
              {{ labelOf(log.actionType) }}
            </a-tag>
            <span class="text-xs text-gray-400">
              {{ dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
            </span>
          </div>
          <div class="mt-1 text-sm text-gray-600">
            <div v-if="log.toUserId">→ 接收人：{{ log.toUserId.slice(0, 8) }}…</div>
            <div v-if="log.reason" class="mt-1 text-xs">{{ log.reason }}</div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { WfTransferLog } from '~/api/workflow'

import { getTransferHistory } from '~/api/workflow'
import dayjs from '~/utils/dayjs'

defineOptions({ name: 'TransferHistoryModal' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ taskId: string | null }>()

const loading = ref(false)
const logs = ref<WfTransferLog[]>([])

function labelOf(type: string) {
  const map: Record<string, string> = {
    transfer: '转办',
    add_sign_before: '前加签',
    add_sign_after: '后加签',
    escalate: '超时升级',
  }
  return map[type] ?? type
}

function colorOf(type: string) {
  const map: Record<string, string> = {
    transfer: 'blue',
    add_sign_before: 'purple',
    add_sign_after: 'purple',
    escalate: 'red',
  }
  return map[type] ?? 'default'
}

watch(open, async (v) => {
  if (!v || !props.taskId) return
  loading.value = true
  try {
    const res: any = await getTransferHistory(props.taskId)
    logs.value = res?.data ?? res ?? []
  } finally {
    loading.value = false
  }
})
</script>
