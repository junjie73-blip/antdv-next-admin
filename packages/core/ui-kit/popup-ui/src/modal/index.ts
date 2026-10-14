// 类型
export type {
  CallbackFn,
  ModalInnerMethods,
  ModalMethods,
  ModalProps,
  ModalWrapperProps,
  Nullable,
  PopupButtonProps,
  UseModalInnerReturnType,
  UseModalReturnType,
} from '../types';
// 主组件
export { default as BasicModal } from './BasicModal.vue';

export { default as ModalWrapper } from './ModalWrapper.vue';

// Hooks
export { useModal } from './useModal';
export { useModalInner } from './useModalInner';
