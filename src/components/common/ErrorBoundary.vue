<script setup lang="ts">
/**
 * ErrorBoundary - Vue 3 错误边界组件
 *
 * 用于捕获子组件树中的 JavaScript 错误，
 * 并显示友好的错误 UI，防止白屏崩溃。
 *
 * 使用方式：
 * ```vue
 * <ErrorBoundary @fallback="customFallback">
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

import type { VNode } from 'vue'
import { onErrorCaptured, ref } from 'vue'
import { cn } from '@/utils/cn'

interface Props {
  /** 自定义 fallback 渲染函数 */
  fallback?: (error: Error, reset: () => void) => VNode
  /** 是否在捕获错误后重置（允许再次尝试） */
  resetOnError?: boolean
  /** 错误时显示的最大堆栈深度 */
  maxStackDepth?: number
}

const props = withDefaults(defineProps<Props>(), {
  resetOnError: true,
  maxStackDepth: 5,
})

const emit = defineEmits<{
  error: [error: Error]
  reset: []
}>()

const error = ref<Error | null>(null)
const errorId = ref(0)

// 捕获子组件错误
onErrorCaptured((err: unknown, instance, info) => {
  // 阻止错误继续向上传播
  let errorObj: Error

  if (err instanceof Error) {
    errorObj = err
    // 追加组件信息
    errorObj.message = `[${info}] ${errorObj.message}`
  }
  else {
    errorObj = new Error(String(err))
    errorObj.name = 'UnknownError'
  }

  error.value = errorObj
  emit('error', errorObj)

  // 控制台输出详细错误信息（仅开发环境）
  if (import.meta.env.DEV) {
    console.group('🚨 ErrorBoundary 捕获到错误')
    console.error('错误对象:', errorObj)
    console.error('组件实例:', instance)
    console.error('错误来源:', info)
    console.trace('调用栈')
    console.groupEnd()
  }

  return false
})

function resetError() {
  error.value = null
  errorId.value++
  emit('reset')
}

function handleRetry() {
  if (props.resetOnError) {
    resetError()
  }
}

/** 默认的 Fallback UI */
const defaultFallbackClassName = cn(
  'flex flex-col items-center justify-center',
  'min-h-[200px] p-6',
  'bg-red-50 dark:bg-red-900/10',
  'rounded-lg border border-red-200 dark:border-red-800',
)

const titleClassName = cn(
  'text-lg font-semibold text-red-700 dark:text-red-400',
  'mb-2',
)

const messageClassName = cn(
  'text-sm text-red-600 dark:text-red-300',
  'mb-4 text-center max-w-md',
  'break-all',
)

const retryButtonClassName = cn(
  'px-4 py-2',
  'bg-red-600 hover:bg-red-700 text-white rounded-md',
  'transition-colors duration-200',
  'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  'cursor-pointer',
)

const detailsClassName = cn(
  'mt-4 p-3 w-full max-w-lg',
  'bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700',
  'text-xs text-gray-600 dark:text-gray-400',
)

// 开发环境检测
const isDev = import.meta.env.DEV
</script>

<template>
  <!-- 错误状态：显示 fallback -->
  <div
    v-if="error"
    :class="defaultFallbackClassName"
  >
    <!-- 使用自定义 fallback -->
    <component
      :is="() => props.fallback?.(error!, resetError)"
      v-if="props.fallback"
    />

    <!-- 默认 fallback UI -->
    <template v-else>
      <!-- 错误图标 -->
      <div class="mb-4 text-6xl">
        ⚠️
      </div>

      <!-- 错误标题 -->
      <h3 :class="titleClassName">
        出错了
      </h3>

      <!-- 错误消息 -->
      <p :class="messageClassName">
        {{ error.message || '发生了未知错误' }}
      </p>

      <!-- 重试按钮 -->
      <button
        v-if="resetOnError"
        :class="retryButtonClassName"
        @click="handleRetry"
      >
        🔄 重试
      </button>

      <!-- 错误详情（开发环境） -->
      <details
        v-if="isDev && error.stack"
        :class="detailsClassName"
      >
        <summary class="cursor-pointer font-medium mb-1">
          调用栈详情
        </summary>
        <PerfectScrollbar class="max-h-32">
          <pre class="whitespace-pre-wrap break-all">{{ error.stack }}</pre>
        </PerfectScrollbar>
      </details>
    </template>
  </div>

  <!-- 正常状态：渲染子组件 -->
  <Suspense v-else>
    <template #default>
      <slot :key="errorId" />
    </template>

    <!-- 异步组件加载中的 fallback -->
    <template #fallback>
      <slot name="loading">
        <div class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </slot>
    </template>
  </Suspense>
</template>
