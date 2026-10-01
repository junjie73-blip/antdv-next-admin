<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '~/stores/modules/user'
import { cn } from '~/utils/cn'

const router = useRouter()
const userStore = useUserStore()

const containerClassName = computed(() =>
  cn(
    'min-h-screen flex flex-col items-center justify-center',
    'bg-gradient-to-br from-gray-100 to-gray-200',
    'dark:from-gray-800 dark:to-gray-900',
  ),
)

function handleBack() {
  if (userStore.isLoggedIn) {
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
}
</script>

<template>
  <div :class="containerClassName">
    <div class="text-center">
      <h1 class="mb-4 text-9xl font-bold text-gray-300 dark:text-gray-600">503</h1>
      <h2 class="mb-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">服务不可用</h2>
      <p class="mb-8 text-gray-500 dark:text-gray-400">抱歉，服务暂时不可用，请稍后再试</p>
      <a-button type="primary" size="large" @click="handleBack"> 返回首页 </a-button>
    </div>
  </div>
</template>
