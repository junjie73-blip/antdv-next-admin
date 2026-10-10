import type { EChartsOption } from 'echarts';
import type { ECharts } from 'echarts/core';

import type { Ref } from 'vue';

import { computed, isRef, nextTick, ref, shallowRef, unref, watch } from 'vue';

import {
  tryOnBeforeUnmount,
  tryOnMounted,
  useDebounceFn,
  useThrottleFn,
} from '@vueuse/core';
import * as echarts from 'echarts/core';
import { attempt, merge } from 'es-toolkit';
import { isNil } from 'es-toolkit/predicate';

/* ============================================================
 * 类型
 * ============================================================ */
export type ResizeStrategy = 'debounce' | 'none' | 'raf' | 'throttle';

/** 支持 ref / getter / 原始值 */
export type MaybeRefOrGetter<T> = (() => T) | Ref<T> | T;

export interface UseEchartsOptions {
  autoResize?: boolean;
  resizeStrategy?: ResizeStrategy;
  resizeDelay?: number;
  isDark?: MaybeRefOrGetter<boolean>;
  onError?: (err: unknown) => void;
  renderer?: 'canvas' | 'svg';
  applyInitial?: boolean;
  /** 调试模式（默认读 import.meta.env.DEV） */
  debug?: boolean;
}

export interface UseEchartsReturn<T = unknown> {
  containerRef: Ref<HTMLElement | null>;
  chart: Ref<ECharts | null>;
  isReady: Ref<boolean>;
  setOption: (option: EChartsOption, notMerge?: boolean) => void;
  setData: (patch: Partial<T>) => void;
  resize: () => void;
  dispose: () => void;
  showLoading: () => void;
  hideLoading: () => void;
}

/* ============================================================
 * 工具：把 MaybeRefOrGetter 归一化为值
 * ============================================================ */
function toValue<T>(input: MaybeRefOrGetter<T>): T {
  if (typeof input === 'function') return (input as () => T)();
  if (isRef(input)) return input.value;
  return input;
}

/* ============================================================
 * 全局 resize 总线
 * ============================================================ */
type ResizeCallback = () => void;
const globalResizeCallbacks = new Set<ResizeCallback>();
let globalResizeBound = false;
let globalRafId: null | number = null;

function bindGlobalResize() {
  if (globalResizeBound || typeof window === 'undefined') return;
  globalResizeBound = true;
  window.addEventListener('resize', () => {
    if (globalRafId !== null) return;
    globalRafId = requestAnimationFrame(() => {
      globalRafId = null;
      globalResizeCallbacks.forEach((cb) => {
        const [err] = attempt(cb);
        if (err) console.warn('[echarts] resize callback failed', err);
      });
    });
  });
}

function registerGlobalResize(cb: ResizeCallback): () => void {
  bindGlobalResize();
  globalResizeCallbacks.add(cb);
  return () => globalResizeCallbacks.delete(cb);
}

/* ============================================================
 * Hook 主体
 * ============================================================ */
