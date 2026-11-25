<script setup lang="ts">
import { ref } from 'vue';

import { PageHeader, Segmented } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getAuditStats, getSecurityScore, getSecurityStats } from '~/api/security';

import RealtimeAlertPanel from './components/RealtimeAlertPanel.vue';
import SecurityScoreCard from './components/SecurityScoreCard.vue';
import SecurityStatsCharts from './components/SecurityStatsCharts.vue';
import SecurityTimeline from './components/SecurityTimeline.vue';

defineOptions({ name: 'SecurityDashboard' });

const containerClassName = cn('space-y-4');

const range = ref('今日');

/** 导出当前安全态势快照（JSON），便于接入合规归档流程 */
async function exportReport() {
  try {
    const [score, stats, operations] = await Promise.all([
      getSecurityScore(),
      getSecurityStats(),
      getAuditStats(),
    ]);
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), range: range.value, score, stats, operations }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('安全报告已导出');
  } catch {
    message.error('报告导出失败，请稍后重试');
  }
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="安全审计仪表盘"
      description="安全态势、实时告警、AI 风险与审计运营集中呈现；切换时间范围会重新加载下方组件"
      icon="carbon:security"
    >
      <template #extra>
        <Segmented
          v-model:value="range"
          :options="['今日', '近7天', '近30天']"
          size="small"
        />
        <Button @click="exportReport">
          <Icon icon="carbon:download" />
          导出报告
        </Button>
      </template>
    </PageHeader>

    <!-- 第一行：评分卡 + 告警面板 -->
    <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
      <!-- 安全评分（占2列） -->
      <div class="xl:col-span-2">
        <SecurityScoreCard :key="`score-${range}`" />
      </div>

      <!-- 实时告警（占1列） -->
      <div>
        <RealtimeAlertPanel :key="`alert-${range}`" />
      </div>
    </div>

    <!-- 第二行：统计图表 -->
    <SecurityStatsCharts :key="`stats-${range}`" />

    <!-- 第三行：事件时间线 -->
    <SecurityTimeline :key="`timeline-${range}`" />
  </div>
</template>
