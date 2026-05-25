import type { TableScroll, UseTableScrollOptions, UseTableScrollReturn } from '../types'

import { isPlainObject } from 'es-toolkit'
import { computed, nextTick, ref, unref, useTemplateRef } from 'vue'

/**
 * 表格滚动管理 Hook
 * 为什么需要：统一管理表格滚动行为和高度计算
 */
export function useTableScroll(options: UseTableScrollOptions): UseTableScrollReturn {
  const { scroll, canResize = false, resizeHeightOffset = 0 } = options

  // 滚动配置
  const scrollRef = ref<TableScroll | undefined>(undefined)
  // 表格容器 ref
  const tableContainerRef = useTemplateRef<HTMLElement>('tableContainer')

  /**
   * 获取滚动配置
   */
  const getScroll = computed((): TableScroll | undefined => {
    const scrollConfig = unref(scroll)
    const resize = unref(canResize)

    if (!scrollConfig && !resize) {
      return undefined
    }

    const baseScroll: TableScroll = isPlainObject(scrollConfig) ? scrollConfig : {}

    // 如果启用自适应高度，计算 y 值
    if (resize) {
      const height = calculateTableHeight()
      if (height > 0) {
        baseScroll.y = height
      }
    }

    return baseScroll
  })

  /**
   * 计算表格高度
   */
  function calculateTableHeight(): number {
    const container = tableContainerRef.value
    if (!container)
      return 0

    const containerHeight = container.offsetHeight
    const offset = unref(resizeHeightOffset)

    // 减去表头高度（约 55px）和其他偏移
    const headerHeight = 55
    const padding = 24

    return containerHeight - headerHeight - padding - (offset || 0)
  }

  /**
   * 重新计算高度
   */
  const redoHeight = async (): Promise<void> => {
    await nextTick()
    const resize = unref(canResize)
    if (resize) {
      scrollRef.value = unref(getScroll)
    }
  }

  /**
   * 滚动到指定位置
   */
  const scrollTo = (pos: { left?: number, top?: number }): void => {
    const tableBody = tableContainerRef.value?.querySelector('.ant-table-body') as HTMLElement
    if (!tableBody)
      return

    if (typeof pos.left === 'number') {
      tableBody.scrollLeft = pos.left
    }
    if (typeof pos.top === 'number') {
      tableBody.scrollTop = pos.top
    }
  }

  /**
   * 监听滚动配置变化
   */
  const updateScroll = () => {
    scrollRef.value = unref(getScroll)
  }

  return {
    scrollRef,
    getScroll,
    redoHeight,
    scrollTo,
  }
}
