<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { reactive, ref } from 'vue'
import { BasicModal, useModal } from '@/components/business/Modal'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'

const appStore = useAppStore()
const userStore = useUserStore()

const containerClassName = cn('space-y-6')
const cardClassName = cn('rounded-xl border border-gray-100 dark:border-gray-800')
const sectionTitleClassName = cn('text-lg font-bold text-gray-800 dark:text-white mb-4')

const dangerCardClassName = cn(
  'rounded-xl border-2 border-red-200 dark:border-red-900',
  'bg-red-50/50 dark:bg-red-950/20',
)

const dangerTitleClassName = cn('text-lg font-bold text-red-600 dark:text-red-400 mb-2')
const dangerDescClassName = cn('text-sm text-red-500 dark:text-red-400 mb-4')

const profileForm = reactive({
  name: userStore.nickname || userStore.username || '',
  email: userStore.email || '',
  phone: userStore.phone || '',
})

const profileLoading = ref(false)

function handleProfileSave() {
  profileLoading.value = true
  setTimeout(() => {
    profileLoading.value = false
    message.success('个人信息更新成功')
  }, 800)
}

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordLoading = ref(false)

function handlePasswordSave() {
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    message.warning('请填写完整的密码信息')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error('两次输入的新密码不一致')
    return
  }
  if (passwordForm.newPassword.length < 8) {
    message.error('密码长度不能少于 8 位')
    return
  }
  passwordLoading.value = true
  setTimeout(() => {
    passwordLoading.value = false
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    message.success('密码修改成功')
  }, 800)
}

const notificationSettings = reactive({
  email: true,
  sms: false,
  push: true,
})

function handleNotificationChange() {
  message.success('通知偏好已更新')
}

const [registerDangerModal, dangerModalMethods] = useModal()
const dangerLoading = ref(false)

function handleDeleteAccount() {
  dangerLoading.value = true
  setTimeout(() => {
    dangerLoading.value = false
    dangerModalMethods?.closeModal()
    message.success('账号已删除')
  }, 1500)
}

const isDarkMode = ref(appStore.themeMode === 'dark')

function handleThemeToggle() {
  appStore.toggleTheme()
  isDarkMode.value = appStore.themeMode === 'dark'
  message.success(`已切换至${isDarkMode.value ? '深色' : '浅色'}主题`)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      variant="borderless"
      :class="cardClassName"
      title="个人资料"
    >
      <div :class="sectionTitleClassName">
        基本信息
      </div>
      <a-form
        :model="profileForm"
        layout="vertical"
        style="max-width: 560px"
      >
        <a-form-item label="姓名">
          <a-input
            v-model:value="profileForm.name"
            placeholder="请输入姓名"
          />
        </a-form-item>
        <a-form-item label="邮箱地址">
          <a-input
            v-model:value="profileForm.email"
            placeholder="请输入邮箱地址"
          />
        </a-form-item>
        <a-form-item label="手机号码">
          <a-input
            v-model:value="profileForm.phone"
            placeholder="请输入手机号码"
          />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            :loading="profileLoading"
            @click="handleProfileSave"
          >
            保存修改
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card
      variant="borderless"
      :class="cardClassName"
      title="修改密码"
    >
      <a-form
        :model="passwordForm"
        layout="vertical"
        style="max-width: 560px"
      >
        <a-form-item label="当前密码">
          <a-input-password
            v-model:value="passwordForm.oldPassword"
            placeholder="请输入当前密码"
          />
        </a-form-item>
        <a-form-item label="新密码">
          <a-input-password
            v-model:value="passwordForm.newPassword"
            placeholder="请输入新密码"
          />
        </a-form-item>
        <a-form-item label="确认新密码">
          <a-input-password
            v-model:value="passwordForm.confirmPassword"
            placeholder="请再次输入新密码"
          />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            :loading="passwordLoading"
            @click="handlePasswordSave"
          >
            更新密码
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card
      variant="borderless"
      :class="cardClassName"
      title="通知设置"
    >
      <div class="space-y-4 max-w-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">
              邮件通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              通过邮件接收系统通知
            </p>
          </div>
          <a-switch
            v-model:checked="notificationSettings.email"
            @change="handleNotificationChange"
          />
        </div>
        <a-divider />
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">
              短信通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              通过短信接收系统通知
            </p>
          </div>
          <a-switch
            v-model:checked="notificationSettings.sms"
            @change="handleNotificationChange"
          />
        </div>
        <a-divider />
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">
              推送通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              在浏览器中接收推送通知
            </p>
          </div>
          <a-switch
            v-model:checked="notificationSettings.push"
            @change="handleNotificationChange"
          />
        </div>
      </div>
    </a-card>

    <a-card
      variant="borderless"
      :class="cardClassName"
      title="主题设置"
    >
      <div class="flex items-center justify-between max-w-lg">
        <div>
          <p class="font-medium text-gray-800 dark:text-gray-200">
            主题模式
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            当前：{{ isDarkMode ? '深色' : '浅色' }}
          </p>
        </div>
        <a-button @click="handleThemeToggle">
          <template #icon>
            <Icon
              :icon="isDarkMode ? 'carbon:sun' : 'carbon:moon'"
              width="18"
              height="18"
            />
          </template>
          切换为{{ isDarkMode ? '浅色' : '深色' }}
        </a-button>
      </div>
    </a-card>

    <a-card
      variant="borderless"
      :class="dangerCardClassName"
    >
      <div :class="dangerTitleClassName">
        危险操作
      </div>
      <p :class="dangerDescClassName">
        删除账号后，所有数据将永久丢失且不可恢复，请谨慎操作。
      </p>
      <a-button
        danger
        @click="dangerModalMethods?.openModal()"
      >
        删除账号
      </a-button>
    </a-card>

    <BasicModal
      :register="registerDangerModal"
      title="删除账号"
      ok-text="确认删除"
      ok-type="danger"
      :loading="dangerLoading"
      @ok="handleDeleteAccount"
    >
      <div class="py-4">
        <div class="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <Icon
            icon="carbon:warning-filled"
            width="24"
            height="24"
            class="text-red-500 flex-shrink-0 mt-0.5"
          />
          <div>
            <p class="font-medium text-red-700 dark:text-red-400 mb-1">
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
