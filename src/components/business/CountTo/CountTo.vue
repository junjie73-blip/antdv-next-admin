<script setup lang="ts">
import type { CountToInstance, CountToProps } from './types'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { cn } from '@/utils/cn'

/**
 * CountTo - 数字动画组件
 * 对标 Vben Admin 的 CountTo 组件
 */

const props = withDefaults(defineProps<CountToProps>(), {
  startVal: 0,
  endVal: 0,
  duration: 2000,
  autoplay: true,
  decimals: 0,
  decimal: '.',
  separator: ',',
  prefix: '',
  suffix: '',
  useEasing: true,
  easingFn: 'easeOutExpo',
})

const emit = defineEmits<{
  (e: 'finished'): void
  (e: 'change', value: number): void
}>()

// 当前值
const currentValue = ref(props.startVal)
// 动画状态
const isAnimating = ref(false)
// 动画 ID
let animationId: number | null = null
// 开始时间
let startTime: number | null = null

/**
 * 缓动函数
 */
const easingFunctions = {
  // 指数缓出
  easeOutExpo: (t: number): number => {
    return t === 1 ? 1 : 1 - 2 ** (-10 * t)
  },
  // 线性
  linear: (t: number): number => {
    return t
  },
  // 三次缓入缓出
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  },
}

/**
 * 格式化数字
 */
function formatNumber(num: number): string {
  const value = num.toFixed(props.decimals)
  const parts = value.split('.')
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, props.separator)
  const decimalPart = parts[1] ? props.decimal + parts[1] : ''
  return props.prefix + integerPart + decimalPart + props.suffix
}

/**
 * 显示值
 */
const displayValue = computed(() => formatNumber(currentValue.value))

/**
 * 动画循环
 */
function animate(timestamp: number) {
  if (!startTime)
    startTime = timestamp
  const progress = Math.min((timestamp - startTime) / props.duration, 1)

  // 应用缓动函数
  const easeProgress = props.useEasing
    ? easingFunctions[props.easingFn](progress)
    : progress

  // 计算当前值
  currentValue.value = props.startVal + (props.endVal - props.startVal) * easeProgress

  // 触发变化事件
  emit('change', currentValue.value)

  if (progress < 1) {
    animationId = requestAnimationFrame(animate)
  }
  else {
    // 动画结束
    currentValue.value = props.endVal
    isAnimating.value = false
    emit('finished')
  }
}

/**
 * 开始动画
 */
function start() {
  if (isAnimating.value)
    return
  isAnimating.value = true
  startTime = null
  currentValue.value = props.startVal
  animationId = requestAnimationFrame(animate)
}

/**
 * 暂停动画
 */
function pause() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
    isAnimating.value = false
  }
}

/**
 * 重置动画
 */
function reset() {
  pause()
  currentValue.value = props.startVal
  startTime = null
}

/**
 * 获取当前值
 */
const getCurrentValue = () => currentValue.value

// 监听 endVal 变化
watch(
  () => props.endVal,
  () => {
    if (props.autoplay) {
      reset()
      start()
    }
  },
)

// 组件挂载时自动播放
onMounted(() => {
  if (props.autoplay) {
    start()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  pause()
})

// 暴露实例方法
defineExpose<CountToInstance>({
  start,
  pause,
  reset,
  getCurrentValue,
})
</script>

<template>
  <span
    :class="cn('count-to', className)"
    :style="style"
  >
    {{ displayValue }}
  </span>
</template>
