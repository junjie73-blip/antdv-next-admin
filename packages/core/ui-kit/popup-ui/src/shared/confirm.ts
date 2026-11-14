import type { ComponentInternalInstance } from 'vue';

/** 确认回调：同步或异步皆可，返回值不参与弹层的关闭决策 */
export type ConfirmHandler = (event: MouseEvent) => Promise<unknown> | unknown;

type MaybeHandler = ConfirmHandler | ConfirmHandler[] | undefined;

/**
 * 找出 `@ok` / `setModalProps({ onOk })` 注册的确认回调。
 *
 * Vue 的 `emit()` 内部走 `callWithAsyncErrorHandling`，listener 的返回值被吞掉，
 * 组件拿不到提交流程的 Promise。于是「点保存 → 校验失败 / 接口报错 → 没人把
 * confirmLoading 关掉」，按钮一直转圈且不可再次点击。确认流程必须自己取得
 * handler 并 `await`，把 loading 复位放进 `finally`。
 *
 * 取值细节：
 * - 声明在 `emits` 里的 listener 不进 `$attrs`，但仍留在 `instance.vnode.props.onOk`
 *   上（`emit` 自己也是从这里查的）。必须在 **setup 同期**把 instance 抓下来传给
 *   这里：事件回调执行时 `getCurrentInstance()` 已经是 null。
 * - `vnode` 会随父组件重渲染被替换，所以每次点击都重新读 `instance.vnode.props`，
 *   而不是在 setup 里把函数缓存成常量。
 * - 命令式 `setModalProps({ onOk })` / `setDrawerProps({ onOk })` 优先于模板 `@ok`，
 *   与 `merged = { ...props, ...propOverrides }` 的覆盖顺序一致。
 * - `v-on` 合并出来的 listener 可能是数组，逐个调用并一起等待。
 */
export function resolveConfirmHandler(
  explicit: ConfirmHandler | undefined,
  instance: ComponentInternalInstance | null,
): ConfirmHandler | undefined {
  const fromTemplate = (
    instance?.vnode.props as Record<string, unknown> | undefined
  )?.onOk;
  const raw = (explicit ?? fromTemplate) as MaybeHandler;

  if (typeof raw === 'function') return raw;
  if (Array.isArray(raw)) {
    const handlers = raw.filter(
      (fn): fn is ConfirmHandler => typeof fn === 'function',
    );
    if (handlers.length === 0) return undefined;
    return (event) => Promise.all(handlers.map((fn) => fn(event)));
  }
  return undefined;
}
