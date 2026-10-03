<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import { cn } from '~/utils/cn'

import type { CountToInstance, CountToProps } from './types'

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

// ============ 缓动函数 ============
const easingFunctions = {
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  linear: (t: number) => t,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
} as const

// ============ 状态 ============
const currentValue = ref(props.startVal)
const startTimestamp = ref<number | null>(null)

// ============ 格式化 ============
function formatNumber(num: number): string {
  const [integerPart, decimalPart] = num.toFixed(props.decimals).split('.')
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, props.separator)
  const decimalStr = decimalPart ? props.decimal + decimalPart : ''
  return `${props.prefix}${formatted}${decimalStr}${props.suffix}`
}

const displayValue = computed(() => formatNumber(currentValue.value))

// ============ 动画：useRafFn 自动管理 RAF 生命周期 ============
const { pause, resume, isActive } = useRafFn(
  ({ timestamp }) => {
    if (startTimestamp.value === null) startTimestamp.value = timestamp
    const progress = Math.min((timestamp - startTimestamp.value) / props.duration, 1)
    const eased = props.useEasing ? easingFunctions[props.easingFn](progress) : progress

    currentValue.value = props.startVal + (props.endVal - props.startVal) * eased
    emit('change', currentValue.value)

    if (progress >= 1) {
      currentValue.value = props.endVal
      pause()
      emit('finished')
    }
  },
  { immediate: false },
)

// ============ 对外方法 ============
function start() {
  if (isActive.value) return
  startTimestamp.value = null
  currentValue.value = props.startVal
  resume()
}

function pauseAnimation() {
  pause()
}

function reset() {
  pause()
  currentValue.value = props.startVal
  startTimestamp.value = null
}

// ============ 生命周期 ============
watch(
  () => props.endVal,
  () => {
    if (props.autoplay) {
      reset()
      start()
    }
  },
)

onMounted(() => {
  if (props.autoplay) start()
})

// useRafFn 会在组件卸载时自动 pause，无需手动 onUnmounted

defineExpose<CountToInstance>({
  start,
  pause: pauseAnimation,
  reset,
  getCurrentValue: () => currentValue.value,
})
</script>

<template>
  <span :class="cn('count-to', className)" :style="style">
    {{ displayValue }}
  </span>
</template>
