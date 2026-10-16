<script setup lang="ts">
import { ref } from 'vue';

import { Segmented, Space } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

import RealtimeAlertPanel from './components/RealtimeAlertPanel.vue';
import SecurityScoreCard from './components/SecurityScoreCard.vue';
import SecurityStatsCharts from './components/SecurityStatsCharts.vue';
import SecurityTimeline from './components/SecurityTimeline.vue';

defineOptions({ name: 'SecurityDashboard' });

const containerClassName = cn('space-y-4');
const headerClassName = cn('mb-2 flex items-center justify-between');

const range = ref('今日');
</script>

<template>
  <div :class="containerClassName">
    <!-- 页面标题 -->
    <div :class="headerClassName">
      <div>
        <h1
          class="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white"
        >
          <Icon
            icon="carbon:security"
            :width="24"
            :height="24"
            class="text-primary"
          />
          安全审计仪表盘
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          实时安全态势感知与威胁分析中心
        </p>
      </div>
      <Space>
        <Segmented
          v-model:value="range"
          :options="['今日', '近7天', '近30天']"
          size="small"
        />
        <Button size="sm">
          <Icon icon="carbon:download" />
          导出报告
        </Button>
      </Space>
    </div>

    <!-- 第一行：评分卡 + 告警面板 -->
    <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
      <!-- 安全评分（占2列） -->
      <div class="xl:col-span-2">
        <SecurityScoreCard />
      </div>

      <!-- 实时告警（占1列） -->
      <div>
        <RealtimeAlertPanel />
      </div>
    </div>

    <!-- 第二行：统计图表 -->
    <SecurityStatsCharts />

    <!-- 第三行：事件时间线 -->
    <SecurityTimeline />
  </div>
</template>
