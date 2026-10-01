<template>
  <button
    type="button"
    :class="[
      'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
      item.isRead === 0 ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-slate-50',
    ]"
    @click="emit('click', item)"
  >
    <!-- 图标 -->
    <div :class="['mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClass]">
      <Icon :icon="iconName" class="h-4 w-4" />
    </div>

    <!-- 内容 -->
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <span :class="['line-clamp-1 text-sm', item.isRead === 0 ? 'font-medium text-slate-800' : 'text-slate-600']">
          {{ item.title }}
        </span>
        <span v-if="item.isRead === 0" class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
      </div>

      <p class="mt-0.5 line-clamp-2 text-xs text-slate-500">
        {{ item.content }}
      </p>

      <div class="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
        <span>{{ formatTime(item.publishTime) }}</span>
        <a-tag v-if="sourceLabel" :color="sourceColor" size="small">
          {{ sourceLabel }}
        </a-tag>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import type { NoticeRecord } from '~/views/message/my/types'

import dayjs from '~/utils/dayjs'

defineOptions({ name: 'NoticeItem' })

const props = defineProps<{
  item: NoticeRecord
}>()

const emit = defineEmits<{
  click: [item: NoticeRecord]
}>()

/** 图标与配色：按 source 区分 */
const iconName = computed(() => {
  switch (props.item.source) {
    case 'workflow':
      return 'lucide:git-branch'
    case 'report':
      return 'lucide:bar-chart-3'
    case 'system':
      return 'lucide:settings'
    default:
      return 'lucide:bell'
  }
})

const iconClass = computed(() => {
  switch (props.item.source) {
    case 'workflow':
      return 'bg-purple-50 text-purple-600'
    case 'report':
      return 'bg-emerald-50 text-emerald-600'
    case 'system':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-blue-50 text-blue-600'
  }
})

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  notice: { label: '通知', color: 'blue' },
  workflow: { label: '工作流', color: 'purple' },
  report: { label: '报表', color: 'green' },
  system: { label: '系统', color: 'default' },
}

const sourceLabel = computed(() => {
  if (!props.item.source || props.item.source === 'notice') return ''
  return SOURCE_MAP[props.item.source]?.label ?? ''
})

const sourceColor = computed(() => SOURCE_MAP[props.item.source ?? 'notice']?.color ?? 'default')

function formatTime(time: string | null) {
  if (!time) return ''
  const d = dayjs(time)
  const diff = dayjs().diff(d, 'minute')
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${diff}分钟前`
  if (diff < 24 * 60) return `${Math.floor(diff / 60)}小时前`
  if (diff < 7 * 24 * 60) return `${Math.floor(diff / 24 / 60)}天前`
  return d.format('YYYY-MM-DD')
}
</script>
