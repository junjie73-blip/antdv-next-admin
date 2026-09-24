<script setup lang="ts">
/**
 * TableSkeleton - 表格骨架屏组件
 *
 * 专门用于表格数据加载时的占位 UI，
 * 模拟真实表格的行列结构，提供更好的视觉连续性。
 *
 * 使用方式：
 * ```vue
 * <TableSkeleton :loading="isLoading" :columns="5" :rows="10" />
 *
 * 或配合 BasicTable 使用：
 * <BasicTable :loading="isLoading">
 *   <template #skeleton>
 *     <TableSkeleton :columns="tableColumns.length" />
 *   </template>
 * </BasicTable>
 * ```
 */

import { cn } from '~/utils/cn'

interface Props {
  /** 是否显示骨架屏 */
  loading?: boolean
  /** 表格列数 */
  columns?: number
  /** 表格行数 */
  rows?: number
  /** 是否显示表头 */
  showHeader?: boolean
  /** 是否显示操作列 */
  showActions?: boolean
  /** 是否显示分页器 */
  showPagination?: boolean
  /** 自定义类名 */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: true,
  columns: 5,
  rows: 8,
  showHeader: true,
  showActions: true,
  showPagination: true,
})

// 骨架屏基础样式（带动画）
const skeletonBaseClassName = cn('animate-pulse', 'bg-gray-200 dark:bg-gray-700', 'rounded')

// 表头单元格样式
const headerCellClassName = cn(skeletonBaseClassName, 'h-10 px-4')

// 数据行单元格样式
function getCellClassName(isAction?: boolean) {
  if (isAction) {
    return cn(skeletonBaseClassName, 'h-8 w-20 mx-auto')
  }
  return cn(skeletonBaseClassName, 'h-8')
}
</script>

<template>
  <!-- 加载中：显示表格骨架屏 -->
  <div v-if="loading" :class="cn('w-full', props.class)">
    <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <!-- 表头 -->
      <div
        v-if="showHeader"
        :class="cn('flex border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800')"
      >
        <div v-for="col in columns" :key="`header-${col}`" :class="cn(headerCellClassName, 'flex-1')" />
        <div v-if="showActions" :class="cn(headerCellClassName, 'w-24 shrink-0')" />
      </div>

      <!-- 数据行 -->
      <div>
        <div
          v-for="row in rows"
          :key="`row-${row}`"
          :class="
            cn(
              'flex items-center',
              row !== rows && 'border-b border-gray-100 dark:border-gray-800',
              row % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-900/50',
            )
          "
        >
          <div v-for="col in columns" :key="`cell-${row}-${col}`" :class="cn('flex-1 px-4', getCellClassName())" />
          <div v-if="showActions" :class="cn('w-24 shrink-0 px-4', getCellClassName(true))" />
        </div>
      </div>
    </div>

    <!-- 分页器骨架 -->
    <div v-if="showPagination" class="mt-4 flex items-center justify-between">
      <div :class="cn(skeletonBaseClassName, 'h-8 w-48')" />
      <div class="flex items-center gap-2">
        <div :class="cn(skeletonBaseClassName, 'h-8 w-16')" />
        <div :class="cn(skeletonBaseClassName, 'h-8 w-8')" />
        <div :class="cn(skeletonBaseClassName, 'h-8 w-8')" />
        <div :class="cn(skeletonBaseClassName, 'h-8 w-8')" />
        <div :class="cn(skeletonBaseClassName, 'h-8 w-16')" />
      </div>
    </div>
  </div>

  <!-- 加载完成：显示实际内容 -->
  <slot v-else />
</template>
