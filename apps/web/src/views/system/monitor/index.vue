<script setup lang="ts">
import type { MonitorSnapshotData } from '~/api/monitor';
import type { Tone } from '~/utils/log-format';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Card, PageHeader, Segmented } from '@antdv/common-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getMonitorSnapshot } from '~/api/monitor';
import { formatCount, unwrapApi } from '~/utils/log-format';

import AsyncState from '../components/AsyncState.vue';
import MetricCard from '../components/MetricCard.vue';
import StatusPill from '../components/StatusPill.vue';

/**
 * 系统监控（服务资源 / 进程 / 中间件）。
 *
 * 对齐参考实现的「系统监控」：头部健康徽标与自动刷新、四张概览卡、资源条、
 * 进程表、数据库 / 缓存 / 队列三块。数据来自 backend-mock 的快照接口，
 * 30 秒自动轮询在 onUnmounted 对称清理，不留定时器。
 */
defineOptions({ name: 'SystemMonitor' });

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const statsGridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
);
const resourceGridClassName = cn('grid grid-cols-1 gap-4 md:grid-cols-2');
const infraGridClassName = cn('grid grid-cols-1 gap-4 lg:grid-cols-3');
const tableClassName = cn('w-full border-collapse text-sm');
const headCellClassName = cn(
  'border-border text-muted-foreground border-b py-2 text-left font-medium',
);
const bodyCellClassName = cn('border-border text-foreground border-b py-2');
const labelClassName = cn('text-muted-foreground text-xs');
const valueClassName = cn('text-foreground text-base font-medium tabular-nums');
const progressTrackClassName = cn(
  'bg-muted mt-2 h-2 w-full overflow-hidden rounded-full',
);
const sectionTitleClassName = cn('text-foreground text-sm font-medium');

const TONE_BAR: Record<string, string> = {
  error: 'bg-destructive',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
};

const ENV_OPTIONS = ['生产环境', '预发环境'];

const environmentTab = ref('生产环境');
const autoRefresh = ref(true);
const loading = ref(false);
const error = ref('');
const snapshot = ref<MonitorSnapshotData | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

function asTone(value: string): Tone {
  return (
    ['error', 'info', 'neutral', 'success', 'warning'].includes(value)
      ? value
      : 'neutral'
  ) as Tone;
}

const environment = computed(() =>
  environmentTab.value === '预发环境' ? 'staging' : 'production',
);

