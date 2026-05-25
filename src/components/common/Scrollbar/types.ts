import type { CSSProperties, VNodeChild } from 'vue'

/**
 * Scrollbar 组件属性
 */
export interface ScrollbarProps {
  /**
   * 容器高度
   */
  height?: string | number

  /**
   * 容器最大高度
   */
  maxHeight?: string | number

  /**
   * 是否显示原生滚动条
   * @default false
   */
  native?: boolean

  /**
   * 是否始终显示滚动条
   * @default false
   */
  always?: boolean

  /**
   * 滚动条最小尺寸
   * @default 20
   */
  minSize?: number

  /**
   * 滚动条轨道颜色
   */
  trackColor?: string

  /**
   * 滚动条 thumb 颜色
   */
  thumbColor?: string

  /**
   * 滚动条宽度
   * @default 6
   */
  barWidth?: number

  /**
   * 是否平滑滚动
   * @default true
   */
  smooth?: boolean

  /**
   * 是否隐藏水平滚动条
   * @default false
   */
  noHorizontal?: boolean

  /**
   * 是否隐藏垂直滚动条
   * @default false
   */
  noVertical?: boolean

  /**
   * 包裹元素的标签名
   * @default 'div'
   */
  tag?: string

  /**
   * 包裹元素的类名
   */
  wrapClass?: string

  /**
   * 包裹元素的内联样式
   */
  wrapStyle?: CSSProperties

  /**
   * 视图元素的类名
   */
  viewClass?: string

  /**
   * 视图元素的内联样式
   */
  viewStyle?: CSSProperties
}

/**
 * Scrollbar 组件实例方法
 */
export interface ScrollbarInstance {
  /**
   * 滚动到指定位置
   */
  scrollTo: (options: ScrollToOptions | number, y?: number) => void

  /**
   * 设置滚动位置
   */
  setScrollTop: (top: number) => void

  /**
   * 设置水平滚动位置
   */
  setScrollLeft: (left: number) => void

  /**
   * 更新滚动条状态
   */
  update: () => void

  /**
   * 获取滚动容器元素
   */
  getWrapRef: () => HTMLElement | null
}

/**
 * 滚动条位置信息
 */
export interface ScrollbarPosition {
  scrollTop: number
  scrollLeft: number
}

/**
 * 滚动条尺寸信息
 */
export interface ScrollbarSize {
  width: number
  height: number
  scrollWidth: number
  scrollHeight: number
}

/**
 * Scrollbar 组件事件
 */
export interface ScrollbarEvents {
  /**
   * 滚动事件
   */
  (e: 'scroll', position: ScrollbarPosition, event: Event): void
}

/**
 * Scrollbar 组件插槽
 */
export interface ScrollbarSlots {
  /**
   * 默认插槽
   */
  default?: () => VNodeChild
}
