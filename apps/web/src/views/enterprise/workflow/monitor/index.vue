<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';
import type { WorkflowInstance, WorkflowMonitorData } from '~/api/enterprise';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  Card,
  Descriptions,
  DescriptionsItem,
  PageHeader,
} from '@antdv/common-ui';
import { BasicDrawer, useDrawer } from '@antdv/popup-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import { getWorkflowInstances } from '~/api/enterprise';
import { unwrapApi } from '~/utils/log-format';

import AsyncState from '../../../system/components/AsyncState.vue';
import MetricCard from '../../../system/components/MetricCard.vue';
import StatusPill from '../../../system/components/StatusPill.vue';

/**
 * 流程监控（参考实现 `/template/workflow/monitor`）。
 * 概览指标 + 吞吐与慢节点 + 告警中心 + 执行实例表格 + 详情抽屉，
 * 数据来自 backend-mock，自动刷新在卸载时对称清理。
 */
defineOptions({ name: 'EnterpriseWorkflowMonitor' });

const STATUS_TONE: Record<
  string,
  'error' | 'info' | 'neutral' | 'success' | 'warning'
> = {
  failed: 'error',
  running: 'info',
  success: 'success',
  terminated: 'neutral',
  waiting: 'warning',
};

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const statsGridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
);
const twoColClassName = cn('grid grid-cols-1 gap-4 lg:grid-cols-2');
const labelClassName = cn('text-muted-foreground text-xs');
const hintClassName = cn('text-muted-foreground text-xs');
const progressTrackClassName = cn(
  'bg-muted h-2 w-full overflow-hidden rounded-full',
);

const data = ref<null | WorkflowMonitorData>(null);
const loading = ref(true);
const error = ref('');
const autoRefresh = ref(false);
const acknowledged = ref<Set<string>>(new Set());
const viewingRecord = ref<null | WorkflowInstance>(null);

const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister] = useTable();
/** 刷新 / 自动刷新统一靠 key 重建表格，重新走一遍取数流程 */
const reloadKey = ref(0);

let timer: ReturnType<typeof setInterval> | undefined;

const summary = computed(
  () =>
    data.value?.summary ?? {
      failed: 0,
      running: 0,
      successRate: 0,
      succeeded: 0,
      total: 0,
      unhandledAlerts: 0,
    },
);
const maxThroughput = computed(() =>
  Math.max(
    1,
    ...(data.value?.throughput ?? []).map((item) => item.success + item.failed),
  ),
);
const pendingAlerts = computed(() =>
  (data.value?.alerts ?? []).filter(
    (item) => item.level !== 'info' && !acknowledged.value.has(item.id),
  ),
);

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '实例检索',
    component: 'Input',
    componentProps: {
      placeholder: '实例 ID、Trace ID 或发起人',
      allowClear: true,
    },
    colProps: { span: 8 },
  },
  {
    field: 'status',
    label: '执行状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部状态',
      allowClear: true,
      options: [
        { label: '全部状态', value: '' },
        { label: '运行中', value: 'running' },
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
        { label: '等待中', value: 'waiting' },
        { label: '已终止', value: 'terminated' },
      ],
    },
    colProps: { span: 8 },
  },
  {
    field: 'environment',
    label: '运行环境',
    component: 'Select',
    componentProps: {
      placeholder: '全部环境',
      allowClear: true,
      options: [
        { label: '全部环境', value: '' },
        { label: '生产环境', value: '生产环境' },
        { label: '预发环境', value: '预发环境' },
      ],
    },
    colProps: { span: 8 },
  },
];

async function fetchData(params: Record<string, unknown> = {}) {
  loading.value = true;
  error.value = '';
  try {
    const res = await getWorkflowInstances(params);
    const payload = unwrapApi<null | WorkflowMonitorData>(res);
    data.value = payload ?? null;
    return { items: payload?.list ?? [], total: payload?.total ?? 0 };
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : '流程监控接口暂不可用';
    return { items: [], total: 0 };
  } finally {
    loading.value = false;
  }
}

