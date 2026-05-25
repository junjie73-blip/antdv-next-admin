import type { ModalProps } from './types'

/**
 * Modal 组件默认 Props
 */
export const defaultModalProps: Required<Pick<ModalProps, | 'draggable'
  | 'canFullscreen'
  | 'defaultFullscreen'
  | 'useWrapper'
  | 'showCancelBtn'
  | 'showOkBtn'
  | 'cancelText'
  | 'okText'
  | 'maskClosable'
  | 'keyboard'
  | 'closable'
  | 'centered'
  | 'wrapperFooterOffset'
  | 'zIndex'
  | 'mask'
  | 'destroyOnClose'>> = {
  draggable: true,
  canFullscreen: true,
  defaultFullscreen: false,
  useWrapper: true,
  showCancelBtn: true,
  showOkBtn: true,
  cancelText: '关闭',
  okText: '保存',
  maskClosable: true,
  keyboard: true,
  closable: true,
  centered: false,
  wrapperFooterOffset: 0,
  zIndex: 1000,
  mask: true,
  destroyOnClose: false,
}

/**
 * 获取默认 Props
 */
export function getDefaultModalProps(): typeof defaultModalProps {
  return { ...defaultModalProps }
}
