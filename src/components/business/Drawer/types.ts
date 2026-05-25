import type { ButtonProps } from 'antdv-next'
import type { CSSProperties } from 'vue'

/**
 * DrawerPlacement - 抽屉弹出位置
 */
export type DrawerPlacement = 'top' | 'right' | 'bottom' | 'left'

/**
 * DrawerProps - 抽屉配置
 */
export interface DrawerProps {
  /** 是否显示（v-model:open） */
  'open'?: boolean
  /** 标题 */
  'title'?: string
  /** 标题右侧提示文本 */
  'helpMessage'?: string | string[]

  /** 尺寸（推荐使用，替代 width/height） */
  'size'?: string | number
  /** 宽度（当 placement 为 left/right 时有效，已废弃请用 size） */
  'width'?: string | number
  /** 高度（当 placement 为 top/bottom 时有效，已废弃请用 size） */
  'height'?: string | number

  /** 弹出位置（默认 right） */
  'placement'?: DrawerPlacement
  /** 自适应高度（默认 true） */
  'useWrapper'?: boolean

  /** 底部偏移量（默认 0） */
  'wrapperFooterOffset'?: number

  /** 抽屉 loading */
  'loading'?: boolean
  /** loading 文本 */
  'loadingTip'?: string

  /** 显示取消按钮（默认 true） */
  'showCancelBtn'?: boolean
  /** 显示确认按钮（默认 true） */
  'showOkBtn'?: boolean
  /** 取消按钮文本（默认 '关闭'） */
  'cancelText'?: string
  /** 确认按钮文本（默认 '保存'） */
  'okText'?: string
  /** 确认按钮 props */
  'okButtonProps'?: ButtonProps
  /** 取消按钮 props */
  'cancelButtonProps'?: ButtonProps
  /** 确认按钮类型 */
  'okType'?: 'primary' | 'danger' | 'dashed' | 'ghost' | 'default'

  /** 显示关闭图标（默认 true） */
  'closable'?: boolean
  /** 点击蒙层关闭（默认 true） */
  'maskClosable'?: boolean
  /** ESC 关闭（默认 true） */
  'keyboard'?: boolean
  /** 关闭时销毁内容（默认 false） */
  'destroyOnHidden'?: boolean
  /** 关闭前回调，返回 true 才关闭 */
  'closeFunc'?: () => Promise<boolean>

  /** zIndex */
  'zIndex'?: number
  /** 是否显示蒙层 */
  'mask'?: boolean
  /** 蒙层样式 */
  'maskStyle'?: CSSProperties
  /** 内容区域样式 */
  'bodyStyle'?: CSSProperties
  /** 抽屉样式 */
  'drawerStyle'?: CSSProperties
  /** 头部样式 */
  'headerStyle'?: CSSProperties
  /** 底部样式 */
  'footerStyle'?: CSSProperties
  /** 包裹层类名 */
  'wrapClassName'?: string
  /** 关闭后回调 */
  'afterClose'?: () => void

  /** 确认事件 */
  'onOk'?: (e: MouseEvent) => void | Promise<void>
  /** 取消事件 */
  'onCancel'?: (e: MouseEvent) => void
  /** 显示状态变化事件 */
  'onVisible-change'?: (visible: boolean) => void
  /** v-model 更新事件 */
  'onUpdate:visible'?: (visible: boolean) => void
}

/**
 * DrawerMethods - useDrawer 返回的方法
 */
export interface DrawerMethods {
  /** 打开抽屉（可传数据） */
  openDrawer: <T = any>(visible?: boolean, data?: T) => void
  /** 关闭抽屉 */
  closeDrawer: () => void
  /** 动态修改 props */
  setDrawerProps: (props: Partial<DrawerProps>) => void
  /** 获取显示状态 */
  getVisible: () => boolean
}

/**
 * DrawerInnerMethods - useDrawerInner 返回的方法
 */
export interface DrawerInnerMethods {
  /** 关闭抽屉 */
  closeDrawer: () => void
  /** 动态修改 props */
  setDrawerProps: (props: Partial<DrawerProps>) => void
  /** 修改确认按钮 loading */
  changeOkLoading: (loading: boolean) => void
  /** 修改抽屉 loading */
  changeLoading: (loading: boolean) => void
}

/**
 * UseDrawerReturnType - useDrawer 返回值类型
 */
export type UseDrawerReturnType = [
  (instance: DrawerMethods) => void, // register 注册函数
  DrawerMethods, // 操作方法
]

/**
 * UseDrawerInnerReturnType - useDrawerInner 返回值类型
 */
export type UseDrawerInnerReturnType = [
  (instance: DrawerInnerMethods) => void, // register 注册函数
  DrawerInnerMethods, // 操作方法
]

/**
 * DrawerWrapperProps - 内容包装器配置
 */
export interface DrawerWrapperProps {
  loading?: boolean
  loadingTip?: string
  height?: number
  footerOffset?: number
  visible?: boolean
  useWrapper?: boolean
}

// 使用全局类型 RegisterFn、CallbackFn、Nullable
// 这些类型在全局类型定义中统一导出
