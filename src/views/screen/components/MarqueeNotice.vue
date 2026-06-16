<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{
  /** 公告列表 */
  items?: string[]
  /** 滚动速度(px/s) */
  speed?: number
}>(), {
  items: () => [],
  speed: 40,
})

defineOptions({ name: 'MarqueeNotice' })

const containerClassName = cn(
  'overflow-hidden whitespace-nowrap cursor-pointer',
  'hover:pause',
)

const contentRef = ref<HTMLDivElement>()
let animationId: number | null = null

function animate() {
  const el = contentRef.value
  if (!el)
    return

  let start: number | null = null
  function step(timestamp: number) {
    if (start === null)
      start = timestamp
    const elapsed = timestamp - start
    // 循环滚动
    const maxScroll = el.scrollWidth / 2
    const offset = ((elapsed / 1000) * props.speed) % maxScroll
    el.style.transform = `translateX(-${offset}px)`
    animationId = requestAnimationFrame(step)
  }
  animationId = requestAnimationFrame(step)
}

onMounted(() => {
  // 延迟启动确保 DOM 渲染完成
  setTimeout(animate, 100)
})

onUnmounted(() => {
  if (animationId !== null)
    cancelAnimationFrame(animationId)
})
</script>

<template>
  <div :class="containerClassName">
    <div
      ref="contentRef"
      class="inline-flex"
    >
      <!-- 双份内容实现无缝循环 -->
      <div
        v-for="(item, i) in [...items,
                             ...items]"
        :key="i"
        class="flex-shrink-0 px-6 py-1.5"
      >
        <span class="text-xs text-blue-200/70 flex items-center gap-1.5">
          <span class="w-1 h-1 bg-yellow-400 rounded-full shrink-0" />
          {{ item }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover\:pause:hover {
  animation-play-state: paused;
}
</style>
