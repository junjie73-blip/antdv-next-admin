<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  Card,
  Descriptions,
  DescriptionsItem,
  Divider,
  PageHeader,
  TabPane,
  Tabs,
  Tag,
  Timeline,
  TimelineItem,
} from '@antdv/common-ui';
import { confirm, message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useUserStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';

const userStore = useUserStore();
const router = useRouter();

const activeTab = ref('basic');

// 滑动删除相关
const swipedDeviceId = ref<null | string>(null);
const swipeStartX = ref(0);
const swipeCurrentX = ref(0);

interface LoginDevice {
  device: string;
  location: string;
  time: string;
  icon: string;
}

// 左栏档案 + 右栏分节内容：个人中心是"看一个人"的页面，堆成一列会失去这种主辅关系
const containerClassName = cn('grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]');
const headerClassName = cn('lg:col-span-2');
const profileClassName = cn('min-w-0');
const contentClassName = cn('min-w-0');

const displayRole = computed(() => {
  const roles = userStore.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.join('、');
  }
  return '未分配';
});

const _displayPermissions = computed(() => {
  const perms = userStore.permissions;
  if (Array.isArray(perms) && perms.length > 0) {
    return perms.join('、');
  }
  return '无';
});

const securityInfo = {
  passwordStrength: 85,
  twoFactorEnabled: true,
  loginDevices: [
    {
      device: 'MacBook Pro - Chrome',
      location: 'Shanghai, CN',
      time: '当前会话',
      icon: 'carbon:laptop',
    },
    {
      device: 'iPhone 15 Pro - Safari',
      location: 'Shanghai, CN',
      time: '2小时前',
      icon: 'carbon:phone',
    },
    {
      device: 'Windows PC - Edge',
      location: 'Beijing, CN',
      time: '3天前',
      icon: 'carbon:virtual-desktop',
    },
  ],
};

const activityLogs = [
  {
    action: '登录成功',
    time: '2026-05-21 09:30:00',
    color: 'text-success',
  },
  {
    action: '更新个人资料',
    time: '2026-05-20 14:22:00',
    color: 'text-primary',
  },
  {
    action: '修改密码',
    time: '2026-05-18 11:05:00',
    color: 'text-warning',
  },
  {
    action: '登录成功',
    time: '2026-05-18 09:15:00',
    color: 'text-success',
  },
  {
    action: '导出报告数据',
    time: '2026-05-17 16:45:00',
    color: 'text-foreground',
  },
];

// 档案卡用主色的极淡一档做提示，颜色仍从 --primary 换算，换预设会跟过去
const userCardClassName = cn('bg-card border-border rounded-xl border');

const avatarWrapperClassName = cn(
  'flex size-20 items-center justify-center overflow-hidden rounded-full',
  'bg-primary/10 text-primary',
);

const avatarImgClassName = cn('size-full object-cover');

const securityHeaderClassName = cn('flex items-center justify-between');

const passwordStrengthBarClassName = cn(
  'bg-muted h-2 overflow-hidden rounded-full',
);

const passwordStrengthFillClassName = cn(
  'bg-success h-full rounded-full transition-all duration-500',
);

const twoFactorBadgeClassName = cn(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  'bg-success/15 text-success',
);

const cardClassName = cn('border-border rounded-xl border');

const teamInfoItemClassName = cn('flex items-center gap-3');

const teamInfoLabelClassName = cn('text-muted-foreground min-w-12 text-sm');

const teamInfoValueClassName = cn('text-foreground text-sm');

const permissionTagClassName = cn('mr-1 mb-1');

const hasAvatar = computed(() => {
  const info = userStore.userInfo;
  return (
    info !== null &&
    typeof info === 'object' &&
    typeof (info as any).avatar === 'string' &&
    (info as any).avatar.length > 0
  );
});

function getActivityColorClass(color: string) {
  return cn('font-medium', color);
}

// 滑动删除事件（仅电脑端鼠标，全局监听防止丢失）
const draggingDeviceId = ref<null | string>(null);

function handleSwipeStart(e: MouseEvent, deviceId: string) {
  e.preventDefault();
  swipeStartX.value = e.clientX;
  draggingDeviceId.value = deviceId;
  swipedDeviceId.value = null;
  swipeCurrentX.value = 0;
  // 全局监听：防止鼠标移出元素后丢失事件
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
}