const infraBlocks = computed(() => {
  const data = snapshot.value;
  if (!data) return [];
  return [
    {
      title: `数据库 · ${data.database.name}`,
      icon: 'carbon:data-base',
      rows: [
        [
          '实例 / 副本',
          `${data.database.replicas + 1} / ${data.database.replicas}`,
        ],
        ['活跃连接', formatCount(data.database.activeConnections)],
        ['每秒查询', formatCount(data.database.qps)],
        ['慢查询', String(data.database.slowQueries)],
      ],
    },
    {
      title: `缓存 · ${data.redis.name}`,
      icon: 'carbon:data-center',
      rows: [
        ['命中率', `${data.redis.hitRate}%`],
        ['键数量', formatCount(data.redis.keys)],
        ['内存占用', data.redis.memory],
        ['每秒操作', formatCount(data.redis.ops)],
      ],
    },
    {
      title: `消息队列 · ${data.rabbitmq.name}`,
      icon: 'carbon:flow',
      rows: [
        ['虚拟主机', data.rabbitmq.vhost],
        ['Ready 消息', String(data.rabbitmq.ready)],
        ['未确认消息', String(data.rabbitmq.unacked)],
        ['消费者', String(data.rabbitmq.consumers)],
      ],
    },
  ];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getMonitorSnapshot({ environment: environment.value });
    snapshot.value = unwrapApi<MonitorSnapshotData | null>(res) ?? null;
  } catch (error) {
    error.value =
      error instanceof Error ? error.message : '监控快照接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  timer = setInterval(() => {
    if (autoRefresh.value) load();
  }, 30_000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="系统监控"
      description="服务资源、进程与中间件运行快照 · 每 30 秒自动刷新"
      icon="carbon:screen"
    >
      <template #extra>
        <Segmented
          v-model:value="environmentTab"
          :options="ENV_OPTIONS"
          size="small"
          @update:value="load"
        />
        <span class="flex items-center gap-2">
          <Switch
            :model-value="autoRefresh"
            @update:model-value="(v: boolean) => (autoRefresh = v)"
          />
          <span :class="labelClassName">自动刷新</span>
        </span>
        <Button variant="outline" size="sm" :disabled="loading" @click="load">
          <Icon icon="carbon:renew" :class="loading ? 'animate-spin' : ''" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <AsyncState
      :loading="loading && !snapshot"
      :error="error"
      :empty="!loading && !snapshot"
      @retry="load"
    >
      <template v-if="snapshot">
        <Card :class="cardClassName">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p :class="sectionTitleClassName">
                {{ snapshot.hostname }} · {{ snapshot.region }}
              </p>
              <p :class="labelClassName">
                最近更新 {{ snapshot.updatedAt }} · 当前 {{ environmentTab }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <StatusPill
                :label="snapshot.health.label"
                :tone="asTone(snapshot.health.tone)"
              />
              <span :class="labelClassName">健康评分 {{ snapshot.healthScore }} / 100</span>
            </div>
          </div>
        </Card>

        <div :class="statsGridClassName">
          <MetricCard
            title="健康评分"
            :value="snapshot.healthScore"
            suffix="分"
            icon="carbon:checkmark-outline"
            tone="success"
          />
          <MetricCard
            title="应用进程"
            :value="snapshot.processes.length"
            suffix="个"
            icon="carbon:application"
            tone="info"
          />
          <MetricCard
            title="数据库实例"
            :value="snapshot.database.replicas + 1"
            suffix="个"
            icon="carbon:data-base"
          />
          <MetricCard
            title="慢查询"
            :value="snapshot.database.slowQueries"
            suffix="条"
            icon="carbon:warning"
            tone="warning"
          />
        </div>

        <div :class="resourceGridClassName">
          <Card
            v-for="resource in snapshot.resources"
            :key="resource.key"
            :class="cardClassName"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span :class="sectionTitleClassName">{{ resource.label }}</span>
              <span :class="valueClassName">{{ resource.value }}{{ resource.unit }}</span>
            </div>
            <div :class="progressTrackClassName">
              <div
                class="h-full rounded-full transition-[width] duration-500"
                :class="TONE_BAR[resource.tone]"
                :style="{ width: `${Math.min(resource.value, 100)}%` }"
              ></div>
            </div>
            <p :class="labelClassName" class="mt-2">{{ resource.detail }}</p>
          </Card>
        </div>

        <Card title="应用进程" :class="cardClassName">
          <div class="overflow-x-auto">
            <table :class="tableClassName">
              <thead>
                <tr>
                  <th :class="headCellClassName">进程名称</th>
                  <th :class="headCellClassName">版本</th>
                  <th :class="headCellClassName">运行时长</th>
                  <th :class="headCellClassName">CPU</th>
                  <th :class="headCellClassName">内存</th>
                  <th :class="headCellClassName">线程数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="process in snapshot.processes" :key="process.id">
                  <td :class="bodyCellClassName">{{ process.name }}</td>
                  <td :class="bodyCellClassName">{{ process.version }}</td>
                  <td :class="bodyCellClassName">{{ process.uptime }}</td>
                  <td :class="bodyCellClassName">{{ process.cpu }}%</td>
                  <td :class="bodyCellClassName">
                    {{ formatCount(process.memory) }} MB
                  </td>
                  <td :class="bodyCellClassName">{{ process.threads }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div :class="infraGridClassName">
          <Card
            v-for="block in infraBlocks"
            :key="block.title"
            :class="cardClassName"
          >
            <template #extra>
<Icon :icon="block.icon" class="text-base text-primary" />
</template>
            <p :class="sectionTitleClassName">{{ block.title }}</p>
            <dl class="mt-3 space-y-2">
              <div
                v-for="row in block.rows"
                :key="row[0]"
                class="flex items-center justify-between gap-2"
              >
                <dt :class="labelClassName">{{ row[0] }}</dt>
                <dd class="text-sm tabular-nums text-foreground">
                  {{ row[1] }}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </template>
    </AsyncState>
  </div>
</template>
