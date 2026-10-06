import { unrefElement, useEventListener, tryOnScopeDispose } from '@vueuse/core'
import { clamp, isNil } from 'es-toolkit'
import { computed, defineComponent, h, inject, ref } from 'vue'

import type { ScrollbarWrapRef } from './types'

import { BAR_MAP, renderThumbStyle } from './util'

export default defineComponent({
  name: 'Bar',
  props: {
    vertical: Boolean,
    size: String,
    move: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const thumb = ref<HTMLElement>()
    const track = ref<HTMLElement>()
    const wrap = inject<ScrollbarWrapRef>('scroll-bar-wrap')

    const bar = computed(
      () => BAR_MAP[props.vertical ? 'vertical' : 'horizontal'],
    )

    /** 是否处于拖动状态 */
    const cursorDown = ref(false)
    /** 记录按下 thumb 时的内部偏移量（X / Y 分开缓存） */
    const barStore: Record<'X' | 'Y', number> = { X: 0, Y: 0 }

    /** 统一解析当前 DOM 引用，避免各处理函数里重复判断 */
    const resolveElements = () => ({
      wrapEl: wrap ? unrefElement(wrap) : undefined,
      trackEl: track.value,
      thumbEl: thumb.value,
    })

    /** 按百分比把滚动容器的位置滚动到对应位置 */
    const scrollTo = (percentage: number) => {
      const { wrapEl } = resolveElements()
      if (!wrapEl) return
      const p = clamp(percentage, 0, 100)
      if (props.vertical) {
        wrapEl.scrollTop = (p * wrapEl.scrollHeight) / 100
      } else {
        wrapEl.scrollLeft = (p * wrapEl.scrollWidth) / 100
      }
    }

    const getPointer = (e: MouseEvent) =>
      props.vertical ? e.clientY : e.clientX

    const getTrackStart = (rect: DOMRect) =>
      props.vertical ? rect.top : rect.left

    const mouseMoveDocumentHandler = (e: MouseEvent) => {
      if (!cursorDown.value) return

      const { trackEl, thumbEl } = resolveElements()
      if (!trackEl || !thumbEl) return

      const prevPage = barStore[bar.value.axis]
      // isNil 替代 `!prevPage`，避免 0 值被误判
      if (isNil(prevPage) || prevPage === 0) return

      const trackRect = trackEl.getBoundingClientRect()
      const pointer = getPointer(e)
      const trackStart = getTrackStart(trackRect)
      const trackSize = props.vertical
        ? trackEl.offsetHeight
        : trackEl.offsetWidth
      const thumbSize = props.vertical
        ? thumbEl.offsetHeight
        : thumbEl.offsetWidth

      const offset = (trackStart - pointer) * -1
      const thumbClickPosition = thumbSize - prevPage
      const percentage = ((offset - thumbClickPosition) * 100) / trackSize

      scrollTo(percentage)
    }

    const mouseUpDocumentHandler = () => {
      cursorDown.value = false
      barStore[bar.value.axis] = 0
      document.onselectstart = null
    }

    const startDrag = (e: MouseEvent) => {
      e.stopImmediatePropagation()
      cursorDown.value = true
      document.onselectstart = () => false
    }

    const clickThumbHandler = (e: MouseEvent) => {
      // 忽略右键与 ctrl + 左键
      if (e.ctrlKey || e.button === 2) return

      window.getSelection()?.removeAllRanges()
      startDrag(e)

      const { thumbEl } = resolveElements()
      if (!thumbEl) return

      const pointer = getPointer(e)
      const rect = thumbEl.getBoundingClientRect()
      const thumbStart = props.vertical ? rect.top : rect.left
      const thumbSize = props.vertical
        ? thumbEl.offsetHeight
        : thumbEl.offsetWidth

      barStore[bar.value.axis] = thumbSize - (pointer - thumbStart)
    }

    const clickTrackHandler = (e: MouseEvent) => {
      const { trackEl, thumbEl } = resolveElements()
      if (!trackEl || !thumbEl) return

      const trackRect = trackEl.getBoundingClientRect()
      const pointer = getPointer(e)
      const trackStart = getTrackStart(trackRect)
      const trackSize = props.vertical
        ? trackEl.offsetHeight
        : trackEl.offsetWidth
      const thumbSize = props.vertical
        ? thumbEl.offsetHeight
        : thumbEl.offsetWidth

      const offset = Math.abs(trackStart - pointer)
      const thumbHalf = thumbSize / 2
      const percentage = ((offset - thumbHalf) * 100) / trackSize

      scrollTo(percentage)
    }

    // useEventListener：VueUse 会在组件卸载时自动移除监听，无需手动 off
    useEventListener(document, 'mousemove', mouseMoveDocumentHandler)
    useEventListener(document, 'mouseup', mouseUpDocumentHandler)

    // tryOnScopeDispose：effect scope 销毁时也会触发（比 onBeforeUnmount 更全面）
    tryOnScopeDispose(() => {
      document.onselectstart = null
    })

    return () =>
      h(
        'div',
        {
          ref: track,
          class: ['scrollbar__bar', `is-${bar.value.key}`],
          onMousedown: clickTrackHandler,
        },
        h('div', {
          ref: thumb,
          class: 'scrollbar__thumb',
          style: renderThumbStyle({
            size: props.size,
            move: props.move,
            bar: bar.value,
          }),
          onMousedown: clickThumbHandler,
        }),
      )
  },
})
