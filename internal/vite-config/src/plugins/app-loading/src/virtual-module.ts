import type { AppLoadingOptions } from './types';

export function resolveVirtualModule(
  options: Required<AppLoadingOptions>,
): string {
  const {
    containerSelector,
    fadeDuration,
    fadeProperty,
    autoRemove,
    autoRemoveDelay,
  } = options;

  return `
const CONTAINER_SELECTOR = ${JSON.stringify(containerSelector)};
const FADE_DURATION = ${fadeDuration};
const FADE_PROPERTY = ${JSON.stringify(fadeProperty)};

function getContainer() {
  return document.querySelector(CONTAINER_SELECTOR);
}

/**
 * 手动移除 loading 容器（无动画）
 */
export function removeAppLoading() {
  const el = getContainer();
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/**
 * 带淡出动画移除 loading 容器
 */
export function loadingFadeOut() {
  const el = getContainer();
  if (!el) return;

  el.style.transition = \`\${FADE_PROPERTY} \${FADE_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)\`;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';

  setTimeout(() => {
    removeAppLoading();
  }, FADE_DURATION);
}

/**
 * 获取 loading 上下文
 */
export function useAppLoading() {
  return {
    element: getContainer(),
    remove: removeAppLoading,
    fadeOut: loadingFadeOut,
  };
}

${
  autoRemove
    ? `
// 自动移除模式
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => loadingFadeOut(), ${autoRemoveDelay});
  });
}
`
    : ''
}

// 默认导出 fadeOut 作为快捷方式
export default loadingFadeOut;
`;
}