async function listApi(params: Record<string, any>) {
  return fetchData(params);
}

function refresh() {
  reloadKey.value += 1;
}

function acknowledge(id: string) {
  const next = new Set(acknowledged.value);
  next.add(id);
  acknowledged.value = next;
}

function openDetail(record: unknown) {
  viewingRecord.value = record as WorkflowInstance;
  drawerMethods.openDrawer();
}

onMounted(() => {
  timer = setInterval(() => {
    if (autoRefresh.value) refresh();
  }, 15_000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const columns: BasicColumn[] = [
  {
    title: '实例 / 流程',
    dataIndex: 'id',
    key: 'id',
    width: 230,
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  { title: '执行进度', dataIndex: 'progress', key: 'progress', width: 170 },
  { title: '触发信息', dataIndex: 'trigger', key: 'trigger', width: 130 },
  { title: '发起人', dataIndex: 'initiator', key: 'initiator', width: 130 },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 170 },
  { title: '耗时', dataIndex: 'duration', key: 'duration', width: 100 },
  { title: '环境', dataIndex: 'environment', key: 'environment', width: 110 },
];
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="流程监控"
      description="执行实例的吞吐、告警与节点耗时 · 可开启 15 秒自动刷新"
      icon="carbon:activity"
    >
      <template #extra>
        <span class="flex items-center gap-2">
          <Switch
            :model-value="autoRefresh"
            @update:model-value="(v: boolean) => (autoRefresh = v)"
          />
          <span :class="labelClassName">自动刷新</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="refresh"
        >
          <Icon icon="carbon:renew" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <div :class="statsGridClassName">
      <MetricCard
        title="运行中实例"
        :value="summary.running"
        suffix="个"
        icon="carbon:progress-bar-round"
        tone="info"
      />
      <MetricCard
        title="执行成功率"
        :value="summary.successRate"
        suffix="%"
        icon="carbon:checkmark-outline"
        tone="success"
      />
      <MetricCard
        title="失败实例"
        :value="summary.failed"
        suffix="个"
        icon="carbon:error"
        tone="destructive"
      />
      <MetricCard
        title="未处理告警"
        :value="pendingAlerts.length"
        suffix="条"
        icon="carbon:warning"
        tone="warning"
      />
    </div>

    <AsyncState
      :loading="loading && !data"
      :error="error"
      :empty="false"
      @retry="refresh"
    >
      <template v-if="data">
        <div :class="twoColClassName">
          <Card title="执行吞吐与慢节点" :class="cardClassName">
            <p :class="hintClassName">按 5 分钟聚合的执行结果（成功 / 失败）</p>
            <div class="mt-4 flex h-32 items-end gap-2">
              <div
                v-for="point in data.throughput"
                :key="point.time"
                class="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  class="flex w-full flex-1 items-end justify-center gap-0.5"
                >
                  <div
                    class="w-1/2 rounded-t-sm bg-success"
                    :style="{
                      height: `${Math.round((point.success / maxThroughput) * 100)}%`,
                    }"
                    :title="`${point.time} 成功 ${point.success}`"
                  ></div>
                  <div
                    class="w-1/2 rounded-t-sm bg-destructive"
                    :style="{
                      height: `${Math.round((point.failed / maxThroughput) * 100)}%`,
                    }"
                    :title="`${point.time} 失败 ${point.failed}`"
                  ></div>
                </div>
                <span :class="labelClassName">{{ point.time }}</span>
              </div>
            </div>
            <div class="mt-4 space-y-2 border-t border-border pt-3">
              <div
                v-for="rank in data.latencyRanks"
                :key="rank.node"
                class="flex items-center justify-between gap-2"
              >
                <span class="text-sm text-foreground">{{ rank.node }}</span>
                <span class="text-sm tabular-nums text-muted-foreground">{{ rank.ms }} ms</span>
              </div>
            </div>
          </Card>

          <Card title="告警中心" :class="cardClassName">
            <template #extra>
<span :class="hintClassName">{{ pendingAlerts.length }} 待处理</span>
</template>
            <div class="space-y-2">
              <div
                v-for="alert in data.alerts"
                :key="alert.id"
                class="flex items-start gap-3 rounded-md border border-border px-3 py-2"
              >
                <Icon
                  :icon="
                    alert.level === 'error'
                      ? 'carbon:error'
                      : alert.level === 'warning'
                        ? 'carbon:warning'
                        : 'carbon:information'
                  "
                  :class="
                    alert.level === 'error'
                      ? 'text-destructive'
                      : alert.level === 'warning'
                        ? 'text-warning'
                        : 'text-info'
                  "
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">
                    {{ alert.title }}
                  </p>
                  <p :class="hintClassName">
                    {{ alert.message }} · {{ alert.time }}
                  </p>
                </div>
                <Button
                  v-if="!acknowledged.has(alert.id)"
                  variant="outline"
                  size="sm"
                  @click="acknowledge(alert.id)"
                >
                  确认
                </Button>
                <span v-else :class="hintClassName">已确认</span>
              </div>
            </div>
          </Card>
        </div>

        <Card title="执行实例" :class="cardClassName">
          <BasicTable
            :key="reloadKey"
            :columns="columns"
            :api="listApi"
            :immediate="true"
            :use-search-form="true"
            :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
            :action-column="{ width: 100, title: '操作', fixed: 'right' }"
            :pagination="{
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }"
            :scroll="{ x: 1400 }"
            @register="tableRegister"
          >
            <template #cell-status="{ record }">
              <StatusPill
                :label="data.statusLabels[record.status] || record.status"
                :tone="STATUS_TONE[record.status] || 'neutral'"
              />
            </template>
            <template #cell-progress="{ record }">
              <div class="flex items-center gap-2">
                <div :class="progressTrackClassName">
                  <div
                    class="h-full rounded-full bg-primary transition-[width] duration-500"
                    :style="{ width: `${record.progress}%` }"
                  ></div>
                </div>
                <span
                  class="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >{{ record.progress }}%</span>
              </div>
            </template>
            <template #action="{ record }">
              <Button variant="link" size="sm" @click="openDetail(record)">
