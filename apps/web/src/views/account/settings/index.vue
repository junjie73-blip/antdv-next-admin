<script setup lang="ts">
import { reactive, ref } from 'vue';

import { Card, Divider } from '@antdv/common-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button, Input, Label, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { useAppStore } from '~/stores/modules/app';
import { useUserStore } from '~/stores/modules/user';

const appStore = useAppStore();
const userStore = useUserStore();

const containerClassName = cn('space-y-6');
const cardClassName = cn(
  'rounded-xl border border-gray-100 dark:border-gray-800',
);
const sectionTitleClassName = cn(
  'mb-4 text-lg font-bold text-gray-800 dark:text-white',
);

const dangerCardClassName = cn(
  'rounded-xl border-2 border-red-200 dark:border-red-900',
  'bg-red-50/50 dark:bg-red-950/20',
);

const dangerTitleClassName = cn(
  'mb-2 text-lg font-bold text-red-600 dark:text-red-400',
);
const dangerDescClassName = cn('mb-4 text-sm text-red-500 dark:text-red-400');

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
  <div :class="containerClassName">
    <Card variant="borderless" :class="cardClassName" title="个人资料">
      <div :class="sectionTitleClassName">基本信息</div>
      <form class="max-w-[560px] space-y-6" @submit.prevent>
        <div class="space-y-2">
          <Label class="text-gray-700 dark:text-gray-300">姓名</Label>
          <Input v-model="profileForm.name" placeholder="请输入姓名" />
        </div>
        <div class="space-y-2">
          <Label class="text-gray-700 dark:text-gray-300">邮箱地址</Label>
          <Input v-model="profileForm.email" placeholder="请输入邮箱地址" />
        </div>
        <div class="space-y-2">
          <Label class="text-gray-700 dark:text-gray-300">手机号码</Label>
          <Input v-model="profileForm.phone" placeholder="请输入手机号码" />
        </div>
        <div>
          <Button
            type="button"
            :disabled="profileLoading"
            @click="handleProfileSave"
          >
            <Icon
              v-if="profileLoading"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            保存修改
          </Button>
        </div>
      </form>
    </Card>

    <Card variant="borderless" :class="cardClassName" title="修改密码">
      <form class="max-w-[560px] space-y-6" @submit.prevent>
        <div class="space-y-2">
          <Label class="text-gray-700 dark:text-gray-300">当前密码</Label>
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
              :aria-label="passwordVisible.oldPassword ? '隐藏密码' : '显示密码'"
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
          <Label class="text-gray-700 dark:text-gray-300">新密码</Label>
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
              :aria-label="passwordVisible.newPassword ? '隐藏密码' : '显示密码'"
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
          <Label class="text-gray-700 dark:text-gray-300">确认新密码</Label>
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
            <Icon
              v-if="passwordLoading"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            更新密码
          </Button>
        </div>
      </form>
    </Card>

    <Card variant="borderless" :class="cardClassName" title="通知设置">
      <div class="max-w-lg space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">邮件通知</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              通过邮件接收系统通知
            </p>
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
            <p class="font-medium text-gray-800 dark:text-gray-200">短信通知</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              通过短信接收系统通知
            </p>
          </div>
          <Switch
            :model-value="notificationSettings.sms"
            @update:model-value="(v: any) => handleNotificationSwitch('sms', v)"
          />
        </div>
        <Divider />
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">推送通知</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
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

    <Card variant="borderless" :class="cardClassName" title="主题设置">
      <div class="flex max-w-lg items-center justify-between">
        <div>
          <p class="font-medium text-gray-800 dark:text-gray-200">主题模式</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            当前：{{ isDarkMode ? '深色' : '浅色' }}
          </p>
        </div>
        <Button type="button" @click="handleThemeToggle">
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
          class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
        >
          <Icon
            icon="carbon:warning-filled"
            width="24"
            height="24"
            class="mt-0.5 flex-shrink-0 text-red-500"
          />
          <div>
            <p class="mb-1 font-medium text-red-700 dark:text-red-400">
              确定要删除账号吗？
            </p>
            <p class="text-sm text-red-600 dark:text-red-400">
              此操作不可撤销，您的所有数据将被永久删除，包括个人资料、设置和历史记录。
            </p>
          </div>
        </div>
      </div>
    </BasicModal>
  </div>
</template>
