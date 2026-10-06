<script setup lang="ts">
import { usePreferredReducedMotion, useRafFn } from '@vueuse/core'
import { useMotion } from '@vueuse/motion'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAppStore } from '~/stores/modules/app'

import { getTransitionVariants, NO_MOTION_VARIANT } from './transitions'

defineOptions({ name: 'PageTransition' })

const appStore = useAppStore()
const route = useRoute()

const target = ref<HTMLElement>()

const { apply } = useMotion(target, {
  initial: { opacity: 1 },
  enter: { opacity: 1 },
})

// usePreferredReducedMotion：响应式检测用户偏好
const reducedMotion = usePreferredReducedMotion()
const isReducedMotion = () => reducedMotion.value === 'reduce'

// useRafFn：注册一次性 raf 回调
const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  () => {
    const effect = appStore.transitionEffect
    if (isReducedMotion() || !effect || effect === ('none' as never)) {
      pauseRaf()
      return
    }
    const { enter } = getTransitionVariants(effect)
    apply(enter)
    pauseRaf()
  },
  { immediate: false },
)

async function playEnter() {
  if (!target.value) return

  const effect = appStore.transitionEffect

  if (isReducedMotion() || !effect || effect === ('none' as never)) {
    apply(NO_MOTION_VARIANT.initial)
    return
  }

  const { initial } = getTransitionVariants(effect)

  // 1. 回到起点（无过渡）
  apply({ ...initial, transition: { duration: 0 } })

  // 2. 等一帧
  await nextTick()

  // 3. 用 useRafFn 触发 enter（自动管理 raf 生命周期）
  resumeRaf()
}

onMounted(playEnter)

watch(() => route.fullPath, playEnter, { flush: 'post' })
watch(() => appStore.transitionEffect, playEnter)
</script>

<template>
  <div ref="target" class="h-full will-change-transform">
    <slot />
  </div>
</template>
