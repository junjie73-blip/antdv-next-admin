import type { MaybeRefOrGetter } from 'vue';

import { computed, toValue } from 'vue';

import { useWindowSize } from '@vueuse/core';
import { clamp } from 'es-toolkit';

/**
 * 注意这里显式 import `toValue` / `MaybeRefOrGetter`：
 * 应用里靠 unplugin-auto-import 提供，包内不能依赖那种隐式全局，
 * 否则换一种消费方式（不做自动导入的工程）就会运行时 `toValue is not defined`。
 */

export interface ResponsiveMaxHeightOptions {
  /** 基准分辨率高（CSS px） */
  referenceHeight?: MaybeRefOrGetter<number>;
  /** 基准分辨率下的 max-height（px） */
  referenceMaxHeight?: MaybeRefOrGetter<number>;
  /**
   * 缩放指数
   * - 1   = 线性
   * - >1  = 超线性（默认 1.938，1920×1080 → 495，2560×1600 ≈ 1060）
   * - <1  = 亚线性
   */
  exponent?: MaybeRefOrGetter<number>;
  /** 下限（px） */
  min?: MaybeRefOrGetter<number>;
  /** 上限（px） */
  max?: MaybeRefOrGetter<number>;
}

/**
 * 按窗口高度动态计算滚动容器 max-height。
 * 支持传入 Ref / Getter，父级 maxHeight 变化时会自动重算。
 */
export function useResponsiveMaxHeight(
  options: ResponsiveMaxHeightOptions = {},
) {
  // useWindowSize 自带 rAF 节流
  const { height: windowHeight } = useWindowSize();

  const maxHeight = computed(() => {
    // ⭐ toValue：兼容 number / Ref<number> / () => number
    const referenceHeight = toValue(options.referenceHeight) ?? 1080;
    const referenceMaxHeight = toValue(options.referenceMaxHeight) ?? 0;
    const exponent = toValue(options.exponent) ?? 1.938;
    const min = toValue(options.min) ?? 712;
    const max = toValue(options.max) ?? Number.POSITIVE_INFINITY;

    const ratio = windowHeight.value / referenceHeight;
    const scaled = referenceMaxHeight * ratio ** exponent;
    return Math.round(clamp(scaled, min, max));
  });

  const maxHeightPx = computed(() => `${maxHeight.value}px`);

  return { maxHeight, maxHeightPx, windowHeight };
}
