import { createApp, defineComponent, h, nextTick } from 'vue';

export interface SetupResult<T> {
  result: T;
  root: HTMLElement;
  unmount: () => void;
}

/**
 * 在一个真实组件作用域里执行 composable。
 *
 * onMounted / onUnmounted / tryOnScopeDispose / watch 都依赖组件实例，
 * 裸调用只会拿到 Vue 的 "onMounted is called when there is no active component" 警告，
 * 测试也就永远覆盖不到生命周期分支。这里用一个匿名组件 + createApp 把作用域搭起来。
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

/** 等一轮微任务 + watcher flush */
export async function flush(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

/**
 * 伪造一个足够 useChunkUpload 使用的 File。
 *
 * 不依赖 happy-dom 的 File/Blob.arrayBuffer 实现：不同版本行为不一致，
 * 而这个 hook 只用到 `size` 和 `slice().arrayBuffer()` 两件事。
 */
export function fakeFile(size: number, name = 'fake.bin'): File {
  const slice = (start?: number, end?: number) => {
    const from = start ?? 0;
    const to = end ?? size;
    return {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(Math.max(0, to - from))),
      size: Math.max(0, to - from),
    };
  };

  return {
    name,
    size,
    type: '',
    slice: (start?: number, end?: number) =>
      slice(start, Math.min(end ?? size, size)) as unknown as Blob,
  } as unknown as File;
}

/** 伪造一个 worker：记录 postMessage，并暴露触发 message 的入口 */
export function fakeWorker() {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const posted: unknown[] = [];
  let terminated = 0;

  const worker = {
    addEventListener(type: string, handler: (event: MessageEvent) => void) {
      if (type === 'message') listeners.push(handler);
    },
    postMessage(data: unknown) {
      posted.push(data);
    },
    terminate() {
      terminated += 1;
    },
  };

  return {
    emitted: () => terminated,
    postMessage: posted,
    worker: worker as unknown as Worker,
    /** 模拟 worker 回消息 */
    send(data: unknown) {
      const event = { data } as MessageEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}
