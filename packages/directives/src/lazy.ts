import type { DirectiveBinding, ObjectDirective } from 'vue';

/* ============================================================
 * 类型
 * ============================================================ */

export interface LazyOptions {
  /** 渐显时长 ms */
  duration?: number;
  /** 加载失败时的回退图 */
  error?: string;
  /** 是否渐显 */
  fade?: boolean;
  /** 进视口前先行加载的占位图 */
  placeholder?: string;
  /** 提前量，`'100px'` 表示快到就加载 */
  rootMargin?: string;
  /** 图片地址（必填） */
  src: string;
  /** 可见比例阈值 */
  threshold?: number;
}

export type LazyBindingValue = LazyOptions | string;

/** 观察器最小契约：真实 IntersectionObserver、happy-dom 假实现、不支持时返回 null 都能替 */
export interface LazyObserver {
  disconnect: () => void;
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
}

export interface LazyObserverEntry {
  isIntersecting: boolean;
  target: Element;
}

export interface LazyDirectiveOptions {
  /** 实例级默认值，`binding.value` 与 `data-*` 优先级更高 */
  defaults?: Partial<LazyOptions>;
  /** 已加载 URL 缓存；默认模块级 Set，注入便于测试与内存控制 */
  loadedCache?: Set<string>;
  /**
   * 观察器工厂。返回 `null` 表示当前环境没有 IntersectionObserver ——
   * 此时指令直接加载图片（降级），而不是留一张永远空白/占位的图。
   */
  createObserver?: (
    callback: (entries: LazyObserverEntry[]) => void,
    options: { rootMargin: string; threshold: number },
  ) => LazyObserver | null;
  /** 预加载，`true` 成功。默认用 `new Image()` */
  preload?: (src: string) => Promise<boolean>;
  /** 加载失败上报：应用决定 console / 埋点 */
  onError?: (info: { error?: unknown; src: string }) => void;
}

/* ============================================================
 * 默认实现
 * ============================================================ */

const FALLBACK_ROOT_MARGIN = '100px';
const FALLBACK_THRESHOLD = 0.1;
const FALLBACK_DURATION = 300;

/** 全局缓存：跨组件共享，同一张图只请求一次 */
const globalLoadedCache = new Set<string>();

function defaultCreateObserver(
  callback: (entries: LazyObserverEntry[]) => void,
  options: { rootMargin: string; threshold: number },
): LazyObserver | null {
  const Ctor = (globalThis as { IntersectionObserver?: unknown })
    .IntersectionObserver as
    | (new (
        cb: (entries: IntersectionObserverEntry[]) => void,
        opts: IntersectionObserverInit,
      ) => IntersectionObserver)
    | undefined;

  if (typeof Ctor !== 'function') return null;

  return new Ctor((entries) => {
    callback(
      entries.map((entry) => ({
        isIntersecting: entry.isIntersecting,
        target: entry.target,
      })),
    );
  }, options);
}

