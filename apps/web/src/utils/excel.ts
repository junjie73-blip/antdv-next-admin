import type { ExportOptions } from '@antdv/shared/utils/excel';

import { message } from '@antdv/popup-ui';
import { exportToExcel as downloadExcel } from '@antdv/shared/utils/excel';

/**
 * 应用侧的导出包装：`@antdv/shared` 只提供纯逻辑（基础包不依赖组件库），
 * "有没有导出成功"这句话由界面层来说。
 */
export function exportToExcel(options: ExportOptions): void {
  const rowCount = options.data?.length ?? 0;
  if (!downloadExcel(options)) {
    message.warning('没有可导出的数据');
    return;
  }
  message.success(`成功导出 ${rowCount} 条数据`);
}
