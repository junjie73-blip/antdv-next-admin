import { delay } from 'es-toolkit'
import { nextTick, onUnmounted, ref, type Ref } from 'vue'

import type { ModalMethods, Nullable, UseModalReturnType } from './types'

export function useModal(): UseModalReturnType {
  const modalInstance: Ref<Nullable<ModalMethods>> = ref(null)

  const register = (instance: ModalMethods) => {
    modalInstance.value = instance
    onUnmounted(() => {
      modalInstance.value = null
    })
  }

  const waitForInstance = async (): Promise<ModalMethods> => {
    if (modalInstance.value) return modalInstance.value

    // 最多重试 10 次，每次 50ms（es-toolkit sleep 语义更清晰）
    for (let i = 0; i < 10; i++) {
      await nextTick()
      if (modalInstance.value) return modalInstance.value
      await delay(50)
    }

    throw new Error(
      '[useModal] Modal instance not found. Please check if the Modal component is registered.',
    )
  }

  const methods: ModalMethods = {
    openModal: async (visible = true, data?: unknown) => {
      const instance = await waitForInstance()
      instance.openModal(visible, data)
    },
    closeModal: async () => {
      const instance = await waitForInstance()
      instance.closeModal()
    },
    setModalProps: async (props) => {
      const instance = await waitForInstance()
      instance.setModalProps(props)
    },
    getVisible: () => modalInstance.value?.getVisible() || false,
  }

  return [register, methods]
}
