import type { ComputedRef, Ref } from 'vue'
import type { Recordable } from '../types'
import { computed, nextTick, ref, watch } from 'vue'

export interface UseVirtualScrollOptions {
  dataSource: Ref<Recordable[]>
  enabled: ComputedRef<boolean>
  itemHeight?: number
  bufferSize?: number
}

export interface UseVirtualScrollReturn {
  visibleData: ComputedRef<Recordable[]>
  startIndex: Ref<number>
  endIndex: Ref<number>
  scrollTop: Ref<number>
  containerHeight: Ref<number>
  totalHeight: ComputedRef<number>
  handleScroll: (e: Event) => void
  updateContainerHeight: (height: number) => void
}

/**
 * 虚拟滚动 Hook
 * 为什么需要：大数据量下只渲染可见区域的数据，提升性能
 */
export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const { dataSource, enabled, itemHeight = 48, bufferSize = 5 } = options

  // 滚动位置
  const scrollTop = ref(0)
  // 容器高度
  const containerHeight = ref(0)
  // 开始索引
  const startIndex = ref(0)
  // 结束索引
  const endIndex = ref(0)

  /**
   * 计算总高度
   */
  const totalHeight = computed(() => {
    if (!enabled.value)
      return 0
    return dataSource.value.length * itemHeight
  })

  /**
   * 计算可见数据
   */
  const visibleData = computed(() => {
    if (!enabled.value)
      return dataSource.value

    const start = startIndex.value
    const end = endIndex.value
    return dataSource.value.slice(start, end)
  })

  /**
   * 计算可见范围
   */
  const calculateVisibleRange = () => {
    if (!enabled.value || containerHeight.value === 0) {
      startIndex.value = 0
      endIndex.value = dataSource.value.length
      return
    }

    const start = Math.floor(scrollTop.value / itemHeight)
    const visibleCount = Math.ceil(containerHeight.value / itemHeight)

    // 添加缓冲区
    startIndex.value = Math.max(0, start - bufferSize)
    endIndex.value = Math.min(
      dataSource.value.length,
      start + visibleCount + bufferSize,
    )
  }

  /**
   * 处理滚动事件
   */
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    scrollTop.value = target.scrollTop
    calculateVisibleRange()
  }

  /**
   * 更新容器高度
   */
  const updateContainerHeight = (height: number) => {
    containerHeight.value = height
    calculateVisibleRange()
  }

  // 监听数据源变化
  watch(
    () => dataSource.value.length,
    () => {
      nextTick(() => {
        calculateVisibleRange()
      })
    },
    { immediate: true },
  )

  // 监听容器高度变化
  watch(containerHeight, () => {
    calculateVisibleRange()
  })

  return {
    visibleData,
    startIndex,
    endIndex,
    scrollTop,
    containerHeight,
    totalHeight,
    handleScroll,
    updateContainerHeight,
  }
}
