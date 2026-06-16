<script setup lang="ts">
import dayjs from 'dayjs'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{
  /** 大屏标题 */
  title?: string
  /** 是否显示全屏按钮 */
  showFullscreen?: boolean
}>(), {
  title: '数据监控中心',
  showFullscreen: true,
})

defineOptions({ name: 'ScreenHeader' })

const containerClassName = cn(
  'flex items-center justify-between h-14 px-6 select-none',
  'bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10',
  'border-b border-blue-500/20',
)
const titleClassName = cn('text-xl font-bold tracking-wider text-white flex items-center gap-2')
const timeClassName = cn('text-sm text-blue-200/80 font-mono tabular-nums')
const actionBtnClassName = cn(
  'inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded text-xs border transition-all duration-200 cursor-pointer',
  'text-blue-300/70 border-blue-500/30 hover:text-blue-100 hover:border-blue-400/60 hover:bg-blue-500/10',
)

const currentTime = ref('')
const isFullscreen = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function updateTime() {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss dddd')
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  }
  else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onBeforeUnmount(() => {
  if (timer)
    clearInterval(timer)
  document.removeEventListener('fullscreenchange', () => {})
})
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧：标题 -->
    <div :class="titleClassName">
      <span class="w-1.5 h-6 bg-blue-400 rounded-full" />
      {{ title }}
      <span class="text-[10px] text-blue-300/50 ml-2 tracking-widest">SECURITY MONITOR</span>
    </div>

    <!-- 中间：时间 -->
    <div class="absolute left-1/2 -translate-x-1/2">
      <div :class="timeClassName">
        {{ currentTime }}
      </div>
    </div>

    <!-- 右侧：操作按钮 -->
    <div
      v-if="showFullscreen"
      class="flex items-center gap-3"
    >
      <button
        :class="actionBtnClassName"
        @click="toggleFullscreen"
      >
        <FullscreenOutlined v-if="!isFullscreen" class="text-xs" />
        <FullscreenExitOutlined v-else class="text-xs" />
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
      <button :class="actionBtnClassName">
        <SettingOutlined class="text-xs" />
        设置
      </button>
    </div>
  </div>
</template>