function defaultPreload(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const Ctor = (globalThis as { Image?: unknown }).Image as
      | (new () => HTMLImageElement)
      | undefined;

    // 没有 Image 构造器（非浏览器）时不该把加载流程卡死，按成功处理
    if (typeof Ctor !== 'function') {
      resolve(true);
      return;
    }

    const img = new Ctor();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** 没有 rAF 的环境直接跳过动画帧，写完 opacity 就算完成 */
function nextFrame(action: () => void): void {
  const raf = (globalThis as { requestAnimationFrame?: unknown })
    .requestAnimationFrame as ((cb: () => void) => void) | undefined;

  if (typeof raf !== 'function') {
    action();
    return;
  }
  // 双帧：第一帧让 opacity:0 生效，第二帧才过渡到 1，否则会看到硬跳
  raf(() => raf(action));
}

/* ============================================================
 * 元素状态
 * ============================================================ */

interface LazyElementState {
  observer: LazyObserver | null;
  /** 已生效的 src，用于 `updated` 判断是否需要重绑 */
  src: string;
  /**
   * 递增令牌。图片预加载是异步的，用户在加载中途换 src 或卸载组件时，
   * 晚到的 `onload` 不能把旧图写回元素 —— 这是原实现里真实存在的竞态。
   */
  token: number;
}

const stateMap = new WeakMap<HTMLImageElement, LazyElementState>();

/* ============================================================
 * 指令工厂
 * ============================================================ */

export function createLazyDirective(
  options: LazyDirectiveOptions = {},
): ObjectDirective<HTMLImageElement, LazyBindingValue> {
  const cache = options.loadedCache ?? globalLoadedCache;
  const makeObserver = options.createObserver ?? defaultCreateObserver;
  const preload = options.preload ?? defaultPreload;

  /**
   * 取值优先级：`binding.value` 对象 > `data-*` 属性 > 指令级 `defaults` > 内置兜底。
   * 保留 `data-placeholder` / `data-error` 是因为头像列表里逐张传对象太啰嗦，
   * 而同一列表的占位/兜底图通常是同一个。
   */
  function resolve(
    el: HTMLImageElement,
    value: LazyBindingValue | undefined,
  ): LazyOptions | null {
    const fromBinding: Partial<LazyOptions> =
      typeof value === 'string' ? { src: value } : (value ?? {});

    const src = fromBinding.src || el.dataset.src || '';
    if (!src) return null;

    return {
      duration:
        fromBinding.duration ??
        options.defaults?.duration ??
        FALLBACK_DURATION,
      error: fromBinding.error ?? el.dataset.error ?? options.defaults?.error,
      fade: fromBinding.fade ?? options.defaults?.fade ?? true,
      placeholder:
        fromBinding.placeholder ??
        el.dataset.placeholder ??
        options.defaults?.placeholder,
      rootMargin:
        fromBinding.rootMargin ??
        options.defaults?.rootMargin ??
        FALLBACK_ROOT_MARGIN,
      src,
      threshold:
        fromBinding.threshold ??
        options.defaults?.threshold ??
        FALLBACK_THRESHOLD,
    };
  }

  function applySrc(el: HTMLImageElement, src: string, opts: LazyOptions) {
    if (opts.fade === false) {
      el.src = src;
      return;
    }
    el.style.opacity = '0';
    el.style.transition = `opacity ${opts.duration}ms ease-in-out`;
    el.src = src;
    nextFrame(() => {
      el.style.opacity = '1';
    });
  }

  async function load(
    el: HTMLImageElement,
    opts: LazyOptions,
    state: LazyElementState,
  ) {
    const { src } = opts;

    // 命中缓存：省一次请求，直接落图
    if (cache.has(src)) {
      applySrc(el, src, opts);
      return;
    }

    const token = ++state.token;
    let ok: boolean;
    try {
      ok = await preload(src);
    } catch (error) {
      options.onError?.({ error, src });
      ok = false;
    }

    // 中途换过 src 或已卸载 → 丢弃这次结果
    if (token !== state.token) return;

    if (ok) {
      cache.add(src);
      applySrc(el, src, opts);
      return;
    }

    options.onError?.({ src });
    if (opts.error) el.src = opts.error;
  }

  function cleanup(el: HTMLImageElement) {
    const state = stateMap.get(el);
    if (!state) return;
    state.observer?.disconnect();
    state.observer = null;
    // 让在途的预加载结果作废
    state.token += 1;
  }

  function bind(
    el: HTMLImageElement,
    value: LazyBindingValue | undefined,
    existing: LazyElementState | undefined,
  ) {
    const opts = resolve(el, value);
    if (!opts) return;

    const state: LazyElementState =
      existing ?? { observer: null, src: opts.src, token: 0 };
    state.src = opts.src;
    el.dataset.src = opts.src;

    if (opts.placeholder && !el.src) el.src = opts.placeholder;

    stateMap.set(el, state);

    const enter = () => {
      load(el, opts, state);
      state.observer?.unobserve(el);
    };

    const observer = makeObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) enter();
      },
      { rootMargin: opts.rootMargin ?? FALLBACK_ROOT_MARGIN, threshold: opts.threshold ?? FALLBACK_THRESHOLD },
    );

    // 环境不支持观察器：立即加载，功能降级但画面不空
    if (!observer) {
      enter();
      return;
    }

    state.observer = observer;
    observer.observe(el);
  }

  return {
    mounted(el, binding) {
      bind(el, binding.value, undefined);
    },

    updated(el, binding: DirectiveBinding<LazyBindingValue>) {
      const state = stateMap.get(el);
      const next = typeof binding.value === 'string' ? binding.value : binding.value?.src;
      if (!next || next === state?.src) return;

      cleanup(el);
      bind(el, binding.value, state);
    },

    unmounted(el) {
      cleanup(el);
      stateMap.delete(el);
    },
  };
}

/**
 * 默认实例：直接 `app.directive('lazy', vLazy)` 即可用。
 * 需要注入观察器 / 缓存时改用 `createLazyDirective()`。
 */
export const vLazy = createLazyDirective();
