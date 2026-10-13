import type { VNode } from 'vue';

import { h, render } from 'vue';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

export interface ConfirmOptions {
  cancelText?: string;
  content?: string | VNode;
  /** 确认按钮样式：danger 走 destructive（对应旧 okType: 'danger'） */
  danger?: boolean;
  onCancel?: () => Promise<void> | void;
  onOk?: () => Promise<void> | void;
  /** 是否显示取消按钮（alert() 场景为 false） */
  showCancel?: boolean;
  title: string;
  okText?: string;
}

function renderNode(node: string | undefined | VNode) {
  if (node === undefined) return null;
  return typeof node === 'string'
    ? h('p', { class: cn('text-muted-foreground text-sm') }, node)
    : node;
}

/**
 * 命令式确认框（AlertDialog 单例挂载），替代 antdv-next 的 `Modal.confirm`。
 * Promise 语义：确认 → onOk 完成后 resolve(true)；取消/ESC/蒙层 → resolve(false)。
 * onOk 抛错时弹层保持打开，等待用户重试或取消（与旧行为一致）。
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    content,
    okText = '确认',
    cancelText = '取消',
    danger = false,
    showCancel = true,
    onOk,
    onCancel,
  } = options;

  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.append(container);

    let settled = false;
    let closing = false;
    /** onOk 挂起期间，reka 的 Action 会先触发 update:open(false) 再触发 onClick，须防止取消路径抢先 resolve */
    let okPending = false;
    let cancelScheduled = false;

    /** 关闭信号延迟一个微任务再判定：Action 的 onClick 与 update:open 处于同一同步派发，onClick 在后 */
    const scheduleCancel = () => {
      if (cancelScheduled || settled) return;
      cancelScheduled = true;
      queueMicrotask(() => {
        cancelScheduled = false;
        if (settled || okPending) return;
        void handleCancel();
      });
    };

    const teardown = () => {
      if (closing) return;
      closing = true;
      render(null, container);
      container.remove();
    };

    const handleOk = async () => {
      okPending = true;
      try {
        await onOk?.();
      } catch {
        // onOk 失败保持打开，允许再次取消
        okPending = false;
        return;
      }
      settled = true;
      teardown();
      resolve(true);
    };

    const handleCancel = async () => {
      if (settled || okPending) return;
      settled = true;
      await onCancel?.();
      teardown();
      resolve(false);
    };

    const VNodeConfirm = () =>
      h(
        AlertDialog,
        { open: true, 'onUpdate:open': (val: boolean) => !val && scheduleCancel() },
        () =>
          [
            h(
              AlertDialogContent,
              { class: cn('sm:max-w-[416px]') },
              () => [
                h(AlertDialogHeader, () => [
                  h(AlertDialogTitle, () => title),
                  h(
                    AlertDialogDescription,
                    { class: content === undefined ? 'sr-only' : 'text-muted-foreground' },
                    () => (content === undefined ? title : renderNode(content)),
                  ),
                ]),
                h(AlertDialogFooter, () => [
                  showCancel
                    ? h(
                        AlertDialogCancel,
                        { onClick: handleCancel },
                        () => cancelText,
                      )
                    : null,
                  h(
                    AlertDialogAction,
                    {
                      class: danger
                        ? cn('bg-destructive text-white hover:bg-destructive/90')
                        : undefined,
                      onClick: (e: MouseEvent) => {
                        e.preventDefault();
                        void handleOk();
                      },
                    },
                    () => okText,
                  ),
                ]),
              ],
            ),
          ],
      );

    render(h(VNodeConfirm), container);
  });
}

/** 单按钮提示框，对应旧 `Modal.warning/error/info` 的用法 */
export function alert(
  options: Omit<ConfirmOptions, 'cancelText' | 'onCancel' | 'showCancel'> & {
    type?: 'error' | 'info' | 'success' | 'warning';
  },
) {
  const { type, ...rest } = options;
  return confirm({
    ...rest,
    showCancel: false,
    okText: options.okText ?? '知道了',
    danger: type === 'error',
  });
}
