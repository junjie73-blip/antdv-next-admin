<script setup lang="ts">
import { ref, watch } from 'vue'

import dayjs from '~/utils/dayjs'

import type { OrgHistoryEvent } from '../types'

import { getDeptTimeline } from '../api'
import { CHANGE_TYPE_COLOR, CHANGE_TYPE_MAP, SCOPE_MAP } from '../constants'

defineOptions({ name: 'DeptTimelineDrawer' })

interface Props {
  deptId: string | null
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const events = ref<OrgHistoryEvent[]>([])

watch(
  () => [props.open, props.deptId] as const,
  async ([open, id]) => {
    if (!open) return
    if (!id) {
      events.value = []
      return
    }
    loading.value = true
    try {
      events.value = await getDeptTimeline(id, 200)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <a-drawer :open="open" title="部门变更时间线" width="680" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <a-timeline v-if="events.length">
        <a-timeline-item v-for="e in events" :key="e.historyId" :color="CHANGE_TYPE_COLOR[e.changeType] ?? 'blue'">
          <div class="mb-1 flex items-center gap-2">
            <a-tag :color="CHANGE_TYPE_COLOR[e.changeType]" style="margin: 0">
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
          <div class="mt-1 text-xs text-slate-400">操作者：{{ e.operatorName ?? '系统' }}</div>
        </a-timeline-item>
      </a-timeline>

      <a-empty v-else description="暂无变更记录" />
    </a-spin>
  </a-drawer>
</template>
