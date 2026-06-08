<script setup lang="ts">
/**
 * PageLoading - 页面切换骨架屏
 *
 * 在路由切换时显示的加载占位组件
 * 提供比进度条更丰富的视觉反馈
 */
import { computed } from 'vue'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  variant: 'default',
  error: false,
})

defineOptions({
  name: 'PageLoading',
})

interface Props {
  /** 是否显示 */
  loading?: boolean
  /** 骨架屏变体：default / simple / detailed */
  variant?: 'default' | 'simple' | 'detailed'
  /** 是否为错误/慢加载状态 */
  error?: boolean
}

const appStore = useAppStore()
const isDark = computed(() => appStore.themeMode === 'dark')

// 主题相关样式
const skeletonBg = computed(() =>
  isDark.value ? 'bg-gray-800/50' : 'bg-gray-100',
)

const shimmerFrom = computed(() =>
  isDark.value ? 'from-transparent via-gray-700/30 to-transparent' : 'from-transparent via-white/60 to-transparent',
)

const containerClassName = cn(
  'absolute inset-0 z-10 flex flex-col animate-fade-in',
  // 错误状态：红色调
  props.error
    ? (isDark.value ? 'bg-red-950/80' : 'bg-red-50/90')
    : (isDark.value ? 'bg-gray-900/80' : 'bg-gray-50/90'),
)
</script>

<template>
  <Transition
    name="page-loading"
    mode="out-in"
    appear
  >
    <div
      v-if="loading"
      :class="containerClassName"
      role="status"
      :aria-label="error ? '页面加载较慢' : '页面加载中'"
    >
      <!-- 错误/慢加载状态：显示警告信息 -->
      <template v-if="error">
        <div class="flex-1 flex items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <!-- 警告图标 -->
            <div class="relative h-16 w-16">
              <div
                :class="cn(
                  'absolute inset-0 rounded-full',
                  isDark ? 'bg-red-900/30' : 'bg-red-100',
                )"
              />
              <svg
                class="absolute inset-0 m-auto h-8 w-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <!-- 提示文字 -->
            <p
              :class="cn(
                'text-sm font-medium',
                isDark ? 'text-red-400' : 'text-red-600',
              )"
            >
              页面加载时间较长，请稍候...
            </p>
            <!-- 骨架屏（半透明） -->
            <div class="w-full max-w-md px-6 opacity-50">
              <div
                v-for="i in 3"
                :key="i"
                :class="cn('h-3 rounded-full mb-2', skeletonBg)"
              />
            </div>
          </div>
        </div>
      </template>
      <!-- 默认变体：完整的页面骨架 -->
      <template v-if="variant === 'default'">
        <!-- 标题区域 -->
        <div class="px-6 pt-6 pb-4">
          <div
            :class="cn('h-8 w-48 rounded-lg', skeletonBg, 'relative overflow-hidden')"
          >
            <!-- 闪烁动画 -->
            <div
              :class="cn(
                'absolute inset-0 bg-gradient-to-r',
                shimmerFrom,
                'animate-shimmer',
              )"
            />
          </div>
          <div
            :class="cn('h-4 w-64 rounded mt-3', skeletonBg, 'relative overflow-hidden')"
          >
            <div
              :class="cn(
                'absolute inset-0 bg-gradient-to-r',
                shimmerFrom,
                'animate-shimmer',
                'animation-delay-200',
              )"
            />
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="flex-1 px-6 space-y-4">
          <!-- 卡片行 -->
          <div
            v-for="i in 4"
            :key="i"
            :class="cn(
              'rounded-xl border p-6',
              isDark ? 'border-gray-800/50 bg-gray-900/50' : 'border-gray-200/50 bg-white/50',
            )"
          >
            <!-- 卡片标题 -->
            <div
              :class="cn('h-5 w-32 rounded mb-4', skeletonBg, 'relative overflow-hidden')"
            >
              <div
                :class="cn(
                  'absolute inset-0 bg-gradient-to-r',
                  shimmerFrom,
                  'animate-shimmer',
                )"
              />
            </div>

            <!-- 内容行 -->
            <div class="space-y-3">
              <div
                :class="cn('h-4 rounded-full', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                  )"
                />
              </div>
              <div
                :class="cn('h-4 w-3/4 rounded-full', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                    'animation-delay-100',
                  )"
                />
              </div>
              <div
                :class="cn('h-4 w-1/2 rounded-full', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                    'animation-delay-200',
                  )"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 简单变体：居中 spinner -->
      <template v-else-if="variant === 'simple'">
        <div class="flex-1 flex items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <!-- 自定义 spinner -->
            <div class="relative h-12 w-12">
              <div
                :class="cn(
                  'absolute inset-0 rounded-full border-4',
                  isDark ? 'border-gray-700' : 'border-gray-200',
                )"
              />
              <div
                :class="cn(
                  'absolute inset-0 rounded-full border-4 border-t-transparent animate-spin',
                  isDark ? 'border-indigo-500' : 'border-blue-500',
                )"
              />
            </div>

            <!-- 加载文字 -->
            <p
              :class="cn(
                'text-sm font-medium',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )"
            >
              正在加载...
            </p>
          </div>
        </div>
      </template>

      <!-- 详细变体：带统计卡片的骨架 -->
      <template v-else>
        <!-- 统计卡片区域 -->
        <div class="px-6 pt-6 pb-2">
          <div class="grid grid-cols-4 gap-4">
            <div
              v-for="i in 4"
              :key="i"
              :class="cn(
                'rounded-xl p-5',
                isDark ? 'bg-gray-800/50' : 'bg-white/70 shadow-sm',
              )"
            >
              <div
                :class="cn('h-4 w-20 rounded mb-3', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                  )"
                />
              </div>
              <div
                :class="cn('h-8 w-24 rounded', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                    'animation-delay-100',
                  )"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 主内容区域 -->
        <div class="flex-1 px-6 space-y-4 pt-4">
          <div
            :class="cn(
              'rounded-xl p-6 h-96',
              isDark ? 'bg-gray-800/30' : 'bg-white/50 shadow-sm',
            )"
          >
            <div class="space-y-4">
              <div
                :class="cn('h-6 w-40 rounded', skeletonBg)"
              />
              <div
                :class="cn('h-[320px] rounded-lg', skeletonBg, 'relative overflow-hidden')"
              >
                <div
                  :class="cn(
                    'absolute inset-0 bg-gradient-to-r',
                    shimmerFrom,
                    'animate-shimmer',
                  )"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
/* 进入/离开动画 */
.page-loading-enter-active {
  transition: opacity 0.2s ease-out;
}

.page-loading-leave-active {
  transition: opacity 0.15s ease-in;
}

.page-loading-enter-from,
.page-loading-leave-to {
  opacity: 0;
}

/* 闪烁动画 - 模拟加载效果 */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}

/* 延迟变体 */
.animation-delay-100 {
  animation-delay: 100ms;
}

.animation-delay-200 {
  animation-delay: 200ms;
}
</style>
