<script setup lang="ts">
import { ref } from 'vue';

import { PageHeader, Segmented } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

import RealtimeAlertPanel from './components/RealtimeAlertPanel.vue';
import SecurityScoreCard from './components/SecurityScoreCard.vue';
import SecurityStatsCharts from './components/SecurityStatsCharts.vue';
import SecurityTimeline from './components/SecurityTimeline.vue';

defineOptions({ name: 'SecurityDashboard' });

const containerClassName = cn('space-y-4');

const range = ref('今日');
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="安全审计仪表盘"
      description="安全态势、实时告警与风险事件都在这一页；切换时间范围会同步下面的图表"
      icon="carbon:security"
    >
      <template #extra>
        <Segmented
          v-model:value="range"
          :options="['今日', '近7天', '近30天']"
          size="small"
        />
        <Button>
          <Icon icon="carbon:download" />
          导出报告
        </Button>
      </template>
    </PageHeader>

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
