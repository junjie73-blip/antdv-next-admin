/**
 * v-lazy 图片懒加载指令
 *
 * 优化策略：
 * 1. 使用 IntersectionObserver（性能优于 scroll 事件）
 * 2. 支持 placeholder 占位图
 * 3. 支持错误回退图
 * 4. 支持渐显效果（避免闪烁）
 * 5. 自动解除观察（内存友好）
 *
 * 使用示例：
 * <img v-lazy="'https://example.com/image.jpg'" :data-placeholder="placeholderUrl" />
 * <img v-lazy src="..." error="error.jpg" />
 */

import type { Directive, DirectiveBinding } from 'vue'

interface LazyOptions {
  /** 图片 URL */
  src: string
  /** 占位图 URL（可选） */
  placeholder?: string
  /** 错误回退图 URL（可选） */
  error?: string
  /** 是否启用渐显效果（默认 true） */
  fade?: boolean
  /** 渐显时长 ms（默认 300） */
  duration?: number
  /** 根边距（默认 100px） */
  rootMargin?: string
  /** 可见度阈值（默认 0.1） */
  threshold?: number
}

// 缓存已加载的图片 URL（避免重复请求）
const loadedImages = new Set<string>()

/**
 * 创建 IntersectionObserver 实例
 */
function createObserver(
  el: HTMLImageElement,
  options: LazyOptions,
): IntersectionObserver {
  const {
    rootMargin = '100px',
    threshold = 0.1,
    fade = true,
    duration = 300,
  } = options

  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // 元素进入视口
        if (entry.isIntersecting) {
          loadImage(el, options, fade, duration)
          // 停止观察（图片只需加载一次）
          observer.unobserve(el)
        }
      })
    },
    {
      rootMargin,
      threshold,
    },
  )
}

/**
 * 加载图片
 */
function loadImage(
  el: HTMLImageElement,
  options: LazyOptions,
  fade: boolean,
  duration: number,
): void {
  const { src, placeholder, error } = options

  // 显示占位图
  if (placeholder && !el.src) {
    el.src = placeholder
  }

  // 如果已经加载过，直接设置
  if (loadedImages.has(src)) {
    el.src = src
    return
  }

  // 创建临时 Image 对象预加载
  const img = new Image()

  img.onload = () => {
    // 标记为已加载
    loadedImages.add(src)

    // 设置真实图片
    if (fade) {
      // 渐显效果：先透明，再淡入
      el.style.opacity = '0'
      el.style.transition = `opacity ${duration}ms ease-in-out`
      el.src = src

      // 触发重排后开始动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = '1'
        })
      })
    }
    else {
      el.src = src
    }
  }

  img.onerror = () => {
    console.warn(`[v-lazy] 图片加载失败: ${src}`)
    // 设置错误回退图
    if (error) {
      el.src = error
    }
  }

  img.src = src
}

/**
 * 指令实现
 */
const lazyDirective: Directive<HTMLImageElement, string | LazyOptions> = {
  mounted(el: HTMLImageElement, binding: DirectiveBinding<string | LazyOptions>) {
    // 解析参数
    let options: LazyOptions

    if (typeof binding.value === 'string') {
      options = { src: binding.value }
    }
    else {
      options = binding.value
    }

    // 验证参数
    if (!options.src) {
      console.warn('[v-lazy] 缺少必需的 src 参数')
      return
    }

    // 初始状态
    el.dataset.src = options.src

    // 设置默认样式
    if (options.fade !== false) {
      el.style.transition = 'opacity 300ms ease-in-out'
    }

    // 创建观察者
    const observer = createObserver(el, options)
    observer.observe(el)

    // 存储观察者引用（用于卸载时清理）
    ;(el as any)._lazyObserver = observer
  },

  updated(el: HTMLImageElement, binding: DirectiveBinding<string | LazyOptions>) {
    // 如果 src 变化，重新观察
    const newSrc = typeof binding.value === 'string' ? binding.value : binding.value?.src
    const oldSrc = el.dataset.src

    if (newSrc && newSrc !== oldSrc) {
      // 清理旧观察者
      unmounted(el)

      // 重新绑定
      mounted(el, binding as any)
    }
  },

  unmounted(el: HTMLImageElement) {
    // 清理观察者
    const observer = (el as any)._lazyObserver as IntersectionObserver | undefined
    if (observer) {
      observer.disconnect()
      delete (el as any)._lazyObserver
    }
  },
}

// 导出类型和指令
export { type LazyOptions }
export default lazyDirective
