<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { cn } from '@/utils/cn'

interface Props {
  name: string
  url?: string
  className?: string
  baseroute?: string
  keepAlive?: boolean
  disableMemoryRouter?: boolean
  disablePatchRequest?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disableMemoryRouter: true,
  disablePatchRequest: false,
})

const emit = defineEmits<{
  (e: 'beforeload'): void
  (e: 'mounted'): void
  (e: 'unmount'): void
  (e: 'error', error: Error): void
}>()

// 状态
const loading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const retryCount = ref(0)

const containerClassName = computed(() =>
  cn(
    'micro-app-container relative',
    'w-full h-full',
    props.className,
  ),
)

const overlayClassName = cn(
  'absolute inset-0 z-10 flex flex-col items-center justify-center',
  'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg',
)

function handleBeforeLoad() {
  loading.value = true
  hasError.value = false
  errorMessage.value = ''
  emit('beforeload')
}

function handleMounted() {
  loading.value = false
  hasError.value = false
  emit('mounted')
}

function handleUnmount() {
  emit('unmount')
}

function handleError(event: Event) {
  const target = event.target as HTMLElement
  // micro-app 的 data 属性可能包含错误信息
  const detail = (event as CustomEvent).detail
  loading.value = false
  hasError.value = true
  errorMessage.value = detail?.message || `子应用 ${props.name} 加载失败`
  emit('error', new Error(errorMessage.value))
}

function handleRetry() {
  hasError.value = false
  loading.value = true
  retryCount.value++
}

onMounted(() => {
  // 监听 micro-app 生命周期事件
  window.addEventListener(`beforeload-${props.name}`, handleBeforeLoad)
  window.addEventListener(`mounted-${props.name}`, handleMounted)
  window.addEventListener(`unmount-${props.name}`, handleUnmount)
  window.addEventListener(`error-${props.name}`, handleError)

  // 如果没有 URL，直接标记为加载完成（占位模式）
  if (!props.url) {
    setTimeout(() => {
      loading.value = false
    }, 800)
  }
})

onUnmounted(() => {
  window.removeEventListener(`beforeload-${props.name}`, handleBeforeLoad)
  window.removeEventListener(`mounted-${props.name}`, handleMounted)
  window.removeEventListener(`unmount-${props.name}`, handleUnmount)
  window.removeEventListener(`error-${props.name}`, handleError)
})
</script>

<template>
  <div :class="containerClassName">
    <!-- 加载状态 -->
    <div
      v-if="loading"
      :class="overlayClassName"
    >
      <a-spin size="large" />
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
        正在加载子应用...
      </p>
      <p
        v-if="retryCount > 0"
        class="mt-1 text-xs text-gray-400 dark:text-gray-500"
      >
        第 {{ retryCount }} 次重试
      </p>
    </div>

    <!-- 错误状态 -->
    <div
      v-if="hasError && !loading"
      :class="overlayClassName"
    >
      <div class="text-center max-w-sm px-4">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <span class="i-carbon-error text-red-500 text-3xl" />
        </div>
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-2">
          子应用加载失败
        </h4>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {{ errorMessage }}
        </p>
        <p
          v-if="url"
          class="text-xs text-gray-400 dark:text-gray-500 mb-5 font-mono break-all"
        >
          {{ url }}
        </p>

        <div class="flex justify-center gap-3">
          <a-button
            type="primary"
            @click="handleRetry"
          >
            重试加载
          </a-button>
          <a-button @click="hasError = false">
            关闭提示
          </a-button>
        </div>
      </div>
    </div>

    <!-- 无 URL 占位状态 -->
    <div
      v-if="!url && !loading"
      class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500"
    >
      <span class="i-carbon-application text-6xl mb-4 opacity-30" />
      <p class="text-sm">
        未配置应用地址
      </p>
      <p class="text-xs mt-1 opacity-60">
        请在微前端管理中设置访问 URL
      </p>
    </div>

    <!-- 微应用容器 -->
    <micro-app
      v-show="!hasError && url"
      :name="props.name"
      :url="props.url"
      :baseroute="props.baseroute"
      :keep-alive="props.keepAlive"
      :disable-memory-router="props.disableMemoryRouter"
      :disable-patch-request="props.disablePatchRequest"
    />
  </div>
</template>

<style scoped>
.micro-app-container {
  position: relative;
  min-height: 200px;
}

:deep(micro-app) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
