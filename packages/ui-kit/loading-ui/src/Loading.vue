<script setup lang="ts">
import type { LoadingProps } from './types';

import { computed } from 'vue';

import { Spinner } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

/**
 * Loading 加载组件
 * 支持全屏和容器内两种模式
 */

const props = withDefaults(defineProps<LoadingProps>(), {
  size: 'default',
  absolute: false,
  loading: false,
  theme: 'light',
});

/**
 * 计算样式
 * 优先使用自定义背景色，否则使用主题色
 */
const getStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.background) {
    style.backgroundColor = props.background;
  }
  return style;
});

/**
 * 计算类名
 * 根据 absolute 属性决定全屏还是容器内模式
 * 根据 size 和 theme 应用不同的样式
 */
const wrapperClassName = computed(() => {
  return cn(
    'loading-wrapper',
    'flex flex-col items-center justify-center',
    'z-9999 transition-all duration-300',
    // 全屏模式
    !props.absolute && 'fixed inset-0 h-screen w-screen',
    // 绝对定位模式（容器内）
    props.absolute && 'absolute inset-0 size-full',
    // 尺寸钩子：宿主样式与 e2e 用 `.loading-small/.loading-large` 认档位
    props.size === 'small' && 'loading-small',
    props.size === 'large' && 'loading-large',
    // 主题背景色（仅当没有自定义背景时）
    !props.background &&
      !props.absolute &&
      props.theme === 'light' &&
      'bg-white/80',
    !props.background &&
      !props.absolute &&
      props.theme === 'dark' &&
      'bg-black/70 text-white',
    !props.background &&
      props.absolute &&
      props.theme === 'light' &&
      'bg-white/60',
    !props.background &&
      props.absolute &&
      props.theme === 'dark' &&
      'bg-black/50 text-white',
  );
});

/**
 * Spinner 尺寸
 * `Spinner` 只有 `class` 一个入口（它把 `cn('size-4 animate-spin', props.class)` 交给调用方），
 * 所以档位在这里换成等宽的 `size-*` 工具类，而不是早期版本对 antd `Spin` 做的 `transform: scale()` ——
 * scale 只放大视觉、不改占位，容器内模式会让遮罩层留出一圈空白。
 */
const spinnerClassName = computed(() =>
  cn(
    'animate-spin',
    props.size === 'small' && 'size-4',
    props.size === 'default' && 'size-6',
    props.size === 'large' && 'size-9',
  ),
);
</script>

<template>
  <Transition name="loading-fade" mode="out-in">
    <div v-show="loading" :class="wrapperClassName" :style="getStyle">
      <div class="loading-spin">
        <Spinner :class="spinnerClassName" />
      </div>
      <div v-if="tip" class="loading-tip mt-3 text-sm">
        {{ tip }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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
