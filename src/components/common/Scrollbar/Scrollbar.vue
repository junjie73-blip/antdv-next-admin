<template>
  <div class="group/scrollbar relative h-full overflow-hidden">
    <div
      ref="wrap"
      :class="[wrapClass, 'scrollbar__wrap h-full overflow-auto', native ? '' : 'scrollbar__wrap--hidden-default']"
      :style="wrapStyle"
      @scroll="handleScroll"
    >
      <component :is="tag" ref="resize" :class="['scrollbar__view', viewClass]" :style="viewStyle">
        <slot></slot>
      </component>
    </div>
    <template v-if="!native">
      <bar
        :move="moveX"
        :size="sizeWidth"
        class="scrollbar__bar is-horizontal opacity-0 transition-opacity duration-[80ms] group-hover/scrollbar:opacity-100 group-hover/scrollbar:duration-[340ms]"
      />
      <bar
        vertical
        :move="moveY"
        :size="sizeHeight"
        class="scrollbar__bar is-vertical opacity-0 transition-opacity duration-[80ms] group-hover/scrollbar:opacity-100 group-hover/scrollbar:duration-[340ms]"
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, type PropType, provide, ref, type StyleValue, unref, watch } from 'vue'

import { projectConfig } from '~/config/project'
import { addResizeListener, removeResizeListener } from '~/utils'

import Bar from './bar'

defineOptions({ name: 'Scrollbar' })

const props = defineProps({
  native: {
    type: Boolean,
    default: projectConfig.scrollbar?.native ?? false,
  },
  wrapStyle: {
    type: [String, Array, Object] as PropType<StyleValue>,
    default: '',
  },
  wrapClass: {
    type: [String, Array],
    default: '',
  },
  viewClass: {
    type: [String, Array],
    default: '',
  },
  viewStyle: {
    type: [String, Array],
    default: '',
  },
  noresize: Boolean, // 如果 container 尺寸不会发生变化，最好设置它可以优化性能
  tag: {
    type: String,
    default: 'div',
  },
  scrollHeight: {
    // 用于监控内部scrollHeight的变化
    type: Number,
    default: 0,
  },
})

const sizeWidth = ref('0')
const sizeHeight = ref('0')
const moveX = ref(0)
const moveY = ref(0)
const wrap = ref()
const resize = ref()

provide('scroll-bar-wrap', wrap)

const handleScroll = () => {
  if (!props.native) {
    moveY.value = (unref(wrap).scrollTop * 100) / unref(wrap).clientHeight
    moveX.value = (unref(wrap).scrollLeft * 100) / unref(wrap).clientWidth
  }
}

const update = () => {
  if (!unref(wrap)) return

  const heightPercentage = (unref(wrap).clientHeight * 100) / unref(wrap).scrollHeight
  const widthPercentage = (unref(wrap).clientWidth * 100) / unref(wrap).scrollWidth

  sizeHeight.value = heightPercentage < 100 ? heightPercentage + '%' : ''
  sizeWidth.value = widthPercentage < 100 ? widthPercentage + '%' : ''
}

watch(
  () => props.scrollHeight,
  () => {
    if (props.native) return
    update()
  },
)

defineExpose({
  wrap,
})

onMounted(() => {
  if (props.native) return
  nextTick(update)
  if (!props.noresize) {
    addResizeListener(unref(resize), update)
    addResizeListener(unref(wrap), update)
    addEventListener('resize', update)
  }
})

onBeforeUnmount(() => {
  if (props.native) return
  if (!props.noresize) {
    removeResizeListener(unref(resize), update)
    removeResizeListener(unref(wrap), update)
    removeEventListener('resize', update)
  }
})
</script>
