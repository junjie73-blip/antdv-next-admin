<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { cn } from '@/utils/cn'
import RealtimeAlertPanel from './components/RealtimeAlertPanel.vue'
import SecurityScoreCard from './components/SecurityScoreCard.vue'
import SecurityStatsCharts from './components/SecurityStatsCharts.vue'
import SecurityTimeline from './components/SecurityTimeline.vue'

defineOptions({ name: 'SecurityDashboard' })

const containerClassName = cn('p-5 space-y-4')
const headerClassName = cn('flex items-center justify-between mb-2')
</script>

<template>
  <div :class="containerClassName">
    <!-- 页面标题 -->
    <div :class="headerClassName">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Icon
            icon="carbon:security"
            :width="24"
            :height="24"
            class="text-primary"
          />
          安全审计仪表盘
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          实时安全态势感知与威胁分析中心
        </p>
      </div>
      <a-space>
        <a-segmented
          :options="['今日',
                     '近7天',
                     '近30天']"
          default-value="今日"
          size="small"
        />
        <a-button size="small">
          <template #icon>
            <Icon icon="carbon:download" />
          </template>
          导出报告
        </a-button>
      </a-space>
    </div>

    <!-- 第一行：评分卡 + 告警面板 -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
      <!-- 安全评分（占2列） -->
      <div class="xl:col-span-2 h-full">
        <SecurityScoreCard />
      </div>

      <!-- 实时告警（占1列） -->
      <div class="h-full">
        <RealtimeAlertPanel />
      </div>
    </div>

    <!-- 第二行：统计图表 -->
    <SecurityStatsCharts />

    <!-- 第三行：事件时间线 -->
    <SecurityTimeline />
  </div>
</template>
