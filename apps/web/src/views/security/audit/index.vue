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
import { getAuditList, getAuditStats } from '~/api/security';

defineOptions({ name: 'SecurityAudit' });

const stats = ref<SecurityOperations | null>(null);

const STATUS_LABELS: Record<string, string> = {
  error: '失败',
  denied: '拒绝',
  success: '成功',
};
const STATUS_COLORS: Record<string, string> = {
  error: 'red',
  denied: 'amber',
  success: 'green',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'createdAt', title: '时间', width: '170px' },
  { key: 'actor', title: '操作人', width: '110px' },
  { key: 'action', title: '操作', width: '180px' },
  { key: 'method', title: '方法', width: '90px' },
  { key: 'path', title: '目标接口', width: '220px' },
  { key: 'ip', title: '来源 IP', width: '140px' },
  { key: 'result', title: '结果', width: '90px' },
  { key: 'risk', title: '风险', width: '90px' },
  { key: 'traceId', title: '链路 ID', width: '150px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'result',
    label: '访问结果',
    options: [
      { label: '成功', value: 'success' },
      { label: '拒绝', value: 'denied' },
      { label: '失败', value: 'error' },
    ],
  },
  {
    key: 'risk',
    label: '风险等级',
    options: [
      { label: '高危', value: 'high' },
      { label: '严重', value: 'critical' },
      { label: '中危', value: 'medium' },
      { label: '低危', value: 'low' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:document',
    label: '审计记录',
    tone: 'blue',
    value: String(stats.value?.auditTotal ?? 0),
  },
  {
    icon: 'carbon:stop',
    label: '拒绝访问',
    tone: 'amber',
    value: String(stats.value?.auditDenied ?? 0),
  },
  {
    icon: 'carbon:warning-alt',
    label: '异常请求',
    tone: 'red',
    value: String(stats.value?.auditError ?? 0),
  },
  {
    icon: 'carbon:bot',
    label: 'AI 调用',
    tone: 'violet',
    value: String(stats.value?.aiTotal ?? 0),
  },
]);

const config = computed<DataPageProps>(() => ({
  actionWidth: 90,
  api: (params: Record<string, any>) => getAuditList(params),
  columns: columns.value,
  description:
    '每次接口调用都记录操作人、动作、目标、IP、结果与链路 ID；请求体中的凭据与个人信息已由服务端脱敏。',
  filters: filters.value,
  icon: 'carbon:document',
  primaryKey: 'id',
  readonly: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'result',
  title: '审计日志',
}));

onMounted(() => {
  void getAuditStats().then((result) => {
    stats.value = result;
  });
});
</script>

<template>
  <DataPage v-bind="config" />
</template>
