import { useWindowSize } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { computed } from 'vue'

export interface ResponsiveMaxHeightOptions {
  /** 基准分辨率高（CSS px） */
  referenceHeight?: MaybeRefOrGetter<number>
  /** 基准分辨率下的 max-height（px） */
  referenceMaxHeight?: MaybeRefOrGetter<number>
  /**
   * 缩放指数
   * - 1   = 线性
   * - >1  = 超线性（默认 1.938，1920×1080 → 495，2560×1600 ≈ 1060）
   * - <1  = 亚线性
   */
  exponent?: MaybeRefOrGetter<number>
  /** 下限（px） */
  min?: MaybeRefOrGetter<number>
  /** 上限（px） */
  max?: MaybeRefOrGetter<number>
}

/**
 * 按窗口高度动态计算滚动容器 max-height。
 * 支持传入 Ref / Getter，父级 maxHeight 变化时会自动重算。
 */
export function useResponsiveMaxHeight(
  options: ResponsiveMaxHeightOptions = {},
) {
  // useWindowSize 自带 rAF 节流
  const { height: windowHeight } = useWindowSize()

  const maxHeight = computed(() => {
    // ⭐ toValue：兼容 number / Ref<number> / () => number
    const referenceHeight = toValue(options.referenceHeight) ?? 1080
    const referenceMaxHeight = toValue(options.referenceMaxHeight) ?? 0
    const exponent = toValue(options.exponent) ?? 1.938
    const min = toValue(options.min) ?? 712
    const max = toValue(options.max) ?? Number.POSITIVE_INFINITY

    const ratio = windowHeight.value / referenceHeight
    const scaled = referenceMaxHeight * Math.pow(ratio, exponent)
    return Math.round(clamp(scaled, min, max))
  })

  const maxHeightPx = computed(() => `${maxHeight.value}px`)

  return { maxHeight, maxHeightPx, windowHeight }
}
