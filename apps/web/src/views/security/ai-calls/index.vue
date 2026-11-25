<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataStat,
} from '@antdv/common-ui';
import type { SecurityOperations } from '~/api/security';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { getAiCallList, getAuditStats } from '~/api/security';

defineOptions({ name: 'SecurityAiCalls' });

const stats = ref<null | SecurityOperations>(null);

const LEVEL_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
};
const LEVEL_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'red',
  medium: 'amber',
  low: 'green',
};
const ACTION_LABELS: Record<string, string> = {
  block: '已阻断',
  mask: '已脱敏',
  pass: '放行',
  audit: '仅留痕',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'createdAt', title: '时间', width: '170px' },
  { key: 'actor', title: '调用方', width: '110px' },
  { key: 'prompt', title: '提示词摘要（脱敏）', width: '260px' },
  { key: 'categoryText', title: '风险类型', width: '150px' },
  { key: 'actionLabel', title: '处置', width: '110px' },
  { key: 'level', title: '等级', width: '90px' },
  { key: 'traceId', title: '链路 ID', width: '150px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'level',
    label: '风险等级',
    options: [
      { label: '严重', value: 'critical' },
      { label: '高危', value: 'high' },
      { label: '中危', value: 'medium' },
      { label: '低危', value: 'low' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:bot',
    label: 'AI 调用总量',
    tone: 'blue',
    value: String(stats.value?.aiTotal ?? 0),
  },
  {
    icon: 'carbon:stop',
    label: '安全阻断',
    tone: 'red',
    value: String(stats.value?.aiBlocked ?? 0),
  },
  {
    icon: 'carbon:erase',
    label: '自动脱敏',
    tone: 'amber',
    value: String(stats.value?.aiMasked ?? 0),
  },
  {
    icon: 'carbon:warning-alt',
    label: '高风险调用',
    tone: 'violet',
    value: String(stats.value?.aiHighRisk ?? 0),
  },
]);

const config = computed<DataPageProps>(() => ({
  actionWidth: 90,
  api: listApi,
  columns: columns.value,
  description:
    '所有 AI 对话都经过输入检测、脱敏与输出审核；这里只保存脱敏后的提示词摘要和判定结果。',
  filters: filters.value,
  icon: 'carbon:bot',
  primaryKey: 'id',
  readonly: true,
  stats: statsCards.value,
  statusColors: LEVEL_COLORS,
  statusLabels: LEVEL_LABELS,
  statusKey: 'level',
  title: 'AI 调用审计',
}));

function listApi(params: Record<string, any>) {
  return getAiCallList(params).then((result) => ({
    total: result.total,
    list: result.list.map((row) => ({
      ...row,
      actionLabel: ACTION_LABELS[row.action] ?? row.action,
      categoryText: row.categories.join('、') || '无',
    })),
  }));
}

onMounted(() => {
  void getAuditStats().then((result) => {
    stats.value = result;
  });
});
</script>

<template>
  <DataPage v-bind="config" />
</template>
