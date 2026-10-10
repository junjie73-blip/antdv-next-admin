/**
 * 全局指令注册中心
 *
 * 指令的**实现**都在子包里，这里只负责把本项目的依赖注进去：
 * - `v-permission`：判定函数来自 `usePermission()`（pinia store），开发期日志走 `import.meta.env.DEV`
 * - `v-lazy`：图片懒加载，包内已带 IntersectionObserver 降级
 * - `v-safe-html` / `v-escape`：XSS 防护，来自 `@antdv/shared/xss`
 */

import { watch } from 'vue';

import { createPermissionDirective } from '@antdv/directives';
import { usePermission } from '~/composables/web/permission';
import { useUserStore } from '~/stores/modules/user';

export { createLazyDirective, vLazy } from '@antdv/directives';
export { escapeDirective, safeHtmlDirective } from '@antdv/shared/xss';

export const vPermission = createPermissionDirective({
  /**
   * 惰性取 store：这个模块在 `main.ts` 里被 import，
   * 那时 pinia 还没挂到 app 上，直接 `usePermission()` 会抛 no active pinia。
   */
  checkers: () => usePermission(),
  onCheck: (context) => {
    if (import.meta.env.DEV) {
      console.log('[v-permission]', context);
    }
  },
  /**
   * 权限列表是登录后异步回填的：订阅它，指令才会在数据到位后自己翻正。
   * 返回的 stop 函数由指令在 unmounted 时调用，不留悬垂 watch。
   */
  subscribe: (notify) =>
    watch(() => useUserStore().permissions, notify, { deep: true }),
});
