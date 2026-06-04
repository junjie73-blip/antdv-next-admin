<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'

const userStore = useUserStore()
const router = useRouter()

const activeTab = ref('basic')

// 滑动删除相关
const swipedDeviceId = ref<string | null>(null)
const swipeStartX = ref(0)
const swipeCurrentX = ref(0)

interface LoginDevice {
  device: string
  location: string
  time: string
  icon: string
}

const containerClassName = cn('space-y-6')

const displayRole = computed(() => {
  const roles = userStore.roles
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.join('、')
  }
  return '未分配'
})

const _displayPermissions = computed(() => {
  const perms = userStore.permissions
  if (Array.isArray(perms) && perms.length > 0) {
    return perms.join('、')
  }
  return '无'
})

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
  'w-20 h-20 rounded-full flex items-center justify-center overflow-hidden',
  'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
)

const avatarImgClassName = cn('w-full h-full object-cover')

const statItemClassName = cn(
  'flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400',
)

const securityHeaderClassName = cn('flex items-center justify-between')

const passwordStrengthBarClassName = cn('h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden')

const passwordStrengthFillClassName = cn('h-full rounded-full transition-all duration-500 bg-green-500')

const twoFactorBadgeClassName = cn(
  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
)

const cardClassName = cn('rounded-xl border border-gray-100 dark:border-gray-800')

const teamInfoItemClassName = cn('flex items-center gap-3')

const teamInfoLabelClassName = cn('text-sm text-gray-500 dark:text-gray-400 min-w-12')

const teamInfoValueClassName = cn('text-sm text-gray-800 dark:text-gray-200')

const permissionTagClassName = cn('mr-1 mb-1')

const hasAvatar = computed(() => {
  const info = userStore.userInfo
  return info !== null && typeof info === 'object' && typeof (info as any).avatar === 'string' && (info as any).avatar.length > 0
})

function getActivityColorClass(color: string) {
  return cn('font-medium', color)
}

// 滑动删除事件（仅电脑端鼠标，全局监听防止丢失）
const draggingDeviceId = ref<string | null>(null)

function handleSwipeStart(e: MouseEvent, deviceId: string) {
  e.preventDefault()
  swipeStartX.value = e.clientX
  draggingDeviceId.value = deviceId
  swipedDeviceId.value = null
  swipeCurrentX.value = 0
  // 全局监听：防止鼠标移出元素后丢失事件
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
}

function handleGlobalMouseMove(e: MouseEvent) {
  if (draggingDeviceId.value === null)
    return
  const delta = e.clientX - swipeStartX.value
  if (delta > 20) {
    swipedDeviceId.value = draggingDeviceId.value!
    swipeCurrentX.value = Math.min(delta, 120)
  }
  else {
    swipedDeviceId.value = null
    swipeCurrentX.value = 0
  }
}

function handleGlobalMouseUp() {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
  draggingDeviceId.value = null
  swipeCurrentX.value = 0
}

