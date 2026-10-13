/**
 * 运行时注入点：让 table-ui 不依赖具体应用。
 *
 * - `resolveErrorMessage`：把接口异常翻译成人话（web 侧注入自己的实现，
 *   认识 `{ code, msg }` 信封）；
 * - `notifyError`：错误提示通道（默认走 popup-ui 的 vue-sonner toast）；
 * - `checkAuth` / `checkAnyAuth`：操作列权限（默认放行，web 侧注入 usePermission）。
 */
import { message } from '@antdv/popup-ui';

export interface TableUIRuntime {
  checkAnyAuth: (codes: string[]) => boolean;
  checkAuth: (code: string) => boolean;
  notifyError: (content: string) => void;
  resolveErrorMessage: (error: unknown, fallback: string) => string;
}

function defaultResolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export const tableRuntime: TableUIRuntime = {
  checkAnyAuth: () => true,
  checkAuth: () => true,
  notifyError: (content: string) => message.error(content),
  resolveErrorMessage: defaultResolveErrorMessage,
};

/** 应用启动时调用一次，注入自己的错误提示与权限判断 */
export function configureTable(options: Partial<TableUIRuntime>): void {
  Object.assign(tableRuntime, options);
}
