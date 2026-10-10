<script setup lang="ts">
import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'ScreenCard' });

withDefaults(
  defineProps<{
    /** 卡片标题 */
    title?: string;
    /** 是否显示标题栏发光边框效果 */
    glow?: boolean;
    /** 内容区域额外类名 */
    bodyClass?: string;
  }>(),
  {
    glow: true,
  },
);

const containerClassName = cn(
  'relative overflow-hidden rounded-lg',
  'border border-blue-500/20 bg-blue-950/40 backdrop-blur-sm',
  'transition-all duration-300 hover:border-blue-400/30',
);
const headerClassName = cn(
  'flex items-center gap-2 border-b border-blue-500/15 px-4 py-2.5',
  'bg-linear-to-r from-blue-600/8 to-transparent',
);
const headerTitleClassName = cn(
  'text-sm font-medium tracking-wide text-blue-200/90',
);
</script>

<template>
  <div :class="containerClassName">
    <!-- 标题栏 -->
    <div v-if="$slots.header || title" :class="headerClassName">
      <slot name="header">
        <span class="h-3.5 w-1 rounded-sm bg-blue-400/70"></span>
        <span :class="headerTitleClassName">{{ title }}</span>
      </slot>
    </div>

    <!-- 内容区域 -->
    <div :class="cn('p-4', bodyClass)">
      <slot></slot>
    </div>

    <!-- 装饰角标 -->
    <span
      v-if="glow"
      class="absolute top-0 left-0 h-3 w-3 rounded-tl border-t border-l border-blue-400/40"
    ></span>
    <span
      v-if="glow"
      class="absolute top-0 right-0 h-3 w-3 rounded-tr border-t border-r border-blue-400/40"
    ></span>
    <span
      v-if="glow"
      class="absolute bottom-0 left-0 h-3 w-3 rounded-bl border-b border-l border-blue-400/40"
    ></span>
    <span
      v-if="glow"
      class="absolute right-0 bottom-0 h-3 w-3 rounded-br border-r border-b border-blue-400/40"
    ></span>
  </div>
</template>
