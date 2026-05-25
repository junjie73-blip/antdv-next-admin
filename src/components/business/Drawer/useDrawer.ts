import type { Ref } from 'vue'
import type { DrawerMethods, Nullable, UseDrawerReturnType } from './types'
import { nextTick, onUnmounted, ref } from 'vue'

/**
 * useDrawer - 用于页面组件控制独立抽屉组件
 * @example
 * const [register, { openDrawer, closeDrawer, setDrawerProps }] = useDrawer()
 */
export function useDrawer(): UseDrawerReturnType {
  const drawerInstance: Ref<Nullable<DrawerMethods>> = ref(null)

  /**
   * 注册抽屉实例
   */
  const register = (instance: DrawerMethods) => {
    drawerInstance.value = instance

    // 监听组件卸载，清理实例
    onUnmounted(() => {
      drawerInstance.value = null
    })
  }

  /**
   * 等待实例就绪
   */
  const waitForInstance = async (): Promise<DrawerMethods> => {
    if (drawerInstance.value) {
      return drawerInstance.value
    }

    // 最多重试 10 次，每次等待 50ms
    for (let i = 0; i < 10; i++) {
      await nextTick()
      if (drawerInstance.value) {
        return drawerInstance.value
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    throw new Error('[useDrawer] Drawer instance not found. Please check if the Drawer component is registered.')
  }

  /**
   * 操作方法
   */
  const methods: DrawerMethods = {
    openDrawer: async (visible = true, data?: any) => {
      const instance = await waitForInstance()
      instance.openDrawer(visible, data)
    },
    closeDrawer: async () => {
      const instance = await waitForInstance()
      instance.closeDrawer()
    },
    setDrawerProps: async (props) => {
      const instance = await waitForInstance()
      instance.setDrawerProps(props)
    },
    getVisible: () => {
      return drawerInstance.value?.getVisible() || false
    },
  }

  return [register, methods]
}
