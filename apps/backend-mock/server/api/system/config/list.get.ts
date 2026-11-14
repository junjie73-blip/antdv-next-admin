import { CONFIG_PANELS, CONFIG_VALUES } from '../../../utils/db/monitor';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 系统配置：一次返回 7 个面板的字段定义与当前值，页面按定义渲染表单 */
export default defineMockRoute({
  handler() {
    return success(
      { panels: CONFIG_PANELS, values: CONFIG_VALUES },
      '获取系统配置成功',
    );
  },
  method: 'GET',
  path: '/system/config/list',
});
