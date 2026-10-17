/**
 * 轻提示与通知：都基于 vue-sonner（shadcn `Toaster` 的底层）。
 *
 * 用法与旧 `message.success/error/info/warning` 对齐；应用需要在根部挂**两只**
 * `<Toaster />`（`@antdv/shadcn-ui` 导出）：一只不带 `id`（轻提示，位置固定居中），
 * 一只 `:id="NOTIFICATION_TOASTER_ID"`（通知，位置由偏好 `notificationPosition` 决定）。
 *
 * 为什么分两只而不是给每条 toast 传 `position`：sonner 同一个位置只维护一个堆栈，
 * 轻提示与通知各自的出场位置、停留时长、堆叠上限是两回事，混进同一只 toaster
 * 就会互相顶位（一条通知把三条轻提示挤下去）。
 *
 * 路由规则（vue-sonner 2.0.9）：不带 `toasterId` 的 toast 只进**没有 id** 的那只，
 * 带了 `toasterId` 的只进同名的那只。所以 `message.*` 一律不传 ——
 * 宿主漏挂通知那只时轻提示仍然可见，反过来也不会串位。
 */
// CSS 副作用导入的类型声明只能引用、不能复制：下游按源码消费本包时看不到 popup-ui 的 tsconfig include。
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../types/css.d.ts" />
import { toast } from 'vue-sonner';

import 'vue-sonner/style.css';

/** 通知通道的 toaster id，宿主按这个名字挂第二只 `<Toaster />` */
export const NOTIFICATION_TOASTER_ID = 'notification';

export const message = {
  error: (content: string, duration?: number) =>
    toast.error(content, { duration }),
  info: (content: string, duration?: number) =>
    toast.info(content, { duration }),
  loading: (content: string) => toast.loading(content),
  success: (content: string, duration?: number) =>
    toast.success(content, { duration }),
  warning: (content: string, duration?: number) =>
    toast.warning(content, { duration }),
};

/** 通知：比轻提示多一条描述，并落到宿主单独定位的那只 toaster 上 */
export const notification = {
  error: (content: string, description?: string) =>
    toast.error(content, { description, toasterId: NOTIFICATION_TOASTER_ID }),
  info: (content: string, description?: string) =>
    toast.info(content, { description, toasterId: NOTIFICATION_TOASTER_ID }),
  success: (content: string, description?: string) =>
    toast.success(content, { description, toasterId: NOTIFICATION_TOASTER_ID }),
  warning: (content: string, description?: string) =>
    toast.warning(content, { description, toasterId: NOTIFICATION_TOASTER_ID }),
};

export { toast };
