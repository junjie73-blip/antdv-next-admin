import type { Ref } from 'vue'
import type { ModalMethods, Nullable, UseModalReturnType } from './types'
import { nextTick, onUnmounted, ref } from 'vue'

/**
 * useModal - 用于页面组件控制独立弹窗组件
 * @example
 * const [register, { openModal, closeModal, setModalProps }] = useModal()
 */
export function useModal(): UseModalReturnType {
  const modalInstance: Ref<Nullable<ModalMethods>> = ref(null)

  /**
   * 注册弹窗实例
   */
  const register = (instance: ModalMethods) => {
    modalInstance.value = instance

    // 监听组件卸载，清理实例
    onUnmounted(() => {
      modalInstance.value = null
    })
  }

  /**
   * 等待实例就绪
   */
  const waitForInstance = async (): Promise<ModalMethods> => {
    if (modalInstance.value) {
      return modalInstance.value
    }

    // 最多重试 10 次，每次等待 50ms
    for (let i = 0; i < 10; i++) {
      await nextTick()
      if (modalInstance.value) {
        return modalInstance.value
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    throw new Error('[useModal] Modal instance not found. Please check if the Modal component is registered.')
  }

  /**
   * 操作方法
   */
  const methods: ModalMethods = {
    openModal: async (visible = true, data?: any) => {
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
    getVisible: () => {
      return modalInstance.value?.getVisible() || false
    },
  }

  return [register, methods]
}
