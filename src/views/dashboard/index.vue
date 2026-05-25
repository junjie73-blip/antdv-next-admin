<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const appStore = useAppStore()

const containerClassName = computed(() =>
  cn('p-6 space-y-6'),
)

interface StatItem {
  title: string
  value: string
  icon: string
  trend: string
  color: string
  gradientFrom: string
  gradientTo: string
}

const stats: StatItem[] = [
  {
    title: '用户总数',
    value: '12,846',
    icon: 'carbon:user-multiple',
    trend: '+12%',
    color: 'blue',
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-blue-500/5',
  },
  {
    title: '订单数量',
    value: '8,234',
    icon: 'carbon:shopping-cart',
    trend: '+8%',
    color: 'green',
    gradientFrom: 'from-emerald-500/10',
    gradientTo: 'to-emerald-500/5',
  },
  {
    title: '销售额',
    value: '¥128,450',
    icon: 'currency-cny',
    trend: '+23%',
    color: 'gold',
    gradientFrom: 'from-amber-500/10',
    gradientTo: 'to-amber-500/5',
  },
  {
    title: '访问量',
    value: '45,678',
    icon: 'carbon:view',
    trend: '+5%',
    color: 'purple',
    gradientFrom: 'from-violet-500/10',
    gradientTo: 'to-violet-500/5',
  },
]

const recentActivities = [
  { user: '张三', action: '创建了新订单', time: '2分钟前', avatar: 'Z' },
  { user: '李四', action: '更新了用户信息', time: '5分钟前', avatar: 'L' },
  { user: '王五', action: '删除了过期数据', time: '10分钟前', avatar: 'W' },
  { user: '赵六', action: '导出了报表', time: '15分钟前', avatar: 'Z' },
]

function getStatCardClassName(stat: StatItem) {
  return cn(
    'h-full rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden',
    'transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 hover:-translate-y-0.5',
    `bg-gradient-to-br ${stat.gradientFrom} ${stat.gradientTo}`,
  )
}

function getStatIconWrapperClassName(color: string) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    gold: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  }
  return cn(
    'w-14 h-14 rounded-xl flex items-center justify-center',
    colorMap[color] || colorMap.blue,
  )
}

function getTrendClassName(trend: string) {
  const isPositive = trend.startsWith('+')
  return cn(
    'text-sm font-medium mt-2',
    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
  )
}
</script>

<template>
  <div :class="containerClassName">
    <div class="space-y-2 mb-6">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
        欢迎回来 👋
      </h1>
      <p class="text-gray-500 dark:text-gray-400">
        今天是 {{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </p>
    </div>

    <a-row :gutter="[16, 16]">
      <a-col
        v-for="stat in stats"
        :key="stat.title"
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <a-card
          hoverable
          :class="getStatCardClassName(stat)"
          variant="borderless"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
                {{ stat.title }}
              </p>
              <p class="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
                {{ stat.value }}
              </p>
              <p :class="getTrendClassName(stat.trend)">
                {{ stat.trend }} 较上周
              </p>
            </div>
            <div :class="getStatIconWrapperClassName(stat.color)">
              <Icon :icon="stat.icon" width="28" height="28" />
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col
        :xs="24"
        :lg="16"
      >
        <a-card
          title="访问趋势"
          class="h-full"
          variant="borderless"
          class-name="rounded-xl border border-gray-100 dark:border-gray-800"
        >
          <div class="h-64 flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-lg">
            <a-empty description="图表组件开发中..." />
          </div>
        </a-card>
      </a-col>
      <a-col
        :xs="24"
        :lg="8"
      >
        <a-card
          title="最近活动"
          class="h-full"
          variant="borderless"
          class-name="rounded-xl border border-gray-100 dark:border-gray-800"
        >
          <a-list
            :data-source="recentActivities"
            item-layout="horizontal"
          >
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta :description="item.time">
                  <template #avatar>
                    <a-avatar class="bg-primary/10 text-primary font-medium">
                      {{ item.avatar }}
                    </a-avatar>
                  </template>
                  <template #title>
                    <span class="font-medium text-gray-800 dark:text-gray-200">{{ item.user }}</span>
                    <span class="text-gray-500 font-normal ml-1">{{ item.action }}</span>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          title="快捷操作"
          variant="borderless"
          class-name="rounded-xl border border-gray-100 dark:border-gray-800"
        >
          <a-space wrap>
            <a-button type="primary">
              新建用户
            </a-button>
            <a-button>创建订单</a-button>
            <a-button>导出数据</a-button>
            <a-button>系统设置</a-button>
          </a-space>
        </a-card>
      </a-col>
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          title="系统信息"
          variant="borderless"
          class-name="rounded-xl border border-gray-100 dark:border-gray-800"
        >
          <a-descriptions
            :column="1"
            size="small"
          >
            <a-descriptions-item label="系统版本">
              v1.0.0
            </a-descriptions-item>
            <a-descriptions-item label="框架版本">
              Vue 3.5 + Antdv Next
            </a-descriptions-item>
            <a-descriptions-item label="当前主题">
              {{ appStore.themeStyle }}
            </a-descriptions-item>
            <a-descriptions-item label="当前语言">
              {{ appStore.locale }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>
