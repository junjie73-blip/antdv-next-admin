import type { Ref } from 'vue';

import type { DrawerMethods, Nullable, UseDrawerReturnType } from './types';

import { nextTick, onUnmounted, ref } from 'vue';

import { delay } from 'es-toolkit';

export function useDrawer(): UseDrawerReturnType {
  const drawerInstance: Ref<Nullable<DrawerMethods>> = ref(null);

  /**
   * 卸载钩子必须在 `useDrawer()` 被调用的那一刻注册，也就是父组件 setup 同期。
   *
   * 原来写在 `register` 里，而 `register` 是子组件 `emit('register', instance)` 的回调：
   * emit 发生在子组件自己的 setup 里，Vue 此时已经把 `currentInstance` 指向子组件
   * （回调执行期间甚至已经清空），于是既触发
   * 「onUnmounted is called when there is no active component instance」警告，
   * 又让钩子挂不到任何实例上 —— 抽屉实例永远留在引用里。
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
