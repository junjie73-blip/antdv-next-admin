import type { Ref } from 'vue';

import type { Nullable } from '../types';
import type { DrawerMethods, UseDrawerReturnType } from './types';

import { nextTick, onUnmounted, ref } from 'vue';

import { delay } from 'es-toolkit';

export function useDrawer(): UseDrawerReturnType {
  const drawerInstance: Ref<Nullable<DrawerMethods>> = ref(null);

  /**
   * 卸载钩子必须在 `useDrawer()` 被调用的那一刻注册，也就是父组件 setup 同期。
   * `register` 是子组件 `emit('register', instance)` 的回调，此时 currentInstance
   * 已指向子组件，在它里面调 onUnmounted 只会告警且挂不到任何实例上。
   */
  onUnmounted(() => {
    drawerInstance.value = null;
  });

  const register = (instance: DrawerMethods) => {
    drawerInstance.value = instance;
  };

  const waitForInstance = async (): Promise<DrawerMethods> => {
    if (drawerInstance.value) return drawerInstance.value;

    for (let i = 0; i < 10; i++) {
      await nextTick();
      if (drawerInstance.value) return drawerInstance.value;
      await delay(50);
    }

    throw new Error(
      '[useDrawer] Drawer instance not found. Please check if the Drawer component is registered.',
    );
  };

  const methods: DrawerMethods = {
    openDrawer: async (visible = true, data?: unknown) => {
      const instance = await waitForInstance();
      instance.openDrawer(visible, data);
    },
    closeDrawer: async () => {
      const instance = await waitForInstance();
      instance.closeDrawer();
    },
    setDrawerProps: async (props) => {
      const instance = await waitForInstance();
      instance.setDrawerProps(props);
    },
    getVisible: () => drawerInstance.value?.getVisible() || false,
  };

  return [register, methods];
}
