<script setup lang="ts">
import type { AlertItem, SecurityEventLevel } from '~/api/security';

import { onMounted, ref } from 'vue';

import { Icon } from '@iconify/vue';
import { getAlertList, handleAlert } from '~/api/security';
import { cn } from '~/utils/cn';

defineOptions({ name: 'RealtimeAlertPanel' });

const containerClassName = cn('rounded-xl p-5');
const alertCardClassName = cn(
  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-200 hover:shadow-sm',
);
const iconWrapClassName = cn(
  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
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
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
      icon: 'carbon:warning-filled',
      label: '严重',
    },
    high: {
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
      icon: 'carbon:warning-alt',
      label: '高危',
    },
    medium: {
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      icon: 'carbon:information',
      label: '中危',
    },
    low: {
      color: 'text-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-800',
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

onMounted(async () => {
  loading.value = true;
  try {
    const res = await getAlertList();
    // 兼容多种返回格式：{ list: [] } | 直接数组 | { data: { list: [] } }
    const rawData = res?.data ?? res;
    const listData = rawData?.list ?? (Array.isArray(rawData) ? rawData : []);
    alerts.value = Array.isArray(listData) ? listData : [];
  } catch {
    alerts.value = [];
  } finally {
    loading.value = false;
  }

  // 模拟实时推送：每15秒可能新增一条告警
  setInterval(() => {
    if (Math.random() > 0.6) {
      // 60% 概率新增
      const levels: SecurityEventLevel[] = [
        'critical',
        'high',
        'medium',
        'low',
      ];
      const messages = [
        '检测到异常登录尝试',
        '敏感接口调用频率异常',
        '发现新的可疑IP访问',
        '用户权限变更通知',
      ];
      const newAlert: AlertItem = {
        id: `alert-${Date.now()}`,
        level: levels[Math.floor(Math.random() * levels.length)]!,
        message: messages[Math.floor(Math.random() * messages.length)]!,
        source: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        timestamp: new Date().toISOString(),
        actions: ['查看详情', '忽略'],
      };
      alerts.value = [newAlert, ...alerts.value].slice(0, 10);
    }
  }, 15_000);
});
</script>

<template>
  <div
    :class="
      cn(
        containerClassName,
        'border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
      )
    "
  >
    <!-- 标题 -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-base font-semibold text-gray-800 dark:text-white">
          实时告警
        </h3>
        <!-- 脉冲指示灯 -->
        <span class="relative flex h-2.5 w-2.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"
          ></span>
        </span>
        <span class="text-xs text-red-400">LIVE</span>
      </div>
      <a-button size="small" type="link" @click="alerts = []">
        清空已读
      </a-button>
    </div>

    <!-- 告警列表 -->
    <a-spin :spinning="loading">
      <PerfectScrollbar v-if="alerts.length > 0" class="max-h-[240px] pr-1">
        <div class="space-y-2.5">
          <div
            v-for="alert in alerts"
            :key="alert.id"
            :class="
              cn(
                alertCardClassName,
                isHighPriority(alert.level)
                  ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/10'
                  : 'border-gray-100 dark:border-gray-800',
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
                <span
                  class="truncate text-sm font-medium text-gray-800 dark:text-gray-200"
                  >{{ alert.message }}</span>
                <a-tag
                  :color="
                    alert.level === 'critical'
                      ? 'error'
                      : alert.level === 'high'
                        ? 'warning'
                        : undefined
                  "
                  size="small"
                  class="shrink-0 text-[10px]"
                >
                  {{ getLevelConfig(alert.level).label }}
                </a-tag>
              </div>
              <div class="mt-1 flex items-center justify-between">
                <span class="font-mono text-[11px] text-gray-400">{{
                  alert.source
                }}</span>
                <span class="text-[11px] text-gray-400">{{
                  new Date(alert.timestamp).toLocaleTimeString('zh-CN')
                }}</span>
              </div>

              <!-- 操作按钮 -->
              <div
                v-if="isHighPriority(alert.level)"
                class="mt-2 flex items-center gap-2"
              >
                <a-button
                  v-for="action in alert.actions"
                  :key="action"
                  size="small"
                  danger
                  class="!h-6 !px-2 !text-xs"
                  @click.stop="onHandle(alert.id, action)"
                >
                  {{ action }}
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </PerfectScrollbar>

      <a-empty v-else description="暂无告警信息" class="py-8" />
    </a-spin>
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
