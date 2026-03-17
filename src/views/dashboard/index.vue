<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const appStore = useAppStore()

const containerClassName = computed(() =>
  cn(
    'p-6 space-y-6',
  ),
)

const stats = [
  { title: '用户总数', value: '12,846', icon: '👥', trend: '+12%', color: 'blue' },
  { title: '订单数量', value: '8,234', icon: '📦', trend: '+8%', color: 'green' },
  { title: '销售额', value: '¥128,450', icon: '💰', trend: '+23%', color: 'gold' },
  { title: '访问量', value: '45,678', icon: '👁️', trend: '+5%', color: 'purple' },
]

const recentActivities = [
  { user: '张三', action: '创建了新订单', time: '2分钟前', avatar: 'Z' },
  { user: '李四', action: '更新了用户信息', time: '5分钟前', avatar: 'L' },
  { user: '王五', action: '删除了过期数据', time: '10分钟前', avatar: 'W' },
  { user: '赵六', action: '导出了报表', time: '15分钟前', avatar: 'Z' },
]
</script>

<template>
  <div :class="containerClassName">
    <div class="space-y-2">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
        欢迎回来 👋
      </h1>
      <p class="text-gray-500 dark:text-gray-400">
        今天是 {{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </p>
    </div>

    <a-row
      :gutter="[16,
                16]"
    >
      <a-col
        v-for="stat in stats"
        :key="stat.title"
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <a-card
          hoverable
          class="h-full"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 dark:text-gray-400 text-sm mb-1">
                {{ stat.title }}
              </p>
              <p class="text-2xl font-bold text-gray-800 dark:text-white">
                {{ stat.value }}
              </p>
              <p class="text-green-500 text-sm mt-1">
                {{ stat.trend }} 较上周
              </p>
            </div>
            <div class="text-4xl">
              {{ stat.icon }}
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-row
      :gutter="[16,
                16]"
    >
      <a-col
        :xs="24"
        :lg="16"
      >
        <a-card
          title="访问趋势"
          class="h-full"
        >
          <div class="h-64 flex items-center justify-center text-gray-400">
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
        >
          <a-list
            :data-source="recentActivities"
            item-layout="horizontal"
          >
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta :description="item.time">
                  <template #avatar>
                    <a-avatar>{{ item.avatar }}</a-avatar>
                  </template>
                  <template #title>
                    <span class="font-medium">{{ item.user }}</span>
                    <span class="text-gray-500 font-normal ml-1">{{ item.action }}</span>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <a-row
      :gutter="[16,
                16]"
    >
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card title="快捷操作">
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
        <a-card title="系统信息">
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
