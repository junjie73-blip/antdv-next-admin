<script setup lang="ts">
import dayjs from 'dayjs'
import { computed } from 'vue'

import type { NotificationItem } from '~/utils/ws'

import { cn } from '~/utils/cn'

defineOptions({ name: 'NoticeItem' })

const props = defineProps<{
  item: NotificationItem
}>()

const emit = defineEmits<{ click: [item: NotificationItem] }>()

/** 优先级样式 */
const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: '普通', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  1: { label: '重要', color: '#EA580C', bg: 'rgba(234,88,12,0.12)' },
  2: { label: '紧急', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
}

const priority = computed(() => PRIORITY_CONFIG[props.item.priority ?? 0] ?? PRIORITY_CONFIG[0]!)
const isUnread = computed(() => props.item.isRead === 0)
const isUrgent = computed(() => (props.item.priority ?? 0) >= 2)

const rootClass = computed(() =>
  cn(
    'group relative flex cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5',
    'border border-transparent transition-all duration-200',
    'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
    isUrgent.value && 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30',
    isUnread.value && !isUrgent.value && 'bg-blue-50/50 dark:bg-blue-950/20',
  ),
)

function handleClick() {
  emit('click', props.item)
}
</script>

<template>
  <div :class="rootClass" @click="handleClick">
    <!-- 未读左侧色条 -->
    <span
      v-if="isUnread"
      class="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r-full"
      :style="{ backgroundColor: priority.color }"
    />

    <!-- 第一行：标题 + 优先级标签 + 未读点 -->
    <div class="flex items-center gap-1.5">
      <span
        class="truncate text-[13px] leading-5"
        :class="isUnread ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'"
        :title="item.title"
      >
        {{ item.title }}
      </span>

      <span
        class="shrink-0 rounded px-1.5 py-px text-[10px] leading-none font-medium"
        :style="{ backgroundColor: priority.bg, color: priority.color }"
      >
        {{ priority.label }}
      </span>

      <span v-if="isUnread" class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
    </div>

    <!-- 第二行：内容摘要 + 时间 -->
    <div class="flex items-center gap-2">
      <span class="flex-1 truncate text-[12px] leading-4 text-slate-500 dark:text-slate-400">
        {{ item.content || '暂无详情' }}
      </span>
      <span class="shrink-0 text-[11px] leading-4 text-slate-400 dark:text-slate-500">
        {{ dayjs(item.createdAt).fromNow() }}
      </span>
    </div>
  </div>
</template>
