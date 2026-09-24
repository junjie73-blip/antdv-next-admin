<script setup lang="ts">
import { Icon } from '@iconify/vue'
import * as echarts from 'echarts' // ⚠️ 静态 import，不要动态 import
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { getServerInfo } from '~/api'

defineOptions({ name: 'MonitorServer' })

const info = ref<any>({ history: [] })
let timer: any = null
let chart: echarts.ECharts | null = null
const trendRef = ref<HTMLDivElement>()

async function load() {
  const res: any = await getServerInfo()
  info.value = res?.data ?? res ?? { history: [] }
}

// ========== 工具 ==========
function formatUptime(s: number) {
  if (!s || s < 0) return '0 秒'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)

  // 分层次显示，粒度自适应
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分钟`
  if (m > 0) return `${m} 分钟 ${sec} 秒`
  return `${sec} 秒`
}

function getStatusColor(usage: number) {
  if (usage >= 80) return { stroke: '#ef4444' }
  if (usage >= 60) return { stroke: '#f59e0b' }
  return { stroke: '#10b981' }
}

const cpuUsage = computed(() => Number(info.value.cpu?.usage || 0))
const memUsage = computed(() => Number(info.value.memory?.usage || 0))
const sysItems = computed(() => [
  { icon: 'carbon:computer', label: '主机名', value: info.value.system?.hostname },
  {
    icon: 'carbon:laptop',
    label: '操作系统',
    value: `${info.value.system?.platform} ${info.value.system?.arch}`,
  },
  { icon: 'carbon:code', label: '系统版本', value: info.value.system?.release },
  { icon: 'carbon:logo-nodejs', label: 'Node 版本', value: info.value.system?.nodeVersion },
  { icon: 'carbon:application', label: '进程 PID', value: info.value.system?.pid },
  { icon: 'carbon:time', label: '系统运行', value: formatUptime(info.value.system?.uptime || 0) },
])
const processUptime = computed(() => info.value.process?.uptime || 0)
const systemUptime = computed(() => info.value.system?.uptime || 0)

// 是否显示"重启过"的提示
const hasRestarted = computed(() => {
  // 系统运行超过 1 小时，但进程运行小于 10 分钟 → 明显重启过
  return systemUptime.value > 3600 && processUptime.value < 600
})
// ========== 图表：初始化时就把结构定好 ==========
function initChart() {
  if (!trendRef.value || chart) return

  chart = echarts.init(trendRef.value)

  chart.setOption({
    grid: { left: 48, right: 24, top: 44, bottom: 36 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#374151', fontSize: 12 },
      valueFormatter: (v: any) => `${v}%`,
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#d1d5db', type: 'dashed' },
      },
    },
    legend: {
      data: ['CPU', '内存', 'Heap'],
      right: 0,
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { fontSize: 11, color: '#6b7280' },
    },
    xAxis: {
      type: 'category',
      data: [],
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: {
        color: '#9ca3af',
        fontSize: 10,
        // 只显示部分标签，避免拥挤
        interval: 4,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 20,
      axisLabel: {
        color: '#9ca3af',
        fontSize: 10,
        formatter: '{value}%',
      },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [
      {
        name: 'CPU',
        type: 'line',
        smooth: 0.4, // ← 平滑曲线
        showSymbol: true, // ← 显示点（尤其是只有 1 个点时）
        symbol: 'circle',
        symbolSize: 6,
        data: [],
        lineStyle: { color: '#3b82f6', width: 2.5 }, // ← 线更粗
        itemStyle: { color: '#3b82f6', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ],
          },
        },
        emphasis: { focus: 'series' },
      },
      {
        name: '内存',
        type: 'line',
        smooth: 0.4,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        data: [],
        lineStyle: { color: '#f59e0b', width: 2.5 },
        itemStyle: { color: '#f59e0b', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,158,11,0.25)' },
              { offset: 1, color: 'rgba(245,158,11,0.02)' },
            ],
          },
        },
      },
      {
        name: 'Heap',
        type: 'line',
        smooth: 0.4,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        data: [],
        lineStyle: { color: '#10b981', width: 2.5 },
        itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16,185,129,0.25)' },
              { offset: 1, color: 'rgba(16,185,129,0.02)' },
            ],
          },
        },
      },
    ],
    animationDuration: 600,
    animationEasing: 'cubicOut',
  })
}

// ========== 每次数据更新，只替换 data ==========
function updateChart() {
  if (!chart) return
  const history = info.value.history || []
  chart.setOption({
    xAxis: {
      data: history.map((h: any) => h.time.substring(11, 19)),
    },
    series: [
      { data: history.map((h: any) => h.cpu) },
      { data: history.map((h: any) => h.memory) },
      { data: history.map((h: any) => h.heap) },
    ],
  })
}

// 数据变化时更新图表
watch(
  () => info.value.history,
  () => updateChart(),
  { deep: true },
)

// ========== 生命周期 ==========
onMounted(async () => {
  await load()
  // ⚠️ nextTick 确保 DOM 渲染完成后再 initChart
  await new Promise((r) => setTimeout(r, 0))
  initChart()
  updateChart()

  timer = setInterval(async () => {
    await load()
    // watch 会自动触发 updateChart
  }, 5000)
})

onUnmounted(() => {
  clearInterval(timer)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <Scrollbar class="h-full">
    <div class="space-y-4">
      <!-- ========== 顶部：状态栏 ========== -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <!-- Node 状态 -->
        <div
          class="flex items-center gap-3 rounded-xl border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
            <Icon icon="carbon:logo-nodejs" class="text-xl" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1 text-xs text-gray-400">
              Node 服务
              <a-tag v-if="hasRestarted" color="orange" class="!m-0 !px-1 !py-0 !text-[10px] !leading-4">
                最近重启过
              </a-tag>
            </div>
            <div class="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-100">
              运行中 · {{ formatUptime(processUptime) }}
            </div>
          </div>
        </div>
        <!-- Redis -->
        <div
          class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            :class="info.redis?.status === 'connected' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'"
          >
            <Icon icon="logos:redis" class="text-xl" />
          </div>
          <div class="min-w-0">
            <div class="text-xs text-gray-400">Redis</div>
            <div
              class="mt-0.5 flex items-center gap-1.5 text-sm font-medium"
              :class="info.redis?.status === 'connected' ? 'text-emerald-600' : 'text-red-500'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="info.redis?.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'"
              />
              {{ info.redis?.status === 'connected' ? '已连接' : '未连接' }}
            </div>
          </div>
        </div>

        <!-- DB -->
        <div
          class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            :class="info.database?.status === 'connected' ? 'text-ant-primary bg-blue-50' : 'bg-gray-100 text-gray-400'"
          >
            <Icon icon="carbon:data-base" class="text-xl" />
          </div>
          <div class="min-w-0">
            <div class="text-xs text-gray-400">数据库</div>
            <div
              class="mt-0.5 flex items-center gap-1.5 text-sm font-medium"
              :class="info.database?.status === 'connected' ? 'text-emerald-600' : 'text-red-500'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="info.database?.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'"
              />
              {{ info.database?.status === 'connected' ? `已连接 ${info.database?.latency || 0}ms` : '未连接' }}
            </div>
          </div>
        </div>

        <!-- 系统运行 -->
        <div
          class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
            <Icon icon="carbon:server" class="text-xl" />
          </div>
          <div class="min-w-0">
            <div class="text-xs text-gray-400">系统运行</div>
            <div class="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ formatUptime(info.system?.uptime || 0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- ========== CPU & 内存 ========== -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- CPU 卡片 -->
        <div class="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="carbon:chip" class="text-ant-primary" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">CPU</span>
            </div>
            <span class="text-xs text-gray-400">{{ info.cpu?.cores }} 核 · {{ info.cpu?.speed }}MHz</span>
          </div>

          <div class="flex items-center gap-6">
            <!-- 环形进度 -->
            <div class="relative flex-shrink-0">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" stroke-width="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  :stroke="getStatusColor(cpuUsage).stroke"
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="264"
                  :stroke-dashoffset="264 * (1 - cpuUsage / 100)"
                  transform="rotate(-90 50 50)"
                  style="transition: stroke-dashoffset 0.5s ease"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <div class="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {{ cpuUsage }}
                  </div>
                  <div class="text-[10px] text-gray-400">%</div>
                </div>
              </div>
            </div>

            <!-- CPU 详情 -->
            <div class="flex-1 space-y-2">
              <div class="text-xs leading-relaxed break-all text-gray-500">
                {{ info.cpu?.model }}
              </div>
              <div class="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <div class="text-xs text-gray-400">1 min</div>
                  <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ info.cpu?.loadAvg?.[0] || 0 }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-400">5 min</div>
                  <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ info.cpu?.loadAvg?.[1] || 0 }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-400">15 min</div>
                  <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ info.cpu?.loadAvg?.[2] || 0 }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 内存卡片 -->
        <div class="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="carbon:memory" class="text-amber-500" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">内存</span>
            </div>
            <span class="text-xs text-gray-400">共 {{ info.memory?.totalHuman }}</span>
          </div>

          <div class="flex items-center gap-6">
            <!-- 环形进度 -->
            <div class="relative flex-shrink-0">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" stroke-width="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  :stroke="getStatusColor(memUsage).stroke"
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="264"
                  :stroke-dashoffset="264 * (1 - memUsage / 100)"
                  transform="rotate(-90 50 50)"
                  style="transition: stroke-dashoffset 0.5s ease"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <div class="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {{ memUsage }}
                  </div>
                  <div class="text-[10px] text-gray-400">%</div>
                </div>
              </div>
            </div>

            <!-- 内存详情 -->
            <div class="flex-1 space-y-3">
              <div>
                <div class="mb-1 flex justify-between text-xs">
                  <span class="text-gray-500">已用</span>
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{ info.memory?.usedHuman }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{
                      width: memUsage + '%',
                      backgroundColor: getStatusColor(memUsage).stroke,
                    }"
                  />
                </div>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">空闲</span>
                <span class="font-medium text-gray-700 dark:text-gray-200">{{ info.memory?.freeHuman }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 实时趋势图 ========== -->
      <div class="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon icon="carbon:chart-line" class="text-ant-primary" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">实时趋势</span>
          </div>
          <span class="text-xs text-gray-400">每 5 秒刷新 · 最近 30 次采样</span>
        </div>
        <div ref="trendRef" style="height: 240px" />
      </div>

      <!-- ========== Node 进程 + 磁盘 ========== -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <!-- Node 进程 -->
        <div class="rounded-xl border border-gray-100 bg-white p-5 md:col-span-2 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 flex items-center gap-2">
            <Icon icon="carbon:application-web" class="text-emerald-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Node 进程</span>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">运行时长</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ formatUptime(info.process?.uptime || 0) }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">RSS</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ info.process?.memoryUsage?.rssHuman }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">Heap 已用</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ info.process?.memoryUsage?.heapUsedHuman }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">Heap 总量</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ info.process?.memoryUsage?.heapTotalHuman }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">External</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ info.process?.memoryUsage?.externalHuman }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-xs text-gray-400">Redis Keys</div>
              <div class="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ info.redis?.keys || 0 }}
              </div>
            </div>
          </div>
        </div>

        <!-- 磁盘 -->

        <div class="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 flex items-center gap-2">
            <Icon icon="carbon:data-base" class="text-purple-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">磁盘</span>
          </div>
          <div v-if="!info.disks || info.disks.length === 0" class="py-4 text-center text-xs text-gray-400">
            暂无数据
          </div>
          <PerfectScrollbar v-else class="h-full max-h-[180px] space-y-3">
            <div v-for="d in info.disks" :key="d.mount" class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="font-mono text-gray-500">{{ d.mount }}</span>
                <span class="font-medium text-gray-700 dark:text-gray-200">{{ d.usage }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: d.usage + '%',
                    backgroundColor: getStatusColor(Number(d.usage)).stroke,
                  }"
                />
              </div>
              <div class="text-[10px] text-gray-400">{{ d.usedHuman }} / {{ d.totalHuman }}</div>
            </div>
          </PerfectScrollbar>
        </div>
      </div>

      <!-- ========== 系统信息 ========== -->
      <div class="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex items-center gap-2">
          <Icon icon="carbon:information" class="text-gray-500" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">系统信息</span>
        </div>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div
            v-for="item in sysItems"
            :key="item.label"
            class="flex items-start gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
          >
            <Icon :icon="item.icon" class="mt-0.5 flex-shrink-0 text-base text-gray-400" />
            <div class="min-w-0">
              <div class="text-[11px] text-gray-400">{{ item.label }}</div>
              <div class="mt-0.5 truncate text-xs font-medium text-gray-700 dark:text-gray-200" :title="item.value">
                {{ item.value || '-' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Scrollbar>
</template>

<style scoped>
/* 环形进度条动画 */
svg circle {
  transition: stroke-dashoffset 0.6s ease;
}
</style>
