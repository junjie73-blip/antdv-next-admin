import type { Ref } from 'vue';

import type { ModalMethods, Nullable, UseModalReturnType } from './types';

import { nextTick, onUnmounted, ref } from 'vue';

import { delay } from 'es-toolkit';

export function useModal(): UseModalReturnType {
  const modalInstance: Ref<Nullable<ModalMethods>> = ref(null);

  // 与 useDrawer 同理：卸载钩子只能在 setup 同期注册。
  // `register` 是子组件 emit('register') 的回调，此刻 currentInstance 已经不可用。
  onUnmounted(() => {
    modalInstance.value = null;
  });

  const register = (instance: ModalMethods) => {
    modalInstance.value = instance;
  };

  const waitForInstance = async (): Promise<ModalMethods> => {
    if (modalInstance.value) return modalInstance.value;

    // 最多重试 10 次，每次 50ms（es-toolkit sleep 语义更清晰）
    for (let i = 0; i < 10; i++) {
      await nextTick();
      if (modalInstance.value) return modalInstance.value;
      await delay(50);
    }

    throw new Error(
      '[useModal] Modal instance not found. Please check if the Modal component is registered.',
    );
  };

  const methods: ModalMethods = {
    openModal: async (visible = true, data?: unknown) => {
      const instance = await waitForInstance();
      instance.openModal(visible, data);
    },
    closeModal: async () => {
      const instance = await waitForInstance();
      instance.closeModal();
    },
    setModalProps: async (props) => {
      const instance = await waitForInstance();
      instance.setModalProps(props);
    },
    getVisible: () => modalInstance.value?.getVisible() || false,
  };

  return [register, methods];
}
