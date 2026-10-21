<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { useAppStore } from '@antdv/stores';

defineOptions({ name: 'WidgetButton' });

/**
 * 顶栏按钮一律只有图标，不带文字（`text` 这个口子已经撤掉）：
 * 图标 + 名称足够认出来，而多挂一段常驻文本会在窄视口把整条工具区撑爆 ——
 * 8 个按钮各多 30px，390px 的手机上菜单和 logo 就没有位置了。
 *
 * `label` 同时喂 `aria-label` 与 `title`：只有一个图标的按钮，读屏软件念不出任何东西，
 * 自动化用例也只能靠 `data-testid` 硬找（此前退出登录就是这么绕过去的）。
 * 给个名字比加 testid 更值：既补了无障碍，也让选择器跟着界面文案走。
 */
const props = defineProps<{
  /** 弹层当前是否展开：用于给按钮一个"按下"的持久态 */
  active?: boolean;
  /** 按钮名称，同时作为 aria-label 与 tooltip */
  label?: string;
}>();

const appStore = useAppStore();

/** 按钮本体：圆形 + 固定 32px 方框（图标居中，不再随内容变宽） */
const buttonClass = computed(() =>
  cn(
    'group widget-button relative inline-flex size-8 items-center justify-center',
    'cursor-pointer rounded-full focus:outline-none',
    'transition-colors duration-200',
    appStore.darkHeader
      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
      : 'dark:hover:text-primary hover:text-primary text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
    // 展开态：与 hover 同源但常驻，让用户看得出"这个弹层是哪个按钮开的"
    props.active && 'text-primary bg-slate-100 dark:bg-slate-800',
  ),
);

/** 图标容器：负责旋转 */
const iconWrapperClass = computed(() =>
  cn(
    'flex size-full items-center justify-center',
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
