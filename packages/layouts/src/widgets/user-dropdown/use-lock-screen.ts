import { computed, onScopeDispose, ref, watch } from 'vue';

import { useScrollLock } from '@vueuse/core';

import {
  hasLockPassword,
  setLockPassword,
  verifyLockPassword,
} from './lock-password';

/**
 * 锁屏的状态机：`lock()` 把屏幕钉住，`submitPassword()` 校验通过才 `unlock()`。
 *
 * 触发点是头像下拉里的「锁屏」（见 `index.vue`），**不改动下拉本身的任何逻辑** ——
 * 这里只管"锁上之后发生了什么"，所以整块功能是新增文件；解锁后监听器摘掉、
 * 滚动锁还原，不留副作用。
 *
 * 密码流程（本次新增）：
 * - 首次锁屏（未设密码）进入 `setup` 模式：设置成功**仍保持锁定**，
 *   再切到 `unlock` 模式要求输入一次——对应「首次设置后也要校验才能解锁」；
 * - 已有密码时直接进 `unlock` 模式；
 * - 校验失败 / 空密码只更新 `errorMessageKey`，`locked` 一直是 true；
 * - 原来的「按任意键解锁」已移除：它无法做密码校验，留着就是绕过保护的后门。
 */

/** 锁屏面板当前处于「首次设置密码」还是「输入密码解锁」 */
export type LockScreenMode = 'setup' | 'unlock';

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
  const mode = ref<LockScreenMode>('unlock');
  /** i18n key；为空表示当前没有错误。UI 用 `t(errorMessageKey.value)` 显示 */
  const errorMessageKey = ref('');
  /** 连续失败次数：给宿主做「记住我」/限流之类扩展留一个钩子，本实现不据此锁定 */
  const failedAttempts = ref(0);

  const needsSetup = computed(() => mode.value === 'setup');

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

  /**
   * 键盘：锁上期间仍吞掉落不到密码框的按键（不让它们进页面里的输入框），
   * 但**不再用按键解锁**——任何解锁都必须走密码校验。
   * 密码框内的按键放行，否则用户根本输入不了密码。
   */
  function onKeydown(event: KeyboardEvent) {
    // 监听器挂在 window 的捕获阶段：直接 dispatch 到 window 时 target 就是 window，
    // 它没有 closest()。只有真正的 Element 才可能是密码框，先判类型再查。
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-lock-password-input]')
    )
      return;
    event.preventDefault();
    event.stopPropagation();
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
    errorMessageKey.value = '';
    failedAttempts.value = 0;
    // 没设过密码：先进入设置模式；设置成功后仍回到解锁模式再校验一次
    mode.value = hasLockPassword() ? 'unlock' : 'setup';
    locked.value = true;
  }

  function unlock() {
    locked.value = false;
    errorMessageKey.value = '';
    failedAttempts.value = 0;
  }

  /** 供外部（忘记密码后由宿主鉴权重置）主动放弃锁定，不经过密码校验 */
  function forceUnlock() {
    unlock();
  }

  /**
   * 面板提交：setup 模式写入新密码并切到 unlock（保持锁定）；
   * unlock 模式校验，成功才放行，失败只登记错误与次数。
   */
  function submitPassword(password: string, confirm = ''): boolean {
    if (!locked.value) return true;

    if (mode.value === 'setup') {
      const result = setLockPassword(password, confirm);
      if (!result.ok) {
        errorMessageKey.value =
          result.messageKey ?? 'header.lockPasswordRequired';
        failedAttempts.value += 1;
        return false;
      }
      errorMessageKey.value = '';
      failedAttempts.value = 0;
      // 设置成功不代表放行：仍需再输一次完成校验
      mode.value = 'unlock';
      return true;
    }

    if (!verifyLockPassword(password)) {
      errorMessageKey.value = 'header.lockPasswordWrong';
      failedAttempts.value += 1;
      return false;
    }
    unlock();
    return true;
  }

  // 宿主销毁时如果还锁着，监听器与滚动锁都要还原，不能留一把没人管的锁
  onScopeDispose(() => {
    window.removeEventListener('keydown', onKeydown, { capture: true });
  });

  return {
    errorMessageKey,
    failedAttempts,
    forceUnlock,
    lock,
    locked,
    mode,
    needsSetup,
    submitPassword,
    unlock,
  };
}
