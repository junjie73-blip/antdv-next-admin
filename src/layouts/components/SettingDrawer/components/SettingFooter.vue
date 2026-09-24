<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { message, Modal } from 'antdv-next'

import { useAppStore } from '~/stores/modules/app'
import { useUserStore } from '~/stores/modules/user'
import { cache } from '~/utils/cache'
import { cn } from '~/utils/cn'
defineOptions({ name: 'SettingFooter' })

const emit = defineEmits<{ close: [] }>()

const appStore = useAppStore()
const userStore = useUserStore()
const { copy } = useClipboard({ source: JSON.stringify(appStore.appSetting, null, 2) })
const btnClass = cn(
  'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg',
  'text-xs font-medium',
  'outline outline-1',
  'transition-all duration-200',
)

/** 复制主题配置 */
function handleCopy() {
  try {
    copy(JSON.stringify(appStore.appSetting, null, 2))
    message.success('主题配置已复制到剪贴板')
  } catch {
    message.error('复制失败，请检查浏览器权限')
  }
}

/** 清除缓存 & 退出登录 */
function handleClearAndLogout() {
  Modal.confirm({
    title: '清除缓存并退出登录',
    content: '将清除本地缓存并退出当前账号，确定继续吗？',
    okType: 'danger',
    okText: '确定退出',
    cancelText: '取消',
    async onOk() {
      try {
        cache.clear()
        localStorage.clear()
        sessionStorage.clear()
        await userStore.logout()
        emit('close')
        message.success('已退出登录')
      } catch {
        message.error('退出失败')
      }
    },
  })
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2">
    <button
      type="button"
      :class="
        cn(
          btnClass,
          'bg-white text-slate-600 outline-slate-200',
          'hover:border-ant-primary/40 hover:text-ant-primary hover:bg-slate-50',
          'dark:bg-slate-800 dark:text-slate-300 dark:outline-slate-700 dark:hover:bg-slate-700',
        )
      "
      @click="handleCopy"
    >
      <Icon icon="carbon:copy" class="text-sm" />
      复制配置
    </button>

    <button
      type="button"
      :class="cn(btnClass, 'bg-rose-500 text-white outline-rose-500', 'hover:bg-rose-600 hover:outline-rose-600')"
      @click="handleClearAndLogout"
    >
      <Icon icon="carbon:logout" class="text-sm" />
      清缓存并退出
    </button>
  </div>
</template>
