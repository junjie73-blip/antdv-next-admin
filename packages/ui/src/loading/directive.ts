import type { Directive, DirectiveBinding } from 'vue';

import type { OverlayInstance } from './overlay';
import type { LoadingProps } from './types';

import { createOverlay } from './overlay';

/**
 * v-loading 指令
 * 用于在元素上添加 loading 效果
 *
 * @example
 * // 基础用法（容器内绝对定位覆盖）
 * <div v-loading="isLoading">内容</div>
 *
 * @example
 * // 提示文本：三种写法，优先级 属性 > 指令参数
 * <div v-loading="isLoading" loading-tip="加载中...">内容</div>
 * <div v-loading:加载中="isLoading">内容</div>
 *
 * @example
 * // 自定义背景色 / 主题 / 尺寸
 * <div v-loading="isLoading" loading-background="rgba(0,0,0,0.5)">内容</div>
 * <div v-loading="isLoading" loading-theme="dark">内容</div>
 * <div v-loading="isLoading" loading-size="large">内容</div>
 *
 * @example
 * // 全屏模式 / 挂到 body（修饰符）
 * <div v-loading.fullscreen="isLoading">内容</div>
 * <div v-loading.body="isLoading">内容</div>
 */

/** 属性名 → LoadingProps 字段，模板里写 `loading-xxx`，内部转成 camelCase */
const ATTRIBUTE_PROPS = [
  { attr: 'loading-background', key: 'background' },
  { attr: 'loading-size', key: 'size' },
  { attr: 'loading-theme', key: 'theme' },
  { attr: 'loading-tip', key: 'tip' },
] as const;

/**
 * 实例挂在 WeakMap 上而不是元素的私有属性上：
 * 不污染 DOM、元素被回收时实例一起消失，也不需要在类型上给 HTMLElement 开洞。
 */
const overlays = new WeakMap<HTMLElement, OverlayInstance>();

function getPropsFromAttributes(el: HTMLElement): Partial<LoadingProps> {
  const props: Partial<LoadingProps> = {};
  for (const { attr, key } of ATTRIBUTE_PROPS) {
    const value = el.getAttribute(attr);
    if (value) {
      Object.assign(props, { [key]: value });
    }
  }
  return props;
}

/** 修饰符决定挂载位置：默认覆盖元素，`.body` / `.fullscreen` 挂到 body 全屏 */
function isBodyMount(binding: DirectiveBinding<boolean>): boolean {
  return Boolean(binding.modifiers?.body || binding.modifiers?.fullscreen);
}

/**
 * 取（或建）元素对应的覆盖层实例。
 *
 * 覆盖层是懒挂载的，所以这里即使 `binding.value` 为 false 也可以安全建实例 ——
 * 不会有"先建一个隐藏的 loading，值变 true 时却不再更新"的老问题。
 */
function ensureOverlay(el: HTMLElement, binding: DirectiveBinding<boolean>) {
  const existing = overlays.get(el);
  if (existing) {
    return existing;
  }

  const attributeProps = getPropsFromAttributes(el);
  const overlay = createOverlay({
    ...attributeProps,
    body: isBodyMount(binding),
    loading: Boolean(binding.value),
    target: el,
    tip: binding.arg ?? attributeProps.tip,
    wrapClass: 'loading-directive-wrapper',
  });
  overlays.set(el, overlay);
  return overlay;
}

const loadingDirective: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    ensureOverlay(el, binding);
  },

  updated(el, binding) {
    const overlay = ensureOverlay(el, binding);
    overlay.setVisible(Boolean(binding.value));
    if (binding.arg) {
      overlay.tip.value = binding.arg;
    }
  },

  unmounted(el) {
    overlays.get(el)?.destroy();
    overlays.delete(el);
  },
};

export default loadingDirective;