查看详情
</Button>
            </template>
          </BasicTable>
        </Card>
      </template>
    </AsyncState>

    <BasicDrawer
      title="执行实例详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
    >
      <template v-if="viewingRecord">
        <Descriptions :column="2" bordered size="middle">
          <DescriptionsItem label="实例 ID" :span="2">
{{
            viewingRecord.id
          }}
</DescriptionsItem>
          <DescriptionsItem label="流程名称">
{{
            viewingRecord.name
          }}
</DescriptionsItem>
          <DescriptionsItem label="当前节点">
{{
            viewingRecord.currentNode
          }}
</DescriptionsItem>
          <DescriptionsItem label="执行状态">
            <StatusPill
              :label="
                data?.statusLabels[viewingRecord.status] || viewingRecord.status
              "
              :tone="STATUS_TONE[viewingRecord.status] || 'neutral'"
            />
          </DescriptionsItem>
          <DescriptionsItem label="执行进度">
{{ viewingRecord.progress }}%
</DescriptionsItem>
          <DescriptionsItem label="触发方式">
{{
            viewingRecord.trigger
          }}
</DescriptionsItem>
          <DescriptionsItem label="运行环境">
{{
            viewingRecord.environment
          }}
</DescriptionsItem>
          <DescriptionsItem label="开始时间" :span="2">
{{
            viewingRecord.startTime
          }}
</DescriptionsItem>
          <DescriptionsItem label="耗时">
{{
            viewingRecord.duration
          }}
</DescriptionsItem>
          <DescriptionsItem label="发起人">
{{
            viewingRecord.initiator
          }}
</DescriptionsItem>
          <DescriptionsItem label="Trace ID" :span="2">
{{
            viewingRecord.traceId
          }}
</DescriptionsItem>
        </Descriptions>
      </template>
      <p v-else :class="hintClassName">暂无执行详情</p>
    </BasicDrawer>
  </div>
</template>
