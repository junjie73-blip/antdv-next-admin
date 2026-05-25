<script setup lang="ts">
import type { MicroAppConfig } from '#/menu'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'

interface Props {
  className?: string
}

const props = defineProps<Props>()

const route = useRoute()
const userStore = useUserStore()

const microAppRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)

const microAppConfig = computed<MicroAppConfig | undefined>(() => route.meta?.microApp as MicroAppConfig | undefined)

const containerClassName = computed(() =>
  cn(
    'micro-app-wrapper',
    'w-full h-full',
    props.className,
  ),
)

const loadingClassName = computed(() =>
  cn(
    'absolute inset-0 flex items-center justify-center',
    'bg-white/80 dark:bg-gray-900/80',
    'z-10',
  ),
)

const errorClassName = computed(() =>
  cn(
    'absolute inset-0 flex flex-col items-center justify-center',
    'bg-white dark:bg-gray-900',
    'z-20',
  ),
)

const token = computed(() => userStore.token)
const userInfo = computed(() => userStore.userInfo)

const isMicroAppReady = computed(() => {
  return !!(window as any).microApp
})

function sendDataToChild() {
  if (!microAppRef.value || !microAppConfig.value)
    return

  const childWindow = (microAppRef.value as any).getRootElement?.()
  if (childWindow) {
    childWindow.dispatchEvent(new CustomEvent('main-app-data', {
      detail: {
        token: token.value,
        userInfo: userInfo.value,
        route: {
          path: route.path,
          query: route.query,
          params: route.params,
        },
      },
    }))
  }
}

function handleMounted() {
  isLoading.value = false
  sendDataToChild()
}

function handleError() {
  isLoading.value = false
  hasError.value = true
}

function handleUnmount() {
  isLoading.value = true
  hasError.value = false
}

function retry() {
  hasError.value = false
  isLoading.value = true
  if (microAppRef.value) {
    const microAppElement = microAppRef.value.querySelector('micro-app')
    if (microAppElement) {
      ;(microAppElement as any).reload()
    }
  }
}

watch(token, () => {
  sendDataToChild()
})

onMounted(() => {
  microAppRef.value?.addEventListener('mounted', handleMounted)
  microAppRef.value?.addEventListener('error', handleError)
  microAppRef.value?.addEventListener('unmount', handleUnmount)
})

onUnmounted(() => {
  microAppRef.value?.removeEventListener('mounted', handleMounted)
  microAppRef.value?.removeEventListener('error', handleError)
  microAppRef.value?.removeEventListener('unmount', handleUnmount)
})
</script>

<template>
  <div
    v-if="microAppConfig"
    ref="microAppRef"
    :class="containerClassName"
  >
    <micro-app
      v-if="isMicroAppReady"
      :name="microAppConfig.name"
      :url="microAppConfig.url"
      :baseroute="microAppConfig.baseroute"
      :keep-alive="microAppConfig.keepAlive ?? true"
      :disable-memory-router="microAppConfig.disableMemoryRouter ?? true"
      :disable-patch-request="microAppConfig.disablePatchRequest ?? false"
      :inline="microAppConfig.inline ?? false"
      :destroy="microAppConfig.destroy ?? false"
      :data="{
        token,
        userInfo,
        route: {
          path: route.path,
          query: route.query,
          params: route.params,
        },
      }"
    />

    <div
      v-else
      class="flex flex-col items-center justify-center h-full gap-4"
    >
      <svg
        class="w-16 h-16 text-yellow-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500 text-center">
        微前端功能未启用，请在设置中开启微前端支持
      </p>
    </div>

    <div
      v-if="isLoading && isMicroAppReady"
      :class="loadingClassName"
    >
      <a-spin size="large" />
    </div>

    <div
      v-if="hasError"
      :class="errorClassName"
    >
      <svg
        class="w-16 h-16 text-red-500 mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
        />
        <line
          x1="15"
          y1="9"
          x2="9"
          y2="15"
        />
        <line
          x1="9"
          y1="9"
          x2="15"
          y2="15"
        />
      </svg>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        子应用加载失败
      </p>
      <a-button
        type="primary"
        @click="retry"
      >
        重试
      </a-button>
    </div>
  </div>
  <div
    v-else
    class="flex items-center justify-center h-full"
  >
    <p class="text-gray-500">
      微前端配置不存在
    </p>
  </div>
</template>

<style scoped>
.micro-app-wrapper {
  position: relative;
}

.micro-app-wrapper :deep(micro-app) {
  width: 100%;
  height: 100%;
}
</style>
