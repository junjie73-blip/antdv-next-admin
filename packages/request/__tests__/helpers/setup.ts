import { createApp, defineComponent, h } from 'vue';

export interface SetupResult<T> {
  result: T;
  root: HTMLElement;
  unmount: () => void;
}

/**
 * 在一个真实组件作用域里执行 composable。
 *
 * `useSSE` 靠 `onUnmounted` 关连接，裸调用只会拿到 Vue 的
 * "onUnmounted is called when there is no active component instance" 警告，
 * 生命周期分支永远覆盖不到。这里用一个匿名组件 + createApp 把作用域搭起来。
 */
export function withSetup<T>(composable: () => T): SetupResult<T> {
  let result!: T;

  const Wrapper = defineComponent({
    setup() {
      result = composable();
      return () => h('div');
    },
  });

  const root = document.createElement('div');
  document.body.append(root);

  const app = createApp(Wrapper);
  app.mount(root);

  return {
    result,
    root,
    unmount: () => {
      app.unmount();
      root.remove();
    },
  };
}
