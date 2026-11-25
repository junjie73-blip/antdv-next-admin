/**
 * 页面能力注册表：页面把自己持有的表格/表单句柄登记到这里，Copilot 打开时按路由取用。
 *
 * 这是「依赖注入」在应用层的落点：@antdv/ai-tools 只认 TableHandle / FormHandle 接口，
 * 不知道 BasicTable / BasicForm 的存在，也不知道 pinia / vue-router。
 */
import type { FormHandle, TableHandle } from '@antdv/ai-tools';

const tables = new Map<string, TableHandle>();
const forms = new Map<string, FormHandle>();

export function registerPageTable(routeName: string, handle: TableHandle) {
  tables.set(routeName, handle);
}

export function unregisterPageTable(routeName: string) {
  tables.delete(routeName);
}

export function registerPageForm(routeName: string, handle: FormHandle) {
  forms.set(routeName, handle);
}

export function unregisterPageForm(routeName: string) {
  forms.delete(routeName);
}

export function pageTable(routeName: string): TableHandle | undefined {
  return tables.get(routeName);
}

export function pageForm(routeName: string): FormHandle | undefined {
  return forms.get(routeName);
}
