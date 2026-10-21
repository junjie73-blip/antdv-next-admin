import { onScopeDispose, ref, watch } from 'vue';

import { useScrollLock } from '@vueuse/core';

/**
 * 锁屏的状态机：`lock()` 把屏幕钉住，`unlock()` 放行。
 *
 * 触发点是头像下拉里的「锁屏」（见 `index.vue`），**不改动下拉本身的任何逻辑** ——
 * 这里只管"锁上之后发生了什么"，所以整块功能是新增的两个文件；解锁后监听器摘掉、
 * 滚动锁还原，不留副作用。
 *
 * 三条解锁路径都汇到同一个 `unlock()`：点「解锁屏幕」按钮、把把手向下拖过阈值
 * （阈值见 `lock-screen.vue` 的 `UNLOCK_PULL_THRESHOLD`）、按任意键 ——
 * 第三条与 `header.lockHint` 那句"请点击解锁按钮或按任意键继续"对齐。
 */

/**
 * 页面真正的滚动容器：外壳的内容区交给 reka 的 ScrollArea，
 * 滚的是它的 viewport，不是 `document.body`（body 一直是 `overflow-hidden`）。
 * 只锁 body 会得到"看着锁住了、滚轮还能滚页面"。
 *
 * 按顺序挑第一条命中的：整份文档里 `[data-reka-scroll-area-viewport]` 不止一枚
 * （侧栏菜单、标签栏、页面里自带的滚动区都是），裸选择器拿到的是 DOM 里最靠前的
 * 那一枚，在竖排布局下通常是**侧栏菜单**，而用户滚的是内容区那一枚。
 * 内容区的滚动盒挂在 `[data-layout-region="content"]` 下，所以先按区域收窄，
 * 再退回 `main`，最后才是裸选择器 —— 单测与没有外壳的宿主（只挂 `main`）
 * 都落在后两条上，不会因为收窄而拿不到元素。
 */
const SCROLL_VIEWPORT_SELECTORS = [
  '[data-layout-region="content"] [data-reka-scroll-area-viewport]',
  'main [data-reka-scroll-area-viewport]',
  '[data-reka-scroll-area-viewport]',
];

export function useLockScreen() {
  const locked = ref(false);
  /**
   * 锁上那一刻才去取视口：组件挂载顺序不保证，提前查会拿到 null。
   * 每次锁都重新查一遍，不缓存 —— 换过路由以后内容区那枚滚动盒是新的节点，
   * 攥着上一次那个已脱离文档的元素等于是没锁。
   */
  const viewport = ref<HTMLElement | undefined>(undefined);

  /**
   * 两把滚动锁：reka 的视口 + `<html>`。
   * `useScrollLock` 返回的是"写一下就锁/放"的可写 computed，
   * 它自己记住锁之前的 `overflow`，还原不用我们操心。
   */
  const scrollLockViewport = useScrollLock(viewport);
  const scrollLockHtml = useScrollLock(document.documentElement);

  /** 键盘：锁上期间吞掉第一次按键（不让它落进页面里的输入框），同时解锁 */
  function onKeydown(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    unlock();
  }

  watch(locked, (value) => {
    if (!value) {
      window.removeEventListener('keydown', onKeydown, { capture: true });
      scrollLockViewport.value = false;
      scrollLockHtml.value = false;
      return;
    }
    viewport.value =
      SCROLL_VIEWPORT_SELECTORS.map((selector) =>
        document.querySelector<HTMLElement>(selector),
      ).find(Boolean) ?? undefined;
    scrollLockViewport.value = true;
    scrollLockHtml.value = true;
    window.addEventListener('keydown', onKeydown, { capture: true });
  });

  function lock() {
    locked.value = true;
  }

  function unlock() {
    locked.value = false;
  }

  // 宿主销毁时如果还锁着，监听器与滚动锁都要还原，不能留一把没人管的锁
  onScopeDispose(() => {
    window.removeEventListener('keydown', onKeydown, { capture: true });
  });

  return { lock, locked, unlock };
}
