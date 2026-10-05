import { delay } from 'es-toolkit'
import { nextTick, onUnmounted, ref, type Ref } from 'vue'

import type { DrawerMethods, Nullable, UseDrawerReturnType } from './types'

export function useDrawer(): UseDrawerReturnType {
  const drawerInstance: Ref<Nullable<DrawerMethods>> = ref(null)

  const register = (instance: DrawerMethods) => {
    drawerInstance.value = instance
    onUnmounted(() => {
      drawerInstance.value = null
    })
  }

  const waitForInstance = async (): Promise<DrawerMethods> => {
    if (drawerInstance.value) return drawerInstance.value

    for (let i = 0; i < 10; i++) {
      await nextTick()
      if (drawerInstance.value) return drawerInstance.value
      await delay(50)
    }

    throw new Error(
      '[useDrawer] Drawer instance not found. Please check if the Drawer component is registered.',
    )
  }

  const methods: DrawerMethods = {
    openDrawer: async (visible = true, data?: unknown) => {
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
    getVisible: () => drawerInstance.value?.getVisible() || false,
  }

  return [register, methods]
}
