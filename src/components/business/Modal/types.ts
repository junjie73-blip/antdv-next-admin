import type { ButtonProps } from 'antdv-next'
import type { CSSProperties } from 'vue'

/**
 * ModalProps - 弹窗配置
 */
export interface ModalProps {
  /** 是否显示（v-model:open） */
  'open'?: boolean
  /** 标题 */
  'title'?: string
  /** 标题右侧提示文本 */
  'helpMessage'?: string | string[]

  /** 宽度 */
  'width'?: string | number
  /** 固定高度 */
  'height'?: number
  /** 最小高度 */
  'minHeight'?: number

  /** 自适应高度（默认 true） */
  'useWrapper'?: boolean
  /** 居中显示（默认 false） */
  'centered'?: boolean

  /** 底部偏移量（默认 0） */
  'wrapperFooterOffset'?: number

  /** 弹窗 loading */
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
  /** 对话框样式 */
  'dialogStyle'?: CSSProperties
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
  'onUpdate:open'?: (visible: boolean) => void
}

/**
 * ModalMethods - useModal 返回的方法
 */
export interface ModalMethods {
  /** 打开弹窗（可传数据） */
  openModal: <T = any>(visible?: boolean, data?: T) => void
  /** 关闭弹窗 */
  closeModal: () => void
  /** 动态修改 props */
  setModalProps: (props: Partial<ModalProps>) => void
  /** 获取显示状态 */
  getVisible: () => boolean
}

/**
 * ModalInnerMethods - useModalInner 返回的方法
 */
export interface ModalInnerMethods {
  /** 关闭弹窗 */
  closeModal: () => void
  /** 动态修改 props */
  setModalProps: (props: Partial<ModalProps>) => void
  /** 修改确认按钮 loading */
  changeOkLoading: (loading: boolean) => void
  /** 修改弹窗 loading */
  changeLoading: (loading: boolean) => void
}

/**
 * UseModalReturnType - useModal 返回值类型
 */
export type UseModalReturnType = [
  (instance: ModalMethods) => void, // register 注册函数
  ModalMethods, // 操作方法
]

/**
 * UseModalInnerReturnType - useModalInner 返回值类型
 */
export type UseModalInnerReturnType = [
  (instance: ModalInnerMethods) => void, // register 注册函数
  ModalInnerMethods, // 操作方法
]

/**
 * ModalWrapperProps - 内容包装器配置
 */
export interface ModalWrapperProps {
  loading?: boolean
  loadingTip?: string
  minHeight?: number
  height?: number
  footerOffset?: number
  visible?: boolean
  useWrapper?: boolean
}

// 使用全局类型 RegisterFn、CallbackFn、Nullable
// 这些类型在全局类型定义中统一导出
