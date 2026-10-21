<script setup lang="ts">
import { ref, watch } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
import { APP_BORDER_RADIUS } from '@antdv/shared/constants';
import { Icon } from '@iconify/vue';
import { useCssVar } from '@vueuse/core';

defineOptions({ name: 'LockScreen' });

/**
 * 锁屏遮罩：盖住整个视口，把滚动与页面上的默认交互全部挡在下面。
 *
 * 只在 `useLockScreen()` 的 `locked` 为真时由宿主 `v-if` 挂出来（见 `index.vue`），
 * 本体 Teleport 到 `body`，不跟在顶栏的层叠上下文里，免得被 header 的
 * `shadow` / `overflow` 影响。层级用与路由进度条同一档 `z-9999`：
 * 比所有浮层（shadcn 的 `z-50`）高，比 sonner 自己钉的 `999999999` 低 ——
 * 锁屏期间仍能看到提示，这是有意的。
 */

/**
 * 解锁的下拉阈值：把手按下去之后要拖过这么多像素才放行。
 *
 * 做成入参（而不是写死在指针处理里）有两个理由：单测要在阈值上下两侧各打一次，
 * 以及窄屏（360px 的手机）上手指行程本来就短，宿主可以按视口给一个更小的值。
 * 这是位移量不是圆角，所以用 px —— 圆角才有 rem 的规矩（见下面的样式变量）。
 */
const UNLOCK_PULL_THRESHOLD = 96;

const props = withDefaults(
  defineProps<{
    /** 向下拖过多少像素算解锁 */
    threshold?: number;
  }>(),
  { threshold: UNLOCK_PULL_THRESHOLD },
);

const emit = defineEmits<{ unlock: [] }>();

const { t } = useLayoutI18n();

/* ---------------------------------------------------------------- 样式变量
 * 一律走 VueUse 的 `useCssVar`：读取要跟随偏好实时变（圆角刻度是可配的），
 * 写入要在元素销毁前收干净，两头都不该由组件自己拼 `style` 字符串。
 *
 * 圆角的唯一来源是 `--app-border-radius`，它在 token 里就是 `1rem`，
 * 偏好改的是倍数（见 `@antdv/preferences` 的 `radiusToRem`），
 * 所以这里所有半径都是 `calc(rem 基准 × 倍数)`，源码里不出现任何 px 圆角。
 * 圆形那枚把手用 `rounded-full`（无穷大半径，不是长度单位）。
 */
const cardEl = ref<HTMLElement | null>(null);

/** 基准圆角：跟着 `<html>` 上的内联值与 class 走，明暗/主题/刻度换哪个都能收到 */
const baseRadius = useCssVar(APP_BORDER_RADIUS, document.documentElement, {
  initialValue: '1rem',
  observe: true,
});

/** 卡片比正文圆一档，把手跟基准 —— 都是 rem 的派生值 */
const cardRadius = useCssVar('--lock-card-radius', cardEl);
const handleRadius = useCssVar('--lock-handle-radius', cardEl);
/** 下拉进度（0–1），拖到哪算哪，交给 CSS 去换算位移与提示的透明度 */
const pullProgress = useCssVar('--lock-pull', cardEl, { initialValue: '0' });
/** 进度 1 对应的位移量，和阈值同步，模板里只写 `calc(var(--lock-pull) * var(--lock-pull-distance))` */
const pullDistance = useCssVar('--lock-pull-distance', cardEl);

watch(
  baseRadius,
  (value) => {
    const radius = value?.trim() || '1rem';
    cardRadius.value = `calc(${radius} * 1.5)`;
    handleRadius.value = radius;
  },
  { immediate: true },
);

watch(
  () => props.threshold,
  (value) => {
    pullDistance.value = `${value}px`;
  },
  { immediate: true },
);

/* ---------------------------------------------------------------- 下拉解锁 */