export function useEcharts<T = unknown>(
  initialOption?: EChartsOption,
  options: UseEchartsOptions = {},
): UseEchartsReturn<T> {
  const {
    autoResize = true,
    resizeStrategy = 'raf',
    resizeDelay = 100,
    isDark,
    onError,
    renderer = 'canvas',
    applyInitial = true,
    debug = false,
  } = options;

  const log = (...args: unknown[]) => {
    if (debug) console.log('[useEcharts]', ...args);
  };

  /* ---------- 状态 ---------- */
  const containerRef = shallowRef<HTMLElement | null>(null);
  const chart = shallowRef<ECharts | null>(null);
  const isReady = ref(false);
  const pendingOptions: Array<{ option: EChartsOption; notMerge: boolean }> =
    [];

  /**
   * 最近一次生效的完整 option。
   * setData 需要它：更新数据时必须带着其余配置一起重设，否则 notMerge 会把样式抹掉。
   */
  let lastOption: EChartsOption | null = null;

  /** ⭐ 关键修复：支持 getter / ref / boolean */
  const isDarkRef = computed(() => {
    if (isNil(isDark)) return false;
    return toValue(isDark);
  });

  /* ---------- resize ---------- */
  const rawResize = () => {
    if (!chart.value) return;
    const [err] = attempt(() => chart.value!.resize());
    if (err) onError?.(err);
  };

  const debouncedResize = useDebounceFn(rawResize, resizeDelay);
  const throttledResize = useThrottleFn(rawResize, resizeDelay);
  const rafResize = () => {
    if (typeof requestAnimationFrame === 'undefined') return rawResize();
    requestAnimationFrame(() => rawResize());
  };

  const resizeFn: ResizeCallback =
    resizeStrategy === 'none'
      ? () => undefined
      : resizeStrategy === 'debounce'
        ? debouncedResize
        : resizeStrategy === 'throttle'
          ? throttledResize
          : rafResize;

  /* ---------- 初始化 ---------- */
  function init(): boolean {
    const el = unref(containerRef);
    if (isNil(el)) {
      log('init skip: no element');
      return false;
    }
    if (el.clientWidth === 0 || el.clientHeight === 0) {
      log('init skip: zero size', { w: el.clientWidth, h: el.clientHeight });
      return false;
    }
    if (chart.value) {
      log('init skip: already initialized');
      return true;
    }

    const [err, instance] = attempt(() =>
      echarts.init(el, isDarkRef.value ? 'dark' : undefined, { renderer }),
    );

    if (err || !instance) {
      log('init failed', err);
      onError?.(err);
      return false;
    }

    chart.value = instance;
    isReady.value = true;
    log('init success', {
      w: el.clientWidth,
      h: el.clientHeight,
      dark: isDarkRef.value,
    });

    if (applyInitial && initialOption) {
      lastOption = merge({}, initialOption);
      instance.setOption(initialOption);
    }
    while (pendingOptions.length > 0) {
      const { option, notMerge } = pendingOptions.shift()!;
      lastOption = notMerge
        ? merge({}, option)
        : merge(lastOption ?? {}, option);
      instance.setOption(option, notMerge);
    }
    return true;
  }

  /** ⭐ 关键修复：多次尝试初始化，直到成功或耗尽重试 */
  function initWithRetry(maxAttempts = 5, delayMs = 100): void {
    let attempts = 0;

    const tryOnce = () => {
      attempts++;
      if (init()) return;
      if (attempts >= maxAttempts) {
        log(`init gave up after ${attempts} attempts`);
        return;
      }
      setTimeout(tryOnce, delayMs);
    };

    tryOnce();
  }

  /* ---------- 销毁 ---------- */
  function dispose() {
    const [err] = attempt(() => {
      chart.value?.dispose();
      chart.value = null;
      isReady.value = false;
      pendingOptions.length = 0;
    });
    if (err) onError?.(err);
  }

  /* ---------- 公开 API ---------- */
  function setOption(option: EChartsOption, notMerge = false) {
    // 无论图表是否就绪，都要记住这份 option（setData 依赖它做合并）
    lastOption = notMerge ? merge({}, option) : merge(lastOption ?? {}, option);

    if (!chart.value) {
      log('setOption queued (chart not ready)');
      pendingOptions.push({ option, notMerge });
      return;
    }
    const [err] = attempt(() => chart.value!.setOption(option, notMerge));
    if (err) {
      log('setOption failed', err);
      onError?.(err);
    }
  }

  /**
   * 只更新数据相关的配置项（series / dataset / xAxis.data 等）。
   *
   * ⚠️ 这里以前是 `function setData(_patch: Partial<T>) {}`：一个静默生效的空函数。
   * 调用方以为刷新了图表，实际上一动不动，而且不报错——比报错更难查。
   * 现在把 patch 深合并进最近一次 option 后整体重设，样式配置不会丢。
   *
   * 泛型 `T` 应当传「option 的形状」，例如 `useEcharts<LineOption>({ series: [...] })`。
   */
  function setData(patch: Partial<T>) {
    // es-toolkit 的 merge 只有 (target, source) 两个参数，且会就地改 target，
    // 所以先 merge 出一份底稿，再把 patch 并上去。
    const base = merge({}, lastOption ?? {});
    setOption(
      merge(base, patch as Partial<EChartsOption>) as EChartsOption,
      true,
    );
  }

  function resize() {
    resizeFn();
  }

  function showLoading() {
    chart.value?.showLoading('default', {
      text: '加载中',
      maskColor: 'transparent',
    });
  }

  function hideLoading() {
    chart.value?.hideLoading();
  }

  /* ---------- 生命周期：挂载 ---------- */
  tryOnMounted(() => {
    // ⭐ 多层时序兜底
    nextTick(() => {
      // 1) 立即尝试
      if (init()) return;
      // 2) rAF 后再试
      requestAnimationFrame(() => {
        if (init()) return;
        // 3) 定时重试
        initWithRetry();
      });
    });
  });

  tryOnBeforeUnmount(dispose);

  /* ---------- 主题切换 ---------- */
  watch(isDarkRef, (next, prev) => {
    if (next === prev) return;
    if (!chart.value) return;
    log('theme changed, rebuilding chart');
    const backupOption = chart.value.getOption();
    lastOption = merge({}, backupOption as EChartsOption);
    dispose();
    requestAnimationFrame(() => {
      init();
      if (chart.value && backupOption) {
        chart.value.setOption(backupOption as EChartsOption, true);
      }
    });
  });

  /* ---------- Resize 监听 ---------- */
  if (autoResize && resizeStrategy !== 'none') {
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        // ⭐ 容器尺寸变化时，如果还没 init，也尝试 init
        if (!chart.value) {
          init();
          return;
        }
        resizeFn();
      });

      watch(
        containerRef,
        (el, _old, onCleanup) => {
          if (!el) return;
          observer.observe(el, { box: 'content-box' });
          onCleanup(() => observer.unobserve(el));
        },
        { immediate: true },
      );

      tryOnBeforeUnmount(() => observer.disconnect());
    }

    const unregister = registerGlobalResize(() => {
      if (!chart.value) return;
      resizeFn();
    });
    tryOnBeforeUnmount(unregister);
  }

  return {
    containerRef,
    chart,
    isReady,
    setOption,
    setData,
    resize,
    dispose,
    showLoading,
    hideLoading,
  };
}
