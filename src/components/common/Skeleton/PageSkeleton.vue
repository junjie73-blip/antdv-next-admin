<script setup lang="ts">
/**
 * PageSkeleton - 页面骨架屏组件
 *
 * 用于路由切换或异步内容加载时显示的占位 UI，
 * 提供视觉上的连续性，减少用户等待焦虑。
 *
 * 使用方式：
 * ```vue
 * <PageSkeleton :loading="isLoading">
 *   <YourContent />
 * </PageSkeleton>
 * ```
 *
 * 或在 Suspense 中使用：
 * ```vue
 * <template #fallback>
 *   <PageSkeleton />
 * </template>
 * ```
 */

import { cn } from '@/utils/cn'

interface Props {
  /** 是否显示骨架屏 */
  loading?: boolean
  /** 骨架屏类型 */
  variant?: 'page' | 'card' | 'form' | 'detail'
  /** 显示动画行数（仅 page 类型） */
  rows?: number
  /** 是否显示标题骨架 */
  showTitle?: boolean
  /** 是否显示操作按钮骨架 */
  showActions?: boolean
  /** 是否显示侧边栏（用于有侧栏的页面） */
  showSidebar?: boolean
  /** 自定义类名 */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: true,
  variant: 'page',
  rows: 5,
  showTitle: true,
  showActions: true,
  showSidebar: false,
})

// 骨架屏基础样式
const skeletonBaseClassName = cn(
  'animate-pulse',
  'bg-gray-200 dark:bg-gray-700',
  'rounded',
)

// 标题骨架样式
const titleClassName = cn(skeletonBaseClassName, 'h-8 w-48 mb-6')

// 操作按钮骨架样式
const actionClassName = cn(skeletonBaseClassName, 'h-9 w-20')

// 文本行骨架样式
function getRowClassName(width: string) {
  return cn(skeletonBaseClassName, 'h-4 mb-3', width)
}
</script>

<template>
  <!-- 加载中：显示骨架屏 -->
  <div
    v-if="loading"
    :class="cn('p-4 lg:p-6', props.class)"
  >
    <!-- ========== 页面类型骨架屏 ========== -->
    <div
      v-if="variant === 'page'"
      class="space-y-4"
    >
      <!-- 标题区域 -->
      <div
        v-if="showTitle"
        :class="titleClassName"
      />

      <!-- 操作按钮区域 -->
      <div
        v-if="showActions"
        class="flex items-center gap-3 mb-4"
      >
        <div :class="actionClassName" />
        <div :class="actionClassName" />
        <div class="ml-auto flex gap-2">
          <div :class="cn(skeletonBaseClassName, 'h-9 w-32')" />
        </div>
      </div>

      <!-- 主内容区 + 可选侧边栏 -->
      <div :class="cn('flex gap-6', showSidebar && 'flex-row')">
        <!-- 主要内容 -->
        <div :class="cn('flex-1 space-y-3', showSidebar && 'w-0')">
          <div
            v-for="i in rows"
            :key="i"
            :class="getRowClassName(i === rows ? 'w-3/4' : 'w-full')"
          />
        </div>

        <!-- 侧边栏 -->
        <div
          v-if="showSidebar"
          class="w-64 shrink-0 space-y-3"
        >
          <div :class="cn(skeletonBaseClassName, 'h-40 w-full')" />
          <div :class="cn(skeletonBaseClassName, 'h-32 w-full')" />
        </div>
      </div>
    </div>

    <!-- ========== 卡片类型骨架屏 ========== -->
    <div
      v-else-if="variant === 'card'"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="i in 6"
        :key="i"
        :class="cn('p-4 border border-gray-200 dark:border-gray-700 rounded-lg', skeletonBaseClassName)"
      >
        <div :class="cn(skeletonBaseClassName, 'h-5 w-2/3 mb-3')" />
        <div :class="cn(skeletonBaseClassName, 'h-4 w-full mb-2')" />
        <div :class="cn(skeletonBaseClassName, 'h-4 w-4/5')" />
      </div>
    </div>

    <!-- ========== 表单类型骨架屏 ========== -->
    <div
      v-else-if="variant === 'form'"
      class="max-w-2xl space-y-6"
    >
      <div
        v-for="i in 4"
        :key="i"
        class="flex items-center gap-4"
      >
        <div :class="cn(skeletonBaseClassName, 'h-4 w-24 shrink-0')" />
        <div :class="cn(skeletonBaseClassName, 'h-10 flex-1')" />
      </div>
      <div class="flex justify-end gap-3 pt-4">
        <div :class="actionClassName" />
        <div :class="cn(actionClassName, 'w-24')" />
      </div>
    </div>

    <!-- ========== 详情类型骨架屏 ========== -->
    <div
      v-else-if="variant === 'detail'"
      class="max-w-4xl space-y-6"
    >
      <!-- 头部信息 -->
      <div class="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div :class="cn(skeletonBaseClassName, 'h-16 w-16 rounded-full')" />
        <div class="space-y-2 flex-1">
          <div :class="cn(skeletonBaseClassName, 'h-6 w-48')" />
          <div :class="cn(skeletonBaseClassName, 'h-4 w-64')" />
        </div>
      </div>

      <!-- 详情字段 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="i in 6"
          :key="i"
          class="space-y-1"
        >
          <div :class="cn(skeletonBaseClassName, 'h-3 w-20')" />
          <div :class="cn(skeletonBaseClassName, 'h-5 w-full')" />
        </div>
      </div>
    </div>
  </div>

  <!-- 加载完成：显示实际内容 -->
  <slot v-else />
</template>