function handleGlobalMouseMove(e: MouseEvent) {
  if (draggingDeviceId.value === null) return;
  const delta = e.clientX - swipeStartX.value;
  if (delta > 20) {
    swipedDeviceId.value = draggingDeviceId.value!;
    swipeCurrentX.value = Math.min(delta, 120);
  } else {
    swipedDeviceId.value = null;
    swipeCurrentX.value = 0;
  }
}

function handleGlobalMouseUp() {
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
  draggingDeviceId.value = null;
  swipeCurrentX.value = 0;
}

function handleDeleteDevice(device: LoginDevice) {
  const isCurrent = device.time === '当前会话';

  if (isCurrent) {
    confirm({
      title: '注销当前设备',
      content: `您正在删除当前登录设备「${device.device}」，删除后将退出登录，确定继续吗？`,
      okText: '确定退出',
      danger: true,
      cancelText: '取消',
      onOk: () => {
        const idx = securityInfo.loginDevices.findIndex(
          (d) => d.device === device.device,
        );
        if (idx !== -1) securityInfo.loginDevices.splice(idx, 1);
        swipedDeviceId.value = null;
        userStore.logout();
        router.push('/login');
      },
      onCancel: () => {
        swipedDeviceId.value = null;
      },
    });
    return;
  }

  confirm({
    title: '移除登录设备',
    content: `确定要移除设备「${device.device}」吗？移除后该设备将需要重新登录。`,
    okText: '确定移除',
    danger: true,
    cancelText: '取消',
    onOk: () => {
      const idx = securityInfo.loginDevices.findIndex(
        (d) => d.device === device.device,
      );
      if (idx !== -1) {
        securityInfo.loginDevices.splice(idx, 1);
        message.success(`已移除设备：${device.device}`);
      }
      swipedDeviceId.value = null;
    },
    onCancel: () => {
      swipedDeviceId.value = null;
    },
  });
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      :class="headerClassName"
      title="个人中心"
      description="账号身份、安全状态与最近活动都在这里；改资料请去账户设置"
      icon="carbon:user-profile"
    >
      <template #extra>
        <Button @click="router.push('/account/settings')">
          <Icon icon="carbon:settings" />
          账户设置
        </Button>
      </template>
    </PageHeader>

    <div :class="profileClassName">
      <Card variant="borderless" title="账号档案" :class="userCardClassName">
        <div class="flex flex-col items-center gap-4 text-center">
          <div :class="avatarWrapperClassName">
            <template v-if="hasAvatar">
              <img
                :src="userStore.avatar"
                :alt="userStore.nickname"
                :class="avatarImgClassName"
              />
            </template>
            <template v-else>
              <Icon icon="carbon:user-avatar-filled" width="42" height="42" />
            </template>
          </div>
          <div class="min-w-0">
            <h2 class="text-foreground truncate text-lg font-semibold">
              {{ userStore.nickname || userStore.username }}
            </h2>
            <Tag class="mt-2" color="blue">{{ displayRole }}</Tag>
          </div>
          <!-- 联系方式竖排：横向三列在窄栏里必然挤断，邮箱还会长到溢出 -->
          <ul class="text-muted-foreground w-full space-y-2 text-left text-sm">
            <li class="flex items-center gap-2">
              <Icon icon="carbon:building" width="16" height="16" />
              <span class="truncate">技术研发部</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon icon="carbon:email" width="16" height="16" />
              <span class="truncate">{{ userStore.email }}</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon icon="carbon:phone" width="16" height="16" />
              <span class="truncate">{{ userStore.phone }}</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>

    <div :class="contentClassName">
      <Card variant="borderless" :class="cardClassName">
        <Tabs v-model:active-key="activeTab">
          <TabPane value="basic" tab="基本信息">
            <Descriptions :column="2" bordered size="middle">
              <DescriptionsItem label="用户名">
                {{ userStore.username }}
              </DescriptionsItem>
              <DescriptionsItem label="昵称">
                {{ userStore.nickname }}
              </DescriptionsItem>
              <DescriptionsItem label="邮箱">
                {{ userStore.email }}
              </DescriptionsItem>
              <DescriptionsItem label="手机号">
                {{ userStore.phone }}
              </DescriptionsItem>
              <DescriptionsItem label="性别" :span="2">
                未设置
              </DescriptionsItem>
              <DescriptionsItem label="生日" :span="2">
                未设置
              </DescriptionsItem>
              <DescriptionsItem label="地址" :span="2">
                未设置
              </DescriptionsItem>
              <DescriptionsItem label="个人简介" :span="2">
                未设置
              </DescriptionsItem>
            </Descriptions>
          </TabPane>

          <TabPane value="security" tab="安全设置">
            <div class="space-y-6">
              <div class="space-y-2">
                <div :class="securityHeaderClassName">
                  <span class="font-medium text-foreground">密码强度</span>
                  <span class="text-success text-sm">{{ securityInfo.passwordStrength }}%</span>
                </div>
                <div :class="passwordStrengthBarClassName">
                  <div
                    :class="passwordStrengthFillClassName"
                    :style="{ width: `${securityInfo.passwordStrength}%` }"
                  ></div>
                </div>
                <!-- 原来 inject('switchAccountTab') 没有任何组件 provide，这颗按钮点了没反应 -->
                <Button
                  size="sm"
                  variant="outline"
                  @click="router.push('/account/settings')"
                >
                  前往修改
                </Button>
              </div>

              <Divider />

              <div class="space-y-2">
                <div :class="securityHeaderClassName">
                  <span class="font-medium text-foreground">双因素认证</span>
                  <span :class="twoFactorBadgeClassName">
                    <Icon
                      icon="carbon:checkmark-filled"
                      width="14"
                      height="14"
                    />
                    已启用
                  </span>
                </div>
                <p class="text-muted-foreground text-sm">
                  您的账户已受双因素认证保护。
                </p>
              </div>

              <Divider />

              <div class="space-y-3">
                <span class="font-medium text-foreground">登录设备</span>
                <div
                  v-for="device in securityInfo.loginDevices"
                  :key="device.device"
                  class="relative overflow-hidden rounded-lg select-none"
                  :class="{
                    'cursor-grabbing': draggingDeviceId === device.device,
                    'cursor-grab': !draggingDeviceId,
                  }"
                  @mousedown="
                    (e: MouseEvent) => handleSwipeStart(e, device.device)
                  "
                >
                  <div
                    class="flex items-center justify-between border-border rounded-lg border p-3 transition-transform duration-200"
                    :class="{
                      'translate-x-[-80px]': swipedDeviceId === device.device,
                    }"
                    :style="{
                      transform:
                        draggingDeviceId === device.device
                          ? `translateX(-${swipeCurrentX}px)`
                          : undefined,
                    }"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="flex h-9 w-9 items-center justify-center bg-muted rounded-lg"
                      >
                        <Icon :icon="device.icon" width="20" height="20" />
                      </div>
                      <div>
                        <p class="text-foreground font-medium">
                          {{ device.device }}
                        </p>
                        <p class="text-muted-foreground text-xs">
                          {{ device.location }}
                        </p>
                      </div>
                    </div>
                    <span class="text-muted-foreground shrink-0 text-xs">{{
                      device.time
                    }}</span>
                  </div>
                  <!-- 右滑显示的删除按钮 -->
                  <div
                    v-if="swipedDeviceId === device.device"
                    class="absolute top-0 right-0 bottom-0 flex w-20 cursor-pointer items-center justify-center bg-destructive rounded-r-lg transition-opacity duration-150"
                    @click.stop="handleDeleteDevice(device)"
                  >
                    <div
                      class="text-destructive-foreground flex flex-col items-center gap-0.5"
                    >
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
          </TabPane>

          <TabPane value="activity" tab="活动日志">
            <Timeline>
              <TimelineItem v-for="log in activityLogs" :key="log.time">
                <template #dot>
                  <div
                    class="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15"
                  ></div>
                </template>
                <div class="ml-1">
                  <p :class="getActivityColorClass(log.color)">
                    {{ log.action }}
                  </p>
                  <p class="text-muted-foreground mt-0.5 text-xs">
                    {{ log.time }}
                  </p>
                </div>
              </TimelineItem>
            </Timeline>
          </TabPane>

          <TabPane value="team" tab="团队信息">
            <div class="space-y-4">
              <div :class="teamInfoItemClassName">
                <span :class="teamInfoLabelClassName">角色</span>
                <span :class="teamInfoValueClassName">{{ displayRole }}</span>
              </div>
              <Divider />
              <div :class="teamInfoItemClassName">
                <span :class="teamInfoLabelClassName">权限</span>
                <div class="flex-1">
                  <Tag
                    v-for="perm in userStore.permissions"
                    :key="perm"
                    :class="permissionTagClassName"
                    :color="perm === '*' ? 'purple' : 'blue'"
                  >
                    {{ perm }}
                  </Tag>
                </div>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
