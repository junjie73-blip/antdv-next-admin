<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataStat,
} from '@antdv/common-ui';
import type { ApprovalInstanceSummary } from '~/api/approval';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  getApprovalInstanceList,
  getApprovalMonitorSummary,
} from '~/api/approval';

defineOptions({ name: 'ApprovalMonitor' });

const pageRef = ref<{ reload: () => Promise<void> | void }>();
const summary = ref<ApprovalInstanceSummary | null>(null);

const STATUS_LABELS: Record<string, string> = {
  done: '已完结',
  error: '异常',
  running: '处理中',
};
const STATUS_COLORS: Record<string, string> = {
  done: 'green',
  error: 'red',
  running: 'blue',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '实例 ID', width: '110px' },
  { key: 'name', title: '流程名称', width: '160px' },
  { key: 'groupName', title: '分组', width: '110px' },
  { key: 'node', title: '当前节点', width: '150px' },
  { key: 'owner', title: '负责人', width: '90px' },
  { key: 'duration', title: '已耗时', width: '100px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'startTime', title: '开始时间', width: '150px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'status',
    label: '实例状态',
    options: [
      { label: '处理中', value: 'running' },
      { label: '已完结', value: 'done' },
      { label: '异常', value: 'error' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:activity',
    label: '运行中实例',
    tone: 'blue',
    value: String(summary.value?.running ?? 0),
  },
  {
    icon: 'carbon:checkmark',
    label: '今日完结',
    tone: 'green',
    value: String(summary.value?.doneToday ?? 0),
  },
  {
    icon: 'carbon:time',
    label: '平均耗时',
    tone: 'violet',
    value: `${(summary.value?.avgDurationHours ?? 0).toFixed(1)}h`,
  },
  {
    icon: 'carbon:warning-alt',
    label: '异常',
    tone: 'red',
    value: String(summary.value?.error ?? 0),
  },
]);

async function listApi(params: Record<string, any>) {
  const result = await getApprovalInstanceList(params);
  return { list: result.list, total: result.total };
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function loadSummary() {
  try {
    summary.value = await getApprovalMonitorSummary();
  } catch (error) {
    handleError(error);
  }
}

/** 只读页：刷新走工具按钮触发 reload，不再用「刷新实例」伪装成新建入口 */
async function refreshInstances() {
  await loadSummary();
  await pageRef.value?.reload();
}

const config = computed<DataPageProps>(() => ({
  api: listApi,
  columns: columns.value,
  description: '审批流程实例的吞吐、耗时与异常监控。',
  filters: filters.value,
  icon: 'carbon:activity',
  primaryKey: 'id',
  showDelete: false,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '流程监控',
}));

onMounted(loadSummary);
</script>

<template>
  <div class="approval-monitor-page">
    <DataPage v-bind="config" ref="pageRef">
      <template #action-extra>
        <Button variant="link" class="h-auto px-0.5!" @click="refreshInstances">
          <Icon icon="carbon:renew" /> 刷新实例
        </Button>
      </template>
    </DataPage>
  </div>
</template>

<style scoped>
/* 实例只读：隐藏 DataPage 页头的新建入口，刷新统一走行内「刷新实例」按钮 */
.approval-monitor-page :deep([data-page-view] [data-page='header-extra']) {
  display: none;
}
</style>
