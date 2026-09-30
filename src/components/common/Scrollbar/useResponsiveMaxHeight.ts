import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

export interface ResponsiveMaxHeightOptions {
  /** 基准分辨率高（CSS px） */
  referenceHeight?: number
  /** 基准分辨率下的 max-height（px） */
  referenceMaxHeight?: number
  /**
   * 缩放指数
   * - 1   = 线性（高分屏可用高度按比例）
   * - >1  = 超线性（高分屏获得更多可用高度）→ 默认 1.94 对应 2560×1600 ≈ 1060
   * - <1  = 亚线性
   */
  exponent?: number
  /** 下限（px） */
  min?: number
  /** 上限（px） */
  max?: number
}

/**
 * 按窗口高度动态计算滚动容器 max-height。
 * 以 1920×1080 → 495px 为基准，在 2560×1600 下得到约 1060px。
 */
export function useResponsiveMaxHeight(options: ResponsiveMaxHeightOptions = {}) {
  const { referenceHeight = 1080, exponent = 1.938, min = 200, max = Number.POSITIVE_INFINITY } = options

  // useWindowSize 自带 rAF 节流，resize 时不会打爆渲染
  const { height: windowHeight } = useWindowSize()

  const maxHeight = computed(() => {
    const ratio = windowHeight.value / referenceHeight
    const scaled = (options.referenceMaxHeight ?? 0) * Math.pow(ratio, exponent)
    return Math.round(Math.min(Math.max(scaled, min), max))
  })

  const maxHeightPx = computed(() => `${maxHeight.value}px`)

  return { maxHeight, maxHeightPx, windowHeight }
}
