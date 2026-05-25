import type { App, Directive } from 'vue'
import type { LoadingDirectiveBinding, LoadingProps, LoadingSize, LoadingTheme } from './types'
import { createApp } from 'vue'
import Loading from './Loading.vue'

/**
 * v-loading 指令
 * 用于在元素上添加 loading 效果
 *
 * @example
 * // 基础用法
 * <div v-loading="isLoading">内容</div>
 *
 * @example
 * // 带提示文本
 * <div v-loading="isLoading" loading-tip="加载中...">内容</div>
 *
 * @example
 * // 自定义背景色
 * <div v-loading="isLoading" loading-background="rgba(0,0,0,0.5)">内容</div>
 *
 * @example
 * // 暗色主题
 * <div v-loading="isLoading" loading-theme="dark">内容</div>
 *
 * @example
 * // 自定义尺寸
 * <div v-loading="isLoading" loading-size="large">内容</div>
 *
 * @example
 * // 全屏模式（使用修饰符）
 * <div v-loading.fullscreen="isLoading">内容</div>
 *
 * @example
 * // 挂载到 body（使用修饰符）
 * <div v-loading.body="isLoading">内容</div>
 */

/**
 * 存储在元素上的 loading 状态
 */
interface LoadingState {
  app: App<Element>
  loadingEl: HTMLDivElement
}

/**
 * 从元素属性中读取 loading 配置
 */
function getLoadingPropsFromEl(el: HTMLElement): Partial<LoadingProps> {
  const tip = el.getAttribute('loading-tip') || ''
  const background = el.getAttribute('loading-background') || ''
  const theme = (el.getAttribute('loading-theme') as LoadingTheme) || 'light'
  const size = (el.getAttribute('loading-size') as LoadingSize) || 'default'

  return {
    tip,
    background,
    theme,
    size,
  }
}

/**
 * 确保容器有定位
 */
function ensurePosition(el: HTMLElement): void {
  const position = getComputedStyle(el).position
  if (position === 'static') {
    el.style.position = 'relative'
  }
}

/**
 * 获取或创建 loading 状态
 */
function getLoadingState(el: HTMLElement): LoadingState | undefined {
  return (el as HTMLElement & { _loadingState?: LoadingState })._loadingState
}

/**
 * 设置 loading 状态
 */
function setLoadingState(el: HTMLElement, state: LoadingState | undefined): void {
  (el as HTMLElement & { _loadingState?: LoadingState })._loadingState = state
}

/**
 * 创建 loading 实例
 */
function createLoadingInstance(
  el: HTMLElement,
  binding: LoadingDirectiveBinding,
): void {
  // 如果已存在，先移除
  const existingState = getLoadingState(el)
  if (existingState) {
    removeLoading(el)
  }

  // 读取配置
  const props = getLoadingPropsFromEl(el)
  const isFullscreen = binding.modifiers?.fullscreen || false
  const isBody = binding.modifiers?.body || isFullscreen

  // 确保容器定位（非 body 挂载时）
  if (!isBody) {
    ensurePosition(el)
  }

  // 创建容器元素
  const loadingEl = document.createElement('div')
  loadingEl.className = 'loading-directive-wrapper'

  // 创建 Vue 应用实例
  const app = createApp(Loading, {
    ...props,
    loading: binding.value,
    absolute: !isBody,
  })

  // 挂载组件
  app.mount(loadingEl)

  // 存储状态
  setLoadingState(el, { app, loadingEl })

  // 添加到 DOM
  if (isBody) {
    document.body.appendChild(loadingEl)
  }
  else {
    el.appendChild(loadingEl)
  }
}

/**
 * 移除 loading
 */
function removeLoading(el: HTMLElement): void {
  const state = getLoadingState(el)
  if (!state)
    return

  const { app, loadingEl } = state

  // 先设置 loading 为 false，触发关闭动画
  // 获取组件实例并更新 loading 状态
  // 延迟移除 DOM，等待动画结束
  setTimeout(() => {
    // 检查是否还在 DOM 中（可能已经被重新创建）
    if (loadingEl.parentNode) {
      loadingEl.remove()
      app.unmount()
    }
    // 清理引用
    if (getLoadingState(el) === state) {
      setLoadingState(el, undefined)
    }
  }, 300)
}

/**
 * v-loading 指令定义
 */
const loadingDirective: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    createLoadingInstance(el, binding as LoadingDirectiveBinding)
  },

  updated(el, binding) {
    // 如果值没有变化，不处理
    if (binding.value === binding.oldValue) {
      return
    }

    const state = getLoadingState(el)

    if (binding.value) {
      // 打开 loading
      if (!state) {
        createLoadingInstance(el, binding as LoadingDirectiveBinding)
      }
    }
    else {
      // 关闭 loading
      if (state) {
        removeLoading(el)
      }
    }
  },

  unmounted(el) {
    const state = getLoadingState(el)
    if (state) {
      const { app, loadingEl } = state
      if (loadingEl.parentNode) {
        loadingEl.remove()
      }
      app.unmount()
      setLoadingState(el, undefined)
    }
  },
}

export default loadingDirective
