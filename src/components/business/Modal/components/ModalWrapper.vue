<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

import { cn } from '~/utils/cn'

const props = defineProps({
  loading: Boolean,
  loadingTip: String,
  minHeight: Number,
  height: Number,
  footerOffset: {
    type: Number,
    default: 0,
  },
  visible: Boolean,
  useWrapper: {
    type: Boolean,
    default: true,
  },
})

// useWindowSize：视口高度响应式，窗口缩放自动更新
const { height: windowHeight } = useWindowSize()

const wrapperStyle = computed(() => {
  if (!props.useWrapper) return {}

  if (props.height) {
    return { height: `${props.height}px` }
  }

  const maxHeight = windowHeight.value - 200 - props.footerOffset

  return {
    maxHeight: `${maxHeight}px`,
    minHeight: props.minHeight ? `${props.minHeight}px` : '200px',
  }
})

const bodyStyle = computed(() => ({ maxHeight: '100%' }))
</script>

<template>
  <div :class="cn('modal-wrapper', 'relative')" :style="wrapperStyle">
    <div
      v-if="loading"
      :class="
        cn(
          'absolute inset-0 z-10 flex items-center justify-center',
          'bg-white/80 backdrop-blur-sm',
        )
      "
    >
      <div :class="cn('flex flex-col items-center gap-2')">
        <div
          :class="
            cn(
              'h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent',
            )
          "
        />
        <span v-if="loadingTip" :class="cn('text-sm text-gray-600')">{{
          loadingTip
        }}</span>
      </div>
    </div>

    <Scrollbar :class="cn('modal-body', 'p-6')" :style="bodyStyle">
      <slot />
    </Scrollbar>
  </div>
</template>
