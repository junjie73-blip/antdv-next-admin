import type { MaybeRefOrGetter, Ref } from 'vue';

import type { LoadingProps } from './types';

import { createApp, h, ref, toValue, watch } from 'vue';

import Loading from './Loading.vue';

/**
 * 淡出动画时长（ms）。
 * 必须与 `Loading.vue` 里 `loading-fade` transition 的时长一致：
 * 这里负责"动画放完再摘 DOM"，改一处不改另一处就会出现闪烁或残影。
 */
export const LEAVE_DURATION = 300;

export interface OverlayOptions extends LoadingProps {
  /** 挂载到 body；false 时挂进 `target` 内部并用绝对定位铺满 */
  body?: boolean;
  /** 挂载容器：选择器 / 元素 / ref / getter，`body` 为 false 时才有意义 */
  target?: MaybeRefOrGetter<HTMLElement | string | undefined>;
  /** 覆盖层外层容器的类名 */
  wrapClass?: string;
}

/**
 * 覆盖层句柄：把内部状态以 ref 形式暴露出去，写 ref 就等于改视图。
 *
 * 之所以不做成"方法 + 私有状态"，是因为宿主（`useLoading`、指令）本身就想用响应式驱动；
 * 暴露 ref 也让单测可以直接观察状态，而不必猜内部实现。
 */
export interface OverlayInstance {
  /** 立即销毁并移除 DOM（不等淡出） */
  destroy: () => void;
  /** 当前覆盖层容器元素；未挂载时为 null */
  getEl: () => HTMLDivElement | null;
  /** DOM 是否已挂载 */
  isMounted: () => boolean;
  /** 加载状态：写它即驱动显隐，首次为 true 时自动挂载 DOM */
  loading: Ref<boolean>;
  /**
   * 设置显隐。
   *
   * 与直接写 `loading.value` 的区别：`setVisible(true)` 在状态已经是 true 时仍会重试挂载。
   * 容器模式下目标元素可能晚于 `open()` 才出现，那时第一次挂载失败，
   * 后续再 `open()` 不该被"状态没变"吃掉。
   */
  setVisible: (value: boolean) => void;
  /** 提示文本：写它即更新 */
  tip: Ref<string>;
}

/**
 * 创建响应式 loading 覆盖层 —— `useLoading` 与 `v-loading` 指令共用的唯一实现。
 *
 * 关键设计：**懒挂载**。
 * - `loading` 从 false 变 true 时才 `createApp` 并插入 DOM；
 * - 变回 false 时等 `LEAVE_DURATION` 再卸载，动画期间若再次打开会取消卸载；
 * - 因此常驻但极少触发的 loading（如指令挂在每个卡片上）不会留下一堆僵尸 DOM。
 */
export function createOverlay(options: OverlayOptions = {}): OverlayInstance {
  const {
    body = true,
    target,
    wrapClass,
    loading: initialLoading,
    tip: initialTip,
    ...loadingProps
  } = options;

  const loading = ref(initialLoading ?? false);
  const tip = ref(initialTip ?? '');

  let el: HTMLDivElement | null = null;
  let app: null | ReturnType<typeof createApp> = null;
  let removeTimer: null | ReturnType<typeof setTimeout> = null;

  /** 解析挂载容器；`body` 模式恒为 document.body */
  const resolveContainer = (): HTMLElement | null => {
    if (body) {
      return document.body;
    }
    const value = toValue(target);
    if (typeof value === 'string') {
      return document.querySelector<HTMLElement>(value);
    }
    return value instanceof HTMLElement ? value : null;
  };

  const clearRemoveTimer = () => {
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimer = null;
    }
  };

  const mount = () => {
    if (el) {
      return;
    }

    const container = resolveContainer();
    if (!container) {
      console.warn('[@antdv/ui] loading: target 容器不存在，覆盖层未挂载');
      return;
    }

    // 容器内模式：父级必须是定位元素，否则 absolute 会相对视口铺满
    if (!body) {
      const position = getComputedStyle(container).position;
      if (!position || position === 'static') {
        container.style.position = 'relative';
      }
    }

    el = document.createElement('div');
    if (wrapClass) {
      el.className = wrapClass;
    }

    /**
     * 用 render 函数把 ref 读进 props，Vue 才会建立响应式依赖。
     * 直接 `createApp(Loading, { loading: loading.value })` 传的是快照，
     * 之后 open()/setTip() 永远不会有视觉变化——这是本包抽离时修掉的原始 bug。
     */
    app = createApp({
      render: () =>
        h(Loading, {
          ...loadingProps,
          absolute: !body,
          loading: loading.value,
          tip: tip.value,
        }),
    });
    app.mount(el);

    container.append(el);
  };

  const destroy = () => {
    clearRemoveTimer();
    if (!app || !el) {
      return;
    }
    app.unmount();
    el.remove();
    app = null;
    el = null;
  };

  // sync flush：open() 之后同步就能在 DOM 里查到，调用方不需要额外 await
  watch(
    loading,
    (visible) => {
      if (visible) {
        clearRemoveTimer();
        mount();
        return;
      }
      clearRemoveTimer();
      removeTimer = setTimeout(() => {
        removeTimer = null;
        if (!loading.value) {
          destroy();
        }
      }, LEAVE_DURATION);
    },
    { flush: 'sync' },
  );

  if (loading.value) {
    mount();
  }

  return {
    destroy,
    getEl: () => el,
    isMounted: () => el !== null,
    loading,
    setVisible: (value: boolean) => {
      loading.value = value;
      if (value) {
        mount();
      }
    },
    tip,
  };
}
