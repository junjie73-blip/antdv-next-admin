<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { reactive, ref } from 'vue'
import { BasicModal, useModal } from '@/components/business/Modal'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const appStore = useAppStore()

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
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  phone: '+86 138-0000-0001',
})

const profileLoading = ref(false)

function handleProfileSave() {
  profileLoading.value = true
  setTimeout(() => {
    profileLoading.value = false
    message.success('Profile updated successfully')
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
    message.warning('Please fill in all password fields')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error('New passwords do not match')
    return
  }
  if (passwordForm.newPassword.length < 8) {
    message.error('Password must be at least 8 characters')
    return
  }
  passwordLoading.value = true
  setTimeout(() => {
    passwordLoading.value = false
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    message.success('Password changed successfully')
  }, 800)
}

const notificationSettings = reactive({
  email: true,
  sms: false,
  push: true,
})

function handleNotificationChange() {
  message.success('Notification preferences updated')
}

const [registerDangerModal, dangerModalMethods] = useModal()
const dangerLoading = ref(false)

function handleDeleteAccount() {
  dangerLoading.value = true
  setTimeout(() => {
    dangerLoading.value = false
    dangerModalMethods?.closeModal()
    message.success('Account deleted successfully')
  }, 1500)
}

const isDarkMode = ref(appStore.themeMode === 'dark')

function handleThemeToggle() {
  appStore.toggleTheme()
  isDarkMode.value = appStore.themeMode === 'dark'
  message.success(`Theme switched to ${isDarkMode.value ? 'Dark' : 'Light'} mode`)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card variant="borderless" :class="cardClassName" title="Personal Profile">
      <div :class="sectionTitleClassName">
        Basic Information
      </div>
      <a-form :model="profileForm" layout="vertical" style="max-width: 560px">
        <a-form-item label="Full Name">
          <a-input v-model:value="profileForm.name" placeholder="Enter your name" />
        </a-form-item>
        <a-form-item label="Email Address">
          <a-input v-model:value="profileForm.email" placeholder="Enter your email" />
        </a-form-item>
        <a-form-item label="Phone Number">
          <a-input v-model:value="profileForm.phone" placeholder="Enter your phone number" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :loading="profileLoading" @click="handleProfileSave">
            Save Changes
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card variant="borderless" :class="cardClassName" title="Change Password">
      <a-form :model="passwordForm" layout="vertical" style="max-width: 560px">
        <a-form-item label="Current Password">
          <a-input-password v-model:value="passwordForm.oldPassword" placeholder="Enter current password" />
        </a-form-item>
        <a-form-item label="New Password">
          <a-input-password v-model:value="passwordForm.newPassword" placeholder="Enter new password" />
        </a-form-item>
        <a-form-item label="Confirm New Password">
          <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="Confirm new password" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :loading="passwordLoading" @click="handlePasswordSave">
            Update Password
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card variant="borderless" :class="cardClassName" title="Notification Settings">
      <div class="space-y-4 max-w-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">Email Notifications</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
          </div>
          <a-switch v-model:checked="notificationSettings.email" @change="handleNotificationChange" />
        </div>
        <a-divider />
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">SMS Notifications</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Receive notifications via SMS</p>
          </div>
          <a-switch v-model:checked="notificationSettings.sms" @change="handleNotificationChange" />
        </div>
        <a-divider />
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200">Push Notifications</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Receive push notifications in browser</p>
          </div>
          <a-switch v-model:checked="notificationSettings.push" @change="handleNotificationChange" />
        </div>
      </div>
    </a-card>

    <a-card variant="borderless" :class="cardClassName" title="Theme Settings">
      <div class="flex items-center justify-between max-w-lg">
        <div>
          <p class="font-medium text-gray-800 dark:text-gray-200">Theme Mode</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Current: {{ isDarkMode ? 'Dark' : 'Light' }}
          </p>
        </div>
        <a-button @click="handleThemeToggle">
          <template #icon>
            <Icon :icon="isDarkMode ? 'carbon:sun' : 'carbon:moon'" width="18" height="18" />
          </template>
          Switch to {{ isDarkMode ? 'Light' : 'Dark' }}
        </a-button>
      </div>
    </a-card>

    <a-card variant="borderless" :class="dangerCardClassName">
      <div :class="dangerTitleClassName">
        Danger Zone
      </div>
      <p :class="dangerDescClassName">
        Once you delete your account, there is no going back. Please be certain.
      </p>
      <a-button danger @click="dangerModalMethods?.openModal()">
        Delete Account
      </a-button>
    </a-card>

    <BasicModal
      :register="registerDangerModal"
      title="Delete Account"
      ok-text="Confirm Delete"
      ok-type="danger"
      :loading="dangerLoading"
      @ok="handleDeleteAccount"
    >
      <div class="py-4">
        <div class="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <Icon icon="carbon:warning-filled" width="24" height="24" class="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-red-700 dark:text-red-400 mb-1">Are you sure you want to delete your account?</p>
            <p class="text-sm text-red-600 dark:text-red-400">
              This action cannot be undone. All of your data will be permanently removed including your profile, settings, and activity history.
            </p>
          </div>
        </div>
      </div>
    </BasicModal>
  </div>
</template>