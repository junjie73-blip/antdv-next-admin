<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { cn } from '@/utils/cn'

defineOptions({ name: 'DashboardWorkbench' })

const quickActions = [
  { icon: 'carbon:user-multiple', title: '用户管理', desc: '管理系统用户', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { icon: 'carbon:role', title: '角色权限', desc: '配置角色与权限', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  { icon: 'carbon:document-security', title: '安全审计', desc: '查看安全态势', color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
  { icon: 'carbon:chart-line-data', title: '监控大屏', desc: '实时数据监控', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
]

const recentActivities = [
  { action: '管理员修改了角色「超级管理员」的权限', time: '10分钟前', type: 'permission' },
  { action: '用户「张伟」从北京登录系统', time: '25分钟前', type: 'login' },
  { action: '检测到3条新的安全告警', time: '1小时前', type: 'alert' },
  { action: '数据字典「用户状态」已更新', time: '2小时前', type: 'dict' },
  { action: '系统备份任务执行完成', time: '3小时前', type: 'system' },
]

const cardClassName = cn(
  'rounded-xl p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
)

const statCards = [
  { label: '总用户数', value: 1286, icon: 'carbon:user-multiple', change: '+12%', up: true },
  { label: '今日访问', value: 4921, icon: 'carbon:view', change: '+8.2%', up: true },
  { label: '活跃会话', value: 186, icon: 'carbon:activity', change: '-3.1%', up: false },
  { label: '告警数量', value: 3, icon: 'carbon:warning-alt', change: '-25%', up: true },
]
</script>

<template>
  <div class="p-5 space-y-4">
    <!-- 欢迎区 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
          工作台
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          欢迎回来，这是您的系统概览
        </p>
      </div>
      <span class="text-xs text-gray-400">{{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-4">
      <div
        v-for="stat in statCards"
        :key="stat.label"
        :class="cardClassName"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500">
              {{ stat.label }}
            </p>
            <p class="text-2xl font-bold mt-1 tabular-nums text-gray-800 dark:text-white">
              {{ stat.value }}
            </p>
            <p
              :class="stat.up ? 'text-emerald-500' : 'text-red-500'"
              class="text-xs mt-0.5 flex items-center gap-0.5"
            >
              <Icon
                :icon="stat.up ? 'carbon:arrow-up' : 'carbon:arrow-down'"
                :width="12"
              />
              {{ stat.change }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon
              :icon="stat.icon"
              :width="20"
              class="text-primary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 + 最近动态 -->
    <div class="grid grid-cols-2 gap-4">
      <!-- 快捷操作 -->
      <div :class="cardClassName">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          快捷操作
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="action in quickActions"
            :key="action.title"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
          >
            <div
              :class="action.color"
              class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            >
              <Icon
                :icon="action.icon"
                :width="18"
              />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors">
                {{ action.title }}
              </p>
              <p class="text-[11px] text-gray-400 mt-0.5">
                {{ action.desc }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近动态 -->
      <div :class="cardClassName">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          最近动态
        </h3>
        <div class="space-y-3">
          <div
            v-for="(activity, i) in recentActivities"
            :key="i"
            class="flex items-start gap-3 text-sm"
          >
            <span
              class="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
              :class="activity.type === 'alert' ? 'bg-red-400' : activity.type === 'login' ? 'bg-blue-400' : activity.type === 'permission' ? 'bg-orange-400' : 'bg-gray-400'"
            />
            <div class="min-w-0 flex-1">
              <p class="text-gray-600 dark:text-gray-400 truncate">
                {{ activity.action }}
              </p>
              <p class="text-[11px] text-gray-400 mt-0.5">
                {{ activity.time }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
