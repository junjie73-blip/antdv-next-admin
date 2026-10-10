<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@antdv/shared/cn';
import { useAppStore } from '~/stores/modules/app';

defineOptions({ name: 'WidgetButton' });

/**
 * `label` 同时喂 `aria-label` 与 `title`：
 * 顶栏这些按钮只有一个图标、没有可读文本，读屏软件念不出任何东西，
 * 自动化用例也只能靠 `data-testid` 硬找（此前退出登录就是这么绕过去的）。
 * 给个名字比加 testid 更值：既补了无障碍，也让选择器跟着界面文案走。
 */
const props = defineProps<{
  /** 弹层当前是否展开：用于给按钮一个"按下"的持久态 */
  active?: boolean;
  /** 按钮名称（中文短语），同时作为 aria-label 与 tooltip */
  label?: string;
}>();

const appStore = useAppStore();

/** 按钮本体：圆形 + 固定尺寸 */
const buttonClass = computed(() =>
  cn(
    'group widget-button relative inline-flex items-center justify-center',
    'h-8 min-w-[32px] cursor-pointer gap-1.5 px-2.5 focus:outline-none',
    'rounded-full',
    'transition-colors duration-200',
    appStore.darkHeader
      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
      : 'dark:hover:text-ant-primary hover:text-ant-primary text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
    // 展开态：与 hover 同源但常驻，让用户看得出"这个弹层是哪个按钮开的"
    props.active && 'bg-slate-100 text-ant-primary dark:bg-slate-800',
  ),
);

/** 图标容器：负责旋转 */
const iconWrapperClass = computed(() =>
  cn(
    'flex size-full  items-center justify-center',
    'transform-gpu',
    'ease-spring-rotate transition-[rotate] duration-500',
    'group-hover:rotate-360',
    'group-focus-visible:rotate-360',
  ),
);
</script>

<template>
  <button
    type="button"
    :class="buttonClass"
    :aria-label="props.label"
    :aria-pressed="props.active"
    :title="props.label"
  >
    <span :class="iconWrapperClass">
      <slot></slot>
    </span>
  </button>
</template>
