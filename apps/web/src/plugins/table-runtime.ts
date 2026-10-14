import { message } from '@antdv/popup-ui';
import { configureTable } from '@antdv/table-ui';
import { usePermission } from '~/composables/web/permission';
import { resolveErrorMessage } from '~/composables/web/request/fetcher';

/**
 * 表格组件要认权限、要报接口错误，这两件事只有应用知道，所以从包里注入。
 * 与 `configureUiKitRuntimes()` 分开：本文件会把 `~/composables` 拖进模块图，
 * 只能由入口调用，测试 setup 碰了会让别人的 `vi.mock` 失效。
 */
export function configureTableRuntime(): void {
  // 权限要等 pinia 装好才有 store，所以放进回调里现取
  let permission: ReturnType<typeof usePermission>;
  const getPermission = () => (permission ??= usePermission());

  configureTable({
    checkAnyAuth: (codes) => getPermission().hasAnyPermission(codes),
    checkAuth: (code) => getPermission().hasPermission(code),
    notifyError: (content) => message.error(content),
    resolveErrorMessage: (error, fallback) =>
      resolveErrorMessage(error, fallback),
  });
}
