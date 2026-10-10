import type { Ref } from 'vue';

import type {
  CallbackFn,
  ModalInnerMethods,
  Nullable,
  UseModalInnerReturnType,
} from './types';

import { onUnmounted, ref } from 'vue';

/**
 * useModalInner - 用于弹窗组件内部控制自身
 * @param callback - 接收 openModal 传递数据的回调函数
 * @example
 * const [register, { closeModal, setModalProps, changeOkLoading }] = useModalInner((data) => {
 *   console.log('接收数据：', data)
 * })
 */
export function useModalInner<T = any>(
  callback?: CallbackFn<T>,
): UseModalInnerReturnType {
  const modalInstance: Ref<Nullable<ModalInnerMethods>> = ref(null);
  const dataRef: Ref<null | T> = ref(null);

  // 卸载清理挂在调用方的 setup 上，理由同 useDrawer：
  // register 是 BasicModal emit('register') 的回调，那时已经没有"当前实例"，
  // 在回调里调 onUnmounted 只会告警，钩子也不会被任何实例接管。
  onUnmounted(() => {
    modalInstance.value = null;
  });

  /**
   * 注册弹窗实例
   */
  const register = (instance: ModalInnerMethods) => {
    modalInstance.value = instance;

    // 如果有回调函数，设置数据接收方法
    if (callback) {
      const originalOpenModal = instance.openModal;
      instance.openModal = (visible, data) => {
        if (data !== undefined) {
          dataRef.value = data as T;
          callback(data as T);
        }
        originalOpenModal(visible, data);
      };
    }
  };

  /**
   * 操作方法
   */
  const methods: ModalInnerMethods = {
    closeModal: () => {
      modalInstance.value?.closeModal();
    },
    setModalProps: (props) => {
      modalInstance.value?.setModalProps(props);
    },
    changeOkLoading: (loading) => {
      modalInstance.value?.changeOkLoading?.(loading);
    },
    changeLoading: (loading) => {
      modalInstance.value?.changeLoading?.(loading);
    },
  };

  return [register, methods];
}
