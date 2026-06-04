<script setup lang="ts">
import type { ScrollbarInstance, ScrollbarPosition, ScrollbarProps } from './types'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
} from 'vue'
import { cn } from '@/utils/cn'

/**
 * Scrollbar - 自定义滚动条组件
 * 对标 Element Plus 的 el-scrollbar
 */

const props = withDefaults(defineProps<ScrollbarProps>(), {
  native: false,
  always: false,
  minSize: 20,
  barWidth: 6,
  smooth: true,
  noHorizontal: false,
  noVertical: false,
  tag: 'div',
})

const emit = defineEmits<{
  (e: 'scroll', position: ScrollbarPosition, event: Event): void
}>()

// 容器引用
const wrapRef = shallowRef<HTMLElement | null>(null)
const _viewRef = shallowRef<HTMLElement | null>(null)
const trackVerticalRef = shallowRef<HTMLElement | null>(null)
const thumbVerticalRef = shallowRef<HTMLElement | null>(null)
const trackHorizontalRef = shallowRef<HTMLElement | null>(null)
const thumbHorizontalRef = shallowRef<HTMLElement | null>(null)

// 滚动条状态
const visibleVertical = ref(false)
const visibleHorizontal = ref(false)
const thumbVerticalHeight = ref(0)
const thumbVerticalTop = ref(0)
const thumbHorizontalWidth = ref(0)
const thumbHorizontalLeft = ref(0)

// 拖拽状态
const isDraggingVertical = ref(false)
const isDraggingHorizontal = ref(false)
const dragStartY = ref(0)
const dragStartX = ref(0)
const dragStartScrollTop = ref(0)
const dragStartScrollLeft = ref(0)

/**
 * 计算容器样式
 */
const wrapStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  if (props.maxHeight) {
    style.maxHeight = typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight
  }

  return style
})

/**
 * 计算容器类名
 */
const wrapClassName = computed(() => {
  return cn(
    'scrollbar-wrap',
    'relative overflow-hidden',
    props.native ? 'overflow-auto' : 'overflow-hidden',
    props.wrapClass,
  )
})

/**
 * 计算视图类名
 */
const viewClassName = computed(() => {
  return cn(
    'scrollbar-view',
    props.native ? '' : 'h-full',
    props.viewClass,
  )
})

/**
 * 计算滚动条轨道样式
 */
const trackStyle = computed(() => {
  return {
    width: `${props.barWidth}px`,
    backgroundColor: props.trackColor || 'transparent',
  }
})

/**
 * 计算滚动条 thumb 样式
 */
const thumbStyle = computed(() => {
  return {
    width: `${props.barWidth}px`,
    backgroundColor: props.thumbColor || 'rgba(144, 147, 153, 0.3)',
    borderRadius: `${props.barWidth! / 2}px`,
  }
})

/**
 * 更新滚动条状态
 */
function update() {
  if (!wrapRef.value || props.native)
    return

  const wrap = wrapRef.value
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = wrap

  // 垂直滚动条
  if (!props.noVertical && scrollHeight > clientHeight) {
    visibleVertical.value = true
    const ratio = clientHeight / scrollHeight
    thumbVerticalHeight.value = Math.max(props.minSize!, clientHeight * ratio)
    thumbVerticalTop.value = (wrap.scrollTop / scrollHeight) * clientHeight
  }
  else {
    visibleVertical.value = false
  }

  // 水平滚动条
  if (!props.noHorizontal && scrollWidth > clientWidth) {
    visibleHorizontal.value = true
    const ratio = clientWidth / scrollWidth
    thumbHorizontalWidth.value = Math.max(props.minSize!, clientWidth * ratio)
    thumbHorizontalLeft.value = (wrap.scrollLeft / scrollWidth) * clientWidth
  }
  else {
    visibleHorizontal.value = false
  }
}

/**
 * 处理滚动事件
 */
function handleScroll(e: Event) {
  if (!wrapRef.value)
    return

  const { scrollTop, scrollLeft } = wrapRef.value

  // 更新 thumb 位置
  update()

  // 触发滚动事件
  emit('scroll', { scrollTop, scrollLeft }, e)
}

/**
 * 处理垂直滚动条点击
 */
