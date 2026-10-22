<script setup lang="ts">
import { reactive, ref } from 'vue';

import { Card, Divider, PageHeader } from '@antdv/common-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button, Input, Label, Spinner, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useAppStore, useUserStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';

const appStore = useAppStore();
const userStore = useUserStore();

// 主栏放要填的表单，辅栏放开关与危险操作：一列拉到底时，"删除账号"会跟在一堆输入框后面
const containerClassName = cn(
  'grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]',
);
const headerClassName = cn('lg:col-span-2');
const mainClassName = cn('min-w-0 space-y-4');
const sideClassName = cn('min-w-0 space-y-4');
const cardClassName = cn('border-border rounded-xl border');
const dangerCardClassName = cn(
  'bg-destructive/5 border-destructive/40 rounded-xl border',
);
const dangerTitleClassName = cn('text-destructive mb-2 text-lg font-bold');
const dangerDescClassName = cn('text-muted-foreground mb-4 text-sm');

const profileForm = reactive({
  name: userStore.nickname || userStore.username || '',
  email: userStore.email || '',
  phone: userStore.phone || '',
});

const profileLoading = ref(false);

function handleProfileSave() {
  profileLoading.value = true;
  setTimeout(() => {
    profileLoading.value = false;
    message.success('个人信息更新成功');
  }, 800);
}

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

/** 三个密码框各自的明文可见状态，替代 antd InputPassword 自带的那只眼睛 */
const passwordVisible = reactive({
  confirmPassword: false,
  newPassword: false,
  oldPassword: false,
});

function togglePassword(name: keyof typeof passwordVisible) {
  passwordVisible[name] = !passwordVisible[name];
}

const passwordLoading = ref(false);

function handlePasswordSave() {
  if (
    !passwordForm.oldPassword ||
    !passwordForm.newPassword ||
    !passwordForm.confirmPassword
  ) {
    message.warning('请填写完整的密码信息');
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error('两次输入的新密码不一致');
    return;
  }
  if (passwordForm.newPassword.length < 8) {
    message.error('密码长度不能少于 8 位');
    return;
  }
  passwordLoading.value = true;
  setTimeout(() => {
    passwordLoading.value = false;
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    message.success('密码修改成功');
  }, 800);
}

const notificationSettings = reactive({
  email: true,
  sms: false,
  push: true,
});

function handleNotificationChange() {
  message.success('通知偏好已更新');
}

/** Switch 没有 antd 的 `@change`，改在 update 回调里写回状态并复用同一条提示 */
function handleNotificationSwitch(
  name: keyof typeof notificationSettings,
  value: any,
) {
  notificationSettings[name] = value === true;
  handleNotificationChange();
}

const [registerDangerModal, dangerModalMethods] = useModal();
const dangerLoading = ref(false);

function handleDeleteAccount() {
  dangerLoading.value = true;
  setTimeout(() => {
    dangerLoading.value = false;
    dangerModalMethods?.closeModal();
    message.success('账号已删除');
  }, 1500);
}

const isDarkMode = ref(appStore.themeMode === 'dark');

