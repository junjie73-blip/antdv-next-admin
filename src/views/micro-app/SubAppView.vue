<script setup lang="ts">
import type { MicroAppConfig } from '#/menu'

import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
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

const microAppConfig = computed<MicroAppConfig | undefined>(() => {
  const meta = route.meta as any
  return meta?.microApp as MicroAppConfig | undefined
})

// 判断是否为外部站点（使用 iframe 而非 micro-app）
const isExternalUrl = computed(() => {
  const url = microAppConfig.value?.url
  return !!url && (url.startsWith('https://') || url.startsWith('http://'))
})

// micro-app 库是否可用
const isMicroAppReady = computed(() => !!(window as any).microApp)

// 外部站点用 iframe，内部微前端用 micro-app 组件
const useIframe = computed(() => isExternalUrl.value || !isMicroAppReady.value)

// iframe 的稳定 key——只在 URL 变化时才重建 iframe
const iframeKey = computed(() => microAppConfig.value?.url ?? 'empty')

// 调试信息（帮助定位问题）
const debugInfo = computed(() => ({
  currentPath: route.path,
  routeName: route.name,
  hasMicroAppConfig: !!microAppConfig.value,
  microAppConfig: microAppConfig.value,
  isExternalUrl: isExternalUrl.value,
  isMicroAppReady: isMicroAppReady.value,
  useIframe: useIframe.value,
  metaKeys: route.meta ? Object.keys(route.meta) : [],
  allMeta: route.meta,
}))

// 开发环境打印调试信息
watch(debugInfo, (info) => {
  console.log('[SubAppView] Debug info:', JSON.stringify(info, null, 2))
}, { immediate: true })

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
    'bg-white dark:bg-gray-800',
    'z-20',
  ),
)

const token = computed(() => userStore.token)
const userInfo = computed(() => userStore.userInfo)

function sendDataToChild() {
  if (!microAppRef.value || !microAppConfig.value || useIframe.value)
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
  console.log('[SubAppView] micro-app mounted event received')
  isLoading.value = false
  sendDataToChild()
}

function handleError(err: Event) {
  console.error('[SubAppView] micro-app error:', err)
  isLoading.value = false
  hasError.value = true
}

function handleUnmount() {
  isLoading.value = true
  hasError.value = false
}

function handleIframeLoad() {
  console.log('[SubAppView] iframe loaded successfully')
  isLoading.value = false
  hasError.value = false
}

function handleIframeError() {
  console.error('[SubAppView] iframe load error')
  isLoading.value = false
  hasError.value = true
}

function retry() {
  console.log('[SubAppView] retry clicked')
  hasError.value = false
  isLoading.value = true
  if (useIframe.value && microAppRef.value) {
    const iframeEl = microAppRef.value.querySelector('iframe') as HTMLIFrameElement
    if (iframeEl) {
      // 强制刷新 iframe
      const src = iframeEl.src
      iframeEl.src = 'about:blank'
      setTimeout(() => {
        iframeEl.src = src
      }, 50)
      return
    }
  }
  if (!useIframe.value && microAppRef.value) {
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
  console.log('[SubAppView] mounted, useIframe:', useIframe.value, 'microAppConfig:', microAppConfig.value)
  if (!useIframe.value) {
    microAppRef.value?.addEventListener('mounted', handleMounted)
    microAppRef.value?.addEventListener('error', handleError)
    microAppRef.value?.addEventListener('unmount', handleUnmount)
  }
})

// keep-alive 激活时检测并恢复 iframe 状态
onActivated(() => {
  if (useIframe.value) {
    // iframe 模式：检测 contentWindow 是否被清空，必要时重新加载
    const iframeEl = microAppRef.value?.querySelector('iframe') as HTMLIFrameElement | null
    if (iframeEl && (!iframeEl.contentWindow || !iframeEl.contentDocument || iframeEl.contentDocument.readyState === 'uninitialized')) {
      console.log('[SubAppView] iframe contentWindow lost, reloading...')
      hasError.value = false
      isLoading.value = true
      // 重新设置 src 触发重新加载
      const currentSrc = iframeEl.src
      iframeEl.src = 'about:blank'
      setTimeout(() => {
        iframeEl.src = currentSrc
      }, 50)
    }
    else if (!hasError.value) {
      isLoading.value = false
    }
  }
})

onUnmounted(() => {
  if (!useIframe.value) {
    microAppRef.value?.removeEventListener('mounted', handleMounted)
    microAppRef.value?.removeEventListener('error', handleError)
    microAppRef.value?.removeEventListener('unmount', handleUnmount)
  }
})
</script>

<template>
  <!-- 有配置时：渲染嵌入内容 -->
  <div
    v-if="microAppConfig"
    ref="microAppRef"
    :class="containerClassName"
  >
    <!-- 外部站点：使用 iframe 嵌入 -->
    <iframe
      v-if="useIframe"
      :key="iframeKey"
      :src="microAppConfig.url"
      class="w-full border-0 rounded-lg"
      style="width: 100%; height:100%;"
      frameborder="0"
      allow="clipboard-write; autoplay; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
      @load="handleIframeLoad"
      @error="handleIframeError"
    />

    <!-- 内部微前端：使用 micro-app 组件 -->
    <micro-app
      v-else-if="isMicroAppReady"
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

    <!-- micro-app 库未加载的提示 -->
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
        微前端库未加载，当前以 iframe 模式显示
      </p>
    </div>

    <!-- 加载态 -->
    <div
      v-if="isLoading && (isMicroAppReady || useIframe)"
      :class="loadingClassName"
    >
      <a-spin size="large" />
      <p class="mt-2 text-sm text-gray-500">
        正在加载 {{ microAppConfig.title }}...
      </p>
    </div>

    <!-- 错误态 -->
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
      <p class="text-xs text-gray-400 mb-4 max-w-xs text-center break-all">
        {{ microAppConfig.url }}
      </p>
      <a-button
        type="primary"
        @click="retry"
      >
        重试
      </a-button>
    </div>
  </div>

  <!-- 无配置时：显示详细调试信息 -->
  <div
    v-else
    class="flex flex-col items-center justify-center h-full gap-3 p-6"
    style="min-height: 300px;"
  >
    <svg
      class="w-12 h-12 text-orange-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <p class="text-gray-600 font-medium">
      微前端配置不存在
    </p>
    <!-- 调试信息面板 -->
    <PerfectScrollbar class="mt-2 p-4 bg-orange-50 dark:bg-gray-800 rounded-lg text-left text-xs w-full max-w-lg">
      <p class="font-semibold text-orange-600 dark:text-orange-400 mb-2">
        调试信息：
      </p>
      <pre class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{{ JSON.stringify({
        currentPath: route.path,
        routeName: route.name,
        metaKeys: route.meta ? Object.keys(route.meta) : [],
        hasMicroApp: !!route.meta?.microApp,
        microAppValue: (route.meta as any)?.microApp,
        fullPath: route.fullPath,
      }, null, 2) }}</pre>
    </PerfectScrollbar>
    <p class="text-xs text-gray-400 text-center mt-2">
      请检查路由配置中是否包含 microApp 字段
    </p>
  </div>
</template>

<style scoped>
.micro-app-wrapper {
  position: relative;
}
</style>
