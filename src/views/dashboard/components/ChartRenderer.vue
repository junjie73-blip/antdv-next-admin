<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import { useElementSize } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useEcharts, type ResizeStrategy } from '~/composables/echarts/useEcharts'

defineOptions({ name: 'ChartRenderer' })

type ChartKind = 'line' | 'bar' | 'pie' | 'radar' | 'heatmap' | 'funnel' | 'gauge' | 'wordcloud' | 'sankey' | 'sunburst'

interface Props {
  option: EChartsOption
  dark: boolean
  loading?: boolean
  kind?: ChartKind
  containerHeight?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  kind: 'line',
  containerHeight: 200,
})

const heavyKinds: ChartKind[] = ['wordcloud', 'sankey', 'heatmap', 'sunburst']
const resizeStrategy: ResizeStrategy = heavyKinds.includes(props.kind) ? 'debounce' : 'raf'

const { containerRef, chart, isReady, setOption } = useEcharts(undefined, {
  // ⭐ 关键修复：传 computed，而不是函数
  isDark: computed(() => props.dark),
  resizeStrategy,
  resizeDelay: 150,
  onError: (err) => console.warn(`[chart:${props.kind}] error`, err),
  // ⭐ 开发环境打开日志
  debug: import.meta.env.DEV,
})
// eslint-disable-next-line vue/no-dupe-keys
const { width, height } = useElementSize(containerRef)

// ⭐ 关键修复：只要有尺寸（宽或高任一 > 0）且 chart 就绪，就 setOption
watch(
  [() => props.option, isReady, width, height],
  ([opt, ready, w, h]) => {
    if (!ready) return
    if (w === 0 && h === 0) return // 放宽条件
    setOption(opt)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.loading,
  (l) => {
    if (!chart.value) return
    if (l) {
      chart.value.showLoading('default', {
        text: '加载中',
        maskColor: 'transparent',
      })
    } else {
      chart.value.hideLoading()
    }
  },
)
</script>

<template>
  <div
    ref="containerRef"
    :style="{
      width: '100%',
      height: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight,
      minHeight: '200px',
    }"
  />
</template>
