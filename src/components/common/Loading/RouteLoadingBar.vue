<script setup lang="ts">
import { computed, ref, watch } from 'vue'
/**
 * RouteLoadingBar - 路由切换顶部进度条（增强版）
 *
 * 新增功能：
 * 1. 百分比文字显示（可选）
 * 2. 取消加载功能（用户可中断导航）
 * 3. 失败状态处理（错误提示 + 重试）
 * 4. 加载时间统计
 * 5. 慢加载警告（超过阈值时变色）
 */
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<Props>(), {
  color: '',
  height: 3,
  duration: 300,
  enabled: true,
  showComplete: true,
  showPercentage: false,
  cancellable: false,
  slowThreshold: 3000,
})

// 定义事件
const emit = defineEmits<{
  cancel: []
  retry: []
  slow: [duration: number]
}>()

defineOptions({
  name: 'RouteLoadingBar',
})

interface Props {
  /** 进度条颜色 */
  color?: string
  /** 进度条高度 */
  height?: number
  /** 动画速度 (ms) */
  duration?: number
  /** 是否启用 */
  enabled?: boolean
  /** 是否在导航完成后短暂显示完成状态 */
  showComplete?: boolean
  /** 是否显示百分比文字 */
  showPercentage?: boolean
  /** 是否允许用户取消加载 */
  cancellable?: boolean
  /** 慢加载阈值 (ms)，超过后进度条变红 */
  slowThreshold?: number
}

const route = useRoute()
const appStore = useAppStore()

// 状态管理
const isLoading = ref(false)
const isComplete = ref(false)
const isError = ref(false)
const progress = ref(0)

// 定时器引用
let progressTimer: ReturnType<typeof setInterval> | null = null
let completeTimer: ReturnType<typeof setTimeout> | null = null
let slowWarningTimer: ReturnType<typeof setTimeout> | null = null

// 加载开始时间（用于计算加载时长）
let loadStartTime = 0

// 计算主题色
const barColor = computed(() => {
  if (props.color)
    return props.color

  // 根据主题模式选择颜色
  const isDark = appStore.themeMode === 'dark'

  // 错误状态：红色
  if (isError.value)
    return '#ef4444'

  // 慢加载警告：橙色
  if (isSlow.value)
    return '#f59e0b'

  // 正常状态：主题色
  return isDark ? '#6366f1' : '#1677ff'
})

// 是否慢加载
const isSlow = computed(() => {
  if (!isLoading.value || !loadStartTime)
    return false

  const elapsed = Date.now() - loadStartTime
  return elapsed > props.slowThreshold
})

// 进度条样式类名
const containerClassName = cn(
  'fixed top-0 left-0 right-0 z-[9999]',
  'transition-opacity duration-300 ease-out',
  // 可取消模式：允许鼠标交互
  props.cancellable ? '' : 'pointer-events-none',
)

const barClassName = cn(
  'absolute left-0 top-0 h-full transition-all',
  isComplete.value ? 'ease-out' : 'linear',
  // 错误状态：脉冲动画
  isError.value && 'animate-pulse',
)

// 样式对象
const containerStyle = computed(() => ({
  opacity: isLoading.value || isComplete.value || isError.value ? 1 : 0,
  height: `${props.height}px`,
}))

const barStyle = computed(() => ({
  width: `${progress.value}%`,
  backgroundColor: barColor.value,
  transitionDuration: isComplete.value || isError.value ? '200ms' : `${props.duration}ms`,
  boxShadow: `0 0 10px ${barColor.value}40, 0 0 5px ${barColor.value}20`,
}))

// 百分比文字位置
const percentageStyle = computed(() => ({
  position: 'absolute' as const,
  right: '10px',
  top: `-${props.height + 8}px`,
  fontSize: '12px',
  fontWeight: 500,
  color: barColor.value,
  opacity: isLoading.value ? 1 : 0,
  transition: 'opacity 200ms ease',
  pointerEvents: 'none' as const,
}))

/**
 * 开始加载动画
 */
function startLoading() {
  if (!props.enabled)
    return

  // 清除之前的定时器
  stopLoading()

  isLoading.value = true
  isComplete.value = false
  isError.value = false
  progress.value = 0
  loadStartTime = Date.now()

  // 快速跳到 10%
  progress.value = 10

  // 模拟渐进式加载
  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      const increment = Math.random() * (100 - progress.value) * 0.15
      progress.value = Math.min(90, progress.value + increment)
    }
  }, props.duration)

  // 慢加载检测
  if (props.slowThreshold > 0) {
    slowWarningTimer = setTimeout(() => {
      if (isLoading.value) {
        const duration = Date.now() - loadStartTime
        emit('slow', duration)
        console.warn(`[RouteLoadingBar] ⚠️ 慢加载警告: 已加载 ${duration}ms`)
      }
    }, props.slowThreshold)
  }
}

