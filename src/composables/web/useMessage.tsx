import type { ModalFuncProps } from 'antdv-next/dist/modal/interface'
import { CheckCircleFilled, CloseCircleFilled, InfoCircleFilled } from '@antdv-next/icons'
import { message as Message, Modal, notification } from 'antdv-next'
import { isString } from 'es-toolkit'

export interface NotifyApi {
  info: (config: NotificationOptions) => void
  success: (config: NotificationOptions) => void
  error: (config: NotificationOptions) => void
  warn: (config: NotificationOptions) => void
  warning: (config: NotificationOptions) => void
  open: (args: NotificationOptions) => void
  close: (key: string) => void
  config: (options: NotificationOptions) => void
  destroy: () => void
}

export declare type NotificationPlacement = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
export declare type IconType = 'success' | 'info' | 'error' | 'warning'
export interface ModalOptionsEx extends Omit<ModalFuncProps, 'iconType'> {
  iconType: 'warning' | 'success' | 'error' | 'info'
}
export type ModalOptionsPartial = Partial<ModalOptionsEx> & Pick<ModalOptionsEx, 'content'>

function getIcon(iconType: string) {
  if (iconType === 'warning') {
    return <InfoCircleFilled class="modal-icon-warning" />
  }
  else if (iconType === 'success') {
    return <CheckCircleFilled class="modal-icon-success" />
  }
  else if (iconType === 'info') {
    return <InfoCircleFilled class="modal-icon-info" />
  }
  else {
    return <CloseCircleFilled class="modal-icon-error" />
  }
}

function renderContent({ content }: Pick<ModalOptionsEx, 'content'>) {
  if (isString(content)) {
    return <div innerHTML={`<div>${content as string}</div>`}></div>
  }
  else {
    return content
  }
}

/**
 * @description: Create confirmation box
 */
function createConfirm(options: ModalOptionsEx) {
  const iconType = options.iconType || 'warning'
  Reflect.deleteProperty(options, 'iconType')
  const opt: ModalFuncProps = {
    centered: true,
    icon: getIcon(iconType),
    ...options,
    content: renderContent(options),
  }
  return Modal.confirm(opt)
}

function getBaseOptions() {
  return {
    okText: '确认',
    centered: true,
  }
}

function createModalOptions(options: ModalOptionsPartial, icon: string): ModalOptionsPartial {
  return {
    ...getBaseOptions(),
    ...options,
    content: renderContent(options),
    icon: getIcon(icon),
  }
}

function createSuccessModal(options: ModalOptionsPartial) {
  return Modal.success(createModalOptions(options, 'success'))
}

function createErrorModal(options: ModalOptionsPartial) {
  return Modal.error(createModalOptions(options, 'error'))
}

function createInfoModal(options: ModalOptionsPartial) {
  return Modal.info(createModalOptions(options, 'info'))
}

function createWarningModal(options: ModalOptionsPartial) {
  return Modal.warning(createModalOptions(options, 'warning'))
}

/**
 * @description: message
 */
export function useMessage() {
  return {
    createMessage: Message,
    notification,
    createConfirm,
    createSuccessModal,
    createErrorModal,
    createInfoModal,
    createWarningModal,
  }
}
