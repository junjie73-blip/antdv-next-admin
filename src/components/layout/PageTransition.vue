<script setup lang="ts">
import { useMotion } from '@vueuse/motion'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAppStore } from '~/stores/modules/app'

import { getTransitionVariants, NO_MOTION_VARIANT, prefersReducedMotion } from './transitions'

defineOptions({ name: 'PageTransition' })

const appStore = useAppStore()
const route = useRoute()

const target = ref<HTMLElement>()

/**
 * 创建 motion 实例
 *
 * 说明：
 *  - variants 用"空模板"，实际动画通过 apply() 动态应用
 *  - 这样可以在不改 key、不重建 DOM 的情况下重放动画
 */
const { apply } = useMotion(target, {
  initial: { opacity: 1 },
  enter: { opacity: 1 },
})

/**
 * ⭐ 播放入场动画
 *
 * 步骤：
 *  1. 读取当前 effect 变体
 *  2. 立即应用 initial（回到起点）
 *  3. 下一帧应用 enter（触发过渡）
 */
async function playEnter() {
  if (!target.value) return

  const effect = appStore.transitionEffect

  // 减少动画 / effect 为空：直接显示
  if (prefersReducedMotion() || !effect || effect === ('none' as never)) {
    apply(NO_MOTION_VARIANT.initial)
    return
  }

  const { initial, enter } = getTransitionVariants(effect)

  // 1. 回到初始态（无过渡）
  apply({ ...initial, transition: { duration: 0 } })

  // 2. 等一帧，让浏览器完成 initial 的渲染
  await nextTick()
  requestAnimationFrame(() => {
    // 3. 应用 enter（带 transition）
    apply(enter)
  })
}

/* ============================================================
 * 触发时机
 * ============================================================ */

/** 首次进入 */
onMounted(() => {
  playEnter()
})

/** 路由变化（path + query 都算变化） */
watch(
  () => route.fullPath,
  () => {
    playEnter()
  },
  { flush: 'post' },
)

/** 用户切换动画效果 */
watch(
  () => appStore.transitionEffect,
  () => {
    playEnter()
  },
)
</script>

<template>
  <div ref="target" class="h-full will-change-transform">
    <slot />
  </div>
</template>
