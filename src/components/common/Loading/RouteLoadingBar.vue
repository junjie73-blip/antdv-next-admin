<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteUpdate, useRoute } from "vue-router";

import { useAppStore } from "~/stores/modules/app";
import { cn } from "~/utils/cn";

defineOptions({ name: "RouteLoadingBar" });

/* ============================================================
 * Props & Emits
 * ============================================================ */
const props = withDefaults(
  defineProps<{
    color?: string;
    height?: number;
    duration?: number;
    enabled?: boolean;
    showComplete?: boolean;
    showPercentage?: boolean;
    cancellable?: boolean;
    slowThreshold?: number;
  }>(),
  {
    color: "",
    height: 3,
    duration: 300,
    enabled: true,
    showComplete: true,
    showPercentage: false,
    cancellable: false,
    slowThreshold: 3000,
  },
);

const emit = defineEmits<{
  cancel: [];
  retry: [];
  slow: [duration: number];
}>();

/* ============================================================
 * 状态
 * ============================================================ */
const route = useRoute();
const appStore = useAppStore();

const isLoading = ref(false);
const isComplete = ref(false);
const isError = ref(false);
const progress = ref(0);
const isSlowState = ref(false);

let progressTimer: ReturnType<typeof setInterval> | null = null;
let completeTimer: ReturnType<typeof setTimeout> | null = null;
let slowWarningTimer: ReturnType<typeof setTimeout> | null = null;
let loadStartTime = 0;

/* ============================================================
 * 颜色计算
 * ============================================================ */
const barColor = computed(() => {
  if (props.color) return props.color;
  if (isError.value) return "#ef4444";
  if (isSlowState.value) return "#f59e0b";
  const isDark = appStore.themeMode === "dark";
  return isDark ? "#6366f1" : "#1677ff";
});

/* ============================================================
 * 容器类名（全部 Tailwind）
 * ============================================================ */
const containerClassName = computed(() =>
  cn(
    "fixed inset-x-0 top-0 z-[9999] transition-opacity duration-300 ease-out",
    props.cancellable ? "" : "pointer-events-none",
  ),
);

/* 进度条类名：完成/错误时增加脉冲 */
const barClassName = computed(() =>
  cn(
    "absolute left-0 top-0 h-full transition-all",
    isComplete.value ? "ease-out" : "ease-linear",
    isError.value && "animate-pulse-soft",
  ),
);

/* ============================================================
 * 内联样式（动态值无法用 Tailwind 表达的部分）
 * ============================================================ */
const containerStyle = computed(() => ({
  opacity: isLoading.value || isComplete.value || isError.value ? 1 : 0,
  height: `${props.height}px`,
}));

const barStyle = computed(() => ({
  width: `${progress.value}%`,
  backgroundColor: barColor.value,
  transitionDuration: isComplete.value || isError.value ? "200ms" : `${props.duration}ms`,
  boxShadow: `0 0 10px ${barColor.value}40, 0 0 5px ${barColor.value}20`,
}));

/* ============================================================
 * 开始加载
 * ============================================================ */
function startLoading() {
  if (!props.enabled) return;

  stopLoading();
  isLoading.value = true;
  isComplete.value = false;
  isError.value = false;
  isSlowState.value = false;
  progress.value = 10;
  loadStartTime = Date.now();

  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      const increment = Math.random() * (100 - progress.value) * 0.15;
      progress.value = Math.min(90, progress.value + increment);
    }
  }, props.duration);

  if (props.slowThreshold > 0) {
    slowWarningTimer = setTimeout(() => {
      if (isLoading.value) {
        isSlowState.value = true;
        const duration = Date.now() - loadStartTime;
        emit("slow", duration);
        console.warn(`[RouteLoadingBar] ⚠️ 慢加载警告: 已加载 ${duration}ms`);
      }
    }, props.slowThreshold);
  }
}

/* ============================================================
 * 完成加载
 * ============================================================ */
function completeLoading(error = false) {
  if (!props.enabled || !isLoading.value) return;

  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (slowWarningTimer) {
    clearTimeout(slowWarningTimer);
    slowWarningTimer = null;
  }

  if (error) {
    isError.value = true;
    progress.value = 100;
    console.error("[RouteLoadingBar] ❌ 加载失败");
    completeTimer = setTimeout(reset, 3000);
  } else {
    progress.value = 100;
    isComplete.value = true;
    completeTimer = setTimeout(reset, props.showComplete ? 400 : 200);
  }
}

function reset() {
  isLoading.value = false;
  isComplete.value = false;
  isError.value = false;
  isSlowState.value = false;
  progress.value = 0;
  loadStartTime = 0;
}

function stopLoading() {
  if (progressTimer) clearInterval(progressTimer);
  if (completeTimer) clearTimeout(completeTimer);
  if (slowWarningTimer) clearTimeout(slowWarningTimer);
  progressTimer = null;
  completeTimer = null;
  slowWarningTimer = null;
}

function handleCancel() {
  if (!props.cancellable || !isLoading.value) return;
  emit("cancel");
  stopLoading();
  reset();
}

function handleRetry() {
  emit("retry");
  reset();
  startLoading();
}

/* ============================================================
 * 生命周期
 * ============================================================ */
watch(
  () => route.path,
  () => {
    startLoading();
    const minLoadTime = Math.max(300, props.duration * 2);
    setTimeout(() => completeLoading(), minLoadTime);
  },
);

onBeforeRouteUpdate((to, from) => {
  if (to.path !== from.path) startLoading();
});

onBeforeUnmount(stopLoading);

defineExpose({
  start: startLoading,
  complete: () => completeLoading(),
  error: () => completeLoading(true),
  stop: stopLoading,
  cancel: handleCancel,
  retry: handleRetry,
});
</script>

<template>
  <div
    v-if="enabled"
    :class="containerClassName"
    :style="containerStyle"
    role="progressbar"
    :aria-valuenow="progress"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="
      isError ? '加载失败' : isLoading ? `页面加载中 ${Math.round(progress)}%` : '加载完成'
    "
  >
    <!-- 主进度条 -->
    <div :class="barClassName" :style="barStyle" />

    <!-- 光晕 -->
    <div class="absolute inset-0 opacity-30 blur-sm" :style="{ backgroundColor: barColor }" />

    <!-- 百分比文字 -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <span
        v-if="showPercentage && isLoading && !isComplete"
        class="pointer-events-none absolute right-2.5 top-full mt-1 text-xs font-medium"
        :style="{ color: barColor }"
      >
        {{ Math.round(progress) }}%
      </span>
    </Transition>

    <!-- 操作按钮（可取消 / 错误重试） -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="(cancellable && isLoading) || isError"
        class="absolute right-2 top-full mt-2 flex items-center gap-2"
      >
        <!-- 取消 -->
        <button
          v-if="cancellable && isLoading && !isError"
          type="button"
          title="取消加载"
          class="flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs shadow-sm transition-colors hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700"
          @click="handleCancel"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          取消
        </button>

        <!-- 错误提示 + 重试 -->
        <template v-if="isError">
          <span class="text-xs text-red-600 dark:text-red-400">加载失败</span>
          <button
            type="button"
            title="重试"
            class="flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
            @click="handleRetry"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            重试
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>