function handleVerticalTrackClick(e: MouseEvent) {
  if (!wrapRef.value || !trackVerticalRef.value)
    return

  const rect = trackVerticalRef.value.getBoundingClientRect()
  const offsetY = e.clientY - rect.top
  const thumbHeight = thumbVerticalHeight.value
  const trackHeight = rect.height

  // 计算点击位置对应的滚动比例
  const ratio = (offsetY - thumbHeight / 2) / (trackHeight - thumbHeight)
  const scrollTop = ratio * (wrapRef.value.scrollHeight - wrapRef.value.clientHeight)

  wrapRef.value.scrollTop = Math.max(0, Math.min(scrollTop, wrapRef.value.scrollHeight - wrapRef.value.clientHeight))
}

/**
 * 处理水平滚动条点击
 */
function handleHorizontalTrackClick(e: MouseEvent) {
  if (!wrapRef.value || !trackHorizontalRef.value)
    return

  const rect = trackHorizontalRef.value.getBoundingClientRect()
  const offsetX = e.clientX - rect.left
  const thumbWidth = thumbHorizontalWidth.value
  const trackWidth = rect.width

  const ratio = (offsetX - thumbWidth / 2) / (trackWidth - thumbWidth)
  const scrollLeft = ratio * (wrapRef.value.scrollWidth - wrapRef.value.clientWidth)

  wrapRef.value.scrollLeft = Math.max(0, Math.min(scrollLeft, wrapRef.value.scrollWidth - wrapRef.value.clientWidth))
}

/**
 * 开始拖拽垂直滚动条
 */
function startDragVertical(e: MouseEvent) {
  e.stopPropagation()
  isDraggingVertical.value = true
  dragStartY.value = e.clientY
  dragStartScrollTop.value = wrapRef.value?.scrollTop || 0

  document.addEventListener('mousemove', handleDragVertical)
  document.addEventListener('mouseup', stopDragVertical)
}

/**
 * 拖拽垂直滚动条
 */
function handleDragVertical(e: MouseEvent) {
  if (!isDraggingVertical.value || !wrapRef.value || !trackVerticalRef.value)
    return

  const deltaY = e.clientY - dragStartY.value
  const trackHeight = trackVerticalRef.value.getBoundingClientRect().height
  const scrollRatio = deltaY / (trackHeight - thumbVerticalHeight.value)
  const scrollDelta = scrollRatio * (wrapRef.value.scrollHeight - wrapRef.value.clientHeight)

  wrapRef.value.scrollTop = dragStartScrollTop.value + scrollDelta
}

/**
 * 停止拖拽垂直滚动条
 */
function stopDragVertical() {
  isDraggingVertical.value = false
  document.removeEventListener('mousemove', handleDragVertical)
  document.removeEventListener('mouseup', stopDragVertical)
}

/**
 * 开始拖拽水平滚动条
 */
function startDragHorizontal(e: MouseEvent) {
  e.stopPropagation()
  isDraggingHorizontal.value = true
  dragStartX.value = e.clientX
  dragStartScrollLeft.value = wrapRef.value?.scrollLeft || 0

  document.addEventListener('mousemove', handleDragHorizontal)
  document.addEventListener('mouseup', stopDragHorizontal)
}

/**
 * 拖拽水平滚动条
 */
function handleDragHorizontal(e: MouseEvent) {
  if (!isDraggingHorizontal.value || !wrapRef.value || !trackHorizontalRef.value)
    return

  const deltaX = e.clientX - dragStartX.value
  const trackWidth = trackHorizontalRef.value.getBoundingClientRect().width
  const scrollRatio = deltaX / (trackWidth - thumbHorizontalWidth.value)
  const scrollDelta = scrollRatio * (wrapRef.value.scrollWidth - wrapRef.value.clientWidth)

  wrapRef.value.scrollLeft = dragStartScrollLeft.value + scrollDelta
}

/**
 * 停止拖拽水平滚动条
 */
function stopDragHorizontal() {
  isDraggingHorizontal.value = false
  document.removeEventListener('mousemove', handleDragHorizontal)
  document.removeEventListener('mouseup', stopDragHorizontal)
}

/**
 * 滚动到指定位置
 */
const scrollTo: ScrollbarInstance['scrollTo'] = (options, y) => {
  if (!wrapRef.value)
    return

  if (typeof options === 'number' && typeof y === 'number') {
    wrapRef.value.scrollTo(options, y)
  }
  else if (typeof options === 'object') {
    wrapRef.value.scrollTo(options)
  }
}

/**
 * 设置滚动位置
 */
const setScrollTop: ScrollbarInstance['setScrollTop'] = (top) => {
  if (wrapRef.value) {
    wrapRef.value.scrollTop = top
  }
}

