<script setup lang="ts">
import { ref, watch } from 'vue'

import dayjs from '~/utils/dayjs'

import type { OrgHistoryEvent } from '../types'

import { getRevertChain } from '../api'
import { CHANGE_TYPE_MAP, SCOPE_MAP } from '../constants'

defineOptions({ name: 'RevertChainDrawer' })

interface Props {
  rootId: string | null
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const chain = ref<OrgHistoryEvent[]>([])

watch(
  () => [props.open, props.rootId] as const,
  async ([open, id]) => {
    if (!open) return
    if (!id) {
      chain.value = []
      return
    }
    loading.value = true
    try {
      chain.value = await getRevertChain(id)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <a-drawer :open="open" title="撤销链追踪" width="720" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <a-timeline v-if="chain.length">
        <a-timeline-item v-for="(e, i) in chain" :key="e.historyId" :color="i === 0 ? 'blue' : 'orange'">
          <div class="mb-1 flex items-center gap-2">
            <a-tag :color="i === 0 ? 'blue' : 'orange'" style="margin: 0">
              {{ i === 0 ? '原始' : '撤销' }}
            </a-tag>
            <a-tag style="margin: 0">
              {{ CHANGE_TYPE_MAP[e.changeType] ?? e.changeType }}
            </a-tag>
            <a-tag v-if="e.scope" style="margin: 0">
              {{ SCOPE_MAP[e.scope] ?? e.scope }}
            </a-tag>
            <span class="text-xs text-slate-400">
              {{ dayjs(e.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
            </span>
          </div>
          <div class="text-sm text-slate-700">{{ e.summary ?? '—' }}</div>
          <div class="mt-1 text-xs text-slate-400">
            操作者：{{ e.operatorName ?? '系统' }}
            <span v-if="e.relatedId" class="ml-2">关联：{{ e.relatedId.slice(0, 8) }}…</span>
          </div>
        </a-timeline-item>
      </a-timeline>

      <a-empty v-else description="暂无撤销链记录" />
    </a-spin>
  </a-drawer>
</template>
