<script setup lang="ts">
import { provide, ref } from 'vue'

import { BasicDrawer, useDrawer } from '~/components/business/Drawer'
import { useUserStore } from '~/stores/modules/user'
import AccountSettings from '~/views/account/index.vue'

defineOptions({ name: 'AccountDrawer' })

const [registerDrawer, drawerMethods] = useDrawer()
const activeTab = ref('center')
const userStore = useUserStore()

function switchTab(tab: 'center' | 'settings') {
  activeTab.value = tab
}

// 供子组件调用：刷新当前用户信息
async function refreshUser() {
  await userStore.fetchCurrentUser()
}

provide('switchAccountTab', switchTab)
provide('refreshUser', refreshUser)

function open(tab: 'center' | 'settings' = 'center') {
  activeTab.value = tab
  drawerMethods.openDrawer()
}

function close() {
  drawerMethods.closeDrawer()
}
defineExpose({ open, close })
</script>

<template>
  <BasicDrawer
    title="个人中心"
    :size="720"
    :show-footer="false"
    :mask-closable="true"
    :destroy-on-hidden="false"
    @register="registerDrawer"
  >
    <AccountSettings />
  </BasicDrawer>
</template>
