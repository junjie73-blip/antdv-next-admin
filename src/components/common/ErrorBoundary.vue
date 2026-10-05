<script setup lang="ts">
import { isError, isString } from 'es-toolkit'
import { onErrorCaptured, ref, type VNode } from 'vue'

import { cn } from '~/utils/cn'

interface Props {
  fallback?: (error: Error, reset: () => void) => VNode
  resetOnError?: boolean
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

onErrorCaptured((err: unknown, instance, info) => {
  // isError 替代 instanceof
  let errorObj: Error
  if (isError(err)) {
    errorObj = err
    errorObj.message = `[${info}] ${errorObj.message}`
  } else {
    errorObj = new Error(String(err))
    errorObj.name = 'UnknownError'
  }

  error.value = errorObj
  emit('error', errorObj)

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
  if (props.resetOnError) resetError()
}

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

const isDev = import.meta.env.DEV
</script>

<template>
  <div v-if="error" :class="defaultFallbackClassName">
    <component
      :is="() => props.fallback?.(error!, resetError)"
      v-if="props.fallback"
    />

    <template v-else>
      <div class="mb-4 text-6xl">⚠️</div>
      <h3 :class="titleClassName">出错了</h3>
      <p :class="messageClassName">{{ error.message || '发生了未知错误' }}</p>
      <button
        v-if="resetOnError"
        :class="retryButtonClassName"
        @click="handleRetry"
      >
        🔄 重试
      </button>

      <details v-if="isDev && isString(error.stack)" :class="detailsClassName">
        <summary class="mb-1 cursor-pointer font-medium">调用栈详情</summary>
        <PerfectScrollbar class="max-h-32">
          <pre class="break-all whitespace-pre-wrap">{{ error.stack }}</pre>
        </PerfectScrollbar>
      </details>
    </template>
  </div>

  <Suspense v-else>
    <template #default>
      <slot :key="errorId" />
    </template>
    <template #fallback>
      <slot name="loading">
        <div class="flex items-center justify-center p-8">
          <div
            class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
          />
        </div>
      </slot>
    </template>
  </Suspense>
</template>