function handleDeleteDevice(device: LoginDevice) {
  const isCurrent = device.time === '当前会话'

  if (isCurrent) {
    Modal.confirm({
      title: '注销当前设备',
      content: `您正在删除当前登录设备「${device.device}」，删除后将退出登录，确定继续吗？`,
      okText: '确定退出',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        const idx = securityInfo.loginDevices.findIndex(d => d.device === device.device)
        if (idx > -1)
          securityInfo.loginDevices.splice(idx, 1)
        swipedDeviceId.value = null
        userStore.logout()
        router.push('/login')
      },
      onCancel: () => {
        swipedDeviceId.value = null
      },
    })
    return
  }

  Modal.confirm({
    title: '移除登录设备',
    content: `确定要移除设备「${device.device}」吗？移除后该设备将需要重新登录。`,
    okText: '确定移除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      const idx = securityInfo.loginDevices.findIndex(d => d.device === device.device)
      if (idx > -1) {
        securityInfo.loginDevices.splice(idx, 1)
        message.success(`已移除设备：${device.device}`)
      }
      swipedDeviceId.value = null
    },
    onCancel: () => {
      swipedDeviceId.value = null
    },
  })
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      variant="borderless"
      :class="userCardClassName"
    >
      <div class="flex items-start gap-6">
        <div :class="avatarWrapperClassName">
          <template v-if="hasAvatar">
            <img
              :src="userStore.avatar"
              :alt="userStore.nickname"
              :class="avatarImgClassName"
            >
          </template>
          <template v-else>
            <Icon
              icon="carbon:user-avatar-filled"
              width="42"
              height="42"
            />
          </template>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
              {{ userStore.nickname || userStore.username }}
            </h1>
            <a-tag color="blue">
              {{ displayRole }}
            </a-tag>
          </div>
          <div class="flex items-center gap-6 mb-3">
            <span :class="statItemClassName">
              <Icon
                icon="carbon:building"
                width="16"
                height="16"
              />
              技术研发部
            </span>
            <span :class="statItemClassName">
              <Icon
                icon="carbon:email"
                width="16"
                height="16"
              />
              {{ userStore.email }}
            </span>
            <span :class="statItemClassName">
              <Icon
                icon="carbon:phone"
                width="16"
                height="16"
              />
              {{ userStore.phone }}
            </span>
          </div>
        </div>
        <div class="flex-shrink-0">
          <a-space>
            <a-button type="primary">
              编辑资料
            </a-button>
            <a-button>分享</a-button>
          </a-space>
        </div>
      </div>
    </a-card>

    <a-card
      variant="borderless"
      :class="cardClassName"
    >
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane
          key="basic"
          tab="基本信息"
        >
          <a-descriptions
            :column="2"
            bordered
            size="middle"
          >
            <a-descriptions-item label="用户名">
              {{ userStore.username }}
            </a-descriptions-item>
            <a-descriptions-item label="昵称">
              {{ userStore.nickname }}
            </a-descriptions-item>
            <a-descriptions-item label="邮箱">
              {{ userStore.email }}
            </a-descriptions-item>
            <a-descriptions-item label="手机号">
              {{ userStore.phone }}
            </a-descriptions-item>
            <a-descriptions-item
              label="性别"
              :span="2"
            >
              未设置
            </a-descriptions-item>
            <a-descriptions-item
              label="生日"
              :span="2"
            >
              未设置
            </a-descriptions-item>
            <a-descriptions-item
              label="地址"
              :span="2"
            >
              未设置
            </a-descriptions-item>
            <a-descriptions-item
              label="个人简介"
              :span="2"
            >
              未设置
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>

        <a-tab-pane
          key="security"
          tab="安全设置"
        >
          <div class="space-y-6">
            <div class="space-y-2">
              <div :class="securityHeaderClassName">
                <span class="font-medium text-gray-700 dark:text-gray-300">密码强度</span>
                <span class="text-sm text-green-600 dark:text-green-400">{{ securityInfo.passwordStrength }}%</span>
              </div>
              <div :class="passwordStrengthBarClassName">
                <div
                  :class="passwordStrengthFillClassName"
                  :style="{ width: `${securityInfo.passwordStrength}%` }"
                />
              </div>
              <a-button
                size="small"
                @click="$router.push('/account/settings')"
              >
                前往修改
              </a-button>
            </div>

            <a-divider />

            <div class="space-y-2">
              <div :class="securityHeaderClassName">
                <span class="font-medium text-gray-700 dark:text-gray-300">双因素认证</span>
                <span :class="twoFactorBadgeClassName">
                  <Icon
                    icon="carbon:checkmark-filled"
                    width="14"
                    height="14"
                  />
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
              <div
                v-for="device in securityInfo.loginDevices"
                :key="device.device"
                class="relative overflow-hidden rounded-lg select-none"
                :class="{ 'cursor-grabbing': draggingDeviceId === device.device, 'cursor-grab': !draggingDeviceId }"
                @mousedown="(e: MouseEvent) => handleSwipeStart(e, device.device)"
              >
                <div
                  class="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 transition-transform duration-200"
                  :class="{ 'translate-x-[-80px]': swipedDeviceId === device.device }"
                  :style="{ transform: swipedDeviceId === device.device ? `translateX(-${swipeCurrentX.value}px)` : undefined }"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                      <Icon
                        :icon="device.icon"
                        width="20"
                        height="20"
                      />
                    </div>
                    <div>
                      <p class="font-medium text-gray-800 dark:text-gray-200">
                        {{ device.device }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ device.location }}
                      </p>
                    </div>
                  </div>
                  <span class="text-xs text-gray-400 shrink-0">{{ device.time }}</span>
                </div>
                <!-- 右滑显示的删除按钮 -->
                <div
                  v-if="swipedDeviceId === device.device"
                  class="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-lg cursor-pointer transition-opacity duration-150"
                  @click.stop="handleDeleteDevice(device)"
                >
                  <div class="flex flex-col items-center gap-0.5 text-white">
                    <Icon
                      icon="ant-design:delete-outlined"
                      width="18"
                      height="18"
                    />
                    <span class="text-xs">删除</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane
          key="activity"
          tab="活动日志"
        >
          <a-timeline>
            <a-timeline-item
              v-for="log in activityLogs"
              :key="log.time"
            >
              <template #dot>
                <div class="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30" />
              </template>
              <div class="ml-1">
                <p :class="getActivityColorClass(log.color)">
                  {{ log.action }}
                </p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ log.time }}
                </p>
              </div>
            </a-timeline-item>
          </a-timeline>
        </a-tab-pane>

        <a-tab-pane
          key="team"
          tab="团队信息"
        >
          <div class="space-y-4">
            <div :class="teamInfoItemClassName">
              <span :class="teamInfoLabelClassName">角色</span>
              <span :class="teamInfoValueClassName">{{ displayRole }}</span>
            </div>
            <a-divider />
            <div :class="teamInfoItemClassName">
              <span :class="teamInfoLabelClassName">权限</span>
              <div class="flex-1">
                <a-tag
                  v-for="perm in userStore.permissions"
                  :key="perm"
                  :class="permissionTagClassName"
                  :color="perm === '*' ? 'purple' : 'blue'"
                >
                  {{ perm }}
                </a-tag>
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
