<script setup lang="ts">
import { computed } from 'vue'

import { useAppStore } from '~/stores/modules/app'
import { cn } from '~/utils/cn'

defineOptions({ name: 'WidgetButton' })
const appStore = useAppStore()

/** 按钮本体：圆形 + 固定尺寸 */
const buttonClass = computed(() =>
  cn(
    'widget-button group relative inline-flex items-center justify-center',
    'h-8 min-w-[32px] gap-1.5 px-2.5 cursor-pointer focus:outline-none',
    'rounded-full',
    'transition-colors duration-200',
    appStore.darkHeader
      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-ant-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-ant-primary',
  ),
)

/** 图标容器：负责旋转 */
const iconWrapperClass = computed(() =>
  cn(
    'flex h-full w-full items-center justify-center',
    'transform-gpu',
    'transition-[rotate] duration-500 ease-spring-rotate',
    'group-hover:rotate-[360deg]',
    'group-focus-visible:rotate-[360deg]',
  ),
)
</script>

<template>
  <button type="button" :class="buttonClass">
    <span :class="iconWrapperClass">
      <slot />
    </span>
  </button>
</template>
