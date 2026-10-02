import type { EChartsOption, ECharts } from 'echarts'

import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'

export interface UseEchartsOptions {
  /** 是否跟随窗口变化自动 resize，默认 true */
  autoResize?: boolean
  /** 容器为空时是否跳过初始化，默认 true */
  skipEmpty?: boolean
}

export interface UseEchartsReturn {
  /** 容器 ref，绑到 DOM 上 */
  containerRef: Ref<HTMLElement | null>
  /** 图表实例（shallowRef 避免深度代理） */
  chart: Ref<ECharts | null>
  /** 设置 option（自动 merge，不传 notMerge） */
  setOption: (option: EChartsOption, notMerge?: boolean) => void
  /** 手动 resize（一般不用，autoResize 已处理） */
  resize: () => void
  /** 手动 dispose（组件卸载时自动调用，一般不用） */
  dispose: () => void
}

export function useEcharts(initialOption?: EChartsOption, options: UseEchartsOptions = {}): UseEchartsReturn {
  const { autoResize = true } = options
  const containerRef = ref<HTMLElement | null>(null)
  const chart = shallowRef<ECharts | null>(null)

  let resizeObserver: ResizeObserver | null = null

  function resize() {
    chart.value?.resize()
  }

  function setOption(option: EChartsOption, notMerge = false) {
    if (!chart.value) return
    chart.value.setOption(option, notMerge)
  }

  function dispose() {
    if (chart.value) {
      chart.value.dispose()
      chart.value = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (autoResize) window.removeEventListener('resize', resize)
  }

  onMounted(() => {
    if (!containerRef.value) return

    // 容器必须有尺寸，否则 echarts 会警告 & 渲染为空
    if (containerRef.value.clientWidth === 0 || containerRef.value.clientHeight === 0) {
      console.warn('[useEcharts] container has zero size, skip init')
      return
    }

    chart.value = echarts.init(containerRef.value, undefined, { renderer: 'canvas' })

    if (initialOption) {
      chart.value.setOption(initialOption)
    }

    if (autoResize) {
      window.addEventListener('resize', resize)
      // ⭐ ResizeObserver 处理容器级变化（父容器伸缩、tab 切换）
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          // 简单节流
          requestAnimationFrame(() => resize())
        })
        resizeObserver.observe(containerRef.value)
      }
    }
  })

  onBeforeUnmount(dispose)

  return { containerRef, chart, setOption, resize, dispose }
}
