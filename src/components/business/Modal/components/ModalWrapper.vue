<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/utils/cn'

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

// 计算 wrapper 样式
const wrapperStyle = computed(() => {
  if (!props.useWrapper)
    return {}

  if (props.height) {
    return {
      height: `${props.height}px`,
    }
  }

  // 视口高度 - 顶部间距 - 底部间距 - footerOffset
  const maxHeight = window.innerHeight - 200 - props.footerOffset

  return {
    maxHeight: `${maxHeight}px`,
    minHeight: props.minHeight ? `${props.minHeight}px` : '200px',
  }
})

// 内容区域样式
const bodyStyle = computed(() => ({
  overflow: 'auto',
  maxHeight: '100%',
}))
</script>

<template>
  <div
    :class="cn('modal-wrapper', 'relative')"
    :style="wrapperStyle"
  >
    <!-- Loading 遮罩 -->
    <div
      v-if="loading"
      :class="cn(
        'absolute inset-0 z-10 flex items-center justify-center',
        'bg-white/80 backdrop-blur-sm',
      )"
    >
      <div :class="cn('flex flex-col items-center gap-2')">
        <div :class="cn('w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin')" />
        <span
          v-if="loadingTip"
          :class="cn('text-gray-600 text-sm')"
        >{{ loadingTip }}</span>
      </div>
    </div>

    <!-- 内容区域 -->
    <div
      :class="cn('modal-body', 'p-6')"
      :style="bodyStyle"
    >
      <slot />
    </div>
  </div>
</template>