function handleThemeToggle() {
  appStore.toggleTheme();
  isDarkMode.value = appStore.themeMode === 'dark';
  message.success(`已切换至${isDarkMode.value ? '深色' : '浅色'}主题`);
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      :class="headerClassName"
      title="账户设置"
      description="个人资料、密码与通知偏好都在这里改；右侧是外观与账号级危险操作"
      icon="carbon:settings-adjust"
    />

    <div :class="mainClassName">
      <Card variant="borderless" :class="cardClassName" title="个人资料">
        <form class="max-w-[560px] space-y-6" @submit.prevent>
          <div class="space-y-2">
            <Label class="text-foreground">姓名</Label>
            <Input v-model="profileForm.name" placeholder="请输入姓名" />
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">邮箱地址</Label>
            <Input v-model="profileForm.email" placeholder="请输入邮箱地址" />
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">手机号码</Label>
            <Input v-model="profileForm.phone" placeholder="请输入手机号码" />
          </div>
          <div>
            <Button
              type="button"
              :disabled="profileLoading"
              @click="handleProfileSave"
            >
              <Spinner v-if="profileLoading" class="size-4" />
              保存修改
            </Button>
          </div>
        </form>
      </Card>

      <Card variant="borderless" :class="cardClassName" title="修改密码">
        <form class="max-w-[560px] space-y-6" @submit.prevent>
          <div class="space-y-2">
            <Label class="text-foreground">当前密码</Label>
            <div class="relative">
              <Input
                v-model="passwordForm.oldPassword"
                :type="passwordVisible.oldPassword ? 'text' : 'password'"
                placeholder="请输入当前密码"
                class="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                :aria-label="
                  passwordVisible.oldPassword ? '隐藏密码' : '显示密码'
                "
                class="absolute top-1/2 right-1 -translate-y-1/2"
                @click="togglePassword('oldPassword')"
              >
                <Icon
                  :icon="
                    passwordVisible.oldPassword
                      ? 'carbon:view-off'
                      : 'carbon:view'
                  "
                  class="size-4"
                />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">新密码</Label>
            <div class="relative">
              <Input
                v-model="passwordForm.newPassword"
                :type="passwordVisible.newPassword ? 'text' : 'password'"
                placeholder="请输入新密码"
                class="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                :aria-label="
                  passwordVisible.newPassword ? '隐藏密码' : '显示密码'
                "
                class="absolute top-1/2 right-1 -translate-y-1/2"
                @click="togglePassword('newPassword')"
              >
                <Icon
                  :icon="
                    passwordVisible.newPassword
                      ? 'carbon:view-off'
                      : 'carbon:view'
                  "
                  class="size-4"
                />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label class="text-foreground">确认新密码</Label>
            <div class="relative">
              <Input
                v-model="passwordForm.confirmPassword"
                :type="passwordVisible.confirmPassword ? 'text' : 'password'"
                placeholder="请再次输入新密码"
                class="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                :aria-label="
                  passwordVisible.confirmPassword ? '隐藏密码' : '显示密码'
                "
                class="absolute top-1/2 right-1 -translate-y-1/2"
                @click="togglePassword('confirmPassword')"
              >
                <Icon
                  :icon="
                    passwordVisible.confirmPassword
                      ? 'carbon:view-off'
                      : 'carbon:view'
                  "
                  class="size-4"
                />
              </Button>
            </div>
          </div>
          <div>
            <Button
              type="button"
              :disabled="passwordLoading"
              @click="handlePasswordSave"
            >
              <Spinner v-if="passwordLoading" class="size-4" />
              更新密码
            </Button>
          </div>
        </form>
      </Card>

      <Card variant="borderless" :class="cardClassName" title="通知设置">
        <div class="max-w-lg space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-foreground">邮件通知</p>
              <p class="text-muted-foreground text-sm">通过邮件接收系统通知</p>
            </div>
            <Switch
              :model-value="notificationSettings.email"
              @update:model-value="
                (v: any) => handleNotificationSwitch('email', v)
              "
            />
          </div>
          <Divider />
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-foreground">短信通知</p>
              <p class="text-muted-foreground text-sm">通过短信接收系统通知</p>
            </div>
            <Switch
              :model-value="notificationSettings.sms"
              @update:model-value="
                (v: any) => handleNotificationSwitch('sms', v)
              "
            />
          </div>
          <Divider />
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-foreground">推送通知</p>
              <p class="text-muted-foreground text-sm">
                在浏览器中接收推送通知
              </p>
            </div>
            <Switch
              :model-value="notificationSettings.push"
              @update:model-value="
                (v: any) => handleNotificationSwitch('push', v)
              "
            />
          </div>
        </div>
      </Card>
    </div>

    <div :class="sideClassName">
      <Card variant="borderless" :class="cardClassName" title="主题设置">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-foreground">主题模式</p>
            <p class="text-muted-foreground text-sm">
              当前：{{ isDarkMode ? '深色' : '浅色' }}
            </p>
          </div>
          <Button type="button" variant="outline" @click="handleThemeToggle">
            <Icon
              :icon="isDarkMode ? 'carbon:sun' : 'carbon:moon'"
              width="18"
              height="18"
            />
            切换为{{ isDarkMode ? '浅色' : '深色' }}
          </Button>
        </div>
      </Card>

      <Card variant="borderless" :class="dangerCardClassName">
        <div :class="dangerTitleClassName">危险操作</div>
        <p :class="dangerDescClassName">
          删除账号后，所有数据将永久丢失且不可恢复，请谨慎操作。
        </p>
        <Button
          type="button"
          variant="destructive"
          @click="dangerModalMethods?.openModal()"
        >
          删除账号
        </Button>
      </Card>
    </div>

    <BasicModal
      :register="registerDangerModal"
      title="删除账号"
      ok-text="确认删除"
      ok-type="danger"
      :loading="dangerLoading"
      @ok="handleDeleteAccount"
    >
      <div class="py-4">
        <div
          class="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4"
        >
          <Icon
            icon="carbon:warning-filled"
            width="24"
            height="24"
            class="text-destructive mt-0.5 shrink-0"
          />
          <div>
            <p class="text-destructive mb-1 font-medium">确定要删除账号吗？</p>
            <p class="text-destructive text-sm">
              此操作不可撤销，您的所有数据将被永久删除，包括个人资料、设置和历史记录。
            </p>
          </div>
        </div>
      </div>
    </BasicModal>
  </div>
</template>
