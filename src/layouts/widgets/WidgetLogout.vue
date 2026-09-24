<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'

import { useUserStore } from '~/stores/modules/user'

import WidgetButton from './components/WidgetButton.vue'

defineOptions({ name: 'WidgetLogout' })

const userStore = useUserStore()

function handleLogout() {
  Modal.confirm({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    okType: 'danger',
    okText: '退出',
    cancelText: '取消',
    async onOk() {
      await userStore.logout()
      message.success('已退出')
    },
  })
}
</script>

<template>
  <WidgetButton @click="handleLogout">
    <Icon icon="carbon:logout" class="text-lg" />
  </WidgetButton>
</template>
