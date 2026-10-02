<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'

import { cn } from '~/utils/cn'

import AbnormalLoginPanel from './components/AbnormalLoginPanel.vue'
import CancelAccountPanel from './components/CancelAccountPanel.vue'
import LoginLogPanel from './components/LoginLogPanel.vue'
import MFAPanel from './components/MFAPanel.vue'
import NoticePreferencePanel from './components/NoticePreferencePanel.vue'
import OnlineDevicesPanel from './components/OnlineDevicesPanel.vue'
import PasswordPanel from './components/PasswordPanel.vue'
import ProfileInfoPanel from './components/ProfileInfoPanel.vue'
import TenantSwitchPanel from './components/TenantSwitchPanel.vue'
import UserProfileCard from './components/UserProfileCard.vue'
defineOptions({ name: 'AccountSettings' })

const refreshUser = inject<() => Promise<void>>('refreshUser', async () => {})

const containerClassName = cn('space-y-4 overflow-hidden')
const activeTab = ref<'profile' | 'security' | 'tenant'>('profile')

// Tab 首次进入才挂载（懒加载）
const mountedTabs = ref<Set<string>>(new Set(['profile']))
watch(activeTab, (tab) => {
  mountedTabs.value.add(tab)
  mountedTabs.value = new Set(mountedTabs.value)
})

onMounted(() => {
  mountedTabs.value.add('profile')
})
</script>

<template>
  <div :class="containerClassName">
    <UserProfileCard />

    <a-card :bordered="false" class="shadow-sm">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="profile" tab="基本信息">
          <div class="pt-2">
            <ProfileInfoPanel v-if="mountedTabs.has('profile')" :refresh-user="refreshUser" />
          </div>
        </a-tab-pane>

        <a-tab-pane key="security" tab="账号安全">
          <div class="space-y-6 pt-2">
            <PasswordPanel v-if="mountedTabs.has('security')" />
            <MFAPanel v-if="mountedTabs.has('security')" />
            <OnlineDevicesPanel v-if="mountedTabs.has('security')" />
            <LoginLogPanel v-if="mountedTabs.has('security')" />
            <CancelAccountPanel v-if="mountedTabs.has('security')" />
            <AbnormalLoginPanel v-if="mountedTabs.has('security')" />
          </div>
        </a-tab-pane>
        <a-tab-pane key="notice" tab="通知设置">
          <div class="pt-2">
            <NoticePreferencePanel v-if="mountedTabs.has('notice')" />
          </div>
        </a-tab-pane>
        <a-tab-pane key="tenant" tab="租户切换">
          <div class="pt-2">
            <TenantSwitchPanel v-if="mountedTabs.has('tenant')" />
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
