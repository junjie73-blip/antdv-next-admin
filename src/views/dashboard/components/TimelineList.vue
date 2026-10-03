<script setup lang="ts">
import dayjs from '~/utils/dayjs'

defineOptions({ name: 'TimelineList' })

interface TimelineItem {
  id: string
  title: string
  time: string
  tag?: string
  tagColor?: string
  desc?: string
  operator?: string
}

defineProps<{ items: TimelineItem[] }>()
</script>

<template>
  <div class="max-h-[400px] overflow-y-auto pr-1">
    <a-timeline v-if="items.length">
      <a-timeline-item v-for="item in items" :key="item.id" :color="item.tagColor ?? 'blue'">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
            {{ item.title }}
          </span>
          <a-tag v-if="item.tag" :color="item.tagColor" :bordered="false" class="!text-[10px]">
            {{ item.tag }}
          </a-tag>
          <span class="text-xs text-slate-400">
            {{ dayjs(item.time).format('MM-DD HH:mm') }}
          </span>
        </div>
        <div v-if="item.desc" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ item.desc }}
        </div>
        <div v-if="item.operator" class="mt-0.5 text-xs text-slate-400">操作者：{{ item.operator }}</div>
      </a-timeline-item>
    </a-timeline>
    <a-empty v-else description="暂无记录" />
  </div>
</template>
