<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const activeTab = ref('basic')

const userInfo = {
  name: 'Alex Johnson',
  role: '高级开发工程师',
  department: '技术研发部',
  email: 'alex.johnson@example.com',
  phone: '+86 138-0000-0001',
  gender: 'Male',
  birthday: '1992-06-15',
  address: 'No. 88, West Nanjing Road, Jing\'an District, Shanghai',
  bio: 'Full-stack developer with 8+ years of experience. Passionate about building scalable web applications and open-source contributions.',
}

const securityInfo = {
  passwordStrength: 85,
  twoFactorEnabled: true,
  loginDevices: [
    { device: 'MacBook Pro - Chrome', location: 'Shanghai, CN', time: '当前会话', icon: 'carbon:laptop' },
    { device: 'iPhone 15 Pro - Safari', location: 'Shanghai, CN', time: '2小时前', icon: 'carbon:phone' },
    { device: 'Windows PC - Edge', location: 'Beijing, CN', time: '3天前', icon: 'carbon:desktop' },
  ],
}

const activityLogs = [
  { action: '登录成功', time: '2026-05-21 09:30:00', color: 'text-green-600 dark:text-green-400' },
  { action: '更新个人资料', time: '2026-05-20 14:22:00', color: 'text-blue-600 dark:text-blue-400' },
  { action: '修改密码', time: '2026-05-18 11:05:00', color: 'text-amber-600 dark:text-amber-400' },
  { action: '登录成功', time: '2026-05-18 09:15:00', color: 'text-green-600 dark:text-green-400' },
  { action: '导出报告数据', time: '2026-05-17 16:45:00', color: 'text-purple-600 dark:text-purple-400' },
]

const userCardClassName = computed(() =>
  cn(
    'rounded-xl border border-gray-100 dark:border-gray-800',
    'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30',
  ),
)

const avatarWrapperClassName = cn(
  'w-20 h-20 rounded-full flex items-center justify-center',
  'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
)

const statItemClassName = cn(
  'flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400',
)

const securityHeaderClassName = cn('flex items-center justify-between')

const deviceItemClassName = cn(
  'flex items-center justify-between p-3 rounded-lg',
  'border border-gray-100 dark:border-gray-800',
  'hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors',
)

const passwordStrengthBarClassName = cn('h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden')

const passwordStrengthFillClassName = cn('h-full rounded-full transition-all duration-500 bg-green-500')

const twoFactorBadgeClassName = cn(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
)

const formItemClassName = cn('mb-4')

const cardClassName = cn('rounded-xl border border-gray-100 dark:border-gray-800')

function getActivityColorClass(color: string) {
  return cn('font-medium', color)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card variant="borderless" :class="userCardClassName">
      <div class="flex items-start gap-6">
        <div :class="avatarWrapperClassName">
          <Icon icon="carbon:user-avatar-filled" width="42" height="42" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
              {{ userInfo.name }}
            </h1>
            <a-tag color="blue">{{ userInfo.role }}</a-tag>
          </div>
          <div class="flex items-center gap-6 mb-3">
            <span :class="statItemClassName">
              <Icon icon="carbon:building" width="16" height="16" />
              {{ userInfo.department }}
            </span>
            <span :class="statItemClassName">
              <Icon icon="carbon:email" width="16" height="16" />
              {{ userInfo.email }}
            </span>
            <span :class="statItemClassName">
              <Icon icon="carbon:phone" width="16" height="16" />
              {{ userInfo.phone }}
            </span>
          </div>
        </div>
        <div class="flex-shrink-0">
          <a-space>
            <a-button type="primary">编辑资料</a-button>
            <a-button>分享</a-button>
          </a-space>
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" :class="cardClassName">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="basic" tab="基本信息">
          <a-descriptions :column="2" bordered size="middle">
            <a-descriptions-item label="用户名">
              {{ userInfo.name }}
            </a-descriptions-item>
            <a-descriptions-item label="邮箱">
              {{ userInfo.email }}
            </a-descriptions-item>
            <a-descriptions-item label="手机号">
              {{ userInfo.phone }}
            </a-descriptions-item>
            <a-descriptions-item label="性别">
              {{ userInfo.gender }}
            </a-descriptions-item>
            <a-descriptions-item label="生日" :span="2">
              {{ userInfo.birthday }}
            </a-descriptions-item>
            <a-descriptions-item label="地址" :span="2">
              {{ userInfo.address }}
            </a-descriptions-item>
            <a-descriptions-item label="个人简介" :span="2">
              {{ userInfo.bio }}
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>

        <a-tab-pane key="security" tab="安全设置">
          <div class="space-y-6">
            <div class="space-y-2">
              <div :class="securityHeaderClassName">
                <span class="font-medium text-gray-700 dark:text-gray-300">密码强度</span>
                <span class="text-sm text-green-600 dark:text-green-400">{{ securityInfo.passwordStrength }}%</span>
              </div>
              <div :class="passwordStrengthBarClassName">
                <div :class="passwordStrengthFillClassName" :style="{ width: `${securityInfo.passwordStrength}%` }" />
              </div>
              <a-button size="small">修改密码</a-button>
            </div>

            <a-divider />

            <div class="space-y-2">
              <div :class="securityHeaderClassName">
                <span class="font-medium text-gray-700 dark:text-gray-300">双因素认证</span>
                <span :class="twoFactorBadgeClassName">
                  <Icon icon="carbon:checkmark-filled" width="14" height="14" />
                  已启用
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                您的账户已受双因素认证保护。
              </p>
            </div>

            <a-divider />

            <div class="space-y-3">
              <span class="font-medium text-gray-700 dark:text-gray-300">登录设备</span>
              <div v-for="device in securityInfo.loginDevices" :key="device.device" :class="deviceItemClassName">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                    <Icon :icon="device.icon" width="20" height="20" />
                  </div>
                  <div>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ device.device }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ device.location }}</p>
                  </div>
                </div>
                <span class="text-xs text-gray-400">{{ device.time }}</span>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="activity" tab="活动日志">
          <a-timeline>
            <a-timeline-item v-for="log in activityLogs" :key="log.time">
              <template #dot>
                <div class="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30" />
              </template>
              <div class="ml-1">
                <p :class="getActivityColorClass(log.color)">{{ log.action }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ log.time }}</p>
              </div>
            </a-timeline-item>
          </a-timeline>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>