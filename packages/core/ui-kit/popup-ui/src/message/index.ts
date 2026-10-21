/**
 * 轻提示与通知：同一个内核的两条通道，都基于 vue-sonner。
 *
 * 用法与旧 `message.success/error/info/warning` 对齐；应用需要在根部挂**两只**
 * `<Toaster />`（`@antdv/common-ui` 导出的主题化外壳）：一只不带 `id`（轻提示，位置固定居中），
 * 一只 `:id="NOTIFICATION_TOASTER_ID"`（通知，位置由偏好 `notificationPosition` 决定）。
 * 两只都**不**开 `close-button`：手动关闭是单条的决定，由第三个参数的 `closeButton` 开，
 * 不传就没有 ✕（两条通道口径一致，短文案挂个按钮只是噪声）。
 *
 * 为什么分两只而不是给每条 toast 传 `position`：sonner 同一个位置只维护一个堆栈，
 * 轻提示与通知各自的出场位置、堆叠上限是两回事，混进同一只 toaster
 * 就会互相顶位（一条通知把三条轻提示挤下去）。
 *
 * 路由规则（vue-sonner 2.0.9）：不带 `toasterId` 的 toast 只进**没有 id** 的那只，
 * 带了 `toasterId` 的只进同名的那只。所以轻提示那侧一律不传 ——
 * 宿主漏挂通知那只时轻提示仍然可见，反过来也不会串位。
 *
 * 两条通道的 API 形状完全一致（`show(type, content, init?)` + `loading` + `close`），
 * 差别只有两处，都由 `createFeedback` 的入参决定：
 * 1. `toasterId` —— 决定落到哪只 toaster；
 * 2. 内容上通知通常多带一行 `description`（第二参数给字符串即可，轻提示也能用，不是硬限制）。
 * 停留时长、清除逻辑、状态徽标与手动关闭走的是同一份代码，
 * 所以「通知 3 秒自己走、点 ✕ 立刻收」与轻提示的行为不会有第二套实现去漂移。
 */
// CSS 副作用导入的类型声明只能引用、不能复制：下游按源码消费本包时看不到 popup-ui 的 tsconfig include。
// oxlint-disable-next-line typescript/triple-slash-reference
// / <reference path="../types/css.d.ts" />
import type { ExternalToast } from 'vue-sonner';

import { toast } from 'vue-sonner';
import 'vue-sonner/style.css';

/** 通知通道的 toaster id，宿主按这个名字挂第二只 `<Toaster />` */
export const NOTIFICATION_TOASTER_ID = 'notification';

/**
 * 默认停留时长：两条通道共用一个值。
 *
 * 沿用旧 `message` 的 3 秒 —— 够读完一行标题加一行描述，又不至于挡路。
 * 之前通知单独给 8 秒，理由是"挂了常驻关闭按钮就不能短到按钮还没看清就消失"，
 * 但实际后果是同一段文案在两条通道上停留时间不一样，用户读完还得等它自己走；
 * 关闭按钮该不该给由单条的 `closeButton` 决定（见 `ToastInit`），不该反向决定时长。
 */
const TOAST_DURATION = 3000;

/** 四种带状态徽标的类型，内核与 `toast` 上的方法名一一对应 */
type ToastType = 'error' | 'info' | 'success' | 'warning';

/** vue-sonner 的 toast 标识（库里没导出同名类型，按它的返回值声明） */
export type ToastId = number | string;

/** 第三个参数的对象写法 */
export interface ToastInit {
  /** 副文本：通知一般用得上，轻提示一般不用 */
  description?: string;
  /** 本次的停留时长，不传走 `TOAST_DURATION` */
  duration?: number;
  /**
   * 这一条要不要挂手动关闭的 ✕，**两条通道共用这一个开关**。
   *
   * 不传就没有按钮：宿主那两只 `<Toaster>` 不再整体开 `close-button`，
   * 默认状态由"这条内容需不需要用户手动收掉"决定，而不是由通道决定。
   * 传 `false` 与不传不是一回事 —— sonner 的取值是
   * `toast.closeButton ?? toaster.closeButton`，显式 `false` 能在宿主整体开启时
   * 关掉单条，不传则是把决定权留给宿主。
   */
  closeButton?: boolean;
}

/**
 * 内容之外的可选项，收三种写法：
 * 数字 = 停留时长（与旧 `message.error(text, 1500)` 完全兼容），
 * 字符串 = 描述（与旧 `notification.info(title, desc)` 完全兼容），
 * 对象 = 三者都给（`description` / `duration` / `closeButton`）。
 *
 * 之所以压成一个参数而不是 `(content, description, duration)`：两条通道要用
 * **同一个签名**才谈得上"共用一份实现"，而 `notification` 从来不需要只改时长
 * 不写描述，`(content, , 2000)` 这种写法不该出现在 API 里。
 * `closeButton` 只走对象写法：简写那两档已经有含义，再往里塞开关只会让人猜。
 */
export type ToastInitInput = number | string | ToastInit;

/** 把三种简写归一成 `{ closeButton, description, duration }`，认不出的写法（没传）就当空对象 */
function normalizeInit(init: ToastInitInput | undefined): ToastInit {
  if (typeof init === 'number') return { duration: init };
  if (typeof init === 'string') return { description: init };
  return init ?? {};
}

/** 组装发给 sonner 的载荷，并且**只写有值的键** */
function toToastOptions(
  init: ToastInitInput | undefined,
  toasterId?: string,
): ExternalToast {
  const { closeButton, description, duration } = normalizeInit(init);
  const options: ExternalToast = { duration: duration ?? TOAST_DURATION };
  if (description !== undefined) options.description = description;
  if (closeButton !== undefined) options.closeButton = closeButton;
  if (toasterId !== undefined) options.toasterId = toasterId;
  return options;
}

/**
 * 一条通道的实现。`toasterId` 省略时落到没有 id 的那只 toaster（轻提示）。
 */
function createFeedback(toasterId?: string) {
  const show = (type: ToastType, content: string, init?: ToastInitInput) =>
    toast[type](content, toToastOptions(init, toasterId));

  return {
    /** 关闭单条；`id` 是这几个方法调用时的返回值 */
    close: (id: ToastId) => toast.dismiss(id),
    /**
     * 清空当前队列。sonner 的 `dismiss()` 不分 toaster，
     * 所以这一句会把两只里的 toast 一起收掉 —— 需要留某条时用 `close(id)`。
     */
    closeAll: () => toast.dismiss(),
    error: (content: string, init?: ToastInitInput) =>
      show('error', content, init),
    info: (content: string, init?: ToastInitInput) =>
      show('info', content, init),
    /**
     * 加载提示不设 `duration`：sonner 的 loading 默认常驻，直到 `close(id)`
     * 或用它返回的 id 换成别的方法（`toast.loading` → 后续 `toast.success` 顶替是常见写法）。
     */
    loading: (content: string) =>
      toast.loading(content, toasterId === undefined ? {} : { toasterId }),
    success: (content: string, init?: ToastInitInput) =>
      show('success', content, init),
    warning: (content: string, init?: ToastInitInput) =>
      show('warning', content, init),
  };
}

/** 轻提示：顶部居中的那只 toaster，短文案 */
export const message = createFeedback();

/** 通知：`:id="NOTIFICATION_TOASTER_ID"` 的那只 toaster，位置跟随偏好，通常多一行描述 */
export const notification = createFeedback(NOTIFICATION_TOASTER_ID);

export { toast };
