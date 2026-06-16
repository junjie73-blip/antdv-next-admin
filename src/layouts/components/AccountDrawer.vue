<script setup lang="ts">
import { provide, ref } from 'vue'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import AccountCenter from '@/views/account/center/index.vue'
import AccountSettings from '@/views/account/settings/index.vue'

defineOptions({ name: 'AccountDrawer' })

const [registerDrawer, drawerMethods] = useDrawer()
const activeTab = ref('center')

function switchTab(tab: 'center' | 'settings') {
  activeTab.value = tab
}

provide('switchAccountTab', switchTab)

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
    title="个人账户"
    :size="720"
    :show-footer="false"
    :mask-closable="true"
    :destroy-on-hidden="false"
    @register="registerDrawer"
  >
    <a-tabs
      v-model:active-key="activeTab"
      class="h-full"
      type="card"
    >
      <a-tab-pane
        key="center"
        tab="个人中心"
      >
        <AccountCenter />
      </a-tab-pane>
      <a-tab-pane
        key="settings"
        tab="账户设置"
      >
        <AccountSettings />
      </a-tab-pane>
    </a-tabs>
  </BasicDrawer>
</template>