/**
 * 设置水平滚动位置
 */
const setScrollLeft: ScrollbarInstance['setScrollLeft'] = (left) => {
  if (wrapRef.value) {
    wrapRef.value.scrollLeft = left
  }
}

/**
 * 获取滚动容器元素
 */
const getWrapRef: ScrollbarInstance['getWrapRef'] = () => {
  return wrapRef.value
}

// 监听尺寸变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  update()

  // 使用 ResizeObserver 监听尺寸变化
  if (window.ResizeObserver && wrapRef.value) {
    resizeObserver = new ResizeObserver(() => {
      nextTick(update)
    })
    resizeObserver.observe(wrapRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver && wrapRef.value) {
    resizeObserver.unobserve(wrapRef.value)
    resizeObserver = null
  }

  // 清理拖拽事件
  document.removeEventListener('mousemove', handleDragVertical)
  document.removeEventListener('mouseup', stopDragVertical)
  document.removeEventListener('mousemove', handleDragHorizontal)
  document.removeEventListener('mouseup', stopDragHorizontal)
})

// 暴露实例方法
defineExpose<ScrollbarInstance>({
  scrollTo,
  setScrollTop,
  setScrollLeft,
  update,
  getWrapRef,
})
</script>

<template>
  <div
    :class="wrapClassName"
    :style="[wrapStyle,
             wrapStyle]"
  >
    <!-- 内容区域 -->
    <component
      :is="tag"
      ref="wrapRef"
      :class="viewClassName"
      :style="[
        viewStyle,
        {
          overflow: native ? 'auto' : 'scroll',
          scrollbarWidth: native ? 'auto' : 'none',
          msOverflowStyle: native ? 'auto' : 'none',
        },
      ]"
      @scroll="handleScroll"
    >
      <slot />
    </component>

    <!-- 垂直滚动条 -->
    <div
      v-if="!native && !noVertical && (always || visibleVertical)"
      ref="trackVerticalRef"
      :class="cn(
        'scrollbar-track-vertical',
        'absolute right-0 top-0 bottom-0 z-10',
        'transition-opacity duration-200',
        !always && !visibleVertical && 'opacity-0',
        always && 'opacity-100',
      )"
      :style="trackStyle"
      @click="handleVerticalTrackClick"
    >
      <div
        ref="thumbVerticalRef"
        :class="cn(
          'scrollbar-thumb-vertical',
          'absolute cursor-pointer',
          'hover:bg-opacity-50 transition-colors',
          isDraggingVertical && 'bg-opacity-60',
        )"
        :style="[
          thumbStyle,
          {
            height: `${thumbVerticalHeight}px`,
            top: `${thumbVerticalTop}px`,
          },
        ]"
        @mousedown="startDragVertical"
      />
    </div>

    <!-- 水平滚动条 -->
    <div
      v-if="!native && !noHorizontal && (always || visibleHorizontal)"
      ref="trackHorizontalRef"
      :class="cn(
        'scrollbar-track-horizontal',
        'absolute left-0 bottom-0 right-0 z-10',
        'transition-opacity duration-200',
        !always && !visibleHorizontal && 'opacity-0',
        always && 'opacity-100',
      )"
      :style="{ ...trackStyle, height: `${barWidth}px`, width: 'auto' }"
      @click="handleHorizontalTrackClick"
    >
      <div
        ref="thumbHorizontalRef"
        :class="cn(
          'scrollbar-thumb-horizontal',
          'absolute cursor-pointer',
          'hover:bg-opacity-50 transition-colors',
          isDraggingHorizontal && 'bg-opacity-60',
        )"
        :style="[
          thumbStyle,
          {
            width: `${thumbHorizontalWidth}px`,
            left: `${thumbHorizontalLeft}px`,
          },
        ]"
        @mousedown="startDragHorizontal"
      />
    </div>
  </div>
</template>

<style scoped>
/* 隐藏原生滚动条 */
.scrollbar-view::-webkit-scrollbar {
  display: none;
}

/* 滚动条轨道悬停效果 */
.scrollbar-track-vertical:hover,
.scrollbar-track-horizontal:hover {
  background-color: rgba(144, 147, 153, 0.1);
}

/* 滚动条 thumb 悬停效果 */
.scrollbar-thumb-vertical:hover,
.scrollbar-thumb-horizontal:hover {
  background-color: rgba(144, 147, 153, 0.5) !important;
}
</style>
