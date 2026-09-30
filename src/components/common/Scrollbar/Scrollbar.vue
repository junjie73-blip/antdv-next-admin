<template>
  <div :class="['group/scrollbar relative overflow-hidden', rootClass ?? 'h-full']" :style="rootStyle">
    <div
      ref="wrap"
      :class="[
        wrapClass,
        'scrollbar__wrap h-full min-h-0 w-full overflow-auto',
        native ? '' : 'scrollbar__wrap--hidden-default',
      ]"
      :style="wrapStyle"
    >
      <component :is="tag" ref="resize" :class="['scrollbar__view', viewClass]" :style="viewStyle">
        <slot />
      </component>
    </div>

    <template v-if="!native">
      <bar :move="moveX" :size="sizeWidth" :class="['scrollbar__bar is-horizontal', barVisibleClass]" />
      <bar vertical :move="moveY" :size="sizeHeight" :class="['scrollbar__bar is-vertical', barVisibleClass]" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { unrefElement, useEventListener, useResizeObserver } from '@vueuse/core'
import { clamp, isNumber } from 'es-toolkit'
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue'

import { projectConfig } from '~/config/project'

import type { ScrollbarProps } from './types'

import Bar from './bar'
import { useResponsiveMaxHeight } from './useResponsiveMaxHeight'

defineOptions({ name: 'Scrollbar' })

const props = withDefaults(defineProps<ScrollbarProps>(), {
  native: () => projectConfig.scrollbar?.native ?? false,
  wrapStyle: '',
  wrapClass: '',
  viewClass: '',
  viewStyle: '',
  noresize: false,
  tag: 'div',
  always: false,
  minSize: 20,
  scrollHeight: 0,
  maxHeight: undefined,
  rootClass: undefined,
})

const emit = defineEmits<{
  (e: 'scroll', payload: { scrollTop: number; scrollLeft: number }): void
}>()
const responsiveMaxHeight = useResponsiveMaxHeight({
  referenceMaxHeight: isNumber(props.maxHeight) ? props.maxHeight : 495,
})
const sizeWidth = ref('0')
const sizeHeight = ref('0')
const moveX = ref(0)
const moveY = ref(0)
const wrap = ref<HTMLElement>()
const resize = ref<HTMLElement>()

provide('scroll-bar-wrap', wrap)

const customScrollbarEnabled = computed(() => !props.native)

const barVisibleClass = computed(() =>
  props.always
    ? 'opacity-100'
    : 'opacity-0 transition-opacity duration-[80ms] group-hover/scrollbar:opacity-100 group-hover/scrollbar:duration-[340ms]',
)

/** ⭐ 把 maxHeight 应用到最外层容器，实现“根据分辨率自适应高度” */
const rootStyle = computed<Record<string, string>>(() => {
  if (props.maxHeight == null) return {}
  return {
    maxHeight: responsiveMaxHeight.maxHeightPx.value,
    height: `min(100%, ${responsiveMaxHeight.maxHeightPx.value})`,
  }
})

const handleScroll = () => {
  const el = unrefElement(wrap)
  if (!el) return

  if (customScrollbarEnabled.value) {
    moveY.value = el.clientHeight ? (el.scrollTop * 100) / el.clientHeight : 0
    moveX.value = el.clientWidth ? (el.scrollLeft * 100) / el.clientWidth : 0
  }

  emit('scroll', { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft })
}

const update = () => {
  const el = unrefElement(wrap)
  if (!el) return

  const { clientHeight, clientWidth, scrollHeight, scrollWidth } = el

  // 容器还没有高度时，不写入 size，等 ResizeObserver 再触发
  if (!clientHeight || !clientWidth) return
  if (!scrollHeight || !scrollWidth) return

  const heightPercentage = (clientHeight * 100) / scrollHeight
  const widthPercentage = (clientWidth * 100) / scrollWidth
  const minSize = clamp(props.minSize, 0, 100)

  sizeHeight.value = heightPercentage < 100 ? `${Math.max(heightPercentage, minSize)}%` : ''
  sizeWidth.value = widthPercentage < 100 ? `${Math.max(widthPercentage, minSize)}%` : ''
}

// ---------------- 滚动监听（passive） ----------------
useEventListener(wrap, 'scroll', handleScroll, { passive: true })

// ---------------- 尺寸监听 ----------------
const shouldObserveResize = () => customScrollbarEnabled.value && !props.noresize

useResizeObserver(wrap, () => {
  if (shouldObserveResize()) update()
})

useResizeObserver(resize, () => {
  if (shouldObserveResize()) update()
})

useEventListener('resize', () => {
  if (shouldObserveResize()) update()
})

// ---------------- 外部通过 scrollHeight 强制刷新 ----------------
watch(
  () => props.scrollHeight,
  () => {
    if (!customScrollbarEnabled.value) return
    update()
  },
)

// ---------------- 挂载后多时机兜底重算 ----------------
onMounted(() => {
  if (!customScrollbarEnabled.value) return

  const safeUpdate = () => {
    try {
      update()
    } catch {
      /* noop */
    }
  }

  // 三层兜底，解决：display:none → 显示、SSR 水合后、父级高度延迟就绪
  nextTick(safeUpdate)
  requestAnimationFrame(safeUpdate)
  setTimeout(safeUpdate, 50)
})

// ---------------- 对外 API ----------------
const setScrollTop = (value: number) => {
  if (!isNumber(value)) return
  const el = unrefElement(wrap)
  if (el) el.scrollTop = value
}

const setScrollLeft = (value: number) => {
  if (!isNumber(value)) return
  const el = unrefElement(wrap)
  if (el) el.scrollLeft = value
}

const scrollTo = (options: ScrollToOptions) => {
  unrefElement(wrap)?.scrollTo(options)
}

defineExpose({
  wrap,
  update,
  setScrollTop,
  setScrollLeft,
  scrollTo,
  handleScroll,
})
</script>
