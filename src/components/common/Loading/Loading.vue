<script setup lang="ts">
import type { LoadingProps } from './types'
import { Spin } from 'antdv-next'
import { computed } from 'vue'
import { cn } from '@/utils/cn'

/**
 * Loading 加载组件
 * 支持全屏和容器内两种模式
 */

const props = withDefaults(defineProps<LoadingProps>(), {
  size: 'default',
  absolute: false,
  loading: false,
  theme: 'light',
})

/**
 * 计算样式
 * 优先使用自定义背景色，否则使用主题色
 */
const getStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.background) {
    style.backgroundColor = props.background
  }
  return style
})

/**
 * 计算类名
 * 根据 absolute 属性决定全屏还是容器内模式
 * 根据 size 和 theme 应用不同的样式
 */
const wrapperClassName = computed(() => {
  return cn(
    'loading-wrapper',
    'flex flex-col items-center justify-center',
    'z-[9999] transition-all duration-300',
    // 全屏模式
    !props.absolute && 'fixed inset-0 w-screen h-screen',
    // 绝对定位模式（容器内）
    props.absolute && 'absolute inset-0 w-full h-full',
    // 尺寸
    props.size === 'small' && 'loading-small',
    props.size === 'large' && 'loading-large',
    // 主题背景色（仅当没有自定义背景时）
    !props.background && !props.absolute && props.theme === 'light' && 'bg-white/80',
    !props.background && !props.absolute && props.theme === 'dark' && 'bg-black/70 text-white',
    !props.background && props.absolute && props.theme === 'light' && 'bg-white/60',
    !props.background && props.absolute && props.theme === 'dark' && 'bg-black/50 text-white',
  )
})

/**
 * Spin 尺寸映射
 * 将 LoadingSize 映射到 Spin 组件的 size
 */
const spinSize = computed(() => {
  const sizeMap: Record<string, 'small' | 'default' | 'large'> = {
    small: 'small',
    default: 'default',
    large: 'large',
  }
  return sizeMap[props.size] || 'default'
})
</script>

<template>
  <Transition
    name="loading-fade"
    mode="out-in"
  >
    <div
      v-show="loading"
      :class="wrapperClassName"
      :style="getStyle"
    >
      <div class="loading-spin">
        <Spin :size="spinSize" />
      </div>
      <div
        v-if="tip"
        class="loading-tip mt-3 text-sm"
      >
        {{ tip }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 尺寸缩放 */
.loading-small .loading-spin {
  transform: scale(0.8);
}

.loading-large .loading-spin {
  transform: scale(1.2);
}

/* 过渡动画 */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>