/** 指针按下时的 Y，拖动期间用它算位移；null 表示当前没在拖 */
let pointerStartY: null | number = null;

function onPointerDown(event: PointerEvent) {
  pointerStartY = event.clientY;
  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (pointerStartY === null) return;
  // 只认向下：往回拖就退回 0，进度封顶 1，免得拖出屏幕外还在加速
  const distance = Math.max(0, event.clientY - pointerStartY);
  pullProgress.value = String(Math.min(distance / props.threshold, 1));
}

function onPointerUp() {
  const distance = Number(pullProgress.value) * props.threshold;
  pointerStartY = null;
  if (distance >= props.threshold) emit('unlock');
  else pullProgress.value = '0';
}

/** 解锁的三条路（按钮 / 下拉过阈值 / 任意键）都汇到这里，任意键那条在 `useLockScreen` 里 */
function release() {
  emit('unlock');
}
</script>

<template>
  <Teleport to="body">
    <div
      class="lock-screen fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm select-none"
      data-testid="lock-screen"
      @contextmenu.prevent
    >
      <div
        ref="cardEl"
        class="lock-card flex w-[min(320px,calc(100vw-32px))] flex-col items-center px-6 py-8 text-center"
      >
        <span
          class="lock-badge flex size-14 items-center justify-center rounded-full"
        >
          <Icon class="text-2xl" icon="carbon:locked" />
        </span>

        <h2 class="lock-title mt-4 text-lg font-semibold">
          {{ t('header.locked') }}
        </h2>
        <p class="lock-hint mt-1 text-sm">
          {{ t('header.lockHint') }}
        </p>

        <button
          class="lock-button mt-6 inline-flex h-9 w-full cursor-pointer items-center justify-center text-sm transition-colors"
          data-testid="lock-unlock-button"
          type="button"
          @click="release"
        >
          {{ t('header.unlock') }}
        </button>

        <!--
          把手：按住向下拖过阈值同样解锁。位移与箭头透明度全部由卡上的两个
          CSS 变量换算（`--lock-pull` / `--lock-pull-distance`），
          JS 里只管写进度，不碰 style。
        -->
        <div
          class="lock-handle mt-6 flex size-10 cursor-grab touch-none items-center justify-center rounded-full active:cursor-grabbing"
          data-testid="lock-pull-handle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <Icon class="lock-arrow text-xl" icon="carbon:chevron-down" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/*
 * 只写几何与配色，半径一律引用卡上那两个由 `useCssVar` 写进来的 rem 变量，
 * 这里不出现任何 `px` 圆角（`--lock-card-radius` / `--lock-handle-radius`）。
 */
.lock-screen {
  /* 遮罩自身不接收来自页面的滚动；滚轮落在它身上没有可滚内容，等于没有滚动 */
  overscroll-behavior: none;
}

.lock-card {
  background: var(--app-popover);
  border-radius: var(--lock-card-radius);
  color: var(--app-popover-foreground);
  box-shadow: 0 18px 48px rgb(0 0 0 / 32%);
}

.lock-badge {
  background: var(--app-primary);
  color: var(--app-primary-foreground);
}

.lock-title {
  color: var(--app-popover-foreground);
}

.lock-hint {
  color: var(--app-muted-foreground);
}

.lock-button {
  background: var(--app-primary);
  border-radius: var(--lock-handle-radius);
  color: var(--app-primary-foreground);
}

.lock-button:hover {
  opacity: 0.9;
}

.lock-handle {
  background: var(--app-muted);
  color: var(--app-muted-foreground);
}

/* 下拉进度：把手按 var 位移，箭头跟着透明度渐显，两个量都由 JS 写的那个数换算 */
.lock-screen .lock-handle {
  transform: translateY(
    calc(var(--lock-pull, 0) * var(--lock-pull-distance, 0px))
  );
}

.lock-screen .lock-arrow {
  opacity: calc(0.4 + var(--lock-pull, 0) * 0.6);
}
</style>
