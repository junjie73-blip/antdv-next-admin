<script setup lang="ts">
import { computed } from 'vue';

import { isNil } from 'es-toolkit';

import { Tag } from '../tag';

defineOptions({ name: 'StatusTag' });

const props = defineProps<{
  status: string;
  type?: 'export' | 'instance' | 'task' | 'workflow';
}>();

const MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '处理中', color: 'processing' },
  '1': { label: '已完成', color: 'success' },
  '2': { label: '已终止', color: 'error' },
  '3': { label: '已挂起', color: 'warning' },
  pending: { label: '待处理', color: 'processing' },
  processing: { label: '处理中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
  timeout: { label: '已超时', color: 'error' },
};

/**
 * 迁移前的旧 Tag 用状态语义色（processing/success/error/warning/default）。
 * common-ui 的 `Tag` 走 shadcn Badge 的预设色名，这里把语义色对齐到等价预设，
 * 保证视觉一致：processing→blue、success→green、error→red、warning→gold、default→gray。
 */
const PRESET_BY_SEMANTIC: Record<string, string> = {
  default: 'default',
  error: 'red',
  processing: 'blue',
  success: 'green',
  warning: 'gold',
};

const config = computed(() => {
  const found = MAP[props.status];
  // isNil 替代 `??`，防止 status 是空串时的兜底
  return isNil(found) ? { label: props.status, color: 'default' } : found;
});

const presetColor = computed(
  () => PRESET_BY_SEMANTIC[config.value.color] ?? 'default',
);
</script>

<template>
  <Tag :color="presetColor">{{ config.label }}</Tag>
</template>
