/**
 * CountTo 组件属性
 */
export interface CountToProps {
  /**
   * 起始值
   * @default 0
   */
  startVal?: number

  /**
   * 结束值
   * @default 0
   */
  endVal?: number

  /**
   * 动画持续时间（毫秒）
   * @default 2000
   */
  duration?: number

  /**
   * 自动播放
   * @default true
   */
  autoplay?: boolean

  /**
   * 小数位数
   * @default 0
   */
  decimals?: number

  /**
   * 小数点符号
   * @default '.'
   */
  decimal?: string

  /**
   * 千分位分隔符
   * @default ','
   */
  separator?: string

  /**
   * 前缀
   */
  prefix?: string

  /**
   * 后缀
   */
  suffix?: string

  /**
   * 是否使用缓动函数
   * @default true
   */
  useEasing?: boolean

  /**
   * 缓动函数类型
   * @default 'easeOutExpo'
   */
  easingFn?: 'easeOutExpo' | 'linear' | 'easeInOutCubic'

  /**
   * 自定义类名
   */
  className?: string

  /**
   * 自定义样式
   */
  style?: Record<string, string>
}

/**
 * CountTo 组件实例方法
 */
export interface CountToInstance {
  /**
   * 开始动画
   */
  start: () => void

  /**
   * 暂停动画
   */
  pause: () => void

  /**
   * 重置动画
   */
  reset: () => void

  /**
   * 获取当前值
   */
  getCurrentValue: () => number
}

/**
 * CountTo 组件事件
 */
export interface CountToEvents {
  /**
   * 动画结束事件
   */
  (e: 'finished'): void

  /**
   * 值变化事件
   */
  (e: 'change', value: number): void
}
