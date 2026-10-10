import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

/**
 * useRouteLoading - 路由切换 Loading 状态管理
 *
 * 功能：
 * 1. 路由切换时自动显示/隐藏 Loading
 * 2. 最小显示时间控制（防止闪烁）
 * 3. 慢加载检测和警告
 * 4. 支持手动触发（withLoading）
 *
 * 注：路由性能监控已由 src/monitor 统一管理，无需在此重复初始化
 */
import { tryOnScopeDispose } from '@vueuse/core';

export interface RouteLoadingOptions {
  /** 最小显示时间 (ms)，防止闪烁 */
  minDuration?: number;
  /** 是否启用自动模式（监听路由变化） */
  auto?: boolean;
}

export function useRouteLoading(options: RouteLoadingOptions = {}) {
  const { minDuration = 300, auto = true } = options;

  const router = useRouter();

  // 状态
  const isLoading = ref(false);
  const isComplete = ref(false);
  const isError = ref(false);
  const startTime = ref(0);

  // 定时器
  let completeTimer: null | ReturnType<typeof setTimeout> = null;

  /**
   * 开始加载
   *
   * 状态同步置位，不等 requestAnimationFrame：
   * `completeInternal()` 第一件事就是 `if (!isLoading.value) return`，
   * 而 `withLoading(async () => …)` 里 await 只让出微任务，rAF 还没跑，
   * 于是快结束的调用会走进"还没开始"的分支——loading 条永远挂在那儿。
   */
  function start() {
    if (isLoading.value && !isComplete.value) return;

    isError.value = false;
    isComplete.value = false;
    isLoading.value = true;
    startTime.value = Date.now();
  }

  /**
   * 完成加载（成功）
   */
  function complete() {
    completeInternal(false);
  }

  /**
   * 完成加载（失败）
   */
  function fail() {
    completeInternal(true);
  }

  /**
   * 内部完成逻辑
   */
  function completeInternal(error: boolean) {
    if (!isLoading.value) {
      return;
    }

    const elapsed = Date.now() - startTime.value;
    const remaining = Math.max(0, minDuration - elapsed);

    if (completeTimer) {
      clearTimeout(completeTimer);
    }

    completeTimer = setTimeout(() => {
      isComplete.value = !error;
      isError.value = error;

      setTimeout(
        () => {
          isLoading.value = false;
          isComplete.value = false;
          isError.value = false;
        },
        error ? 500 : 200,
      );
    }, remaining);
  }

  /**
   * 取消加载
   */
  function cancel() {
    if (!isLoading.value) return;

    reset();
  }

  /**
   * 手动触发完整的加载-完成流程
   *
   * 注意 catch 的形参名：这里叫 `raw` 而不是随手写 `error`——
   * 本文件里 `error()` 是"标记加载失败"的方法，
   * 一旦 catch 形参叫 error，`error()` 就成了调用一个 unknown，
   * 失败路径不但没标记失败，还会抛出 TypeError。
   */
  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    start();
    try {
      const result = await fn();
      complete();
      return result;
    } catch (raw) {
      // 失败路径不能再走 finally 的 complete()：那会把 isError 冲掉
      fail();
      throw raw;
    }
  }

  /**
   * 重置状态
   */
  function reset() {
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    isLoading.value = false;
    isComplete.value = false;
    isError.value = false;
    startTime.value = 0;
  }

  // 计算属性
  const progress = computed(() => {
    if (!isLoading.value) return 0;
    if (isComplete.value || isError.value) return 100;

    const elapsed = Date.now() - startTime.value;
    return Math.min(90, 10 + (elapsed / (minDuration * 3)) * 80);
  });

  // 当前耗时
  const elapsed = computed(() => {
    if (!startTime.value) return 0;
    return Date.now() - startTime.value;
  });

  // 是否慢加载
  const isSlow = computed(() => {
    return elapsed.value > 3000 && isLoading.value;
  });

  // 自动模式：只挂一对守卫
  //
  // 两条纪律（都是踩过的坑）：
  // 1. 不要再加 `watch(() => route.path)`：它和 beforeEach/afterEach 是同一件事
  //    的两套触发源，会各自 start/complete，快导航时把进度条切成"闪两下"；
  // 2. 守卫一律用返回值而不是 `next()`：vue-router 5 已废弃 next 回调
  //    （每次导航都告警一次），且箭头函数直出库的链式返回值会被当成导航结果。
  if (auto) {
    router.beforeEach(() => {
      start();
    });

    router.afterEach(() => {
      setTimeout(() => {
        complete();
      }, minDuration / 2);
    });
  }

  // 清理定时器
  tryOnScopeDispose(() => {
    reset();
  });

  return {
    // 状态
    isLoading: computed(() => isLoading.value),
    isComplete: computed(() => isComplete.value),
    isError: computed(() => isError.value),
    progress,
    elapsed,
    isSlow,

    // 方法
    start,
    complete,
    error: fail,
    cancel,
    withLoading,
    reset,
  };
}
