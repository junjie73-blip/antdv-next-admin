<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSecurityStats } from '@/api/security'
import { useAppStore } from '@/stores/modules/app'

import { cn } from '@/utils/cn'

defineOptions({ name: 'SecurityStatsCharts' })

const appStore = useAppStore()
const isDark = computed(() => appStore.themeMode === 'dark')

const containerClassName = cn('rounded-xl p-5')
const sectionTitleClassName = cn('text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3')

// 图表 DOM 引用
const pieRef = ref<HTMLDivElement>()
const barRef = ref<HTMLDivElement>()
const lineRef = ref<HTMLDivElement>()

const charts = new Map<string, echarts.ECharts>()

// 主题色
const PALETTE = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#722ed1',
}

function textColor() { return isDark.value ? '#d1d5db' : '#374151' }
function subTextColor() { return isDark.value ? '#6b7280' : '#9ca3af' }
function borderColor() { return isDark.value ? '#374151' : '#e5e7eb' }

/** 安全初始化图表 */
function safeInit(name: string, refEl: ref<HTMLDivElement | undefined>, initFn: (el: HTMLDivElement) => void) {
  const el = refEl.value
  if (!el || charts.has(name))
    return

  if (el.offsetWidth > 0 && el.offsetHeight > 0) {
    initFn(el)
    return
  }

  let cleaned = false
  const observer = new ResizeObserver((entries) => {
    if (cleaned)
      return
    for (const entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        cleaned = true
        observer.disconnect()
        const target = refEl.value
        if (target && !charts.has(name))
          initFn(target)
        break
      }
    }
  })
  observer.observe(el)

  setTimeout(() => {
    if (!cleaned && !charts.has(name)) {
      cleaned = true
      observer.disconnect()
      const target = refEl.value
      if (target)
        initFn(target)
    }
  }, 3000)
}

function initPieChart(el: HTMLDivElement) {
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('pie', instance)
  instance.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)',
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { color: subTextColor(), fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 10,
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['36%', '50%'],
      avoidLabelOverlap: true,
      padAngle: 2,
      itemStyle: {
        borderRadius: 5,
        borderColor: isDark.value ? '#111827' : '#fff',
        borderWidth: 2,
      },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: textColor() },
        scaleSize: 6,
      },
      data: [
        { value: 45, name: 'XSS攻击', itemStyle: { color: PALETTE.danger } },
        { value: 28, name: 'SQL注入', itemStyle: { color: PALETTE.primary } },
        { value: 35, name: 'CSRF攻击', itemStyle: { color: PALETTE.warning } },
        { value: 52, name: '暴力破解', itemStyle: { color: PALETTE.info } },
        { value: 68, name: '扫描探测', itemStyle: { color: PALETTE.success } },
      ],
      animationDuration: 1200,
    }],
  })
}

function initBarChart(el: HTMLDivElement) {
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('bar', instance)
  instance.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)',
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    grid: { left: '3%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['北京', '上海', '广州', '深圳', '杭州', '成都', '海外'],
      axisLabel: { color: subTextColor(), fontSize: 11 },
      axisLine: { lineStyle: { color: borderColor() } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitLine: { lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 } },
    },
    series: [{
      type: 'bar',
      barWidth: 20,
      data: [
        { value: 320, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#1677ff' }, { offset: 1, color: 'rgba(22,119,255,0.2)' }]) } },
        { value: 280, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#52c41a' }, { offset: 1, color: 'rgba(82,196,26,0.2)' }]) } },
        { value: 180, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#faad14' }, { offset: 1, color: 'rgba(250,173,20,0.2)' }]) } },
        { value: 220, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#722ed1' }, { offset: 1, color: 'rgba(114,46,209,0.2)' }]) } },
        { value: 140, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#13c2c2' }, { offset: 1, color: 'rgba(19,194,194,0.2)' }]) } },
        { value: 110, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#f5222d' }, { offset: 1, color: 'rgba(245,34,45,0.2)' }]) } },
        { value: 450, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#ff85c0' }, { offset: 1, color: 'rgba(255,133,192,0.2)' }]) } },
      ],
      animationDuration: 1000,
    }],
  })
}

function initLineChart(el: HTMLDivElement) {
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('line', instance)
  instance.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)',
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 12 },
    },
    legend: {
      data: ['安全事件数', '平均响应(ms)'],
      bottom: 0,
      textStyle: { color: subTextColor(), fontSize: 11 },
      itemWidth: 14,
      itemHeight: 3,
      itemGap: 20,
    },
    grid: { left: '3%', right: '4%', top: '8%', bottom: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLabel: { color: subTextColor(), fontSize: 10, interval: 2 },
      axisLine: { lineStyle: { color: borderColor() } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '事件数',
        nameTextStyle: { color: subTextColor(), fontSize: 10 },
        axisLabel: { color: subTextColor(), fontSize: 10 },
        splitLine: { lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 } },
      },
      {
        type: 'value',
        name: '响应ms',
        nameTextStyle: { color: subTextColor(), fontSize: 10 },
        axisLabel: { color: subTextColor(), fontSize: 10, formatter: (v: number) => `${v}ms` },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '安全事件数',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: Array.from({ length: 14 }, () => Math.floor(Math.random() * 30 + 10)),
        lineStyle: { color: PALETTE.danger, width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255,77,79,0.2)' }, { offset: 1, color: 'rgba(255,77,79,0.01)' }]) },
      },
      {
        name: '平均响应(ms)',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 1,
        data: Array.from({ length: 14 }, () => Math.floor(Math.random() * 400 + 80)),
        lineStyle: { color: PALETTE.primary, width: 2, type: 'dashed' },
      },
    ],
    animationDuration: 1200,
  })
}

onMounted(async () => {
  try {
    await getSecurityStats()
  }
  catch { /* 使用默认数据 */ }

  // 延迟初始化确保容器已渲染
  setTimeout(() => {
    safeInit('pie', pieRef, initPieChart)
    safeInit('bar', barRef, initBarChart)
    safeInit('line', lineRef, initLineChart)
  }, 100)
})

watch(isDark, () => {
  charts.forEach(c => c.dispose())
  charts.clear()
  setTimeout(() => {
    safeInit('pie', pieRef, initPieChart)
    safeInit('bar', barRef, initBarChart)
    safeInit('line', lineRef, initLineChart)
  }, 50)
})

useEventListener(window, 'resize', () => charts.forEach(c => c.resize()))

function disposeAll() {
  charts.forEach(c => c.dispose())
  charts.clear()
}
onBeforeUnmount(disposeAll)
</script>

<template>
  <div class="space-y-4">
    <!-- 威胁类型分布 + 攻击来源 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 饼图：威胁分布 -->
      <div :class="cn(containerClassName, 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800')">
        <h4 :class="sectionTitleClassName">
          威胁类型分布
        </h4>
        <div
          ref="pieRef"
          style="height: 260px"
        />
      </div>

      <!-- 柱状图：攻击来源地区 -->
      <div :class="cn(containerClassName, 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800')">
        <h4 :class="sectionTitleClassName">
          攻击来源地区 TOP7
        </h4>
        <div
          ref="barRef"
          style="height: 260px"
        />
      </div>
    </div>

    <!-- 趋势图：每日事件 + 响应时间（全宽） -->
    <div :class="cn(containerClassName, 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800')">
      <h4 :class="sectionTitleClassName">
        事件趋势 & 响应时间
      </h4>
      <div
        ref="lineRef"
        style="height: 280px"
      />
    </div>
  </div>
</template>
