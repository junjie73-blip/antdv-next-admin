<script setup lang="ts">
import { ref, watch } from 'vue'

import dayjs from '~/utils/dayjs'

import type { UserTimeline } from '../types'

import { getUserDeptAt, getUserTimeline } from '../api'
import { CHANGE_TYPE_COLOR, CHANGE_TYPE_MAP, SCOPE_MAP } from '../constants'

defineOptions({ name: 'OrgTimelineDrawer' })

interface Props {
  userId: string | null
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const data = ref<UserTimeline | null>(null)

/* dept-at 回溯 */
const atTime = ref<string | null>(null)
const atLoading = ref(false)
const atDepts = ref<string[]>([])

async function loadAt() {
  if (!props.userId || !atTime.value) {
    atDepts.value = []
    return
  }
  atLoading.value = true
  try {
    atDepts.value = await getUserDeptAt(props.userId, atTime.value)
  } finally {
    atLoading.value = false
  }
}

watch(
  () => [props.open, props.userId] as const,
  async ([open, uid]) => {
    if (!open) return
    if (!uid) {
      data.value = null
      return
    }
    loading.value = true
    atDepts.value = []
    atTime.value = null
    try {
      data.value = await getUserTimeline(uid, 200)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <a-drawer :open="open" title="组织变更时间线" width="680" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <!-- 当前部门 -->
      <a-card size="small" class="mb-4">
        <div class="mb-2 text-xs text-slate-500">当前部门</div>
        <div v-if="data?.currentDepts.length">
          <a-tag
            v-for="d in data.currentDepts"
            :key="d.deptId"
            :color="d.isPrimary ? 'green' : 'blue'"
            class="mr-1 mb-1"
          >
            {{ d.deptName }}
            <span v-if="d.isPrimary" class="ml-1 text-xs">主</span>
          </a-tag>
        </div>
        <span v-else class="text-xs text-slate-400">未分配</span>
      </a-card>

      <!-- 时间点回溯 -->
      <a-card size="small" class="mb-4">
        <div class="mb-2 text-xs text-slate-500">回溯某时间点所在部门</div>
        <div class="flex items-center gap-2">
          <a-date-picker
            v-model:value="atTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            style="width: 240px"
          />
          <a-button type="primary" :loading="atLoading" @click="loadAt">回溯</a-button>
        </div>
        <div v-if="atDepts.length" class="mt-2">
          <a-tag v-for="d in atDepts" :key="d" color="cyan" class="mr-1 mb-1">
            {{ d }}
          </a-tag>
        </div>
        <div v-else-if="atTime" class="mt-2 text-xs text-slate-400">该时间点未查询到部门归属</div>
      </a-card>

      <!-- 时间线 -->
      <a-timeline v-if="data?.events.length">
        <a-timeline-item v-for="e in data.events" :key="e.historyId" :color="CHANGE_TYPE_COLOR[e.changeType] ?? 'blue'">
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
          <div class="mt-1 text-xs text-slate-400">
            操作者：{{ e.operatorName ?? '系统' }}
            <span v-if="e.source === 'trigger'" class="ml-2">（数据库触发器记录）</span>
            <span v-if="e.source === 'import'" class="ml-2">（批量导入）</span>
          </div>
        </a-timeline-item>
      </a-timeline>

      <a-empty v-else description="暂无变更记录" />
    </a-spin>
  </a-drawer>
</template>