/**
 * 完成加载动画
 */
function completeLoading(error = false) {
  if (!props.enabled || !isLoading.value)
    return

  // 停止渐进式动画
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }

  // 停止慢加载检测
  if (slowWarningTimer) {
    clearTimeout(slowWarningTimer)
    slowWarningTimer = null
  }

  if (error) {
    // 错误状态
    isError.value = true
    progress.value = 100

    console.error('[RouteLoadingBar] ❌ 加载失败')

    // 3 秒后自动隐藏或等待重试
    completeTimer = setTimeout(() => {
      reset()
    }, 3000)
  }
  else {
    // 成功完成
    progress.value = 100
    isComplete.value = true

    // 短暂显示完成状态后隐藏
    if (props.showComplete) {
      completeTimer = setTimeout(() => {
        reset()
      }, 400)
    }
    else {
      setTimeout(() => {
        reset()
      }, 200)
    }
  }
}

/**
 * 重置状态
 */
function reset() {
  isLoading.value = false
  isComplete.value = false
  isError.value = false
  progress.value = 0
  loadStartTime = 0
}

/**
 * 用户取消加载
 */
function handleCancel() {
  if (!props.cancellable || !isLoading.value)
    return

  emit('cancel')
  stopLoading()
  reset()

  console.log('[RouteLoadingBar] 👆 用户取消加载')
}

/**
 * 重试加载
 */
function handleRetry() {
  emit('retry')
  reset()
  startLoading()

  console.log('[RouteLoadingBar] 🔄 用户触发重试')
}

/**
 * 停止所有动画
 */
function stopLoading() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (completeTimer) {
    clearTimeout(completeTimer)
    completeTimer = null
  }
  if (slowWarningTimer) {
    clearTimeout(slowWarningTimer)
    slowWarningTimer = null
  }
}

// 监听路由变化
watch(
  () => route.path,
  () => {
    startLoading()

    // 使用 requestAnimationFrame 确保 DOM 更新后再完成
    const minLoadTime = Math.max(300, props.duration * 2)
    setTimeout(() => {
      completeLoading()
    }, minLoadTime)
  },
)

// 路由更新前的钩子
onBeforeRouteUpdate((to, from) => {
  if (to.path !== from.path) {
    startLoading()
  }
})

// 暴露方法供外部调用
defineExpose({
  start: startLoading,
  complete: () => completeLoading(),
  error: () => completeLoading(true),
  stop: stopLoading,
  cancel: handleCancel,
  retry: handleRetry,
})
</script>

<template>
  <div
    v-if="enabled"
    :class="containerClassName"
    :style="containerStyle"
    role="progressbar"
    :aria-valuenow="progress"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="isError ? '加载失败' : isLoading ? `页面加载中 ${Math.round(progress)}%` : '加载完成'"
  >
    <!-- 主进度条 -->
    <div
      :class="barClassName"
      :style="barStyle"
    />

    <!-- 阴影/光晕效果 -->
    <div
      class="absolute inset-0 opacity-30 blur-sm"
      :style="{ backgroundColor: barColor }"
    />

    <!-- 百分比文字 -->
    <Transition name="percentage-fade">
      <span
        v-if="showPercentage && isLoading && !isComplete"
        :style="percentageStyle"
      >
        {{ Math.round(progress) }}%
      </span>
    </Transition>

    <!-- 错误/取消按钮区域 -->
    <Transition name="action-fade">
      <div
        v-if="(cancellable && isLoading) || isError"
        class="absolute right-2 top-full mt-2 flex items-center gap-2"
      >
        <!-- 取消按钮 -->
        <button
          v-if="cancellable && isLoading && !isError"
          type="button"
          title="取消加载"
          class="flex items-center gap-1 px-2 py-1 text-xs rounded bg-white/90 dark:bg-gray-800/90 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="handleCancel"
        >
          <svg
            class="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          取消
        </button>

        <!-- 错误提示和重试按钮 -->
        <template v-if="isError">
          <span class="text-xs text-red-600 dark:text-red-400">加载失败</span>
          <button
            type="button"
            title="重试"
            class="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            @click="handleRetry"
          >
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            重试
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 百分比淡入淡出 */
.percentage-fade-enter-active,
.percentage-fade-leave-active {
  transition: opacity 200ms ease;
}
.percentage-fade-enter-from,
.percentage-fade-leave-to {
  opacity: 0;
}

/* 操作按钮淡入淡出 */
.action-fade-enter-active,
.action-fade-leave-active {
  transition: all 200ms ease;
}
.action-fade-enter-from,
.action-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
