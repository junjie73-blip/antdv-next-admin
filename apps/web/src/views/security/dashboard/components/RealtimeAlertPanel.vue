<script setup lang="ts">
import type { AlertItem, SecurityEventLevel } from '~/api/security';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { Empty, Loading, Scrollbar, Tag } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getAlertList, handleAlert } from '~/api/security';

defineOptions({ name: 'RealtimeAlertPanel' });

const containerClassName = cn('rounded-xl p-5');
const alertCardClassName = cn(
  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-200 hover:shadow-sm',
);
const iconWrapClassName = cn(
  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
);

const alerts = ref<AlertItem[]>([]);
const loading = ref(false);

/** 级别配置 */
function getLevelConfig(level: SecurityEventLevel) {
  const map: Record<
    SecurityEventLevel,
    { color: string; bg: string; icon: string; label: string }
  > = {
    critical: {
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      icon: 'carbon:warning-filled',
      label: '严重',
    },
    high: {
      color: 'text-warning',
      bg: 'bg-warning/10',
      icon: 'carbon:warning-alt',
      label: '高危',
    },
    medium: {
      color: 'text-primary',
      bg: 'bg-primary/10',
      icon: 'carbon:information',
      label: '中危',
    },
    low: {
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      icon: 'carbon:checkmark',
      label: '低危',
    },
  };
  return map[level] || map.low;
}

/** 是否为高优先级（严重或高危） */
function isHighPriority(level: SecurityEventLevel): boolean {
  return level === 'critical' || level === 'high';
}

/** 处置操作 */
async function onHandle(alertId: string, action: string) {
  try {
    await handleAlert(alertId, action);
    // 从列表中移除
    alerts.value = alerts.value.filter((a) => a.id !== alertId);
  } catch (error: any) {
    console.error('处置失败', error);
  }
}

let pollTimer: ReturnType<typeof setInterval> | undefined;

async function loadAlerts() {
  try {
    const result = await getAlertList();
    alerts.value = Array.isArray(result.list) ? result.list : [];
  } catch {
    alerts.value = [];
  }
}

onMounted(async () => {
  loading.value = true;
  await loadAlerts();
  loading.value = false;
  // 真实轮询后端告警台账，不再在前端伪造告警
  pollTimer = setInterval(() => {
    void loadAlerts();
  }, 15_000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div :class="cn(containerClassName, 'border-border bg-card')">
    <!-- 标题 -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-base font-semibold text-foreground">实时告警</h3>
        <!-- 脉冲指示灯 -->
        <span class="relative flex h-2.5 w-2.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60"
          ></span>
          <span
            class="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive"
          ></span>
        </span>
        <span class="text-xs text-destructive">LIVE</span>
      </div>
      <Button size="sm" variant="link" class="h-auto px-0" @click="alerts = []">
        清空已读
      </Button>
    </div>

    <!-- 告警列表 -->
    <div class="relative">
      <Loading :loading="loading" :absolute="true" size="small" />
      <Scrollbar v-if="alerts.length > 0" root-class="max-h-[240px] pr-1">
        <div class="space-y-2.5">
          <div
            v-for="alert in alerts"
            :key="alert.id"
            :class="
              cn(
                alertCardClassName,
                isHighPriority(alert.level)
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border',
                isHighPriority(alert.level) && 'animate-pulse-subtle',
              )
            "
          >
            <!-- 图标 -->
            <div :class="cn(iconWrapClassName, getLevelConfig(alert.level).bg)">
              <Icon
                :icon="getLevelConfig(alert.level).icon"
                :width="16"
                :height="16"
                :class="getLevelConfig(alert.level).color"
              />
            </div>

            <!-- 内容 -->
            <div class="min-w-0 flex-1">
              <div class="mb-0.5 flex items-center gap-2">
                <span class="truncate text-sm font-medium text-foreground">{{
                  alert.message
                }}</span>
                <Tag
                  :color="
                    alert.level === 'critical'
                      ? 'red'
                      : alert.level === 'high'
                        ? 'orange'
                        : undefined
                  "
                  class="shrink-0 text-[10px]"
                >
                  {{ getLevelConfig(alert.level).label }}
                </Tag>
              </div>
              <div class="mt-1 flex items-center justify-between">
                <span class="font-mono text-[11px] text-muted-foreground">{{
                  alert.source
                }}</span>
                <span class="text-[11px] text-muted-foreground">{{
                  new Date(alert.timestamp).toLocaleTimeString('zh-CN')
                }}</span>
              </div>

              <!-- 操作按钮 -->
              <div
                v-if="isHighPriority(alert.level)"
                class="mt-2 flex items-center gap-2"
              >
                <Button
                  v-for="action in alert.actions"
                  :key="action"
                  size="xs"
                  variant="destructive"
                  class="!h-6 !px-2 !text-xs"
                  @click.stop="onHandle(alert.id, action)"
                >
                  {{ action }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Scrollbar>

      <Empty v-else description="暂无告警信息" class="py-8" />
    </div>
  </div>
</template>

<style scoped>
.animate-pulse-subtle {
  animation: pulse-subtle 3s ease-in-out infinite;
}
@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}
</style>
