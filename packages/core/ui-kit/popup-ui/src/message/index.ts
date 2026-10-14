/**
 * 轻提示：基于 vue-sonner（shadcn `Toaster` 的底层）。
 * 用法与旧 `message.success/error/info/warning` 对齐；应用需在根部挂载一次
 * `<Toaster />`（`@antdv/shadcn-ui` 导出）。
 */
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
