/**
 * 轻提示：基于 vue-sonner（shadcn `Toaster` 的底层）。
 * 用法与旧 `message.success/error/info/warning` 对齐；应用需在根部挂载一次
 * `<Toaster />`（`@antdv/shadcn-ui` 导出）。
 */
// CSS 副作用导入的类型声明只能引用、不能复制：下游按源码消费本包时看不到 popup-ui 的 tsconfig include。
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../types/css.d.ts" />
import { toast } from 'vue-sonner';

import 'vue-sonner/style.css';

export const message = {
  error: (content: string, duration?: number) => toast.error(content, { duration }),
  info: (content: string, duration?: number) => toast.info(content, { duration }),
  loading: (content: string) => toast.loading(content),
  success: (content: string, duration?: number) => toast.success(content, { duration }),
  warning: (content: string, duration?: number) => toast.warning(content, { duration }),
};

export { toast };
