<template>
  <a-tag :color="config.color">{{ config.label }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'StatusTag' })

const props = defineProps<{
  status: string
  type?: 'workflow' | 'instance' | 'task' | 'export'
}>()

const MAP: Record<string, { label: string; color: string }> = {
  // 通用
  '0': { label: '处理中', color: 'processing' },
  '1': { label: '已完成', color: 'success' },
  '2': { label: '已终止', color: 'error' },
  '3': { label: '已挂起', color: 'warning' },
  // 任务 / 导出
  pending: { label: '待处理', color: 'processing' },
  processing: { label: '处理中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
  timeout: { label: '已超时', color: 'error' },
}

const config = computed(() => MAP[props.status] ?? { label: props.status, color: 'default' })
</script>
