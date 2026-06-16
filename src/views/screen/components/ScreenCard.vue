<script setup lang="ts">
import { cn } from '@/utils/cn'

withDefaults(defineProps<{
  /** 卡片标题 */
  title?: string
  /** 是否显示标题栏发光边框效果 */
  glow?: boolean
}>(), {
  glow: true,
})

defineOptions({ name: 'ScreenCard' })

const containerClassName = cn(
  'rounded-lg overflow-hidden relative',
  'bg-blue-950/40 backdrop-blur-sm border border-blue-500/20',
  'transition-all duration-300 hover:border-blue-400/30',
)
const headerClassName = cn(
  'flex items-center gap-2 px-4 py-2.5 border-b border-blue-500/15',
  'bg-gradient-to-r from-blue-600/8 to-transparent',
)
const headerTitleClassName = cn('text-sm font-medium text-blue-200/90 tracking-wide')
</script>

<template>
  <div :class="containerClassName">
    <!-- 标题栏 -->
    <div
      v-if="$slots.header || title"
      :class="headerClassName"
    >
      <slot name="header">
        <span class="w-1 h-3.5 bg-blue-400/70 rounded-sm" />
        <span :class="headerTitleClassName">{{ title }}</span>
      </slot>
    </div>

    <!-- 内容区域 -->
    <div class="p-4">
      <slot />
    </div>

    <!-- 装饰角标 -->
    <span
      v-if="glow"
      class="absolute top-0 left-0 w-3 h-3 border-l border-t border-blue-400/40 rounded-tl"
    />
    <span
      v-if="glow"
      class="absolute top-0 right-0 w-3 h-3 border-r border-t border-blue-400/40 rounded-tr"
    />
    <span
      v-if="glow"
      class="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-blue-400/40 rounded-bl"
    />
    <span
      v-if="glow"
      class="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-blue-400/40 rounded-br"
    />
  </div>
</template>
