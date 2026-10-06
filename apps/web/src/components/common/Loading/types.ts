import type { ComponentPublicInstance, DirectiveBinding } from 'vue'

/**
 * Loading 组件尺寸类型
 */
export type LoadingSize = 'default' | 'small' | 'large'

/**
 * Loading 组件主题类型
 */
export type LoadingTheme = 'dark' | 'light'

/**
 * Loading 组件属性配置
 */
export interface LoadingProps {
  /**
   * 加载提示文本
   */
  tip?: string

  /**
   * 尺寸大小
   * @default 'default'
   */
  size?: LoadingSize

  /**
   * 是否使用绝对定位（容器内）
   * @default false - false 时为全屏模式
   */
  absolute?: boolean

  /**
   * 加载状态
   * @default false
   */
  loading?: boolean

  /**
   * 自定义背景色
   */
  background?: string

  /**
   * 主题色
   * @default 'light'
   * @description 当 background 存在时优先使用 background
   */
  theme?: LoadingTheme
}

/**
 * Loading 组件实例方法
 */
export interface LoadingInstance {
  /**
   * 关闭 loading
   */
  close: () => void

  /**
   * 打开 loading
   */
  open: () => void

  /**
   * 动态修改提示文本
   */
  setTip: (tip: string) => void

  /**
   * 动态修改加载状态
   */
  setLoading: (loading: boolean) => void
}

/**
 * useLoading 配置选项
 */
export interface UseLoadingOptions extends LoadingProps {
  /**
   * 目标容器（CSS 选择器或元素）
   */
  target?: HTMLElement | string

  /**
   * 是否挂载到 body
   * @default true - 全屏时默认为 true
   */
  body?: boolean

  /**
   * 包装器类名
   */
  wrapClass?: string
}

/**
 * createLoading 配置选项
 */
export interface CreateLoadingOptions extends UseLoadingOptions {
  /**
   * 关闭回调
   */
  onClose?: () => void
}

/**
 * Loading 指令绑定值
 */
export interface LoadingDirectiveBinding {
  /**
   * 是否显示 loading
   */
  value: boolean

  /**
   * 修饰符
   */
  modifiers?: {
    /**
     * 挂载到 body
     */
    body?: boolean

    /**
     * 全屏模式
     */
    fullscreen?: boolean
  }

  /**
   * 参数：提示文本
   */
  arg?: string
}

/**
 * 扩展 HTMLElement 类型，用于存储 loading 实例
 */
declare global {
  interface HTMLElement {
    /**
     * Loading 组件实例
     */
    _loadingInstance?: ComponentPublicInstance<LoadingProps>

    /**
     * Loading 元素容器
     */
    _loadingEl?: HTMLDivElement
  }
}

export type { ComponentPublicInstance, DirectiveBinding }
